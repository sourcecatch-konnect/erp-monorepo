import { api } from "@/lib/api";
import type { ApiResponse } from "@skerp/types";
import {
  unwrapApiResponse,
  unwrapListResponse,
  type ListResult,
} from "@/features/masters/_shared/master-api";

const LOOKUP_SIZE = { size: 1000 } as const;
const LOOKUP_PAGE_SIZE = 20;

export type JobCardStatus = "DRAFT" | "FINALISED" | "CANCELLED";
export type TruckLocationStatus = "AT_HO" | "IN_TRANSIT";
export type RemovedPartCondition = "REUSABLE" | "REPAIRABLE" | "SCRAP";

export type JobCardPartLine = {
  id: string;
  sparePartId: string;
  batchId: string;
  mechanicId: string | null;
  qty: number;
  unitCostPaise: string;
  amountPaise: string;
  description: string | null;
  sparePart: { id: string; name: string; unit: string };
  batch: { id: string; batchNo: string | null; qtyRemaining: number };
  mechanic: { id: string; name: string } | null;
};

export type JobCardServiceLine = {
  id: string;
  serviceProviderId: string;
  sparePartId: string;
  mechanicId: string | null;
  qty: number;
  ratePaise: string;
  amountPaise: string;
  description: string | null;
  billedInServiceBillId: string | null;
  sparePart: { id: string; name: string };
  serviceProvider: { id: string; name: string };
  mechanic: { id: string; name: string } | null;
};

export type JobCard = {
  id: string;
  jobCardNumber: string | null;
  fyCode: string;
  branchId: string;
  vehicleId: string;
  driverId: string;
  truckStatus: TruckLocationStatus;
  inDateTime: string;
  outDateTime: string | null;
  openingKm: number;
  closingKm: number | null;
  status: JobCardStatus;
  remarks: string | null;
  totalPartsAmountPaise: string;
  totalServiceAmountPaise: string;
  totalAmountPaise: string;
  branch: { id: string; name: string; branchCode: string };
  vehicle: { id: string; vehicleNumber: string };
  driver: { id: string; name: string };
  partLines: JobCardPartLine[];
  serviceLines: JobCardServiceLine[];
  journalEntry: { id: string; voucherNumber: string; status: string } | null;
  createdAt: string;
};

export type JobCardRemovedPart = {
  id: string;
  sparePartId: string;
  relatedPartLineId: string | null;
  qty: number;
  condition: RemovedPartCondition;
  unitCostPaise: string | null;
  remarks: string | null;
  sparePart: { id: string; name: string };
  relatedPartLine: { id: string; unitCostPaise: string; batchId: string } | null;
  newBatch: { id: string; qtyRemaining: number } | null;
  createdBy: { id: string; firstName: string; lastName: string } | null;
  journalEntry: { id: string; voucherNumber: string; status: string } | null;
  createdAt: string;
};

export type PartLineInput = {
  sparePartId: string;
  batchId: string;
  mechanicId?: string;
  qty: number;
  description?: string;
};

export type ServiceLineInput = {
  serviceProviderId: string;
  sparePartId: string;
  mechanicId?: string;
  qty: number;
  ratePaise: number;
  description?: string;
};

export type SaveJobCardBody = {
  branchId?: string;
  vehicleId?: string;
  driverId?: string;
  truckStatus?: TruckLocationStatus;
  inDateTime?: string;
  openingKm?: number;
  remarks?: string;
  partLines?: PartLineInput[];
  serviceLines?: ServiceLineInput[];
};

export type BatchOption = {
  id: string;
  batchNo: string | null;
  qtyRemaining: number;
  unitCostPaise: string;
  warrantyExpiry: string | null;
  sourceInvoiceNumber: string | null;
  source: "PURCHASE" | "RETURN";
};

export type LookupOption = { value: string; label: string };

