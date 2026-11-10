import {
  addClaimRecoverySchema,
  claimReasonSchema,
  receiveClaimRecoverySchema,
} from "@skerp/validators";
import type { ClaimFundingAccount } from "@skerp/types";
import { Prisma } from "../../../generated/prisma/index.js";
import { db } from "../../../prisma/prisma.js";
import { BadRequestError, ConflictError, NotFoundError } from "../../lib/error.js";
import { fyCodeFor } from "../_shared/doc-number.js";
import { claimGLLedger, postClaimRecoveryReceipt } from "../ledger/posting.service.js";
import {
  assertFundingMatchesMode,
  fundingAccounts,
} from "../driver-finance/driver-finance.service.js";
import {
  RECOVERED_ELSEWHERE,
  recoveryBlocker,
  transporterRecoveryBlocker,
  rupeesText,
} from "./claim.settle.compute.js";
import {
  STALE,
  assertVersion,
  committedRecoveriesPaise,
  isStaleUpdate,
  withVersionGuard,
  type ActionClaim,
} from "./claim.service.js";

/**
 * C5 — recovery lines: what we get back from whoever caused the damage.
 * FILED → APPROVED → RECEIVED (or REJECTED). Every step writes a ClaimEvent
 * and bumps the claim's version, so two people can't push the recoveries
 * past the loss at the same time.
 */

type AddInput = ReturnType<typeof addClaimRecoverySchema.parse>;
type ReceiveInput = ReturnType<typeof receiveClaimRecoverySchema.parse>;
type ReasonInput = ReturnType<typeof claimReasonSchema.parse>;

const SOURCE_TEXT: Record<AddInput["source"], string> = {
  INSURANCE: "insurance",
  TRANSPORTER: "transporter",
  DRIVER: "driver",
  LABOUR: "labour",
  RAILWAY: "railway",
  OTHER: "other",
};

/** The party master row must exist; returns its name for the timeline. */
const partyOf = async (input: AddInput): Promise<string> => {
  if (input.source === "TRANSPORTER") {
    const row = await db.transport.findUnique({ where: { id: input.transportId! }, select: { name: true } });
    if (!row) throw new NotFoundError("Transporter not found");
    return row.name;
  }
  if (input.source === "DRIVER") {
    const row = await db.driver.findUnique({ where: { id: input.driverId! }, select: { name: true } });
    if (!row) throw new NotFoundError("Driver not found");
    return row.name;
  }
  if (input.source === "LABOUR") {
    const row = await db.labour.findUnique({ where: { id: input.labourId! }, select: { name: true } });
    if (!row) throw new NotFoundError("Labour not found");
    return row.name;
  }
  return input.partyName!;
};

/** Record a recovery line (FILED). Non-rejected recoveries can't exceed the loss. */
export const addRecovery = async (claim: ActionClaim, input: AddInput, actorId: string) => {
  assertVersion(claim, input.version);
  const amountPaise = BigInt(input.amount);
  const blocker = recoveryBlocker(claim, committedRecoveriesPaise(claim), amountPaise);
  if (blocker) throw new BadRequestError(blocker);

  // Accounts, 2026-11-07: an own-fleet consignment has no transporter to
  // recover from, and a market one can only be recovered from the broker who
  // actually hauled it — not whichever broker was picked in the dialog.
  if (input.source === "TRANSPORTER") {
    const haulageBlocker = transporterRecoveryBlocker(claim.lr.group);
    if (haulageBlocker) throw new BadRequestError(haulageBlocker);
    if (input.transportId !== claim.lr.group.marketTransportId)
      throw new BadRequestError(
        `LR ${claim.lr.lrNumber} was hauled by a different transporter — recover from the one that carried it.`,
      );
  }
  const party = await partyOf(input);
  const last = await db.claimRecovery.aggregate({
    where: { claimId: claim.id },
    _max: { lineNo: true },
  });
  const lineNo = (last._max.lineNo ?? 0) + 1;

  await withVersionGuard(() =>
    db.claim.update({
      where: { id: claim.id, version: claim.version },
      data: {
        updatedById: actorId,
        version: { increment: 1 },
        recoveries: {
          create: {
            lineNo,
            source: input.source,
            transportId: input.source === "TRANSPORTER" ? input.transportId : null,
            driverId: input.source === "DRIVER" ? input.driverId : null,
            labourId: input.source === "LABOUR" ? input.labourId : null,
            partyName: input.partyName ?? null,
            amountPaise,
            referenceNo: input.referenceNo ?? null,
            remarks: input.remarks ?? null,
            createdById: actorId,
          },
        },
        events: {
          create: {
            eventType: "RECOVERY_ADDED",
            note: `Recovery R${lineNo}: ${rupeesText(amountPaise)} from ${party} (${SOURCE_TEXT[input.source]})${input.referenceNo ? `, ref. ${input.referenceNo}` : ""}`,
            actorId,
          },
        },
      },
      select: { id: true },
    }),
  );
};

