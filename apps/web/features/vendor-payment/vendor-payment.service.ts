import { api } from "@/lib/api";
import type { ApiResponse } from "@skerp/types";
import {
  unwrapApiResponse,
  unwrapListResponse,
  type ListQuery,
  type ListResult,
} from "@/features/masters/_shared/master-api";

export type VendorPaymentType =
  | "TRANSPORTER"
  | "HAMALI"
  | "LDC_BROKER"
  | "JOBCARD";
export type VendorPaymentStatus =
  | "DRAFT"
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "PARTIALLY_PAID"
  | "PAID"
  | "CANCELLED";
export type VendorPaymentSourceType =
  | "LR"
  | "LR_GROUP"
  | "GRN_HAMALI"
  | "RAIL_BRANCH_GRN"
  | "VP_LOADING"
  | "DELIVERY_CHALLAN";

/** An issued delivery challan the LDC broker can be paid for — one slip line.
 *  Detention is computed by the server from the broker's slab. */
export type EligibleLDCSource = {
  sourceId: string;
  /** Challan number. */
  label: string;
  /** Who bears the last-mile freight. Always `COMPANY` on a payable row
   *  (Q1); on a review row, whatever was recorded — or null if nothing was. */
  paymentBy: "COMPANY" | "CLIENT" | "TRANSPORTER" | "CASH" | null;
  /** Set only on review rows — why this challan is not payable. */
  reviewReason?: string;
  vehicleNumber: string | null;
  branchId: string;
  occurredAt: string;
  freightPaise: string;
  advancePaise: string;
  /** The detention slab the figure came from; null when none matched. */
  slabName: string | null;
  /** The window the detention was measured over, and the day count. */
  reportingAt: string | null;
  unloadingAt: string | null;
  detentionDays: number | null;
  /** Every LR on this challan. */
  lrNumbers: string[];
  detentionPaise: string;
  /** Why the detention figure may be wrong (missing dates, no slab, …). */
  detentionWarnings: string[];
};

/**
 * One LDC slip line's detention working, re-derived for the approver (L0-3).
 *
 * `storedDetentionPaise` is what the slip carries and what was posted — it is
 * the authoritative figure. `recomputedDetentionPaise` is what the slab prices
 * it at now; when the two differ (`drifts`) a slab was re-rated after the slip
 * was made, and the UI says so rather than replacing the stored amount.
 */
export type SlipLineDetention = {
  /** The DeliveryChallan id — matches the slip line's `sourceId`. */
  sourceId: string;
  storedDetentionPaise: string;
  recomputedDetentionPaise: string | null;
  drifts: boolean;
  slabName: string | null;
  reportingAt: string | null;
  unloadingAt: string | null;
  detentionDays: number | null;
  lrNumbers: string[];
  warnings: string[];
};

export type EligibleTransporterLR = {
  lrId: string;
  lrNumber: string;
  groupId: string;
  groupNumber: string;
  originBranchId: string;
  marketVehicleNumber: string | null;
  deliveredAt: string | null;
  /** Only one LR per truck carries the truck's freight/advance/commission/
   *  hamali/TDS; the group's other LRs show 0 for those (ERP-58). */
  ownsTruckAmounts: boolean;
  freightPaise: string;
  detentionPaise: string;
  advancePaise: string;
  commissionPaise: string;
  hamaliPaise: string;
  tdsPaise: string;
  damagePaise: string;
  stationeryPaise: string;
};

/** One LR of a truck, as shown on a truck line. */
export type TruckLR = {
  lrId: string;
  lrNumber: string;
  status: string;
  unloadingPoint: string | null;
  deliveredAt: string | null;
  detentionPaise: string;
  damagePaise: string;
};

/** A market truck (LR group) the transporter is paid for — one slip line.
 *  Freight/advance/commission/hamali/TDS are the truck's, counted once;
 *  detention/damage are the sum of its LRs'. */
export type EligibleTransporterTruck = {
  groupId: string;
  groupNumber: string;
  originBranchId: string;
  vehicleNumber: string | null;
  /** Every LR delivered — only a ready truck can be paid. */
  ready: boolean;
  pendingLrNumbers: string[];
  lrs: TruckLR[];
  freightPaise: string;
  detentionPaise: string;
  advancePaise: string;
  commissionPaise: string;
  hamaliPaise: string;
  tdsPaise: string;
  damagePaise: string;
  stationeryPaise: string;
};

export type HamaliSourceType = "GRN_HAMALI" | "RAIL_BRANCH_GRN" | "VP_LOADING";

export type EligibleHamaliSource = {
  sourceType: HamaliSourceType;
  sourceId: string;
  label: string;
  branchId: string | null;
  occurredAt: string | null;
  hamaliPaise: string;
};

