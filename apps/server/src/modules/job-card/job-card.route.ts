import { Router } from "express";
import { PERMS } from "@skerp/types";
import {
  createJobCardSchema,
  updateJobCardSchema,
  finaliseJobCardSchema,
  createAndFinaliseJobCardSchema,
  cancelJobCardSchema,
  jobCardListQuerySchema,
  jobCardRepairCostQuerySchema,
  jobCardReconciliationQuerySchema,
  jobCardAuditQuerySchema,
  createJobCardRemovedPartSchema,
  jobCardRemovedPartListQuerySchema,
  undoFinaliseJobCardSchema,
} from "@skerp/validators";
import { db } from "../../../prisma/prisma.js";
import { authMiddleware } from "../../middlewares/auth.middlware.js";
import { can } from "../../auth/can.middleware.js";
import { branchFilter, assertBranchAccess } from "../../auth/branch-scope.js";
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
} from "../../lib/error.js";
import { sendOk } from "../_shared/response.js";
import { getParamId } from "../_shared/param.js";
import {
  fyCodeFor,
  formatDocNumber,
  nextSequence,
} from "../_shared/doc-number.js";
import { reverseJournal } from "../ledger/posting.service.js";
import { jobCardListSelect, jobCardListWhere } from "./job-card.query.js";

import { createRemovedPartTx } from "./job-card-removed-part.service.js";
import { finaliseJobCardTx } from "./job-card.service.js";
import { getJobCardRepairCosts } from "./job-card-report.service.js";
import { getJobCardReconciliation } from "./job-card-reconciliation.service.js";
import { createJobCardOnceTx } from "./job-card-create-request.service.js";
import { getJobCardAudit } from "./job-card-audit.service.js";

const router: Router = Router();
router.use(authMiddleware);

router.get(
  "/reports/audit",
  can(PERMS.WORKSHOP.JOBCARD_VIEW),
  can(PERMS.WORKSHOP.SERVICEBILL_VIEW),
  can(PERMS.LEDGER.VIEW),
  can(PERMS.ACCOUNTS.PAYMENT.VIEW),
  async (req, res) => {
    const query = jobCardAuditQuerySchema.parse(req.query);
    if (query.branchId) assertBranchAccess(req, query.branchId);
    sendOk(
      res,
      await getJobCardAudit(
        query,
        req.ctx?.branchScope === "ALL" ? null : (req.ctx?.branchIds ?? []),
      ),
    );
  },
);

router.get(
  "/reports/reconciliation",
  can(PERMS.WORKSHOP.JOBCARD_VIEW),
  can(PERMS.WORKSHOP.SERVICEBILL_VIEW),
  can(PERMS.LEDGER.VIEW),
  async (req, res) => {
    const query = jobCardReconciliationQuerySchema.parse(req.query);
    if (query.branchId) assertBranchAccess(req, query.branchId);
    const branchIds =
      req.ctx?.branchScope === "ALL" ? null : (req.ctx?.branchIds ?? []);
    sendOk(res, await getJobCardReconciliation(query, branchIds));
  },
);

router.get(
  "/reports/repair-costs",
  can(PERMS.WORKSHOP.JOBCARD_VIEW),
  async (req, res) => {
    const query = jobCardRepairCostQuerySchema.parse(req.query);
    if (query.branchId) assertBranchAccess(req, query.branchId);
    const branchIds =
      req.ctx?.branchScope === "ALL" ? null : (req.ctx?.branchIds ?? []);
    sendOk(res, await getJobCardRepairCosts(query, branchIds));
  },
);

const actorId = (req: { user?: { userId: string } }) => req.user!.userId;