const recoverySelect = {
  id: true,
  lineNo: true,
  source: true,
  status: true,
  version: true,
  amountPaise: true,
  partyName: true,
  referenceNo: true,
  transport: { select: { name: true } },
  driver: { select: { name: true } },
  labour: { select: { name: true } },
  journalEntryId: true,
  /** C6: the salary run a driver recovery is deducted on. */
  driverSalary: { select: { isActive: true, run: { select: { runNumber: true, status: true } } } },
} satisfies Prisma.ClaimRecoverySelect;

const loadRecovery = async (claim: ActionClaim, recoveryId: string) => {
  const recovery = await db.claimRecovery.findFirst({
    where: { id: recoveryId, claimId: claim.id },
    select: recoverySelect,
  });
  if (!recovery) throw new NotFoundError("Recovery line not found");
  const party =
    recovery.transport?.name ?? recovery.driver?.name ?? recovery.labour?.name ?? recovery.partyName ?? "—";
  return { ...recovery, label: `R${recovery.lineNo} (${rupeesText(recovery.amountPaise)} from ${party})` };
};

/** One recovery step + its ClaimEvent, as a single write that also bumps the claim. */
const recordStep = (
  claim: ActionClaim,
  recoveryId: string,
  data: Prisma.ClaimRecoveryUpdateWithoutClaimInput,
  note: string,
  actorId: string,
) =>
  withVersionGuard(() =>
    db.claim.update({
      where: { id: claim.id, version: claim.version },
      data: {
        updatedById: actorId,
        version: { increment: 1 },
        recoveries: { update: { where: { id: recoveryId }, data } },
        events: { create: { eventType: "RECOVERY_STATUS_CHANGED", note, actorId } },
      },
      select: { id: true },
    }),
  );

/** FILED → APPROVED: the party has agreed to pay. Counts against the net loss from now. */
export const approveRecovery = async (
  claim: ActionClaim,
  recoveryId: string,
  version: number,
  actorId: string,
) => {
  assertVersion(claim, version);
  const recovery = await loadRecovery(claim, recoveryId);
  if (recovery.status !== "FILED")
    throw new BadRequestError("Only a filed recovery can be approved");
  await recordStep(
    claim,
    recoveryId,
    { status: "APPROVED", version: { increment: 1 } },
    `Recovery ${recovery.label} approved`,
    actorId,
  );
};

