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
  reportedAt: string | null;
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
  group?: LRGroupRef | null;
  delivery?: { deliveredAt: string } | null;
  acknowledgement?: { receivedAt: string } | null;
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
};
