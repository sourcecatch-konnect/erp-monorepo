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
  | "GRN_HAMALI"
  | "RAIL_BRANCH_GRN"
  | "VP_LOADING";

export type EligibleTransporterLR = {
  lrId: string;
  lrNumber: string;
  groupId: string;
  groupNumber: string;
  originBranchId: string;
  marketVehicleNumber: string | null;
  deliveredAt: string | null;
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
};

export type VendorPaymentSlipLine = VendorPaymentSlipLineInput & {
  id: string;
  netPaise: string;
  isActive: boolean;
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
  /** Required for HAMALI — basis points (200 = 2%), applied per line via
   *  roundPaiseByBps server-side. Unused for TRANSPORTER. */
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

const get = async <T>(url: string, params?: Record<string, string | undefined>) => {
  const response = await api.get<ApiResponse<T>>(url, { params });
  return unwrapApiResponse(response);
};

const post = async <T>(url: string, body?: unknown) => {
  const response = await api.post<ApiResponse<T>>(url, body ?? {});
  return unwrapApiResponse(response);
};

export type VendorPaymentSlipListQuery = ListQuery & {
  type?: VendorPaymentType;
  status?: VendorPaymentStatus;
};

const listSlips = async (
  query?: VendorPaymentSlipListQuery,
): Promise<ListResult<VendorPaymentSlip>> => {
  const { type, status, ...listQuery } = query ?? {};
  const response = await api.get<ApiResponse<VendorPaymentSlip[]>>(
    "/vendor-payment/slips",
    {
      params: {
        ...(type ? { type } : {}),
        ...(status ? { status } : {}),
        ...(listQuery.page !== undefined ? { page: listQuery.page } : {}),
        ...(listQuery.size !== undefined ? { size: listQuery.size } : {}),
      },
    },
  );
  return unwrapListResponse(response);
};

export const vendorPaymentApi = {
  eligibleTransporterLRs: (filters: {
    transportId: string;
    branchId?: string;
    from?: string;
    to?: string;
  }) => get<EligibleTransporterLR[]>("/vendor-payment/calculators/transporter", filters),
  eligibleHamaliSources: (filters: {
    labourId: string;
    branchId?: string;
    from?: string;
    to?: string;
  }) => get<EligibleHamaliSource[]>("/vendor-payment/calculators/hamali", filters),
  createSlip: (body: CreateVendorPaymentSlipBody) =>
    post<VendorPaymentSlip>("/vendor-payment/slips", body),
  updateSlip: (id: string, body: UpdateVendorPaymentSlipBody) =>
    api
      .patch<ApiResponse<VendorPaymentSlip>>(`/vendor-payment/slips/${id}`, body)
      .then(unwrapApiResponse),
  submitSlip: (id: string, version: number) =>
    post<VendorPaymentSlip>(`/vendor-payment/slips/${id}/submit`, { version }),
  approveSlip: (id: string, version: number) =>
    post<VendorPaymentSlip>(`/vendor-payment/slips/${id}/approve`, { version }),
  rejectSlip: (id: string, version: number, reason: string) =>
    post<VendorPaymentSlip>(`/vendor-payment/slips/${id}/reject`, { version, reason }),
  disburse: (id: string, body: CreateVendorPaymentDisbursementBody) =>
    post<VendorPaymentSlip>(`/vendor-payment/slips/${id}/disburse`, body),
  cancelSlip: (id: string, version: number, reason: string) =>
    post<VendorPaymentSlip>(`/vendor-payment/slips/${id}/cancel`, { version, reason }),
  listSlips,
  slip: (id: string) => get<VendorPaymentSlip>(`/vendor-payment/slips/${id}`),
};
