import { Prisma, type ClaimOrigin } from "../../../generated/prisma/index.js";
import { db } from "../../../prisma/prisma.js";
import { publishNotificationEvent } from "../notifications/notification.service.js";
import { reserveClaimNumber } from "./claim.numbers.js";
import {
  ackClaimFacts,
  claimSyncState,
  claimTypeFor,
  grnClaimFacts,
  groupLinesByLr,
  hasClaimableLoss,
  planClaimSync,
  syncEventPayload,
  type ClaimSourceFacts,
} from "./claim.sync.compute.js";

/**
 * C2 — raise and maintain claims from damage/shortage on an LR
 * acknowledgement or GRN. Each sync runs AFTER the source document's own
 * write has committed, re-reads the source, and decides (claim.sync.compute)
 * whether to create, update, cancel, reopen or only note the claim.
 *
 * The exported functions never throw: a claim failure must not fail saving
 * the ack/GRN, so errors are logged instead.
 */

const lrContextSelect = {
  id: true,
  lrNumber: true,
  group: {
    select: {
      originBranchId: true,
      consignorId: true,
      originBranch: { select: { branchCode: true } },
    },
  },
} satisfies Prisma.LorryReceiptSelect;
type LRContext = Prisma.LorryReceiptGetPayload<{ select: typeof lrContextSelect }>;

const existingClaimSelect = {
  id: true,
  version: true,
  status: true,
  events: {
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { toStatus: true, payload: true },
  },
} satisfies Prisma.ClaimSelect;
type ExistingClaim = Prisma.ClaimGetPayload<{ select: typeof existingClaimSelect }>;

type SyncInput = {
  origin: Exclude<ClaimOrigin, "MANUAL">;
  /** Source document id; null once the source is gone (undone ack). */
  originRefId: string | null;
  /** How timeline notes name the source, e.g. "the LR acknowledgement". */
  sourceLabel: string;
  /** Timeline note when the source itself is gone, e.g. "LR acknowledgement was undone". */
  goneNote?: string;
  lr: LRContext;
  /** Null when the source is gone or cancelled. */
  facts: ClaimSourceFacts | null;
  claimDate: Date;
  existing: ExistingClaim | null;
  actorId: string;
};

const quantities = (facts: ClaimSourceFacts) =>
  `damaged ${facts.damagedQty}, short ${facts.shortageQty}`;

/** Claim columns that come from the source. Caused-by and the amount are only
 *  overwritten when the source has them. */
const sourceFields = (facts: ClaimSourceFacts) => ({
  claimType: claimTypeFor(facts),
  damagedQty: facts.damagedQty,
  shortageQty: facts.shortageQty,
  ...(facts.causedBy ? { causedBy: facts.causedBy } : {}),
  ...(facts.damageAmountPaise !== null ? { claimedAmountPaise: facts.damageAmountPaise } : {}),
});

const itemRows = (facts: ClaimSourceFacts) =>
  facts.lines.map((line) => ({
    lrGoodsId: line.lrGoodsId,
    goodsName: line.goodsName,
    damagedQty: line.damagedQty,
    shortageQty: line.shortageQty,
  }));

