import { db } from "../../../prisma/prisma.js";
import { NotFoundError } from "../../lib/error.js";
import type {
  SlipOutstandingRow,
  VendorPartyType,
  VendorStatementView,
} from "@skerp/types";
import {
  composeVendorStatement,
  num as n,
  type VendorStatementInputRow,
} from "./vendor-statement.compute.js";

/**
 * Vendor Statement (VP-8) — DB layer. Reads directly from
 * VendorPaymentSlip / VendorPaymentDisbursement, not from a generic
 * JournalLine sweep — see vendor-statement.compute.ts for why.
 *
 * Pure composition math lives in ./vendor-statement.compute.ts (unit-tested).
 */

// Statuses that represent a real, still-live accrued payable — the accrual
// was posted and, for APPROVED specifically, hasn't been reversed. DRAFT/
// PENDING_APPROVAL never touched the ledger, so they're never included. A
// CANCELLED slip is handled separately below: it's only included when it
// *did* have an accrual (accrualJournalEntryId set, i.e. it was APPROVED
// before being cancelled) — those get an explicit ACCRUAL + REVERSAL row
// pair rather than being silently omitted, so the reversal stays visible
// for audit even though it nets to zero.
const ACCRUED_SLIP_STATUSES = ["APPROVED", "PARTIALLY_PAID", "PAID"] as const;

export type VendorStatementFilters = {
  /** Extra Prisma `where` fragment on `branchId` — either `{ branchId }` (a
   *  chosen branch) or the caller's `branchFilter(req)` scope. */
  branchWhere?: Record<string, unknown>;
  fyCode?: string;
  from?: string;
  to?: string;
};

export type SlipOutstandingFilters = {
  branchWhere?: Record<string, unknown>;
  fyCode?: string;
};

const dayStart = (d: string): Date => new Date(`${d}T00:00:00.000Z`);
const dayEnd = (d: string): Date => new Date(`${d}T23:59:59.999Z`);

type ResolvedParty = { partyId: string; partyType: VendorPartyType; partyName: string };

/** A vendor statement is keyed by Ledger.id — same convention
 *  ledgerForCreditor already uses — resolved here to whichever party FK is
 *  actually set (transportId or labourId; VendorPaymentSlip_one_payee_chk
 *  guarantees at most one matters). */
async function resolvePartyOrThrow(ledgerId: string): Promise<ResolvedParty> {
  const ledger = await db.ledger.findUnique({
    where: { id: ledgerId },
    select: {
      transportId: true,
      labourId: true,
      transport: { select: { name: true } },
      labour: { select: { name: true } },
    },
  });
  if (!ledger) throw new NotFoundError("Ledger not found");
  if (ledger.transportId && ledger.transport)
    return { partyId: ledger.transportId, partyType: "TRANSPORTER", partyName: ledger.transport.name };
  if (ledger.labourId && ledger.labour)
    return { partyId: ledger.labourId, partyType: "LABOUR", partyName: ledger.labour.name };
  throw new NotFoundError(
    "This ledger is not a transporter or labour party — no vendor statement available",
  );
}

const payeeWhereFor = (party: ResolvedParty) =>
  party.partyType === "TRANSPORTER"
    ? { transportId: party.partyId }
    : { labourId: party.partyId };