/** FILED / APPROVED → REJECTED. Nothing was posted, so nothing is reversed. */
export const rejectRecovery = async (
  claim: ActionClaim,
  recoveryId: string,
  input: ReasonInput,
  actorId: string,
) => {
  assertVersion(claim, input.version);
  const recovery = await loadRecovery(claim, recoveryId);
  if (recovery.status !== "FILED" && recovery.status !== "APPROVED")
    throw new BadRequestError("Only a filed or approved recovery can be rejected");
  // C6: once a salary run deducted it, the run must be cancelled first; a
  // draft run just loses the line.
  const run = recovery.driverSalary?.isActive ? recovery.driverSalary.run : null;
  if (recovery.journalEntryId || (run && run.status !== "DRAFT"))
    throw new BadRequestError(
      `This recovery is already deducted in salary run ${run?.runNumber ?? ""} — cancel that run first`,
    );
  // C7: a transporter recovery on a vendor payment slip comes off the slip first.
  const slipLine = await db.vendorPaymentSlipLine.findFirst({
    where: { sourceType: "CLAIM_RECOVERY", sourceId: recovery.id, isActive: true },
    select: { slip: { select: { slipNumber: true } } },
  });
  if (slipLine)
    throw new BadRequestError(
      `This recovery is on vendor payment slip ${slipLine.slip.slipNumber} — take it off the slip (edit or cancel it) first`,
    );
  await recordStep(
    claim,
    recoveryId,
    {
      status: "REJECTED",
      rejectedReason: input.reason,
      ...(run ? { driverSalary: { disconnect: true } } : {}),
      version: { increment: 1 },
    },
    `Recovery ${recovery.label} rejected: ${input.reason}`,
    actorId,
  );
};

/**
 * FILED / APPROVED → RECEIVED: the money came in. Posts the receipt voucher
 * (Dr Cash-Bank / Cr DAMAGE_RECOVERY) in the same transaction. Transporter and
 * driver recoveries are deducted from their payments instead (C7 / C6).
 */
export const receiveRecovery = async (
  claim: ActionClaim,
  recoveryId: string,
  input: ReceiveInput,
  actorId: string,
) => {
  assertVersion(claim, input.version);
  const recovery = await loadRecovery(claim, recoveryId);
  const elsewhere = RECOVERED_ELSEWHERE[recovery.source];
  if (elsewhere) throw new BadRequestError(`${elsewhere}, not marked received here`);
  if (recovery.status !== "FILED" && recovery.status !== "APPROVED")
    throw new BadRequestError("Only a filed or approved recovery can be marked received");

  // Reads before the transaction (CLAUDE.md "Database transactions").
  const accountName = await assertFundingMatchesMode(db, input.fundingLedgerId, input.paymentMode);
  const recoveryLedger = await claimGLLedger(db, "recovery");
  const narration = `Damage recovered — ${recovery.label}, ${SOURCE_TEXT[recovery.source]}, claim ${claim.claimNumber}, LR ${claim.lr.lrNumber}`;

  try {
    await db.$transaction(
      async (tx) => {
        const journal = await postClaimRecoveryReceipt(tx, {
          sourceId: recovery.id,
          voucherNumber: `${claim.claimNumber}/R${recovery.lineNo}`,
          voucherDate: input.receivedAt,
          fyCode: fyCodeFor(input.receivedAt),
          branchId: claim.branchId,
          fundingLedgerId: input.fundingLedgerId,
          glLedgerId: recoveryLedger.id,
          amountPaise: recovery.amountPaise,
          narration,
          createdById: actorId,
        });
        await tx.claim.update({
          where: { id: claim.id, version: claim.version },
          data: {
            updatedById: actorId,
            version: { increment: 1 },
            recoveries: {
              update: {
                where: { id: recovery.id },
                data: {
                  status: "RECEIVED",
                  receivedAt: input.receivedAt,
                  receiptMode: input.paymentMode,
                  receivedIntoLedgerId: input.fundingLedgerId,
                  referenceNo: input.referenceNo ?? recovery.referenceNo,
                  journalEntryId: journal.id,
                  version: { increment: 1 },
                },
              },
            },
            events: {
              create: {
                eventType: "RECOVERY_STATUS_CHANGED",
                note: `Recovery ${recovery.label} received into ${accountName} — voucher ${journal.voucherNumber}`,
                actorId,
              },
            },
          },
          select: { id: true },
        });
      },
      { timeout: 15000, maxWait: 10000 },
    );
  } catch (error) {
    if (isStaleUpdate(error)) throw new ConflictError(STALE);
    throw error;
  }
};

/** Cash / bank accounts a recovery can be received into. */
export const recoveryFundingAccounts = async (): Promise<ClaimFundingAccount[]> =>
  (await fundingAccounts()).map((account) => ({
    id: account.id,
    name: account.name,
    group: account.group,
    balancePaise: Number(account.balancePaise),
  }));
