import { Router } from "express";
import {
  approveReceiptSchema,
  cancelReceiptSchema,
  createReceiptSchema,
  outstandingBillsQuerySchema,
} from "@skerp/validators";
import { PERMS } from "@skerp/types";
import {
  Prisma,
  type BillStatus,
  type ReceiptStatus,
} from "../../../generated/prisma/index.js";
import { db } from "../../../prisma/prisma.js";
import { authMiddleware } from "../../middlewares/auth.middlware.js";
import { can } from "../../auth/can.middleware.js";
import { assertBranchAccess, branchFilter } from "../../auth/branch-scope.js";
import { BadRequestError, NotFoundError, ValidationError } from "../../lib/error.js";
import { sendOk } from "../_shared/response.js";
import { getParamId } from "../_shared/param.js";
import { parseListQuery } from "../_shared/list.query.js";
import { fyCodeFor, formatDocNumber, nextSequence } from "../_shared/doc-number.js";
import {
  creditAccountForReceipt,
  reverseAccountAdjustmentsForReceipt,
} from "../cash-planning/cash-planning.service.js";
import { recordLedgerEntry } from "../ledger/ledger.service.js";
import { postReceiptVoucher, reverseJournal } from "../ledger/posting.service.js";

const router: Router = Router();
router.use(authMiddleware);
const actorId = (req: { user?: { userId: string } }) => req.user!.userId;

// Bills carrying a real invoice number that can still receive payment.
const RECEIVABLE_BILL_STATUSES: BillStatus[] = [
  "FINALISED",
  "SENT",
  "PARTIALLY_PAID",
];

const validate = <T>(
  result:
    | { success: true; data: T }
    | {
      success: false;
      error: { flatten: () => { fieldErrors: Record<string, string[]> } };
    },
) => {
  if (!result.success)
    throw new ValidationError(result.error.flatten().fieldErrors);
  return result.data;
};

const receiptDetailInclude = {
  customer: { select: { id: true, name: true, gstNo: true } },
  branch: { select: { id: true, name: true, branchCode: true } },
  receivedIntoAccount: { select: { id: true, name: true, type: true } },
  createdBy: { select: { id: true, firstName: true, lastName: true } },
  approvedBy: { select: { id: true, firstName: true, lastName: true } },
  cancelledBy: { select: { id: true, firstName: true, lastName: true } },
  allocations: {
    orderBy: { createdAt: "asc" as const },
    include: {
      bill: {
        select: {
          id: true,
          billNumber: true,
          billDate: true,
          totalAmountPaise: true,
          outstandingAmountPaise: true,
          status: true,
        },
      },
    },
  },
  statusHistory: { orderBy: { changedAt: "asc" as const } },
  journalEntry: {
    select: { id: true, voucherNumber: true, status: true, tallySyncStatus: true },
  },
} satisfies Prisma.ReceiptInclude;