const jobCardDetailInclude = {
  branch: { select: { id: true, name: true, branchCode: true } },
  vehicle: { select: { id: true, vehicleNumber: true } },
  driver: { select: { id: true, name: true } },
  createdBy: { select: { id: true, firstName: true, lastName: true } },
  partLines: {
    include: {
      sparePart: { select: { id: true, name: true, unit: true } },
      batch: { select: { id: true, batchNo: true, qtyRemaining: true } },
      mechanic: { select: { id: true, name: true } },
    },
  },
  serviceLines: {
    include: {
      sparePart: { select: { id: true, name: true } },
      serviceProvider: { select: { id: true, name: true } },
      mechanic: { select: { id: true, name: true } },
    },
  },
  journalEntry: {
    select: {
      id: true,
      voucherNumber: true,
      status: true,
      tallySyncStatus: true,
    },
  },
};

router.get("/", can(PERMS.WORKSHOP.JOBCARD_VIEW), async (req, res) => {
  const query = jobCardListQuerySchema.parse(req.query);
  const where = jobCardListWhere(branchFilter(req), query);
  const [jobCards, total] = await Promise.all([
    db.jobCard.findMany({
      where,
      select: jobCardListSelect,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: query.page * query.size,
      take: query.size,
    }),
    db.jobCard.count({ where }),
  ]);
  sendOk(res, jobCards, { page: query.page, size: query.size, total });
});

/**
 * Batches with stock remaining for a part at a branch — feeds the
 * batch-wise part picker (old ERP shows stock "invoice/batch-wise").
 * Oldest first, as a natural FIFO suggestion; the user still picks manually.
 */
router.get(
  "/lookup/batches",
  can(PERMS.WORKSHOP.JOBCARD_VIEW),
  async (req, res) => {
    const sparePartId = String(req.query.sparePartId ?? "");
    const branchId = String(req.query.branchId ?? "");
    if (!sparePartId || !branchId)
      throw new BadRequestError("sparePartId and branchId are required");
    assertBranchAccess(req, branchId);

    const batches = await db.spareBatch.findMany({
      where: { sparePartId, branchId, qtyRemaining: { gt: 0 } },
      select: {
        id: true,
        batchNo: true,
        qtyRemaining: true,
        unitCostPaise: true,
        warrantyExpiry: true,
        createdAt: true,
        inwardLine: {
          select: { inward: { select: { inwardNumber: true } } },
        },
      },
      orderBy: { createdAt: "asc" },
    });
    sendOk(
      res,
      batches.map((b) => ({
        id: b.id,
        batchNo: b.batchNo,
        qtyRemaining: b.qtyRemaining,
        unitCostPaise: b.unitCostPaise,
        warrantyExpiry: b.warrantyExpiry,
        // A batch with no inward line came from a Removed-Part reusable return,
        // not a fresh purchase — surfaced so the picker can label it.
        sourceInvoiceNumber: b.inwardLine?.inward.inwardNumber ?? null,
        source: b.inwardLine ? "PURCHASE" : "RETURN",
      })),
    );
  },
);

router.get("/:id", can(PERMS.WORKSHOP.JOBCARD_VIEW), async (req, res) => {
  const jobCard = await db.jobCard.findUnique({
    where: { id: getParamId(req) },
    include: jobCardDetailInclude,
  });
  if (!jobCard) throw new NotFoundError("Job card not found");
  assertBranchAccess(req, jobCard.branchId);
  sendOk(res, jobCard);
});

