export type EwbStatus =
  | "ACTIVE"
  | "PART_B_PENDING"
  | "IN_TRANSIT"
  | "DELIVERED"
  | "EXPIRED"
  | "CANCELLED";

export type EwbTransMode = "ROAD" | "RAIL" | "AIR" | "SHIP";

export type EwbItem = {
  productName: string;
  productDesc: string;
  hsnCode: string;
  quantity: number;
  qtyUnit: string;
  taxableAmount: number;
};

export type EwbVehicleHistoryEntry = {
  vehicleNo: string;
  transDocNo?: string;
  transDocDate?: string;
  fromPlace: string;
  fromState: number;
  reasonCode?: string;
  reasonRem?: string;
  updatedAt: string;
};

export type EwbExtensionEntry = {
  extendedAt: string;
  newValidUntil: string;
  remainingDistanceKm: number;
  reasonCode: string;
  reasonRem: string;
  fromPlace: string;
};

export type EwayBill = {
  ewbNo: string;
  status: EwbStatus;
  generatedDate: string;
  validUntil: string;

  docType: string;
  docNo: string;
  docDate: string;

  fromGstin: string;
  fromTrdName: string;
  fromAddr1: string;
  fromPlace: string;
  fromPincode: number;
  fromStateCode: number;
  fromStateName: string;

  toGstin: string;
  toTrdName: string;
  toAddr1: string;
  toPlace: string;
  toPincode: number;
  toStateCode: number;
  toStateName: string;

  transporterId: string;
  transporterName: string;
  transMode: EwbTransMode;
  transDistance: number;
  vehicleNo: string;
  transDocNo?: string;
  transDocDate?: string;

  totInvValue: number;
  cgstValue: number;
  sgstValue: number;
  igstValue: number;

  items: EwbItem[];

  vehicleHistory: EwbVehicleHistoryEntry[];
  extensions: EwbExtensionEntry[];
};

export type EwbSummary = {
  counts: {
    total: number;
    active: number;
    inTransit: number;
    partBPending: number;
    expiringSoon: number;
  };
  expiringSoon: EwayBill[];
  byState: { stateCode: number; stateName: string; count: number }[];
  liveApiConfigured: boolean;
};

export type EwbListFilters = {
  fromState?: string;
  fromGstin?: string;
  status?: EwbStatus;
  date?: string;
  search?: string;
};

export type UpdateVehicleBody = {
  vehicleNo: string;
  transDocNo?: string;
  transDocDate?: string;
  fromPlace: string;
  fromState: number;
  reasonCode: "1" | "2" | "3" | "4";
  reasonRem: string;
  transMode: EwbTransMode;
};

export type ExtendBody = {
  remainingDistanceKm: number;
  extnRsnCode: "1" | "2" | "3" | "4" | "5";
  extnRemarks: string;
  fromPlace: string;
  additionalHours: number;
};

export const VEHICLE_UPDATE_REASONS = [
  { code: "1", label: "Due to Break Down" },
  { code: "2", label: "Due to Transhipment" },
  { code: "3", label: "Others" },
  { code: "4", label: "First Time" },
] as const;

export const EXTEND_REASONS = [
  { code: "1", label: "Natural Calamity" },
  { code: "2", label: "Law and Order Situation" },
  { code: "3", label: "Transhipment" },
  { code: "4", label: "Accident" },
  { code: "5", label: "Others" },
] as const;