export type VendorPaymentSlipLineInput = {
  sourceType: VendorPaymentSourceType;
  sourceId: string;
  freightPaise: string;
  detentionPaise: string;
  advancePaise: string;
  commissionPaise: string;
  hamaliPaise: string;
  tdsPaise: string;
  damagePaise: string;
  stationeryPaise: string;
  /** LDC_BROKER only — the broker's filed detention claim. `null` or omitted
   *  means no claim was filed, and the server pays the slab amount. Send `0`
   *  only to mean a filed claim of zero. */
  claimedDetentionPaise?: string | null;
};

/** What a slip line pays for, resolved by the server. */
export type VendorPaymentLineSource = {
  label: string;
  vehicleNumber: string | null;
  lrs: Array<{
    lrNumber: string;
    unloadingPoint: string | null;
    deliveredAt: string | null;
    detentionPaise: string;
    damagePaise: string;
  }>;
};

export type VendorPaymentSlipLine = VendorPaymentSlipLineInput & {
  id: string;
  netPaise: string;
  isActive: boolean;
  source?: VendorPaymentLineSource | null;
  /** LDC_BROKER only — how the detention figure was reached, snapshotted at
   *  slip time so a paid slip stays explainable. */
  detentionDays?: number | null;
  detentionSlabName?: string | null;
  /** The broker’s claim, when it differed from the slab. */
  claimedDetentionPaise?: string | null;
  /** LDC_BROKER only — the heads the approver ruled on (L4). Parking,
   *  labour and other are what the broker is allowed to charge; shortage is
   *  recovered from him, like damage. Derived server-side from the DC
   *  approval, never sent by the client. */
  parkingPaise?: string;
  labourPaise?: string;
  otherPaise?: string;
  shortagePaise?: string;
};

type NamedUser = { id: string; firstName: string; lastName: string } | null;

export type VendorPaymentSlip = {
  id: string;
  version: number;
  slipNumber: string;
  type: VendorPaymentType;
  status: VendorPaymentStatus;
  branchId: string;
  fyCode: string;
  transportId: string | null;
  labourId: string | null;
  grossPayablePaise: string;
  totalDeductionsPaise: string;
  netPayablePaise: string;
  paidPaise: string;
  accrualJournalEntryId: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  createdAt: string;
  branch?: { id: string; name: string; branchCode: string };
  transport?: { id: string; name: string } | null;
  labour?: { id: string; name: string } | null;
  createdBy?: NamedUser;
  approvedBy?: NamedUser;
  rejectedBy?: NamedUser;
  cancelledBy?: NamedUser;
  lines?: VendorPaymentSlipLine[];
  disbursements?: Array<{
    id: string;
    paidPaise: string;
    mode: string;
    paidAt: string;
    referenceNo: string | null;
    settlementJournalEntryId: string | null;
    createdAt: string;
  }>;
  _count?: { lines: number; disbursements: number };
};

export type CreateVendorPaymentSlipBody = {
  type: VendorPaymentType;
  branchId: string;
  transportId?: string;
  labourId?: string;
  /** Required for HAMALI and LDC_BROKER — basis points (200 = 2%), applied
   *  per line via roundPaiseByBps server-side. Unused for TRANSPORTER. */
  tdsRateBps?: number;
  lines: VendorPaymentSlipLineInput[];
};

export type UpdateVendorPaymentSlipBody = {
  lines: VendorPaymentSlipLineInput[];
  tdsRateBps?: number;
  version: number;
};

export type PaymentMode = "CASH" | "BANK" | "UPI" | "CHEQUE";

export type CreateVendorPaymentDisbursementBody = {
  paidPaise: string;
  mode: PaymentMode;
  paidAt: string;
  referenceNo?: string;
  fundingLedgerId: string;
  /** Generate once per disbursement attempt (e.g. crypto.randomUUID() on
   *  page mount) and reuse it across retries of the *same* attempt — this
   *  is what makes a retried request a no-op instead of a duplicate payment. */
  clientRequestId: string;
};

const get = async <T>(
  url: string,
  params?: Record<string, string | undefined>,
) => {
  const response = await api.get<ApiResponse<T>>(url, { params });
  return unwrapApiResponse(response);
};

const post = async <T>(url: string, body?: unknown) => {
  const response = await api.post<ApiResponse<T>>(url, body ?? {});
  return unwrapApiResponse(response);
};

export type VendorPaymentSlipListQuery = ListQuery & {
  type?: VendorPaymentType;
  /** One status, or several — sent as a comma-separated list. */
  status?: VendorPaymentStatus | VendorPaymentStatus[];
};

