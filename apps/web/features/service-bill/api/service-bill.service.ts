import { api } from "@/lib/api";
import type { ApiResponse } from "@skerp/types";
import {
  unwrapApiResponse,
  unwrapListResponse,
  type ListResult,
} from "@/features/masters/_shared/master-api";

const LOOKUP_SIZE = { size: 1000 } as const;
const LOOKUP_PAGE_SIZE = 20;

export type ServiceBillStatus = "DRAFT" | "POSTED" | "CANCELLED";
export type PaymentMode = "CASH" | "BANK" | "UPI" | "CHEQUE";

export type UnbilledServiceLine = {
  id: string;
  sparePartId: string;
  qty: number;
  ratePaise: string;
  amountPaise: string;
  description: string | null;
  jobCard: { id: string; jobCardNumber: string | null; vehicleId: string; finalisedAt: string | null };
  sparePart: { id: string; name: string };
};

export type ServiceBillLine = {
  id: string;
  amountPaise: string;
  jobCardServiceLine: UnbilledServiceLine & {
    jobCard: { id: string; jobCardNumber: string | null; vehicleId: string };
  };
};

export type ServiceBill = {
  id: string;
  serviceBillNumber: string | null;
  fyCode: string;
  branchId: string;
  serviceProviderId: string;
  status: ServiceBillStatus;
  billDate: string;
  providerInvoiceNo: string;
  providerInvoiceDate: string | null;
  grossAmountPaise: string;
  discountPaise: string;
  netAmountPaise: string;
  paidAmountPaise: string;
  remarks: string | null;
  branch: { id: string; name: string; branchCode: string };
  serviceProvider: { id: string; name: string; shopName: string | null };
  lines: ServiceBillLine[];
  journalEntry: { id: string; voucherNumber: string; status: string } | null;
  createdAt: string;
};

export type ServiceBillPayment = {
  id: string;
  paidPaise: string;
  tdsPaise: string;
  paymentMode: PaymentMode;
  paymentDate: string;
  referenceNumber: string | null;
  remarks: string | null;
  fromAccount: { id: string; name: string; type: string };
  journalEntry: { id: string; voucherNumber: string; status: string } | null;
  createdAt: string;
};

export type LookupOption = { value: string; label: string };

export const serviceBillApi = {
  list: async (params?: {
    branchId?: string;
    serviceProviderId?: string;
    status?: ServiceBillStatus;
    page?: number;
    size?: number;
  }): Promise<ListResult<ServiceBill>> => {
    const res = await api.get<ApiResponse<ServiceBill[]>>("/service-bill", { params });
    return unwrapListResponse(res);
  },

  get: async (id: string) => {
    const res = await api.get<ApiResponse<ServiceBill>>(`/service-bill/${id}`);
    return unwrapApiResponse(res);
  },

  unbilledLines: async (serviceProviderId: string, uptoDate?: string) => {
    const res = await api.get<ApiResponse<UnbilledServiceLine[]>>("/service-bill/unbilled-lines", {
      params: { serviceProviderId, uptoDate },
    });
    return unwrapListResponse(res).data;
  },

  create: async (body: {
    branchId: string;
    serviceProviderId: string;
    billDate: string;
    providerInvoiceNo: string;
    providerInvoiceDate?: string;
    discountPaise?: number;
    remarks?: string;
    jobCardServiceLineIds: string[];
  }) => {
    const res = await api.post<ApiResponse<ServiceBill>>("/service-bill", body);
    return unwrapApiResponse(res);
  },

  cancel: async (id: string, reason: string) => {
    const res = await api.post<ApiResponse<ServiceBill>>(`/service-bill/${id}/cancel`, { reason });
    return unwrapApiResponse(res);
  },

  payments: async (serviceBillId: string) => {
    const res = await api.get<ApiResponse<ServiceBillPayment[]>>(
      `/service-bill/${serviceBillId}/payments`,
    );
    return unwrapListResponse(res).data;
  },

  pay: async (
    serviceBillId: string,
    body: {
      paidPaise: number;
      tdsPaise?: number;
      paymentMode: PaymentMode;
      paymentDate: string;
      referenceNumber?: string;
      fromAccountId: string;
      remarks?: string;
    },
  ) => {
    const res = await api.post<ApiResponse<ServiceBillPayment>>(
      `/service-bill/${serviceBillId}/pay`,
      body,
    );
    return unwrapApiResponse(res);
  },

  /** Single-workshop-at-HO: no branch picker — always the branch flagged
   *  Head Office. */
  headOfficeBranch: async (): Promise<{ id: string; name: string } | null> => {
    const res = await api.get<ApiResponse<{ id: string; name: string; isHeadOffice: boolean }[]>>(
      "/branches",
      { params: { ...LOOKUP_SIZE, "filter[isHeadOffice]": "true" } },
    );
    const data = unwrapListResponse(res).data;
    return data[0] ? { id: data[0].id, name: data[0].name } : null;
  },

  // Suppliers can grow into a large list, so search server-side instead of
  // pulling all of them for the picker.
  serviceProviders: async (search?: string): Promise<LookupOption[]> => {
    const res = await api.get<ApiResponse<{ id: string; name: string; shopName: string | null }[]>>(
      "/spare-part-suppliers",
      { params: { size: LOOKUP_PAGE_SIZE, search: search || undefined } },
    );
    return unwrapListResponse(res).data.map((s) => ({
      value: s.id,
      label: s.shopName ? `${s.name} (${s.shopName})` : s.name,
    }));
  },

  cashAccounts: async (): Promise<LookupOption[]> => {
    const res = await api.get<ApiResponse<{ id: string; name: string }[]>>("/cash-accounts", {
      params: LOOKUP_SIZE,
    });
    return unwrapListResponse(res).data.map((a) => ({ value: a.id, label: a.name }));
  },
};
