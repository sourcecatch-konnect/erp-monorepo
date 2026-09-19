import { api } from "@/lib/api";
import type { ApiResponse } from "@skerp/types";
import {
  unwrapApiResponse,
  unwrapListResponse,
  type ListResult,
} from "@/features/masters/_shared/master-api";

const LOOKUP_SIZE = { size: 1000 } as const;
const LOOKUP_PAGE_SIZE = 20;

export type ReplacementListStatus = "PENDING" | "PARTIALLY_RECEIVED" | "RECEIVED" | "CANCELLED";
export type ReplacementType = "FREE" | "PAYABLE" | "CREDIT_NOTE";

export type ReplacementListLine = {
  id: string;
  sparePartId: string;
  originalInwardLineId: string;
  qtyRequested: number;
  qtyReceived: number;
  replacementType: ReplacementType;
  remarks: string | null;
  sparePart: { id: string; name: string; unit: string };
  originalBatch: { id: string; batchNo: string | null; unitCostPaise: string };
};

export type ReplacementList = {
  id: string;
  replacementNumber: string | null;
  fyCode: string;
  branchId: string;
  supplierId: string;
  originalInwardId: string;
  status: ReplacementListStatus;
  requestDate: string;
  remarks: string | null;
  branch: { id: string; name: string; branchCode: string };
  supplier: { id: string; name: string; shopName: string | null };
  originalInward: { id: string; inwardNumber: string | null };
  lines: ReplacementListLine[];
  createdAt: string;
};

export type ReplacementInwardLine = {
  id: string;
  replacementListLineId: string;
  qtyReceived: number;
  differentialRatePaise: string;
  differentialAmountPaise: string;
  sparePart: { id: string; name: string };
};

export type ReplacementInward = {
  id: string;
  replacementInwardNumber: string | null;
  branchId: string;
  replacementListId: string;
  supplierId: string;
  status: string;
  inwardDate: string;
  supplierChallanNo: string | null;
  differentialAmountPaise: string;
  supplier: { id: string; name: string };
  replacementList: { id: string; replacementNumber: string | null; status: string };
  lines: ReplacementInwardLine[];
  journalEntry: { id: string; voucherNumber: string; status: string } | null;
  createdAt: string;
};

export type InwardOption = {
  id: string;
  inwardNumber: string | null;
  supplierInvoiceNo: string;
};
export type OriginalInwardDetail = {
  id: string;
  inwardNumber: string | null;
  supplierInvoiceNo: string;
  lines: {
    id: string;
    sparePartId: string;
    qtyReceived: number;
    ratePaise: string;
    sparePart: { id: string; name: string; unit: string };
    batch: { id: string; batchNo: string | null; qtyRemaining: number } | null;
  }[];
};

export type LookupOption = { value: string; label: string };

export const supplierReplacementApi = {
  listReplacementLists: async (params?: {
    supplierId?: string;
    status?: ReplacementListStatus;
    page?: number;
    size?: number;
  }): Promise<ListResult<ReplacementList>> => {
    const res = await api.get<ApiResponse<ReplacementList[]>>("/supplier-replacement/replacement-list", {
      params,
    });
    return unwrapListResponse(res);
  },

  createReplacementList: async (body: {
    branchId: string;
    supplierId: string;
    originalInwardId: string;
    requestDate: string;
    remarks?: string;
    lines: {
      sparePartId: string;
      originalInwardLineId: string;
      qtyRequested: number;
      replacementType: ReplacementType;
      remarks?: string;
    }[];
  }) => {
    const res = await api.post<ApiResponse<ReplacementList>>(
      "/supplier-replacement/replacement-list",
      body,
    );
    return unwrapApiResponse(res);
  },

  get: async (id: string): Promise<ReplacementList> => {
    const res = await api.get<ApiResponse<ReplacementList>>(
      `/supplier-replacement/replacement-list/${id}`,
    );
    return unwrapApiResponse(res);
  },

  cancelReplacementList: async (id: string, reason: string) => {
    const res = await api.post<ApiResponse<ReplacementList>>(
      `/supplier-replacement/replacement-list/${id}/cancel`,
      { reason },
    );
    return unwrapApiResponse(res);
  },

  listReplacementInwards: async (
    replacementListId: string,
    params?: { page?: number; size?: number },
  ): Promise<ListResult<ReplacementInward>> => {
    const res = await api.get<ApiResponse<ReplacementInward[]>>(
      "/supplier-replacement/replacement-inward",
      { params: { replacementListId, ...params } },
    );
    return unwrapListResponse(res);
  },

  createReplacementInward: async (body: {
    replacementListId: string;
    inwardDate: string;
    supplierChallanNo?: string;
    supplierChallanDate?: string;
    remarks?: string;
    lines: {
      replacementListLineId: string;
      qtyReceived: number;
      differentialRatePaise?: number;
      batchNo?: string;
      warrantyExpiry?: string;
      guaranteeExpiry?: string;
    }[];
  }) => {
    const res = await api.post<ApiResponse<ReplacementInward>>(
      "/supplier-replacement/replacement-inward",
      body,
    );
    return unwrapApiResponse(res);
  },

  /** CREDIT_NOTE lines never get a physical batch back — this settles them
   *  directly with an amount per line instead of going through
   *  createReplacementInward. */
  createReplacementCreditNote: async (
    replacementListId: string,
    body: {
      creditNoteDate: string;
      supplierChallanNo?: string;
      remarks?: string;
      lines: { replacementListLineId: string; amountPaise: number }[];
    },
  ) => {
    const res = await api.post<ApiResponse<ReplacementList>>(
      `/supplier-replacement/replacement-list/${replacementListId}/credit-note`,
      body,
    );
    return unwrapApiResponse(res);
  },

  /** Posted inwards for a supplier — the source a Replacement List is keyed off. */
  postedInwardsForSupplier: async (supplierId: string): Promise<InwardOption[]> => {
    const res = await api.get<ApiResponse<InwardOption[]>>("/spare-inward", {
      params: { supplierId, status: "POSTED" },
    });
    return unwrapListResponse(res).data;
  },

  originalInward: async (id: string): Promise<OriginalInwardDetail> => {
    const res = await api.get<ApiResponse<OriginalInwardDetail>>(`/spare-inward/${id}`);
    return unwrapApiResponse(res);
  },

  /** Single-workshop-at-HO: no branch picker — just the HO branch, fixed. */
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
  suppliers: async (search?: string): Promise<LookupOption[]> => {
    const res = await api.get<ApiResponse<{ id: string; name: string; shopName: string | null }[]>>(
      "/spare-part-suppliers",
      { params: { size: LOOKUP_PAGE_SIZE, search: search || undefined } },
    );
    return unwrapListResponse(res).data.map((s) => ({
      value: s.id,
      label: s.shopName ? `${s.name} (${s.shopName})` : s.name,
    }));
  },
};
