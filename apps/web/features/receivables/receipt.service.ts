import { api } from "@/lib/api";
import type { ApiResponse } from "@skerp/types";
import { unwrapApiResponse } from "@/features/masters/_shared/master-api";
import type {
  JournalStatus,
  TallySyncStatus,
  Voucher,
} from "@/features/ledger/voucher.types";

export type ReceiptPaymentMode = "CASH" | "CHEQUE" | "BANK" | "UPI";
export type ReceiptStatus =
  | "DRAFT"
  | "PENDING_APPROVAL"
  | "POSTED"
  | "CANCELLED";

export type OutstandingBill = {
  id: string;
  billNumber: string | null;
  billDate: string;
  branchId: string;
  branchName: string;
  lrNumber: string | null;
  additionalLRCount: number;
  truckNumber: string | null;
  totalAmountPaise: string;
  outstandingAmountPaise: string;
  taxableAmountPaise: string;
};

export type OutstandingBillsFilters = {
  branchId?: string;
  customerId: string;
  truckNumber?: string;
  lrNumber?: string;
  uptoDate?: string;
  billNumber?: string;

};

export type ReceiptAllocationInput = {
  billId: string;
  amountAppliedPaise: string;
  tdsAmountPaise: string;
  tdsSection?: string;
  damageAmountPaise: string;
  rateDiffAmountPaise: string;
};

export type CreateReceiptDraft = {
  branchId: string;
  customerId: string;
  receivedAt: string;
  paymentMode: ReceiptPaymentMode;
  receivedIntoAccountId: string;
  referenceNumber?: string;
  remarks?: string;
  allocations: ReceiptAllocationInput[];
};

type NamedUser = { id: string; firstName: string; lastName: string } | null;

export type ReceiptAllocation = {
  id: string;
  billId: string;
  amountAppliedPaise: string;
  tdsAmountPaise: string;
  tdsSection: string | null;
  tdsCertNumber: string | null;
  tdsCertDate: string | null;
  damageAmountPaise: string;
  rateDiffAmountPaise: string;
  createdAt: string;
  bill: {
    id: string;
    billNumber: string | null;
    billDate: string;
    totalAmountPaise: string;
    outstandingAmountPaise: string;
    status: string;
  };
};

export type ReceiptStatusHistoryEntry = {
  id: string;
  fromStatus: ReceiptStatus | null;
  toStatus: ReceiptStatus;
  reason: string | null;
  changedById: string;
  changedAt: string;
};

export type Receipt = {
  id: string;
  receiptNumber: string | null;
  fyCode: string;
  status: ReceiptStatus;
  amountPaise: string;
  unallocatedPaise: string;
  paymentMode: ReceiptPaymentMode;
  referenceNumber: string | null;
  receivedAt: string;
  remarks: string | null;
  version: number;
  createdAt: string;
  cancellationReason: string | null;
  customer: { id: string; name: string; gstNo: string | null };
  branch: { id: string; name: string; branchCode: string };
  receivedIntoAccount: { id: string; name: string; type: string } | null;
  createdBy: NamedUser;
  approvedBy: NamedUser;
  cancelledBy: NamedUser;
  allocations: ReceiptAllocation[];
  statusHistory: ReceiptStatusHistoryEntry[];
  journalEntryId?: string | null;
  journalEntry?: {
    id: string;
    voucherNumber: string;
    status: JournalStatus;
    tallySyncStatus?: TallySyncStatus;
  } | null;
};

/**
 * Slim response from create/approve/cancel — none of these callers read
 * anything beyond id/status (create navigates to the detail page, which
 * fetches full detail itself; approve/cancel just invalidate and refetch).
 */
export type ReceiptStatusPatch = Pick<Receipt, "id" | "status">;

export type ReceiptListItem = {
  id: string;
  receiptNumber: string | null;
  status: ReceiptStatus;
  amountPaise: string;
  receivedAt: string;
  createdAt: string;
  customer: { id: string; name: string };
  branch: { name: string; branchCode: string };
  _count: { allocations: number };
  journalEntry?: {
    id: string;
    voucherNumber: string;
    status: JournalStatus;
    tallySyncStatus?: TallySyncStatus;
  } | null;
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

export const receiptApi = {
  outstandingBills: (filters: OutstandingBillsFilters) =>
    get<OutstandingBill[]>("/receipt/outstanding-bills", filters),
  create: (body: CreateReceiptDraft) =>
    post<ReceiptStatusPatch>("/receipt", body),
  list: (status?: ReceiptStatus) =>
    get<ReceiptListItem[]>("/receipt", status ? { status } : undefined),
  receipt: (id: string) => get<Receipt>(`/receipt/${id}`),
  approve: (id: string, reason?: string) =>
    post<ReceiptStatusPatch>(
      `/receipt/${id}/approve`,
      reason ? { reason } : undefined,
    ),
  cancel: (id: string, reason: string) =>
    post<ReceiptStatusPatch>(`/receipt/${id}/cancel`, { reason }),
  voucher: (id: string) => get<Voucher>(`/receipt/${id}/voucher`),
};