router.post("/", can(PERMS.WORKSHOP.JOBCARD_MANAGE), async (req, res) => {
  const input = createJobCardSchema.parse(req.body);
  assertBranchAccess(req, input.branchId);

  const branch = await db.branch.findUnique({
    where: { id: input.branchId },
    select: { branchCode: true },
  });
  if (!branch) throw new BadRequestError("Branch not found");

  const fyCode = fyCodeFor(input.inDateTime);

  const jobCard = await db.$transaction((tx) =>
    createJobCardOnceTx(tx, input, actorId(req), "DRAFT", async (identity) => {
      const seq = await nextSequence(tx, branch.branchCode, fyCode, "JC");
      const jobCardNumber = formatDocNumber(
        branch.branchCode,
        fyCode,
        seq,
        "SKT/JC",
      );

      return tx.jobCard.create({
        data: {
          ...identity,
          jobCardNumber,
          fyCode,
          branchId: input.branchId,
          vehicleId: input.vehicleId,
          driverId: input.driverId,
          truckStatus: input.truckStatus,
          inDateTime: input.inDateTime,
          openingKm: input.openingKm,
          remarks: input.remarks,
          createdById: actorId(req),
          partLines: {
            create: input.partLines.map((line) => ({
              sparePartId: line.sparePartId,
              batchId: line.batchId,
              mechanicId: line.mechanicId,
              qty: line.qty,
              unitCostPaise: 0n, // snapshotted from the batch at Finalise
              amountPaise: 0n,
              description: line.description,
            })),
          },
          serviceLines: {
            create: input.serviceLines.map((line) => ({
              serviceProviderId: line.serviceProviderId,
              sparePartId: line.sparePartId,
              mechanicId: line.mechanicId,
              qty: line.qty,
              ratePaise: line.ratePaise,
              amountPaise: line.ratePaise * BigInt(line.qty),
              description: line.description,
            })),
          },
        },
        select: { id: true },
      });
    }),
    { isolationLevel: "ReadCommitted" },
  );

  const created = await db.jobCard.findUnique({
    where: { id: jobCard.id },
    include: jobCardDetailInclude,
  });
  if (created) assertBranchAccess(req, created.branchId);
  sendOk(res, created, undefined, 201);
});

router.patch("/:id", can(PERMS.WORKSHOP.JOBCARD_MANAGE), async (req, res) => {
  const input = updateJobCardSchema.parse(req.body);
  const existing = await db.jobCard.findUnique({
    where: { id: getParamId(req) },
    select: { id: true, status: true, branchId: true, version: true },
  });
  if (!existing) throw new NotFoundError("Job card not found");
  if (existing.status !== "DRAFT")
    throw new BadRequestError("Only a DRAFT job card can be edited");
  assertBranchAccess(req, existing.branchId);
  assertBranchAccess(req, input.branchId ?? existing.branchId);

  await db.$transaction(async (tx) => {
    const claimed = await tx.jobCard.updateMany({
      where: { id: existing.id, status: "DRAFT", version: existing.version },
      data: { version: { increment: 1 } },
    });
    if (claimed.count !== 1)
      throw new ConflictError(
        "Job card changed. Refresh before editing again.",
      );
    if (input.partLines)
      await tx.jobCardPartLine.deleteMany({
        where: { jobCardId: existing.id },
      });
    if (input.serviceLines)
      await tx.jobCardServiceLine.deleteMany({
        where: { jobCardId: existing.id },
      });

    await tx.jobCard.update({
      where: { id: existing.id },
      data: {
        ...(input.branchId ? { branchId: input.branchId } : {}),
        ...(input.vehicleId ? { vehicleId: input.vehicleId } : {}),
        ...(input.driverId ? { driverId: input.driverId } : {}),
        ...(input.truckStatus ? { truckStatus: input.truckStatus } : {}),
        ...(input.inDateTime ? { inDateTime: input.inDateTime } : {}),
        ...(input.openingKm !== undefined
          ? { openingKm: input.openingKm }
          : {}),
        ...(input.remarks !== undefined ? { remarks: input.remarks } : {}),
        ...(input.partLines
          ? {
              partLines: {
                create: input.partLines.map((line) => ({
                  sparePartId: line.sparePartId,
                  batchId: line.batchId,
                  mechanicId: line.mechanicId,
                  qty: line.qty,
                  unitCostPaise: 0n,
                  amountPaise: 0n,
                  description: line.description,
                })),
              },
            }
          : {}),
        ...(input.serviceLines
          ? {
              serviceLines: {
                create: input.serviceLines.map((line) => ({
                  serviceProviderId: line.serviceProviderId,
                  sparePartId: line.sparePartId,
                  mechanicId: line.mechanicId,
                  qty: line.qty,
                  ratePaise: line.ratePaise,
                  amountPaise: line.ratePaise * BigInt(line.qty),
                  description: line.description,
                })),
              },
            }
          : {}),
      },
    });
  });

  const updated = await db.jobCard.findUnique({
    where: { id: existing.id },
    include: jobCardDetailInclude,
  });
  sendOk(res, updated);
});