export const jobCardApi = {
  list: async (params?: {
    branchId?: string;
    vehicleId?: string;
    status?: JobCardStatus;
    page?: number;
    size?: number;
  }): Promise<ListResult<JobCard>> => {
    const res = await api.get<ApiResponse<JobCard[]>>("/job-card", { params });
    return unwrapListResponse(res);
  },

  get: async (id: string) => {
    const res = await api.get<ApiResponse<JobCard>>(`/job-card/${id}`);
    return unwrapApiResponse(res);
  },

  create: async (body: SaveJobCardBody) => {
    const res = await api.post<ApiResponse<JobCard>>("/job-card", body);
    return unwrapApiResponse(res);
  },

  update: async (id: string, body: SaveJobCardBody) => {
    const res = await api.patch<ApiResponse<JobCard>>(`/job-card/${id}`, body);
    return unwrapApiResponse(res);
  },

  finalise: async (id: string, body: { outDateTime: string; closingKm: number }) => {
    const res = await api.post<ApiResponse<JobCard>>(`/job-card/${id}/finalise`, body);
    return unwrapApiResponse(res);
  },

  cancel: async (id: string, reason: string) => {
    const res = await api.post<ApiResponse<JobCard>>(`/job-card/${id}/cancel`, { reason });
    return unwrapApiResponse(res);
  },

  undoFinalise: async (id: string, reason: string) => {
    const res = await api.post<ApiResponse<JobCard>>(`/job-card/${id}/undo-finalise`, { reason });
    return unwrapApiResponse(res);
  },

  removedParts: async (jobCardId: string) => {
    const res = await api.get<ApiResponse<JobCardRemovedPart[]>>(
      `/job-card/${jobCardId}/removed-parts`,
    );
    return unwrapListResponse(res).data;
  },

  addRemovedPart: async (
    jobCardId: string,
    body: {
      sparePartId: string;
      relatedPartLineId?: string;
      qty: number;
      condition: RemovedPartCondition;
      unitCostPaise?: number;
      remarks?: string;
    },
  ) => {
    const res = await api.post<ApiResponse<JobCardRemovedPart>>(
      `/job-card/${jobCardId}/removed-parts`,
      body,
    );
    return unwrapApiResponse(res);
  },

  batches: async (sparePartId: string, branchId: string): Promise<BatchOption[]> => {
    const res = await api.get<ApiResponse<BatchOption[]>>("/job-card/lookup/batches", {
      params: { sparePartId, branchId },
    });
    return unwrapListResponse(res).data;
  },

  /** Single-workshop-at-HO: no branch picker on this screen — always the
   *  branch flagged Head Office. */
  headOfficeBranch: async (): Promise<{ id: string; name: string } | null> => {
    const res = await api.get<ApiResponse<{ id: string; name: string; isHeadOffice: boolean }[]>>(
      "/branches",
      { params: { ...LOOKUP_SIZE, "filter[isHeadOffice]": "true" } },
    );
    const data = unwrapListResponse(res).data;
    return data[0] ? { id: data[0].id, name: data[0].name } : null;
  },

  vehicles: async (): Promise<(LookupOption & { currentKm: number })[]> => {
    const res = await api.get<ApiResponse<{ id: string; vehicleNumber: string; currentKM: number }[]>>(
      "/vehicles",
      { params: LOOKUP_SIZE },
    );
    return unwrapListResponse(res).data.map((v) => ({
      value: v.id,
      label: v.vehicleNumber,
      currentKm: v.currentKM,
    }));
  },

  drivers: async (): Promise<LookupOption[]> => {
    const res = await api.get<ApiResponse<{ id: string; name: string }[]>>("/drivers", {
      params: LOOKUP_SIZE,
    });
    return unwrapListResponse(res).data.map((d) => ({ value: d.id, label: d.name }));
  },

  // Labours are a small, workshop-owned staff list — a plain cached list is
  // fine, no need for search-as-you-type.
  mechanics: async (): Promise<LookupOption[]> => {
    const res = await api.get<ApiResponse<{ id: string; name: string }[]>>("/labours", {
      params: { ...LOOKUP_SIZE, "filter[type]": "Mechanic" },
    });
    return unwrapListResponse(res).data.map((l) => ({ value: l.id, label: l.name }));
  },

  // Spare parts can grow into thousands of rows, so search server-side
  // instead of pulling the whole catalogue for the picker.
  spareParts: async (
    type: "Item" | "Service",
    categoryId?: string,
    search?: string,
  ): Promise<(LookupOption & { categoryId: string; ratePaise: string })[]> => {
    const res = await api.get<
      ApiResponse<{ id: string; name: string; categoryId: string; rate: string }[]>
    >("/spare-parts", {
      params: {
        size: LOOKUP_PAGE_SIZE,
        search: search || undefined,
        "filter[type]": type,
        ...(categoryId ? { "filter[categoryId]": categoryId } : {}),
      },
    });
    return unwrapListResponse(res).data.map((p) => ({
      value: p.id,
      label: p.name,
      categoryId: p.categoryId,
      ratePaise: p.rate,
    }));
  },

  // Spare categories are a small, fixed master — a plain cached list is
  // fine, no need for search-as-you-type.
  categories: async (type: "Item" | "Service"): Promise<LookupOption[]> => {
    const res = await api.get<ApiResponse<{ id: string; name: string }[]>>("/spare-category", {
      params: { ...LOOKUP_SIZE, "filter[type]": type },
    });
    return unwrapListResponse(res).data.map((c) => ({ value: c.id, label: c.name }));
  },

  // Suppliers can grow into a large list, so search server-side instead of
  // pulling all of them for the picker.
  serviceProviders: async (search?: string): Promise<LookupOption[]> => {
    // SparePartSupplier.type is free text but the master form only ever
    // writes "Item" or "Service" (spare-partSupplierForm.tsx's
    // supplierTypeOptions) — filter to "Service" so a pure parts supplier
    // (no labour/service capability) can't be picked as a Job Card provider.
    const res = await api.get<ApiResponse<{ id: string; name: string; shopName: string | null }[]>>(
      "/spare-part-suppliers",
      { params: { size: LOOKUP_PAGE_SIZE, search: search || undefined, "filter[type]": "Service" } },
    );
    return unwrapListResponse(res).data.map((s) => ({
      value: s.id,
      label: s.shopName ? `${s.name} (${s.shopName})` : s.name,
    }));
  },
};
