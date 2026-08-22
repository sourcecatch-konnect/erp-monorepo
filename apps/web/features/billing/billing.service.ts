import { api } from "@/lib/api";
import type { ApiResponse } from "@skerp/types";
import { unwrapApiResponse } from "@/features/masters/_shared/master-api";

export type BillType = "ROAD" | "ROAD_RAIL" | "ROAD_GTA";
export type BillPartyType = "CONSIGNOR" | "CONSIGNEE";
export type ChargeMechanism =
  | "NOT_APPLICABLE"
  | "FORWARD_CHARGE"
  | "REVERSE_CHARGE";

export type BillingOptions = {
  branches: Array<{
    id: string;
    name: string;
    branchCode: string;
    gstNo: string | null;
    companyId: string;
    address: string | null;
    city: {
      id: string;
      name: string;
      state: { id: string; name: string };
    } | null;
  }>;
};

export type EligibleClient = {
  id: string;
  name: string;
  splitBillsByChargeType: boolean;
};

export type EligibleLR = {
  id: string;
  groupId: string;
  groupNumber: string;
  lrNumber: string;
  lrDate: string;
  billingStatus: string;
  transportType: string;
  origin: string;
  destination: string;
  placeOfSupply: { id: string; name: string } | null;
  consignor: { id: string; name: string; gstNo: string | null };
  consignee: { id: string; name: string; gstNo: string | null };
  podReceivedAt: string | null;
  isCompanionOnly: boolean;
  sharedFreightOwnerLRNumber: string | null;
  charges: Array<{
    id: string;
    type: string;
    effect: "ADDITION" | "DEDUCTION";
    description: string | null;
    isTaxable: boolean;
    approvedAmountPaise: string;
    allocatedAmountPaise: string;
    remainingAmountPaise: string;
  }>;
};

type InvoiceState = { id: string; name: string };

type InvoiceCity = {
  id: string;
  name: string;
  state?: InvoiceState;
};

type InvoiceParty = {
  id: string;
  name: string;
  splitBillsByChargeType?: boolean;
  address: string | null;
  gstNo: string | null;
  customerPAN: string | null;
  city: InvoiceCity;
  state: InvoiceState;
};

type InvoiceLocation = {
  id: string;
  name: string;
  address: string | null;
  gstNo: string | null;
  city: InvoiceCity;
};

type InvoiceVehicle = {
  id: string;
  vehicleNumber: string;
  bodyType: string | null;
  capacityMT: number;
  vehicleTypeRef: { id: string; code: string; name: string };
};

export type BillLRDetail = {
  id: string;
  lrNumber: string;
  createdAt: string;
  status: string;
  billingStatus: string;
  invoiceNumber: string | null;
  invoiceAmount: string | null;
  totalWeight: string | null;
  unit: string | null;
  weightUnit: { id: string; code: string; name: string } | null;
  loadingLocation: InvoiceLocation | null;
  unloadingLocation: InvoiceLocation | null;
  goods: Array<{
    id: string;
    name: string;
    description: string | null;
    quantity: number;
    unit: string | null;
    weight: string | null;
    quantityUnit: { id: string; code: string; name: string } | null;
    weightUnit: { id: string; code: string; name: string } | null;
  }>;
  delivery: {
    deliveredAt: string;
    reportedAt: string | null;
    unloadingAt: string | null;
    unloadingCharges: string | null;
  } | null;
  acknowledgement: {
    receivedAt: string;
    detentionDays: number | null;
    detentionAmount: string | null;
    damageAmount: string | null;
  } | null;
  group: {
    id: string;
    groupNumber: string;
    transportType: string;
    isMarketVehicle: boolean;
    marketVehicleNumber: string | null;
    baseFreightAmount: string | null;
    order: { id: string; orderNumber: string } | null;
    consignor: InvoiceParty;
    consignee: InvoiceParty;
    originBranch: {
      id: string;
      name: string;
      address: string | null;
      city: InvoiceCity | null;
    };
    destinationBranch: {
      id: string;
      name: string;
      address: string | null;
      city: InvoiceCity | null;
    };
    transport: { id: string; name: string } | null;
    marketTransport: { id: string; name: string } | null;
    marketVehicle: InvoiceVehicle | null;
    primaryTrip: {
      id: string;
      tripNumber: string;
      vehicle: InvoiceVehicle;
    } | null;
    secondaryTrip: {
      id: string;
      tripNumber: string;
      vehicle: InvoiceVehicle;
    } | null;
  };
};