/**
 * Create a brand-new job card and finalise it immediately, in one request
 * and one transaction — for the "job card is already done, just record it"
 * case. Previously the client made two sequential HTTP calls (create, then
 * finalise) for this; merged here so there's no in-between DRAFT state left
 * behind if the second call had failed.
 */
router.post(
  "/create-and-finalise",
  can(PERMS.WORKSHOP.JOBCARD_FINALISE),
  async (req, res) => {
    const input = createAndFinaliseJobCardSchema.parse(req.body);
    assertBranchAccess(req, input.branchId);

    const branch = await db.branch.findUnique({
      where: { id: input.branchId },
      select: { branchCode: true },
    });
    if (!branch) throw new BadRequestError("Branch not found");

    const fyCode = fyCodeFor(input.inDateTime);
    const me = actorId(req);

    const finalised = await db.$transaction((tx) =>
      createJobCardOnceTx(tx, input, me, "FINALISE", async (identity) => {
        const seq = await nextSequence(tx, branch.branchCode, fyCode, "JC");
        const jobCardNumber = formatDocNumber(
          branch.branchCode,
          fyCode,
          seq,
          "SKT/JC",
        );

        // Job card row, then lines via createManyAndReturn — Prisma's nested
        // `partLines: { create: [...] }` issues one INSERT per line instead
        // of a single batched statement; with N+M lines that's up to N+M+1
        // sequential round trips. createManyAndReturn does it in 2.
        const jobCard = await tx.jobCard.create({
          data: {
            ...identity,
            jobCardNumber,
            fyCode,
            branchId: input.branchId,
            vehicleId: input.vehicleId,
            driverId: input.driverId,
            truckStatus: input.truckStatus,
            inDateTime: input.inDateTime,
            openingKm: input.openingKm,
            remarks: input.remarks,
            createdById: me,
          },
        });

        const [createdPartLines, createdServiceLines] = await Promise.all([
          input.partLines.length
            ? tx.jobCardPartLine.createManyAndReturn({
                data: input.partLines.map((line) => ({
                  jobCardId: jobCard.id,
                  sparePartId: line.sparePartId,
                  batchId: line.batchId,
                  mechanicId: line.mechanicId,
                  qty: line.qty,
                  unitCostPaise: 0n, // snapshotted below by finaliseJobCardTx
                  amountPaise: 0n,
                  description: line.description,
                })),
              })
            : Promise.resolve([]),
          input.serviceLines.length
            ? tx.jobCardServiceLine.createManyAndReturn({
                data: input.serviceLines.map((line) => ({
                  jobCardId: jobCard.id,
                  serviceProviderId: line.serviceProviderId,
                  sparePartId: line.sparePartId,
                  mechanicId: line.mechanicId,
                  qty: line.qty,
                  ratePaise: line.ratePaise,
                  amountPaise: line.ratePaise * BigInt(line.qty),
                  description: line.description,
                })),
              })
            : Promise.resolve([]),
        ]);
        const created = {
          ...jobCard,
          partLines: createdPartLines,
          serviceLines: createdServiceLines,
        };

        return finaliseJobCardTx(
          tx,
          created,
          { outDateTime: input.outDateTime, closingKm: input.closingKm },
          me,
        );
      }),
      { isolationLevel: "ReadCommitted" },
    );

    const result = await db.jobCard.findUnique({
      where: { id: finalised.id },
      include: jobCardDetailInclude,
    });
    if (result) assertBranchAccess(req, result.branchId);
    sendOk(res, result, undefined, 201);
  },
);