const applyClaimSync = async (input: SyncInput): Promise<void> => {
  const { existing, facts, actorId, sourceLabel, lr } = input;
  const action = planClaimSync(existing ? claimSyncState(existing) : null, facts);
  const payload = syncEventPayload(facts);
  const loss = hasClaimableLoss(facts) ? facts : null;
  const lossGoneNote = input.facts === null && input.goneNote
    ? input.goneNote
    : `Damage and shortage removed from ${sourceLabel}`;

  switch (action) {
    case "NONE":
      return;

    case "CREATE": {
      if (!loss || !input.originRefId) return;
      const { claimNumber, fyCode } = await reserveClaimNumber(
        db,
        lr.group.originBranch.branchCode,
        input.claimDate,
      );
      const claim = await db.claim.create({
        data: {
          claimNumber,
          fyCode,
          claimDate: input.claimDate,
          branchId: lr.group.originBranchId,
          lrId: lr.id,
          customerId: lr.group.consignorId,
          origin: input.origin,
          originRefId: input.originRefId,
          ...sourceFields(loss),
          createdById: actorId,
          items: { create: itemRows(loss) },
          events: {
            create: {
              eventType: "CREATED",
              toStatus: "PENDING",
              note: `Raised from ${sourceLabel}: ${quantities(loss)}`,
              payload,
              actorId,
            },
          },
        },
        select: { id: true, claimNumber: true },
      });
      await publishNotificationEvent({
        eventType: "claim.created",
        sourceModule: "claim",
        aggregateType: "Claim",
        aggregateId: claim.id,
        branchId: lr.group.originBranchId,
        actorId,
        payload: {
          claimNumber: claim.claimNumber,
          lrNumber: lr.lrNumber,
          linkUrl: `/claims/${claim.id}`,
        },
        dedupeKey: `claim.created:${claim.id}`,
      });
      return;
    }

    case "UPDATE":
    case "REOPEN": {
      if (!existing || !loss) return;
      const reopen = action === "REOPEN";
      await db.$transaction([
        db.claimItem.deleteMany({ where: { claimId: existing.id } }),
        db.claim.update({
          where: { id: existing.id, version: existing.version },
          data: {
            ...sourceFields(loss),
            ...(input.originRefId ? { originRefId: input.originRefId } : {}),
            ...(reopen ? { status: "PENDING", cancelReason: null } : {}),
            updatedById: actorId,
            version: { increment: 1 },
            items: { create: itemRows(loss) },
            events: {
              create: reopen
                ? {
                  eventType: "STATUS_CHANGED",
                  fromStatus: "CANCELLED",
                  toStatus: "PENDING",
                  note: `Damage recorded again on ${sourceLabel}: ${quantities(loss)}`,
                  payload,
                  actorId,
                }
                : {
                  eventType: "UPDATED",
                  note: `Updated from ${sourceLabel}: ${quantities(loss)}`,
                  payload,
                  actorId,
                },
            },
          },
          select: { id: true },
        }),
      ]);
      return;
    }

    case "CANCEL": {
      if (!existing) return;
      await db.claim.update({
        where: { id: existing.id, version: existing.version },
        data: {
          status: "CANCELLED",
          cancelReason: lossGoneNote,
          updatedById: actorId,
          version: { increment: 1 },
          events: {
            create: {
              eventType: "STATUS_CHANGED",
              fromStatus: "PENDING",
              toStatus: "CANCELLED",
              note: lossGoneNote,
              payload,
              actorId,
            },
          },
        },
        select: { id: true },
      });
      return;
    }

    case "NOTE": {
      if (!existing) return;
      await db.claimEvent.create({
        data: {
          claimId: existing.id,
          eventType: "SOURCE_CHANGED",
          note: loss
            ? `Source document changed after assessment — ${sourceLabel} now says ${quantities(loss)}`
            : `Source document changed after assessment — ${lossGoneNote}`,
          payload,
          actorId,
        },
      });
      return;
    }
  }
};

const isUniqueViolation = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";

/**
 * Logs instead of throwing. `sync` re-reads everything it needs, so a
 * unique-key race with a parallel save of the same document is retried once
 * and then finds (and updates) the other request's claim.
 */
const runClaimSync = async (label: string, sync: () => Promise<void>): Promise<void> => {
  try {
    await sync();
  } catch (error) {
    if (isUniqueViolation(error)) {
      try {
        await sync();
        return;
      } catch (retryError) {
        console.error(`[claims] Claim sync for ${label} failed`, retryError);
        return;
      }
    }
    console.error(`[claims] Claim sync for ${label} failed`, error);
  }
};

/* ------------------------------------------------------------------ */
/* Sources                                                             */
/* ------------------------------------------------------------------ */

/** After an LR acknowledgement is created, edited or undone. Never throws. */
export const syncLRAckClaim = (lrId: string, actorId: string) =>
  runClaimSync(`LR ${lrId} acknowledgement`, async () => {
    const lr = await db.lorryReceipt.findUnique({
      where: { id: lrId },
      select: {
        ...lrContextSelect,
        goods: { select: { id: true, name: true, quantity: true } },
        acknowledgement: {
          select: {
            id: true,
            receivedAt: true,
            damageAmount: true,
            items: { select: { lrGoodsId: true, receivedQty: true, damagedQty: true } },
          },
        },
      },
    });
    if (!lr) return;
    // One acknowledgement claim per LR: undo + re-acknowledge reuses it.
    const existing = await db.claim.findFirst({
      where: { origin: "LR_ACK", lrId, deletedAt: null },
      orderBy: { createdAt: "desc" },
      select: existingClaimSelect,
    });
    const ack = lr.acknowledgement;
    await applyClaimSync({
      origin: "LR_ACK",
      originRefId: ack?.id ?? null,
      sourceLabel: "the LR acknowledgement",
      goneNote: "LR acknowledgement was undone",
      lr,
      facts: ack
        ? ackClaimFacts({
          goods: lr.goods,
          items: ack.items.map((item) => ({
            lrGoodsId: item.lrGoodsId,
            receivedQty: item.receivedQty?.toNumber() ?? null,
            damagedQty: item.damagedQty?.toNumber() ?? null,
          })),
          damageAmountPaise: ack.damageAmount,
        })
        : null,
      claimDate: ack?.receivedAt ?? new Date(),
      existing,
      actorId,
    });
  });