const listSlips = async (
  query?: VendorPaymentSlipListQuery,
): Promise<ListResult<VendorPaymentSlip>> => {
  const { type, status, ...listQuery } = query ?? {};
  const statuses = Array.isArray(status) ? status : status ? [status] : [];
  const search = listQuery.search?.trim();
  const response = await api.get<ApiResponse<VendorPaymentSlip[]>>(
    "/vendor-payment/slips",
    {
      params: {
        ...(type ? { type } : {}),
        ...(statuses.length ? { status: statuses.join(",") } : {}),
        ...(search ? { search } : {}),
        ...(listQuery.page !== undefined ? { page: listQuery.page } : {}),
        ...(listQuery.size !== undefined ? { size: listQuery.size } : {}),
      },
    },
  );
  return unwrapListResponse(response);
};

/** One chunk of an eligible-source list. Ask for the next chunk with
 *  `nextCursor` until it comes back null — there is no fixed cap or count. */
export type EligibleChunk<T> = { items: T[]; nextCursor: string | null };

type EligibleChunkFilters = {
  branchId?: string;
  from?: string;
  to?: string;
  /** Matched in the database, so it covers every eligible row — not just the
   *  chunks already loaded. */
  search?: string;
  cursor?: string;
  size?: number;
};

const chunkParams = ({ size, search, ...rest }: EligibleChunkFilters) => ({
  ...rest,
  search: search?.trim() || undefined,
  size: size === undefined ? undefined : String(size),
});

export type VendorPaymentSlipSummary = {
  draftCount: number;
  pendingApprovalCount: number;
  outstandingPaise: string;
};

export const vendorPaymentApi = {
  eligibleTransporterLRs: (
    filters: EligibleChunkFilters & { transportId: string },
  ) =>
    get<EligibleChunk<EligibleTransporterLR>>(
      "/vendor-payment/calculators/transporter",
      { ...chunkParams(filters), transportId: filters.transportId },
    ),
  eligibleTransporterTrucks: (
    filters: EligibleChunkFilters & { transportId: string },
  ) =>
    get<EligibleChunk<EligibleTransporterTruck>>(
      "/vendor-payment/calculators/transporter-trucks",
      { ...chunkParams(filters), transportId: filters.transportId },
    ),
  /** Page-based (challans are one table), unlike the cursor-chunked lists. */
  eligibleLDCSources: async (filters: {
    transportId: string;
    branchId?: string;
    from?: string;
    to?: string;
    search?: string;
    page: number;
    size: number;
    /** `PAYABLE` (default) — challans the broker can be paid for.
     *  `REVIEW` — the ones held back by the payment-by rule, listed so they
     *  stay visible. Review rows are never selectable. */
    mode?: "PAYABLE" | "REVIEW";
  }): Promise<ListResult<EligibleLDCSource>> => {
    const response = await api.get<ApiResponse<EligibleLDCSource[]>>(
      "/vendor-payment/calculators/ldc-broker",
      { params: { ...filters, search: filters.search?.trim() || undefined } },
    );
    return unwrapListResponse(response);
  },
  eligibleHamaliSources: (
    filters: EligibleChunkFilters & { labourId: string },
  ) =>
    get<EligibleChunk<EligibleHamaliSource>>(
      "/vendor-payment/calculators/hamali",
      {
        ...chunkParams(filters),
        labourId: filters.labourId,
      },
    ),
  slipSummary: () =>
    get<VendorPaymentSlipSummary>("/vendor-payment/slips/summary"),
  createSlip: (body: CreateVendorPaymentSlipBody) =>
    post<VendorPaymentSlip>("/vendor-payment/slips", body),
  updateSlip: (id: string, body: UpdateVendorPaymentSlipBody) =>
    api
      .patch<
        ApiResponse<VendorPaymentSlip>
      >(`/vendor-payment/slips/${id}`, body)
      .then(unwrapApiResponse),
  submitSlip: (id: string, version: number) =>
    post<VendorPaymentSlip>(`/vendor-payment/slips/${id}/submit`, { version }),
  approveSlip: (id: string, version: number) =>
    post<VendorPaymentSlip>(`/vendor-payment/slips/${id}/approve`, { version }),
  rejectSlip: (id: string, version: number, reason: string) =>
    post<VendorPaymentSlip>(`/vendor-payment/slips/${id}/reject`, {
      version,
      reason,
    }),
  disburse: (id: string, body: CreateVendorPaymentDisbursementBody) =>
    post<VendorPaymentSlip>(`/vendor-payment/slips/${id}/disburse`, body),
  cancelSlip: (id: string, version: number, reason: string) =>
    post<VendorPaymentSlip>(`/vendor-payment/slips/${id}/cancel`, {
      version,
      reason,
    }),
  listSlips,
  slip: (id: string) => get<VendorPaymentSlip>(`/vendor-payment/slips/${id}`),
  /** The detention working behind an LDC slip's lines (L0-3). `[]` for any
   *  slip with no challan lines, so the caller need not branch on type. */
  slipDetention: (id: string) =>
    get<SlipLineDetention[]>(`/vendor-payment/slips/${id}/detention`),
};