router.post(
  "/:id/finalise",
  can(PERMS.WORKSHOP.JOBCARD_FINALISE),
  async (req, res) => {
    const input = finaliseJobCardSchema.parse(req.body);

    const existing = await db.jobCard.findUnique({
      where: { id: getParamId(req) },
      include: { partLines: true, serviceLines: true },
    });
    if (!existing) throw new NotFoundError("Job card not found");
    if (existing.status !== "DRAFT")
      throw new BadRequestError("Only a DRAFT job card can be finalised");
    assertBranchAccess(req, existing.branchId);

    const finalised = await db.$transaction((tx) =>
      finaliseJobCardTx(tx, existing, input, actorId(req)),
    );

    const result = await db.jobCard.findUnique({
      where: { id: finalised.id },
      include: jobCardDetailInclude,
    });
    sendOk(res, result);
  },
);

/**
 * Undo Finalise: only safe while nothing downstream has consumed the
 * finalised parts/service lines yet — no Service Bill line and no Removed
 * Part / Supplier Replacement activity against this job card. Reverses the
 * exact effects Finalise made: restores batch/ledger qty, writes offsetting
 * StockMovement rows, reverses the parts voucher, and drops the job card
 * back to DRAFT so it can be edited and re-finalised.
 */
router.post(
  "/:id/undo-finalise",
  can(PERMS.WORKSHOP.JOBCARD_FINALISE),
  async (req, res) => {
    const input = undoFinaliseJobCardSchema.parse(req.body);

    const existing = await db.jobCard.findUnique({
      where: { id: getParamId(req) },
      include: {
        partLines: true,
        serviceLines: true,
        removedParts: { select: { id: true } },
      },
    });
    if (!existing) throw new NotFoundError("Job card not found");
    if (existing.status !== "FINALISED")
      throw new BadRequestError(
        "Only a FINALISED job card can have its finalise undone",
      );
    assertBranchAccess(req, existing.branchId);

    if (existing.serviceLines.some((l) => l.billedInServiceBillId !== null))
      throw new BadRequestError(
        "This job card has already been billed — undo is only possible before billing",
      );
    if (existing.removedParts.length > 0)
      throw new BadRequestError(
        "This job card already has removed-parts activity recorded — undo is no longer possible",
      );

    const undone = await db.$transaction(async (tx) => {
      const claimed = await tx.jobCard.updateMany({
        where: {
          id: existing.id,
          status: "FINALISED",
          version: existing.version,
        },
        data: { version: { increment: 1 } },
      });
      if (claimed.count !== 1)
        throw new ConflictError(
          "Job card changed. Refresh before undoing finalisation.",
        );
      // Billing claims the same parent before claiming service lines. Recheck
      // after the claim, rather than trusting dependencies read before locking.
      if (
        await tx.jobCardServiceLine.count({
          where: {
            jobCardId: existing.id,
            billedInServiceBillId: { not: null },
          },
        })
      )
        throw new ConflictError(
          "This job card has billed services and cannot be reopened",
        );
      for (const line of existing.partLines) {
        await tx.spareBatch.update({
          where: { id: line.batchId },
          data: { qtyRemaining: { increment: line.qty } },
        });

        const stockLedger = await tx.stockLedger.update({
          where: {
            sparePartId_branchId: {
              sparePartId: line.sparePartId,
              branchId: existing.branchId,
            },
          },
          data: { currentQty: { increment: line.qty } },
        });
        const newQty = stockLedger.currentQty;

        await tx.stockMovement.create({
          data: {
            sparePartId: line.sparePartId,
            branchId: existing.branchId,
            movementType: "ADJUSTMENT",
            qtyDelta: line.qty,
            unitCostPaise: line.unitCostPaise,
            balanceQtyAfter: newQty,
            refType: "JOBCARD_FINALISE_UNDO",
            refId: existing.id,
            createdById: actorId(req),
          },
        });

        await tx.jobCardPartLine.update({
          where: { id: line.id },
          data: { unitCostPaise: 0n, amountPaise: 0n },
        });
      }

      if (existing.journalEntryId)
        await reverseJournal(
          tx,
          existing.journalEntryId,
          input.reason,
          actorId(req),
        );

      return tx.jobCard.update({
        where: { id: existing.id },
        data: {
          status: "DRAFT",
          outDateTime: null,
          closingKm: null,
          totalPartsAmountPaise: 0n,
          totalServiceAmountPaise: 0n,
          totalAmountPaise: 0n,
          journalEntryId: null,
          finalisedById: null,
          finalisedAt: null,
        },
        select: { id: true },
      });
    });

    const result = await db.jobCard.findUnique({
      where: { id: undone.id },
      include: jobCardDetailInclude,
    });
    sendOk(res, result);
  },
);

