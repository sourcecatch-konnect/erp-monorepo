import { z } from "zod";
import {
  lrStatusSchema,
  lrSourceSchema,
  lrTransportTypeSchema,
  lrTripLegTypeSchema,
  lrPrioritySchema,
  updateLRSchema,
  addEwayBillSchema,
  deliverLRSchema,
  updateLRDeliverySchema,
  deliverGroupSchema,
  acknowledgeLRSchema,
  updateLRAcknowledgementSchema,
  holdGroupAtHubSchema,
} from "@skerp/validators";

export type LRStatus = z.infer<typeof lrStatusSchema>;
export type LRSource = z.infer<typeof lrSourceSchema>;
export type LRTransportType = z.infer<typeof lrTransportTypeSchema>;
export type LRTripLegType = z.infer<typeof lrTripLegTypeSchema>;
export type LRPriority = z.infer<typeof lrPrioritySchema>;

export type LRDeliveryEligibilityStage =
  | "LR_NOT_FINALISED"
  | "AWAITING_ROAD_DISPATCH"
  | "AWAITING_BRANCH_GRN"
  | "AWAITING_DELIVERY_CHALLAN"
  | "PARTIALLY_CHALLANED"
  | "READY_FOR_DELIVERY"
  | "ALREADY_DELIVERED";

export type LRDeliveryEligibility = {
  eligible: boolean;
  stage: LRDeliveryEligibilityStage;
  reasons: string[];
  requiredQuantity?: number;
  issuedQuantity?: number;
  railwayDetails?: {
    rakeNumbers: string[];
    vpNumbers: string[];
    branchGrnIds: string[];
    receivedQuantity: number;
    damageQuantity: number;
    shortageQuantity: number;
    dcNumbers: string[];
    issuedQuantity: number;
    balanceQuantity: number;
  };
};

export type UpdateLRBody = z.output<typeof updateLRSchema>;
export type AddEwayBillBody = z.output<typeof addEwayBillSchema>;
export type AddEwayBillFormInput = z.input<typeof addEwayBillSchema>;

export type DeliverLRBody = z.output<typeof deliverLRSchema>;
export type DeliverLRFormInput = z.input<typeof deliverLRSchema>;
export type UpdateLRDeliveryBody = z.output<typeof updateLRDeliverySchema>;
export type DeliverGroupBody = z.output<typeof deliverGroupSchema>;
export type DeliverGroupFormInput = z.input<typeof deliverGroupSchema>;
export type AcknowledgeLRBody = z.output<typeof acknowledgeLRSchema>;
export type AcknowledgeLRFormInput = z.input<typeof acknowledgeLRSchema>;
export type UpdateLRAcknowledgementBody = z.output<
  typeof updateLRAcknowledgementSchema
>;
export type HoldGroupAtHubBody = z.output<typeof holdGroupAtHubSchema>;

export type UserRef = {
  id: string;
  firstName: string;
  lastName: string;
};

export type LRDelivery = {
  id: string;
  lrId: string;
  deliveredAt: string;
  unloadingAt: string | null;
  receiverName: string | null;
  receiverPhone: string | null;
  unloadingCharges: number | null;
  remark: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  createdBy?: UserRef | null;
  updatedBy?: UserRef | null;
};

export type LRAcknowledgementItem = {
  id: string;
  ackId: string;
  lrGoodsId: string;
  receivedQty: string | number | null;
  damagedQty: string | number | null;
};

export type LRAcknowledgement = {
  id: string;
  lrId: string;
  receivedAt: string;
  courierName: string | null;
  courierDocketNo: string | null;
  courierCharge: number | null;
  detentionDays: number | null;
  detentionAmount: number | null;
  damageAmount: number | null;
  remark: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  items?: LRAcknowledgementItem[];
  createdBy?: UserRef | null;
  updatedBy?: UserRef | null;
};

export type LocationRef = {
  id: string;
  name: string;
  address: string | null;
  city?: { id: string; name: string } | null;
};

export type LRGroupRef = {
  id: string;
  groupNumber: string;
  status: string;
};

export type LRGoods = {
  id: string;
  lorryReceiptId: string;
  name: string;
  description: string | null;
  quantity: number;
  unit: string | null;
  weight: string | number | null;
  length: number | null;
  width: number | null;
  height: number | null;
  createdAt: string;
  updatedAt: string;
};