export type Bill = {
  id: string;
  version: number;
  billNumber: string | null;
  status: string;
  billType: BillType;
  billingPartyType: BillPartyType;
  chargeMechanism: ChargeMechanism;
  taxTreatment: string;
  billDate: string;
  billingCutoffDate?: string | null;
  billingPartyNameSnapshot: string;
  billingGstinSnapshot: string | null;
  billingAddressSnapshot: string | null;
  supplierNameSnapshot: string;
  supplierGstinSnapshot: string | null;
  supplierAddressSnapshot: string | null;
  supplierStateNameSnapshot: string;
  placeOfSupplyNameSnapshot: string;
  subtotalAmountPaise: string;
  taxableAmountPaise: string;
  taxAmountPaise: string;
  roundOffPaise: string;
  totalAmountPaise: string;
  outstandingAmountPaise: string;
  branch: {
    id?: string;
    name: string;
    branchCode: string;
    address?: string | null;
    gstNo?: string | null;
    city?: InvoiceCity | null;
  };
  company?: {
    id: string;
    name: string;
    address: string | null;
    companyPAN: string | null;
    city: InvoiceCity | null;
    state: InvoiceState | null;
  };
  serviceCustomer?: InvoiceParty;
  billingCustomer?: InvoiceParty;
  billingLocation?: InvoiceLocation | null;
  placeOfSupplyState?: { id: string; name: string };
  lines?: Array<{
    id: string;
    lrId: string;
    chargeTypeSnapshot: string;
    effectSnapshot: "ADDITION" | "DEDUCTION";
    descriptionSnapshot: string | null;
    amountPaise: string;
    lr: BillLRDetail;
  }>;
  taxLines?: Array<{
    id: string;
    taxType: string;
    rateBps: number;
    taxableAmountPaise: string;
    taxAmountPaise: string;
  }>;
  // Every LR on a billed truck, including companions that carry no charge
  // of their own (their freight is billed through another LR on this bill).
  lrLinks?: Array<{
    lrId: string;
    lr: {
      id: string;
      lrNumber: string;
      status: string;
      billingStatus: string;
      totalWeight: string | null;
      unit: string | null;
      weightUnit: { id: string; code: string; name: string } | null;
    };
  }>;
  _count?: { lines: number };
};

/**
 * Slim response from status-only transitions (submit/approve/return-to-draft/
 * cancel) — none of these change line/LR/group data, so the backend skips
 * the deep detail fetch and returns just the changed fields. Callers must
 * merge this onto their existing full `Bill` state, not replace it.
 */
export type BillStatusPatch = Pick<Bill, "id" | "version" | "status">;

export type AvailableBillCharge = {
  id: string;
  lrId: string;
  lrNumber: string;
  type: string;
  effect: "ADDITION" | "DEDUCTION";
  description: string | null;
  source: string;
  remainingAmountPaise: string;
};

export type EligibilityFilters = {
  branchId: string;
  billingPartyType: BillPartyType;
  customerId: string;
  billType: BillType;
  cutoffDate?: string;
  search?: string;
};

export type EligibleClientFilters = Omit<EligibilityFilters, "customerId">;

export type CreateBillDraft = {
  branchId: string;
  billType: BillType;
  billingPartyType: BillPartyType;
  customerId: string;
  chargeMechanism?: ChargeMechanism;
  billDate: string;
  billingCutoffDate?: string | null;
  remarks?: string | null;
  lrChargeIds: string[];
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

export const billingApi = {
  options: () => get<BillingOptions>("/billing/options"),
  eligibleClients: (filters: EligibleClientFilters) =>
    get<EligibleClient[]>("/billing/eligible-clients", filters),
  eligibleLRs: (filters: EligibilityFilters) =>
    get<EligibleLR[]>("/billing/eligible-lrs", filters),
  evaluateEligible: (filters: EligibilityFilters) =>
    post<Array<{ lrId: string; billingStatus: string; created: number }>>(
      "/billing/readiness/evaluate-eligible",
      filters,
    ),
  createManualCharge: (
    lrId: string,
    body: {
      type: string;
      effect: "ADDITION" | "DEDUCTION";
      amountPaise: string;
      reason?: string;
      description?: string;
      isTaxable: boolean;
    },
  ) => post<{ id: string }>(`/billing/lrs/${lrId}/charges`, body),
  approveCharge: (id: string) =>
    post<{ id: string }>(`/billing/charges/${id}/approve`),
  cancelCharge: (id: string, reason: string) =>
    post<{ id: string }>(`/billing/charges/${id}/cancel`, { reason }),
  createBill: (body: CreateBillDraft) => post<Bill[]>("/billing/bills", body),
  listBills: () => get<Bill[]>("/billing/bills"),
  bill: (id: string) => get<Bill>(`/billing/bills/${id}`),
  availableBillCharges: (id: string) =>
    get<AvailableBillCharge[]>(`/billing/bills/${id}/available-charges`),
  addBillCharges: (id: string, lrChargeIds: string[], version: number) =>
    post<Bill>(`/billing/bills/${id}/charges`, { lrChargeIds, version }),
  returnBillToDraft: (id: string, version: number, reason: string) =>
    post<BillStatusPatch>(`/billing/bills/${id}/return-to-draft`, {
      version,
      reason,
    }),
  // finalise recalculates totals and returns the full detail; approve is a
  // pure status flip (DRAFT straight to APPROVED — the old intermediate
  // "submit for review" step is gone) and returns a slim BillStatusPatch
  // instead — the return type stays Bill since finalise needs it, but
  // callers must merge (not replace) their local state so the slim approve
  // case is safe.
  transition: (
    id: string,
    action: "approve" | "finalise",
  ) => post<Bill>(`/billing/bills/${id}/${action}`),
  cancel: (id: string, reason: string) =>
    post<BillStatusPatch>(`/billing/bills/${id}/cancel`, { reason }),
  taxRules: () =>
    get<Array<Record<string, string | number | boolean | null>>>(
      "/billing/tax-rules",
    ),
  createTaxRule: (body: Record<string, string | number | boolean | null>) =>
    post<Record<string, unknown>>("/billing/tax-rules", body),
};