router.post(
  "/:id/cancel",
  can(PERMS.WORKSHOP.JOBCARD_MANAGE),
  async (req, res) => {
    const input = cancelJobCardSchema.parse(req.body);
    const existing = await db.jobCard.findUnique({
      where: { id: getParamId(req) },
      select: { id: true, status: true, branchId: true, version: true },
    });
    if (!existing) throw new NotFoundError("Job card not found");
    if (existing.status !== "DRAFT")
      throw new BadRequestError(
        "Only a DRAFT job card can be cancelled — no stock has moved yet at that stage",
      );
    assertBranchAccess(req, existing.branchId);

    const cancelled = await db.jobCard.updateMany({
      where: { id: existing.id, status: "DRAFT", version: existing.version },
      data: {
        version: { increment: 1 },
        status: "CANCELLED",
        cancelledById: actorId(req),
        cancelledAt: new Date(),
        cancelReason: input.reason,
      },
    });
    if (cancelled.count !== 1)
      throw new ConflictError("Job card changed. Refresh before cancelling.");

    const updated = await db.jobCard.findUnique({
      where: { id: existing.id },
      include: jobCardDetailInclude,
    });
    sendOk(res, updated);
  },
);

const removedPartDetailInclude = {
  sparePart: { select: { id: true, name: true, unit: true } },
  relatedPartLine: { select: { id: true, unitCostPaise: true, batchId: true } },
  newBatch: { select: { id: true, qtyRemaining: true } },
  createdBy: { select: { id: true, firstName: true, lastName: true } },
  journalEntry: { select: { id: true, voucherNumber: true, status: true } },
};

router.get(
  "/:id/removed-parts",
  can(PERMS.WORKSHOP.JOBCARD_VIEW),
  async (req, res) => {
    const jobCardId = getParamId(req);
    const jobCard = await db.jobCard.findUnique({
      where: { id: jobCardId },
      select: { id: true, branchId: true },
    });
    if (!jobCard) throw new NotFoundError("Job card not found");
    assertBranchAccess(req, jobCard.branchId);

    const query = jobCardRemovedPartListQuerySchema.parse(req.query);
    const where = {
      jobCardId,
      ...(query.condition ? { condition: query.condition } : {}),
      ...(query.search
        ? {
            OR: [
              {
                sparePart: {
                  name: {
                    contains: query.search,
                    mode: "insensitive" as const,
                  },
                },
              },
              {
                remarks: {
                  contains: query.search,
                  mode: "insensitive" as const,
                },
              },
            ],
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      db.jobCardRemovedPart.findMany({
        where,
        include: removedPartDetailInclude,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: query.page * query.size,
        take: query.size,
      }),
      db.jobCardRemovedPart.count({ where }),
    ]);
    sendOk(res, rows, { page: query.page, size: query.size, total });
  },
);

/** Removed-part writes share one transaction and a request identity. */
router.post(
  "/:id/removed-parts",
  can(PERMS.WORKSHOP.JOBCARD_MANAGE),
  async (req, res) => {
    const input = createJobCardRemovedPartSchema.parse(req.body);
    const jobCardId = getParamId(req);
    const card = await db.jobCard.findUnique({
      where: { id: jobCardId },
      select: { branchId: true },
    });
    if (!card) throw new NotFoundError("Job card not found");
    assertBranchAccess(req, card.branchId);
    const created = await db.$transaction((tx) =>
      createRemovedPartTx(tx, jobCardId, card.branchId, input, actorId(req)),
    );
    const result = await db.jobCardRemovedPart.findUnique({
      where: { id: created.id },
      include: removedPartDetailInclude,
    });
    sendOk(res, result, undefined, 201);
  },
);
export default router;