router.get(
  "/outstanding-bills",
  can(PERMS.RECEIPT.VIEW),
  async (req, res) => {
    const input = validate(outstandingBillsQuerySchema.safeParse(req.query));
    if (input.branchId) assertBranchAccess(req, input.branchId);

    // lrNumber and truckNumber both narrow the same "lines.some.lr" relation —
    // they must be merged into one filter object. Two separate `lines: {...}`
    // spreads at the top level would collide on the same key and the second
    // one would silently overwrite the first.
    const lrFilter: Prisma.LorryReceiptWhereInput = {};
    if (input.lrNumber)
      lrFilter.lrNumber = { contains: input.lrNumber, mode: "insensitive" };
    if (input.truckNumber)
      lrFilter.group = {
        OR: [
          {
            marketVehicleNumber: {
              contains: input.truckNumber,
              mode: "insensitive",
            },
          },
          {
            primaryTrip: {
              vehicle: {
                vehicleNumber: {
                  contains: input.truckNumber,
                  mode: "insensitive",
                },
              },
            },
          },
          {
            secondaryTrip: {
              vehicle: {
                vehicleNumber: {
                  contains: input.truckNumber,
                  mode: "insensitive",
                },
              },
            },
          },
        ],
      };

    const where: Prisma.BillWhereInput = {
      ...(input.branchId
        ? { branchId: input.branchId }
        : branchFilter(req, "branchId")),
      billingCustomerId: input.customerId,
      status: { in: RECEIVABLE_BILL_STATUSES },
      outstandingAmountPaise: { gt: 0n },
      // A bill with a receipt awaiting approval is "reserved" — its
      // outstanding amount hasn't been reduced yet (that only happens once
      // the receipt posts), so without this it would stay pickable and let
      // someone create a second, conflicting receipt against it.
      receiptAllocations: {
        none: { receipt: { status: "PENDING_APPROVAL" } },
      },
      ...(input.uptoDate ? { billDate: { lte: input.uptoDate } } : {}),
      ...(input.billNumber
        ? { billNumber: { contains: input.billNumber, mode: "insensitive" } }
        : {}),
      ...(Object.keys(lrFilter).length > 0
        ? { lines: { some: { lr: lrFilter } } }
        : {}),
    };

    const [bills, total] = await Promise.all([
      db.bill.findMany({
        where,
        include: {
          branch: { select: { name: true } },
          lines: {
            take: 1,
            orderBy: { lineNumber: "asc" },
            include: {
              lr: {
                select: {
                  lrNumber: true,
                  group: {
                    select: {
                      marketVehicleNumber: true,
                      primaryTrip: {
                        select: { vehicle: { select: { vehicleNumber: true } } },
                      },
                      secondaryTrip: {
                        select: { vehicle: { select: { vehicleNumber: true } } },
                      },
                    },
                  },
                },
              },
            },
          },
          _count: { select: { lines: true } },
        },
        // billDate alone isn't unique — the id tiebreak keeps paging stable
        // (no repeated/skipped rows) when several bills share a date.
        orderBy: [{ billDate: "asc" }, { id: "asc" }],
        skip: input.page * input.size,
        take: input.size,
      }),
      db.bill.count({ where }),
    ]);
    const data = bills.map((bill) => {
      const firstLine = bill.lines[0];
      const vehicle =
        firstLine?.lr.group.marketVehicleNumber ??
        firstLine?.lr.group.primaryTrip?.vehicle.vehicleNumber ??
        firstLine?.lr.group.secondaryTrip?.vehicle.vehicleNumber ??
        null;
      return {
        id: bill.id,
        billNumber: bill.billNumber,
        billDate: bill.billDate,
        branchId: bill.branchId,
        branchName: bill.branch.name,
        lrNumber: firstLine?.lr.lrNumber ?? null,
        additionalLRCount: Math.max(0, bill._count.lines - 1),
        truckNumber: vehicle,
        totalAmountPaise: bill.totalAmountPaise,
        outstandingAmountPaise: bill.outstandingAmountPaise,
        taxableAmountPaise: bill.taxableAmountPaise,
      };
    });
    return sendOk(res, data, { page: input.page, size: input.size, total });
  },
);