export type EwayBill = {
  id: string;
  lorryReceiptId: string;
  ewayBillNo: string;
  generatedAt: string;
  expiresAt: string;
  generatedBy: string | null;
  documentUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

export type LRListItem = {
  id: string;
  lrNumber: string;
  status: LRStatus;
  fyCode: string;
  createdAt: string;
  groupId: string;
  loadingLocation: LocationRef | null;
  unloadingLocation: LocationRef | null;
  invoiceNumber: string | null;
  invoiceAmount: number | null;
  invoiceRemark: string | null;
  group?: LRGroupRef | null;
  delivery?: { deliveredAt: string } | null;
  acknowledgement?: { receivedAt: string } | null;
};

/* ---- delivery worklists (docs/LR_DELIVERY_ACK_PLAN.md §8) ---- */

export type WorklistGroupRef = {
  id: string;
  groupNumber: string;
  finalisedAt: string | null;
  isMarketVehicle: boolean;
  marketVehicleNumber: string | null;
  consignee: { id: string; name: string; shortName: string | null } | null;
  originBranch: { id: string; name: string; branchCode: string } | null;
  destinationBranch: { id: string; name: string; branchCode: string } | null;
  primaryTrip: { id: string; vehicle: { vehicleNumber: string } | null } | null;
  secondaryTrip: {
    id: string;
    vehicle: { vehicleNumber: string } | null;
  } | null;
};

export type PendingDeliveryRow = {
  id: string;
  lrNumber: string;
  status: LRStatus;
  unloadingLocation: { id: string; name: string } | null;
  group: WorklistGroupRef;
  deliveryEligibility: LRDeliveryEligibility;
};

export type PendingPodRow = {
  id: string;
  lrNumber: string;
  status: LRStatus;
  delivery: { deliveredAt: string; receiverName: string | null } | null;
  group: WorklistGroupRef;
};

export type AtHubRow = {
  id: string;
  groupNumber: string;
  hubArrivalAt: string | null;
  finalisedAt: string | null;
  consignee: { id: string; name: string; shortName: string | null } | null;
  originBranch: { id: string; name: string; branchCode: string } | null;
  destinationBranch: { id: string; name: string; branchCode: string } | null;
  hub: { id: string; name: string } | null;
  lorryReceipts: { id: string; lrNumber: string }[];
};

export type DeliveryStats = {
  pendingDelivery: number;
  atHub: number;
  pendingPod: number;
  avgDeliveryDays: number | null;
};

export type LRUnloadingReportRow = {
  id: string;
  lrNumber: string;
  lrDate: string;
  status: LRStatus;
  consignorName: string | null;
  consigneeName: string | null;
  originBranchName: string | null;
  destinationBranchName: string | null;
  challanNumbers: string[];


  unloadingAt: string | null;
  deliveredAt: string;
  receiverName: string | null;
  podReceivedAt: string | null;
  courierName: string | null;
  courierDocketNo: string | null;
  detentionDays: number | null;
  detentionAmount: number | string | null;
};

export type LRUnloadingReportDetail = LRUnloadingReportRow & {
  groupId: string;
  groupNumber: string;
  transportType: string;
  invoiceNumber: string | null;
  invoiceAmount: number | string | null;
  totalWeight: number | string | null;
  weightUnit: string | null;
  loadingLocation: {
    name: string;
    address: string | null;
    cityName: string;
  } | null;
  unloadingLocation: {
    name: string;
    address: string | null;
    cityName: string;
  } | null;
  sourceRailhead: { name: string; cityName: string } | null;
  destinationRailhead: { name: string; cityName: string } | null;
  delivery: {
    /** Truck arrival at the consignee — start of the detention window. */
    reportedAt: string | null;
    unloadingAt: string | null;
    deliveredAt: string;
    receiverName: string | null;
    receiverPhone: string | null;
    unloadingCharges: number | string | null;
    remark: string | null;
    recordedBy: string | null;
  };
  acknowledgement: {
    receivedAt: string;
    courierName: string | null;
    courierDocketNo: string | null;
    courierCharge: number | string | null;
    detentionDays: number | null;
    detentionAmount: number | string | null;
    damageAmount: number | string | null;
    remark: string | null;
    recordedBy: string | null;
    items: {
      lrGoodsId: string;
      receivedQty: number | string | null;
      damagedQty: number | string | null;
    }[];
  } | null;
  goods: {
    id: string;
    name: string;
    description: string | null;
    quantity: number;
    unit: string | null;
  }[];
  deliveryChallans: {
    id: string;
    challanNumber: string;
    status: string;
    loadingAt: string;
    issuedAt: string | null;
    vehicleNumber: string | null;
    driverName: string | null;
    quantity: number;
  }[];
};

export type LorryReceipt = LRListItem & {
  loadingLocationId: string | null;
  unloadingLocationId: string | null;
  cancelReason: string | null;
  createdById: string;
  updatedById: string | null;
  totalWeight: string | number | null;
  unit: string | null;
  version: number;
  updatedAt: string;
  deletedAt: string | null;
  goods: LRGoods[];
  ewayBill: EwayBill | null;
  delivery?: LRDelivery | null;
  acknowledgement?: LRAcknowledgement | null;
  deliveryEligibility?: LRDeliveryEligibility;
};
