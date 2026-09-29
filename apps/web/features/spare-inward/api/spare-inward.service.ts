import { api } from "@/lib/api";
import type { ApiResponse } from "@skerp/types";
import {
  unwrapApiResponse,
  unwrapListResponse,
  type ListResult,
} from "@/features/masters/_shared/master-api";
import type { PurchaseOrderStatus } from "@/features/purchase-order/api/purchase-order.service";

export type OpenPurchaseOrderOption = {
  id: string;
  poNumber: string | null;
  status: PurchaseOrderStatus;
  estimatedPaise: string;
};

export type SpareInwardStatus = "DRAFT" | "POSTED" | "CANCELLED";

export type SpareInwardLine = {
  id: string;
  poLineId: string;
  sparePartId: string;
  qtyReceived: number;
  qtyRejected: number;
  ratePaise: string;
  amountPaise: string;
  batchNo: string | null;
  warrantyExpiry: string | null;
  guaranteeExpiry: string | null;
  sparePart: { id: string; name: string; unit: string };
};

export type SpareInward = {
  id: string;
  inwardNumber: string | null;
  fyCode: string;
  branchId: string;
  poId: string;
  supplierId: string;
  status: SpareInwardStatus;
  inwardDate: string;
  supplierInvoiceNo: string;
  supplierInvoiceDate: string | null;
  grossAmountPaise: string;
  discountPaise: string;
  payableAmountPaise: string;
  remarks: string | null;
  branch: { id: string; name: string; branchCode: string };
  supplier: { id: string; name: string; shopName: string | null };
  po: { id: string; poNumber: string | null; status: string };
  createdBy: { id: string; firstName: string; lastName: string } | null;
  lines: SpareInwardLine[];
  journalEntry: { id: string; voucherNumber: string; status: string } | null;
  createdAt: string;
};

export type SpareInwardLineInput = {
  poLineId: string;
  sparePartId: string;
  qtyReceived: number;
  qtyRejected?: number;
  ratePaise: number;
  batchNo?: string;
  warrantyExpiry?: string;
  guaranteeExpiry?: string;
};

export type CreateSpareInwardBody = {
  poId: string;
  inwardDate: string;
  supplierInvoiceNo: string;
  supplierInvoiceDate?: string;
  discountPaise?: number;
  remarks?: string;
  lines: SpareInwardLineInput[];
};

export const spareInwardApi = {
  list: async (params?: {
    branchId?: string;
    poId?: string;
    supplierId?: string;
    status?: SpareInwardStatus;
    search?: string;
    page?: number;
    size?: number;
  }): Promise<ListResult<SpareInward>> => {
    const res = await api.get<ApiResponse<SpareInward[]>>("/spare-inward", { params });
    return unwrapListResponse(res);
  },

  get: async (id: string) => {
    const res = await api.get<ApiResponse<SpareInward>>(`/spare-inward/${id}`);
    return unwrapApiResponse(res);
  },

  create: async (body: CreateSpareInwardBody) => {
    const res = await api.post<ApiResponse<SpareInward>>("/spare-inward", body);
    return unwrapApiResponse(res);
  },

  cancel: async (id: string, reason: string) => {
    const res = await api.post<ApiResponse<SpareInward>>(`/spare-inward/${id}/cancel`, { reason });
    return unwrapApiResponse(res);
  },

  /** Open purchase orders (still receivable against) for one supplier —
   *  filtered server-side, id/number/status/estimate only. Previously this
   *  fetched every PO for the supplier (any status, full detail incl. every
   *  line) and filtered client-side. */
  openPurchaseOrders: async (supplierId: string): Promise<OpenPurchaseOrderOption[]> => {
    const res = await api.get<ApiResponse<OpenPurchaseOrderOption[]>>(
      "/purchase-order/lookup/open",
      { params: { supplierId, size: 100 } },
    );
    return unwrapListResponse(res).data;
  },
};