router.post("/", can(PERMS.RECEIPT.CREATE), async (req, res) => {
  const input = validate(createReceiptSchema.safeParse(req.body));
  assertBranchAccess(req, input.branchId);

  const [branch, customer, account] = await Promise.all([
    db.branch.findUnique({
      where: { id: input.branchId },
      select: { id: true, branchCode: true, companyId: true },
    }),
    db.customer.findUnique({
      where: { id: input.customerId },
      select: { id: true },
    }),
    db.cashAccount.findUnique({
      where: { id: input.receivedIntoAccountId },
      select: { id: true },
    }),
  ]);
  if (!branch) throw new NotFoundError("Branch not found");
  if (!customer) throw new NotFoundError("Client not found");
  if (!account) throw new NotFoundError("Cash account not found");

  const billIds = [...new Set(input.allocations.map((a) => a.billId))];
  if (billIds.length !== input.allocations.length)
    throw new BadRequestError("The same bill was selected more than once");

  const hasDeduction = input.allocations.some(
    (a) =>
      a.tdsAmountPaise > 0n ||
      a.damageAmountPaise > 0n ||
      a.rateDiffAmountPaise !== 0n,
  );
  const amountPaise = input.allocations.reduce(
    (sum, a) => sum + a.amountAppliedPaise,
    0n,
  );
  const me = actorId(req);
  const fyCode = fyCodeFor(input.receivedAt);
  const sortedBillIds = [...billIds].sort();
  const allocationByBillId = new Map(input.allocations.map((a) => [a.billId, a]));

  const created = await db.$transaction(async (tx): Promise<{ id: string; status: "PENDING_APPROVAL" | "POSTED" }> => {
    // One round trip instead of N. WITH ORDINALITY + ORDER BY preserves the
    // same lock-acquisition order as the original sorted for-loop.
    await tx.$executeRaw`
      SELECT pg_advisory_xact_lock(hashtext(id))
      FROM unnest(${sortedBillIds}::text[]) WITH ORDINALITY AS t(id, ord)
      ORDER BY ord
    `;

    const bills = await tx.bill.findMany({
      where: { id: { in: billIds } },
      select: {
        id: true,
        branchId: true,
        billingCustomerId: true,
        status: true,
        totalAmountPaise: true,
        outstandingAmountPaise: true,
      },
    });
    if (bills.length !== billIds.length)
      throw new BadRequestError("One or more bills were not found");

    const reservedAllocation = await tx.receiptAllocation.findFirst({
      where: {
        billId: { in: billIds },
        receipt: { status: "PENDING_APPROVAL" },
      },
      select: {
        billId: true,
        receipt: { select: { receiptNumber: true } },
      },
    });
    if (reservedAllocation)
      throw new BadRequestError(
        `Bill ${reservedAllocation.billId} already has a receipt pending approval. Approve or cancel that receipt first.`,
      );

    for (const bill of bills) {
      if (bill.branchId !== input.branchId)
        throw new BadRequestError("All bills must belong to the selected branch");
      if (bill.billingCustomerId !== input.customerId)
        throw new BadRequestError("All bills must belong to the selected client");
      if (!RECEIVABLE_BILL_STATUSES.includes(bill.status))
        throw new BadRequestError(`Bill is not open for payment (${bill.status})`);
    }
    const billById = new Map(bills.map((b) => [b.id, b]));

    // Compute every allocation's settlement + new outstanding amount up
    // front, in memory — zero DB calls in this loop.
    const settlementByBillId = new Map<string, { settled: bigint; newOutstanding: bigint }>();
    for (const allocation of input.allocations) {
      const bill = billById.get(allocation.billId)!;
      const settled =
        allocation.amountAppliedPaise +
        allocation.tdsAmountPaise +
        allocation.damageAmountPaise +
        allocation.rateDiffAmountPaise;
      if (settled > bill.outstandingAmountPaise)
        throw new BadRequestError(
          `Allocation for bill ${bill.id} exceeds its outstanding amount`,
        );
      const newOutstanding = bill.outstandingAmountPaise - settled;
      settlementByBillId.set(allocation.billId, { settled, newOutstanding });
    }

    const status = hasDeduction ? "PENDING_APPROVAL" : "POSTED";
    let receiptNumber: string | null = null;
    if (status === "POSTED") {
      const seq = await nextSequence(tx, branch.branchCode, fyCode, "RCPT");
      receiptNumber = formatDocNumber(branch.branchCode, fyCode, seq, "SKT/RCPT");
    }

    const receipt = await tx.receipt.create({
      data: {
        receiptNumber,
        fyCode,
        status,
        customerId: input.customerId,
        branchId: input.branchId,
        companyId: branch.companyId,
        receivedIntoAccountId: input.receivedIntoAccountId,
        amountPaise,
        paymentMode: input.paymentMode,
        referenceNumber: input.referenceNumber,
        receivedAt: input.receivedAt,
        remarks: input.remarks,
        createdById: me,
        allocations: {
          create: input.allocations.map((a) => ({
            billId: a.billId,
            amountAppliedPaise: a.amountAppliedPaise,
            tdsAmountPaise: a.tdsAmountPaise,
            tdsSection: a.tdsSection,
            tdsCertNumber: a.tdsCertNumber,
            tdsCertDate: a.tdsCertDate,
            damageAmountPaise: a.damageAmountPaise,
            rateDiffAmountPaise: a.rateDiffAmountPaise,
          })),
        },
        statusHistory: { create: { toStatus: status, changedById: me } },
      },
      select: { id: true },
    });

    if (status === "POSTED") {
      const voucher = await postReceiptVoucher(tx, {
        receiptId: receipt.id,
        receiptNumber: receiptNumber!,
        receivedAt: input.receivedAt,
        branchId: input.branchId,
        fyCode,
        customerId: input.customerId,
        cashAccountId: input.receivedIntoAccountId,
        allocations: input.allocations,
        createdById: me,
      });
      await tx.receipt.update({
        where: { id: receipt.id },
        data: { journalEntryId: voucher.id },
      });

      // Bill updates: Prisma has no "update many rows, different values
      // each" call, so this still runs once per bill — but concurrently
      // instead of a sequential for-await loop, and with the increment
      // done via Prisma's own { increment } instead of a manual read+add.
      await Promise.all(
        input.allocations.map((a) => {
          const { newOutstanding } = settlementByBillId.get(a.billId)!;
          return tx.bill.update({
            where: { id: a.billId },
            data: {
              paidAmountPaise: { increment: a.amountAppliedPaise },
              outstandingAmountPaise: newOutstanding,
              status: newOutstanding <= 0n ? "PAID" : "PARTIALLY_PAID",
            },
          });
        }),
      );

      // Was: one tx.cashReceivable.findUnique() PER allocation.
      // Now: one findMany() for every bill in this receipt at once.
      const existingReceivables = await tx.cashReceivable.findMany({
        where: { billId: { in: billIds } },
        select: { id: true, billId: true, receivedAmount: true },
      });

      if (existingReceivables.length > 0) {
        // Same Prisma limitation as the bill updates: still one update()
        // call per receivable, but concurrent instead of sequential.
        await Promise.all(
          existingReceivables.map((r) => {
            // r.billId is typed string | null in the generated Prisma types
            // because CashReceivable.billId is nullable in the schema (a
            // MANUAL-source receivable has no bill). But we already filtered
            // this query by `billId: { in: billIds }`, so every row here is
            // guaranteed to have one — the `!` just tells TypeScript what we
            // already know to be true at runtime.
            const billId = r.billId!;
            const allocation = allocationByBillId.get(billId)!;
            const { newOutstanding } = settlementByBillId.get(billId)!;
            return tx.cashReceivable.update({
              where: { id: r.id },
              data: {
                totalAmount: newOutstanding,
                expectedAmount: newOutstanding,
                // receivedAmount is nullable in the schema (null until the
                // first receipt ever posts against this receivable), so this
                // can't use Prisma's { increment } — NULL + x is NULL in SQL.
                // Set the explicit value instead, same as the original code.
                receivedAmount: (r.receivedAmount ?? 0n) + allocation.amountAppliedPaise,
                ackReceived: newOutstanding <= 0n,
              },
            });
          }),
        );

        // Was: one nested `receipts: { create: {...} }` per cashReceivable
        // .update() call above. Now: one createMany() for all of them,
        // using the real relation field name from your schema.
        await tx.cashReceivableReceipt.createMany({
          data: existingReceivables.map((r) => ({
            receivableId: r.id,
            amount: allocationByBillId.get(r.billId!)!.amountAppliedPaise,
            note: `Receipt ${receiptNumber ?? receipt.id}`,
          })),
        });
      }

      await creditAccountForReceipt(tx, {
        receivedAt: input.receivedAt,
        accountId: input.receivedIntoAccountId,
        amountPaise,
        reason: `Receipt ${receiptNumber ?? receipt.id}`,
        receiptId: receipt.id,
        createdById: me,
      });
      await recordLedgerEntry(tx, {
        direction: "IN",
        amountPaise,
        cashAccountId: input.receivedIntoAccountId,
        customerId: input.customerId,
        sourceType: "RECEIPT",
        sourceId: receipt.id,
        occurredAt: input.receivedAt,
        description: `Receipt ${receiptNumber ?? receipt.id}`,
        createdById: me,
      });
    }

    return { id: receipt.id, status };
  });

  return sendOk(res, created, undefined, 201);
});