/** VP-8 — full statement for one transporter or labour party. */
export async function buildVendorStatement(
  ledgerId: string,
  filters: VendorStatementFilters = {},
): Promise<VendorStatementView> {
  const { branchWhere = {}, fyCode } = filters;
  const from = filters.from ? dayStart(filters.from) : null;
  const to = filters.to ? dayEnd(filters.to) : null;
  const fyWhere = fyCode ? { fyCode } : {};

  const party = await resolvePartyOrThrow(ledgerId);

  const slips = await db.vendorPaymentSlip.findMany({
    where: {
      ...payeeWhereFor(party),
      OR: [
        { status: { in: [...ACCRUED_SLIP_STATUSES] } },
        { status: "CANCELLED", accrualJournalEntryId: { not: null } },
      ],
      ...branchWhere,
      ...fyWhere,
    },
    select: {
      id: true,
      slipNumber: true,
      status: true,
      approvedAt: true,
      cancelledAt: true,
      createdAt: true,
      netPayablePaise: true,
      disbursements: {
        select: { id: true, paidPaise: true, mode: true, paidAt: true },
      },
    },
    orderBy: [{ approvedAt: "asc" }, { createdAt: "asc" }],
  });

  const rows: VendorStatementInputRow[] = [];
  for (const slip of slips) {
    // approvedAt is always set once a slip has an accrual (APPROVED or a
    // now-CANCELLED slip that was APPROVED before cancellation).
    const accrualDate = slip.approvedAt ?? slip.createdAt;
    rows.push({
      id: slip.id,
      date: accrualDate,
      kind: "ACCRUAL",
      particulars: "Accrual",
      voucherNumber: slip.slipNumber,
      slipId: slip.id,
      debitPaise: 0,
      creditPaise: n(slip.netPayablePaise),
      sortSeq: 0,
    });

    if (slip.status === "CANCELLED") {
      // Cancellation only reverses an APPROVED-and-unpaid accrual (see
      // reverseVendorSlipAccrual / the cancel route) — paidPaise is always
      // 0 here, so there are never disbursement rows to also emit.
      rows.push({
        id: `${slip.id}:reversal`,
        date: slip.cancelledAt ?? accrualDate,
        kind: "REVERSAL",
        particulars: "Reversal (slip cancelled)",
        voucherNumber: slip.slipNumber,
        slipId: slip.id,
        debitPaise: n(slip.netPayablePaise),
        creditPaise: 0,
        sortSeq: 2,
      });
      continue;
    }

    for (const d of slip.disbursements) {
      rows.push({
        id: d.id,
        date: d.paidAt,
        kind: "PAYMENT",
        particulars: `Payment · ${d.mode}`,
        voucherNumber: slip.slipNumber,
        slipId: slip.id,
        debitPaise: n(d.paidPaise),
        creditPaise: 0,
        sortSeq: 1,
      });
    }
  }

  return composeVendorStatement(rows, { from, to }, party);
}

/**
 * Per-slip outstanding for one vendor. Reads straight from the slip's own
 * maintained netPayablePaise/paidPaise — always current. Unlike the Debtor
 * Ageing view this deliberately has no `asOf` historical reconstruction via
 * LedgerAllocation: VP-8 doesn't ask for vendor ageing, only whether a slip
 * still shows as outstanding right now, which the slip's own running totals
 * already answer directly and can never drift out of sync with.
 */
export async function perSlipOutstanding(
  ledgerId: string,
  filters: SlipOutstandingFilters = {},
): Promise<SlipOutstandingRow[]> {
  const { branchWhere = {}, fyCode } = filters;
  const fyWhere = fyCode ? { fyCode } : {};
  const party = await resolvePartyOrThrow(ledgerId);

  const slips = await db.vendorPaymentSlip.findMany({
    where: {
      ...payeeWhereFor(party),
      status: { in: [...ACCRUED_SLIP_STATUSES] },
      ...branchWhere,
      ...fyWhere,
    },
    select: {
      id: true,
      slipNumber: true,
      approvedAt: true,
      createdAt: true,
      netPayablePaise: true,
      paidPaise: true,
    },
    orderBy: [{ approvedAt: "asc" }, { createdAt: "asc" }],
  });

  return slips.map((s) => ({
    slipId: s.id,
    slipNumber: s.slipNumber,
    slipDate: (s.approvedAt ?? s.createdAt).toISOString(),
    totalPaise: n(s.netPayablePaise),
    paidPaise: n(s.paidPaise),
    outstandingPaise: n(s.netPayablePaise) - n(s.paidPaise),
  }));
}
