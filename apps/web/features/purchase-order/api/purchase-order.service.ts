import { api } from "@/lib/api";
import type { ApiResponse } from "@skerp/types";
import {
  unwrapApiResponse,
  unwrapListResponse,
  type ListResult,
} from "@/features/masters/_shared/master-api";

const LOOKUP_SIZE = { size: 1000 } as const;
export const LOOKUP_PAGE_SIZE = 20;

export type PurchaseOrderStatus =
  | "DRAFT"
  | "APPROVED"
  | "SENT"
  | "PARTIALLY_RECEIVED"
  | "RECEIVED"
  | "CLOSED"
  | "CANCELLED";

export type PurchaseOrderLine = {
  id: string;
  sparePartId: string;
  lineNumber: number;
  qtyOrdered: number;
  qtyReceived: number;
  ratePaise: string;
  amountPaise: string;
  sparePart: { id: string; name: string; unit: string };
};

export type PurchaseOrder = {
  id: string;
  poNumber: string | null;
  fyCode: string;
  branchId: string;
  supplierId: string;
  status: PurchaseOrderStatus;
  poDate: string;
  expectedDate: string | null;
  remarks: string | null;
  estimatedPaise: string;
  branch: { id: string; name: string; branchCode: string };
  supplier: { id: string; name: string; shopName: string | null };
  createdBy: { id: string; firstName: string; lastName: string } | null;
  approvedBy: { id: string; firstName: string; lastName: string } | null;
  lines: PurchaseOrderLine[];
  createdAt: string;
};

export type PurchaseOrderLineInput = {
  sparePartId: string;
  qtyOrdered: number;
  ratePaise: number;
};

export type CreatePurchaseOrderBody = {
  branchId: string;
  supplierId: string;
  poDate: string;
  expectedDate?: string;
  remarks?: string;
  lines: PurchaseOrderLineInput[];
};

export type LookupOption = { value: string; label: string };

export const purchaseOrderApi = {
  list: async (params?: {
    branchId?: string;
    supplierId?: string;
    status?: PurchaseOrderStatus;
    search?: string;
    page?: number;
    size?: number;
  }): Promise<ListResult<PurchaseOrder>> => {
    const res = await api.get<ApiResponse<PurchaseOrder[]>>("/purchase-order", { params });
    return unwrapListResponse(res);
  },

  get: async (id: string) => {
    const res = await api.get<ApiResponse<PurchaseOrder>>(`/purchase-order/${id}`);
    return unwrapApiResponse(res);
  },

  create: async (body: CreatePurchaseOrderBody) => {
    const res = await api.post<ApiResponse<PurchaseOrder>>("/purchase-order", body);
    return unwrapApiResponse(res);
  },

  /** Only a DRAFT purchase order can be edited (enforced server-side). */
  update: async (id: string, body: CreatePurchaseOrderBody) => {
    const res = await api.patch<ApiResponse<PurchaseOrder>>(`/purchase-order/${id}`, body);
    return unwrapApiResponse(res);
  },

  approve: async (id: string) => {
    const res = await api.post<ApiResponse<PurchaseOrder>>(`/purchase-order/${id}/approve`);
    return unwrapApiResponse(res);
  },

  send: async (id: string) => {
    const res = await api.post<ApiResponse<PurchaseOrder>>(`/purchase-order/${id}/send`);
    return unwrapApiResponse(res);
  },

  close: async (id: string) => {
    const res = await api.post<ApiResponse<PurchaseOrder>>(`/purchase-order/${id}/close`);
    return unwrapApiResponse(res);
  },

  cancel: async (id: string, reason: string) => {
    const res = await api.post<ApiResponse<PurchaseOrder>>(`/purchase-order/${id}/cancel`, {
      reason,
    });
    return unwrapApiResponse(res);
  },

  /** Single-workshop-at-HO: the workshop screens don't ask the user to pick
   *  a branch — they just use whichever branch is flagged Head Office. */
  headOfficeBranch: async (): Promise<{ id: string; name: string } | null> => {
    const res = await api.get<ApiResponse<{ id: string; name: string; isHeadOffice: boolean }[]>>(
      "/branches",
      { params: { ...LOOKUP_SIZE, "filter[isHeadOffice]": "true" } },
    );
    const data = unwrapListResponse(res).data;
    return data[0] ? { id: data[0].id, name: data[0].name } : null;
  },

  // Suppliers can grow into a large list — paginated + infinite-scrollable
  // in the combobox rather than truncated to one page silently.
  suppliers: async (params: {
    page: number;
    size: number;
    search?: string;
  }): Promise<ListResult<LookupOption>> => {
    const res = await api.get<ApiResponse<{ id: string; name: string; shopName: string | null }[]>>(
      "/spare-part-suppliers",
      { params: { page: params.page, size: params.size, search: params.search || undefined } },
    );
    const result = unwrapListResponse(res);
    return {
      ...result,
      data: result.data.map((s) => ({
        value: s.id,
        label: s.shopName ? `${s.name} (${s.shopName})` : s.name,
      })),
    };
  },

  /** Parts with current stock at one branch + reorder threshold + the
   *  master's default rate — feeds the PO line picker. currentStock is null
   *  until a branch is picked. Paginated + infinite-scrollable — the parts
   *  catalogue can run into the thousands. */
  spareParts: async (params: {
    branchId?: string;
    search?: string;
    page: number;
    size: number;
  }): Promise<
    ListResult<
      LookupOption & {
        unit: string;
        minimumStock: number;
        currentStock: number | null;
        ratePaise: string;
      }
    >
  > => {
    const res = await api.get<
      ApiResponse<
        {
          id: string;
          name: string;
          unit: string;
          minimumStock: number;
          currentStock: number | null;
          ratePaise: string;
        }[]
      >
    >("/purchase-order/lookup/spare-parts", {
      params: {
        ...(params.branchId ? { branchId: params.branchId } : {}),
        ...(params.search ? { search: params.search } : {}),
        page: params.page,
        size: params.size,
      },
    });
    const result = unwrapListResponse(res);
    return {
      ...result,
      data: result.data.map((p) => ({
        value: p.id,
        label: p.name,
        unit: p.unit,
        minimumStock: p.minimumStock,
        currentStock: p.currentStock,
        ratePaise: p.ratePaise,
      })),
    };
  },
};