router.get("/", can(PERMS.RECEIPT.VIEW), async (req, res) => {
  const status =
    typeof req.query.status === "string"
      ? (req.query.status as ReceiptStatus)
      : undefined;
  const query = parseListQuery(req);
  const where = {
    ...branchFilter(req),
    ...(status ? { status } : {}),
  };
  const [data, total] = await Promise.all([
    db.receipt.findMany({
      where,
      include: {
        customer: { select: { id: true, name: true } },
        branch: { select: { name: true, branchCode: true } },
        _count: { select: { allocations: true } },
        journalEntry: {
          select: { id: true, voucherNumber: true, status: true, tallySyncStatus: true },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: query.page * query.size,
      take: query.size,
    }),
    db.receipt.count({ where }),
  ]);
  return sendOk(res, data, { page: query.page, size: query.size, total });
});

router.get("/:id", can(PERMS.RECEIPT.VIEW), async (req, res) => {
  const receipt = await db.receipt.findUnique({
    where: { id: getParamId(req) },
    include: receiptDetailInclude,
  });
  if (!receipt) throw new NotFoundError("Receipt not found");
  assertBranchAccess(req, receipt.branchId);
  return sendOk(res, receipt);
});

// The RECEIPT voucher posted for this receipt — header + Dr/Cr lines + bill
// allocations. 404 until the receipt reaches POSTED.
router.get(
  "/:id/voucher",
  can(PERMS.LEDGER.VOUCHER_VIEW),
  async (req, res) => {
    const id = getParamId(req);
    const receipt = await db.receipt.findUnique({
      where: { id },
      select: { branchId: true, journalEntryId: true },
    });
    if (!receipt) throw new NotFoundError("Receipt not found");
    assertBranchAccess(req, receipt.branchId);
    if (!receipt.journalEntryId)
      throw new NotFoundError("No voucher posted for this receipt yet");
    const voucher = await db.journalEntry.findUniqueOrThrow({
      where: { id: receipt.journalEntryId },
      include: {
        branch: { select: { id: true, name: true, branchCode: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        lines: {
          orderBy: { lineNumber: "asc" },
          include: {
            ledger: {
              select: { id: true, name: true, code: true, kind: true, group: true },
            },
          },
        },
        allocations: {
          include: {
            bill: { select: { id: true, billNumber: true } },
          },
        },
      },
    });
    return sendOk(res, voucher);
  },
);

router.post("/:id/approve", can(PERMS.RECEIPT.APPROVE), async (req, res) => {
  const id = getParamId(req);
  const input = validate(approveReceiptSchema.safeParse(req.body ?? {}));
  const receipt = await db.receipt.findUnique({
    where: { id },
    include: { allocations: true, branch: { select: { branchCode: true } } },
  });
  if (!receipt) throw new NotFoundError("Receipt not found");
  assertBranchAccess(req, receipt.branchId);
  if (receipt.status !== "PENDING_APPROVAL")
    throw new BadRequestError("Only a receipt pending approval can be approved");

  const me = actorId(req);
  const billIds = [...new Set(receipt.allocations.map((a) => a.billId))].sort();

  await db.$transaction(async (tx) => {
    for (const billId of billIds)
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${billId}))`;

    const bills = await tx.bill.findMany({
      where: { id: { in: billIds } },
      select: { id: true, status: true, outstandingAmountPaise: true },
    });
    const billById = new Map(bills.map((b) => [b.id, b]));
    for (const allocation of receipt.allocations) {
      const bill = billById.get(allocation.billId);
      if (!bill || !RECEIVABLE_BILL_STATUSES.includes(bill.status))
        throw new BadRequestError("A bill on this receipt is no longer open for payment");
      const settled =
        allocation.amountAppliedPaise +
        allocation.tdsAmountPaise +
        allocation.damageAmountPaise +
        allocation.rateDiffAmountPaise;
      if (settled > bill.outstandingAmountPaise)
        throw new BadRequestError(
          `Allocation for bill ${bill.id} exceeds its outstanding amount`,
        );
    }

    const seq = await nextSequence(
      tx,
      receipt.branch.branchCode,
      receipt.fyCode,
      "RCPT",
    );
    const receiptNumber = formatDocNumber(
      receipt.branch.branchCode,
      receipt.fyCode,
      seq,
      "SKT/RCPT",
    );

    // Older receipts created before receivedIntoAccountId existed have no
    // account on file — nothing to post a voucher against for those, same
    // gap already handled below for the cash-account credit.
    const voucher = receipt.receivedIntoAccountId
      ? await postReceiptVoucher(tx, {
        receiptId: receipt.id,
        receiptNumber,
        receivedAt: receipt.receivedAt,
        branchId: receipt.branchId,
        fyCode: receipt.fyCode,
        customerId: receipt.customerId,
        cashAccountId: receipt.receivedIntoAccountId,
        allocations: receipt.allocations,
        createdById: me,
      })
      : null;

    await tx.receipt.update({
      where: { id, version: receipt.version },
      data: {
        status: "POSTED",
        receiptNumber,
        approvedById: me,
        approvedAt: new Date(),
        version: { increment: 1 },
        journalEntryId: voucher?.id,
        statusHistory: {
          create: {
            fromStatus: "PENDING_APPROVAL",
            toStatus: "POSTED",
            reason: input.reason,
            changedById: me,
          },
        },
      },
    });

    for (const allocation of receipt.allocations) {
      const bill = billById.get(allocation.billId)!;
      const settled =
        allocation.amountAppliedPaise +
        allocation.tdsAmountPaise +
        allocation.damageAmountPaise +
        allocation.rateDiffAmountPaise;
      const newOutstanding = bill.outstandingAmountPaise - settled;
      await tx.bill.update({
        where: { id: bill.id },
        data: {
          paidAmountPaise: { increment: allocation.amountAppliedPaise },
          outstandingAmountPaise: newOutstanding,
          status: newOutstanding <= 0n ? "PAID" : "PARTIALLY_PAID",
        },
      });
      // NEW — same sync as the instant-post path in POST /
      const existingReceivable = await tx.cashReceivable.findUnique({
        where: { billId: bill.id },
        select: { id: true, receivedAmount: true },
      });
      if (existingReceivable) {
        await tx.cashReceivable.update({
          where: { id: existingReceivable.id },
          data: {
            totalAmount: newOutstanding,
            expectedAmount: newOutstanding,
            receivedAmount: (existingReceivable.receivedAmount ?? 0n) + allocation.amountAppliedPaise,
            ackReceived: newOutstanding <= 0n,
            receipts: {
              create: {
                amount: allocation.amountAppliedPaise,
                note: `Receipt ${receiptNumber}`,
              },
            },
          },
        });
      }
    }

    // Credit the account this money landed in, same as the instant-post
    // path. Older receipts created before this field existed have no
    // account on file — nothing to credit for those.
    if (receipt.receivedIntoAccountId) {
      await creditAccountForReceipt(tx, {
        receivedAt: receipt.receivedAt,
        accountId: receipt.receivedIntoAccountId,
        amountPaise: receipt.amountPaise,
        reason: `Receipt ${receiptNumber}`,
        receiptId: receipt.id,
        createdById: me,
      });
      await recordLedgerEntry(tx, {
        direction: "IN",
        amountPaise: receipt.amountPaise,
        cashAccountId: receipt.receivedIntoAccountId,
        customerId: receipt.customerId,
        sourceType: "RECEIPT",
        sourceId: receipt.id,
        occurredAt: receipt.receivedAt,
        description: `Receipt ${receiptNumber}`,
        createdById: me,
      });
    }
  });

  // Slim on purpose — the detail page's onSuccess ignores this response
  // entirely and invalidates its query instead, so re-fetching the full
  // receiptDetailInclude tree here was pure waste on every approve click.
  return sendOk(res, { id, status: "POSTED" });
});

router.post("/:id/cancel", can(PERMS.RECEIPT.CANCEL), async (req, res) => {
  const id = getParamId(req);
  const input = validate(cancelReceiptSchema.safeParse(req.body));
  const receipt = await db.receipt.findUnique({
    where: { id },
    include: { allocations: true },
  });
  if (!receipt) throw new NotFoundError("Receipt not found");
  assertBranchAccess(req, receipt.branchId);
  if (receipt.status === "CANCELLED")
    return sendOk(res, { id: receipt.id, status: receipt.status });

  const me = actorId(req);
  const wasPosted = receipt.status === "POSTED";
  const billIds = [...new Set(receipt.allocations.map((a) => a.billId))].sort();

  await db.$transaction(async (tx) => {
    if (wasPosted) {
      for (const billId of billIds)
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${billId}))`;

      if (receipt.journalEntryId)
        await reverseJournal(
          tx,
          receipt.journalEntryId,
          input.reason,
          me,
        );

      const bills = await tx.bill.findMany({
        where: { id: { in: billIds } },
        select: { id: true, totalAmountPaise: true, outstandingAmountPaise: true },
      });
      const billById = new Map(bills.map((b) => [b.id, b]));
      for (const allocation of receipt.allocations) {
        const bill = billById.get(allocation.billId);
        if (!bill) continue;
        const settled =
          allocation.amountAppliedPaise +
          allocation.tdsAmountPaise +
          allocation.damageAmountPaise +
          allocation.rateDiffAmountPaise;
        const restoredOutstanding = bill.outstandingAmountPaise + settled;
        await tx.bill.update({
          where: { id: bill.id },
          data: {
            paidAmountPaise: { decrement: allocation.amountAppliedPaise },
            outstandingAmountPaise: restoredOutstanding,
            status:
              restoredOutstanding >= bill.totalAmountPaise
                ? "FINALISED"
                : "PARTIALLY_PAID",
          },
        });
        // NEW — recompute the linked CashReceivable from the bill's
        // restored outstanding amount, mirroring the bill reversal above.
        const existingReceivable = await tx.cashReceivable.findUnique({
          where: { billId: bill.id },
          select: { id: true, receivedAmount: true },
        });
        if (existingReceivable) {
          await tx.cashReceivable.update({
            where: { id: existingReceivable.id },
            data: {
              totalAmount: restoredOutstanding,
              expectedAmount: restoredOutstanding,
              receivedAmount:
                (existingReceivable.receivedAmount ?? 0n) -
                allocation.amountAppliedPaise,
              ackReceived: false,
            },
          });
        }
      }

      // Reverse whatever this receipt credited into its cash account.
      await reverseAccountAdjustmentsForReceipt(
        tx,
        receipt.id,
        `Reversal: Receipt ${receipt.receiptNumber ?? receipt.id} cancelled`,
        me,
      );
      if (receipt.receivedIntoAccountId) {
        // Mirror-OUT ledger row — same sourceId as the original IN row
        // written on post/approve, per design (reversal, not delete).
        await recordLedgerEntry(tx, {
          direction: "OUT",
          amountPaise: receipt.amountPaise,
          cashAccountId: receipt.receivedIntoAccountId,
          customerId: receipt.customerId,
          sourceType: "RECEIPT",
          sourceId: receipt.id,
          occurredAt: new Date(),
          description: `Reversal: Receipt ${receipt.receiptNumber ?? receipt.id} cancelled`,
          createdById: me,
        });
      }
    }

    await tx.receipt.update({
      where: { id, version: receipt.version },
      data: {
        status: "CANCELLED",
        cancellationReason: input.reason,
        cancelledById: me,
        cancelledAt: new Date(),
        version: { increment: 1 },
        statusHistory: {
          create: {
            fromStatus: receipt.status,
            toStatus: "CANCELLED",
            reason: input.reason,
            changedById: me,
          },
        },
      },
    });
  });

  // Slim on purpose — the detail page's onSuccess ignores this response
  // entirely and invalidates its query instead, so re-fetching the full
  // receiptDetailInclude tree here was pure waste on every cancel click.
  return sendOk(res, { id, status: "CANCELLED" });
});

export default router;