/** After a GRN at rail head is edited, submitted or cancelled. Drafts never raise claims. Never throws. */
export const syncGRNClaim = (grnId: string, actorId: string) =>
  runClaimSync(`GRN ${grnId}`, async () => {
    const grn = await db.gRN.findUnique({
      where: { id: grnId },
      select: {
        id: true,
        grnNumber: true,
        status: true,
        deletedAt: true,
        damagesBy: true,
        inDateTime: true,
        goods: {
          select: { lrGoodsId: true, goodsName: true, damageQty: true, shortageQty: true },
        },
        lorryReceipt: { select: lrContextSelect },
      },
    });
    if (!grn || grn.status === "DRAFT") return;
    const live = grn.status === "SUBMITTED" && grn.deletedAt === null;
    const existing = await db.claim.findFirst({
      where: { origin: "GRN", originRefId: grn.id, lrId: grn.lorryReceipt.id },
      select: existingClaimSelect,
    });
    await applyClaimSync({
      origin: "GRN",
      originRefId: grn.id,
      sourceLabel: `GRN ${grn.grnNumber}`,
      goneNote: `GRN ${grn.grnNumber} was cancelled`,
      lr: grn.lorryReceipt,
      facts: live
        ? grnClaimFacts(
          grn.goods.map((line) => ({
            lrGoodsId: line.lrGoodsId,
            goodsName: line.goodsName,
            damagedQty: line.damageQty,
            shortageQty: line.shortageQty,
          })),
          grn.damagesBy,
        )
        : null,
      claimDate: grn.inDateTime ?? new Date(),
      existing,
      actorId,
    });
  });

/**
 * After a branch GRN is submitted or edited. A branch GRN covers one wagon,
 * which can carry several LRs: one claim per LR, each synced on its own so
 * one failure doesn't skip the rest. Never throws.
 */
export const syncRailBranchGRNClaims = (branchGrnId: string, actorId: string) =>
  runClaimSync(`branch GRN ${branchGrnId}`, async () => {
    const grn = await db.railBranchGRN.findUnique({
      where: { id: branchGrnId },
      select: {
        id: true,
        status: true,
        damagesBy: true,
        submittedAt: true,
        inDateTime: true,
        items: {
          select: {
            goodsNameSnapshot: true,
            damageQty: true,
            shortageQty: true,
            vpLoadingGoods: {
              select: {
                grnGoods: {
                  select: { lrGoodsId: true, grn: { select: { lorryReceiptId: true } } },
                },
              },
            },
          },
        },
      },
    });
    if (!grn || grn.status !== "SUBMITTED") return;

    const linesByLr = groupLinesByLr(
      grn.items.map((item) => ({
        lrId: item.vpLoadingGoods.grnGoods.grn.lorryReceiptId,
        lrGoodsId: item.vpLoadingGoods.grnGoods.lrGoodsId,
        goodsName: item.goodsNameSnapshot,
        damagedQty: item.damageQty,
        shortageQty: item.shortageQty,
      })),
    );
    // LRs that had a claim from this GRN but no longer have loss still need a sync (to cancel).
    const claimedLrs = await db.claim.findMany({
      where: { origin: "RAIL_BRANCH_GRN", originRefId: grn.id },
      select: { lrId: true },
    });
    const lrIds = [...new Set([...linesByLr.keys(), ...claimedLrs.map((claim) => claim.lrId)])];
    const lrs = await db.lorryReceipt.findMany({
      where: { id: { in: lrIds } },
      select: lrContextSelect,
    });

    for (const lr of lrs) {
      await runClaimSync(`branch GRN ${grn.id}, LR ${lr.lrNumber}`, async () => {
        const existing = await db.claim.findFirst({
          where: { origin: "RAIL_BRANCH_GRN", originRefId: grn.id, lrId: lr.id },
          select: existingClaimSelect,
        });
        await applyClaimSync({
          origin: "RAIL_BRANCH_GRN",
          originRefId: grn.id,
          sourceLabel: "the branch GRN",
          lr,
          facts: grnClaimFacts(linesByLr.get(lr.id) ?? [], grn.damagesBy),
          claimDate: grn.submittedAt ?? grn.inDateTime ?? new Date(),
          existing,
          actorId,
        });
      });
    }
  });
