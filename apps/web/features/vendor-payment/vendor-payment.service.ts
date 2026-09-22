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
    createdAt: string;
  }>;
  _count?: { lines: number; disbursements: number };
};

export type CreateVendorPaymentSlipBody = {
  type: VendorPaymentType;
  branchId: string;
  transportId?: string;
  labourId?: string;
  lines: VendorPaymentSlipLineInput[];
};

export type UpdateVendorPaymentSlipBody = {
  lines: VendorPaymentSlipLineInput[];
  version: number;
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
  createSlip: (body: CreateVendorPaymentSlipBody) =>
    post<VendorPaymentSlip>("/vendor-payment/slips", body),
  updateSlip: (id: string, body: UpdateVendorPaymentSlipBody) =>
    api
      .patch<ApiResponse<VendorPaymentSlip>>(`/vendor-payment/slips/${id}`, body)
      .then(unwrapApiResponse),
  submitSlip: (id: string, version: number) =>
    post<VendorPaymentSlip>(`/vendor-payment/slips/${id}/submit`, { version }),
  listSlips,
  slip: (id: string) => get<VendorPaymentSlip>(`/vendor-payment/slips/${id}`),
};
