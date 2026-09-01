import { z } from "zod";
import {
  orderItemSchema,
  orderConsignmentSchema,
  createOrderSchema,
  updateOrderSchema,
  approveOrderSchema,
  rejectOrderSchema,
  cancelOrderSchema,
  orderTypeSchema,
  orderStatusSchema,
} from "@skerp/validators";

export type OrderType = z.infer<typeof orderTypeSchema>;
export type OrderStatus = z.infer<typeof orderStatusSchema>;

export type OrderItemInput = z.input<typeof orderItemSchema>;
export type OrderConsignmentFormInput = z.input<typeof orderConsignmentSchema>;

export type CreateOrderBody = z.output<typeof createOrderSchema>;
export type CreateOrderFormInput = z.input<typeof createOrderSchema>;
export type UpdateOrderBody = z.output<typeof updateOrderSchema>;

export type ApproveOrderBody = z.output<typeof approveOrderSchema>;
export type RejectOrderBody = z.output<typeof rejectOrderSchema>;
export type CancelOrderBody = z.output<typeof cancelOrderSchema>;

/** A lightweight reference shape (id + name) used in nested includes. */
type Ref = { id: string; name: string };
export type OrderEvent = {
  id: string;
  orderId: string;
  actorId: string;
  eventType: string;
  note: string | null;
  payloadDiff: unknown;
  createdAt: string;
  actor?: { id: string; firstName: string; lastName: string };
};

export type OrderItemRow = {
  id: string;
  orderId: string;
  goodsId: string;
  quantity: number;
  goods?: Ref;
};

export type OrderConsignmentGoodsRow = {
  id: string;
  consignmentId: string;
  goodsId: string;
  quantity: number;
  unit: string | null;
  weight: string | null;
  goods?: Ref;
};

/** A consignment line on a Truck order (multi-loading); one line -> one LR. */
export type OrderConsignmentRow = {
  id: string;
  orderId: string;
  truckIndex: number;
  totalWeight: string | null;
  loadingLocationId: string | null;
  unit?: string | null;
  unloadingLocationId: string | null;
  loadingLocation?: { id: string; name: string } | null;
  unloadingLocation?: { id: string; name: string } | null;
  goods?: OrderConsignmentGoodsRow[];
};
export type OrderCityLite = {
  id: string;
  name: string;
};

export type OrderBranchLite = {
  id: string;
  name?: string | null;
  shortCode?: string | null;
};

export type OrderRouteDetail = {
  id: string;
  sourceCity?: OrderCityLite | null;
  destinationCity?: OrderCityLite | null;
};
/** Order as returned by the API (Decimal/Date serialised to string on the wire). */
export type Order = {
  id: string;
  orderNumber: string;
  customerId: string;
  consigneeId: string | null;
  fromBranchId: string;
  toBranchId: string;
  pickupDate: string;

  routeId: string | null;
  route?: OrderRouteDetail | null;

  customerLocationId: string | null;
  pickupAddressOverride: string | null;
  specialInstructions: string | null;
  orderType: OrderType;
  truckQuantity: number | null;
  vehicleTypeId: string | null;
  contactPersonName: string | null;
  contactMobile: string | null;
  contactEmail: string | null;
  bookingFreightAmount: string | null;
  freightOverrideReason: string | null;
  status: OrderStatus;
  rejectionReason: string | null;
  cancelReason: string | null;
  fyCode: string;
  createdById: string;
  updatedById: string | null;
  approvedById: string | null;
  approvedAt: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;

  customer?: Ref;
  consignee?: Ref | null;
  fromBranch?: OrderBranchLite | null;
  toBranch?: OrderBranchLite | null;
  vehicleType?: { id: string; code?: string | null; name: string } | null;
  customerLocation?: { id: string; name: string } | null;
  createdBy?: { id: string; firstName: string; lastName: string };
  approvedBy?: { id: string; firstName: string; lastName: string } | null;
  items?: OrderItemRow[];
  consignments?: OrderConsignmentRow[];
  events?: OrderEvent[];
  lrGroupCount?: number;
  hasLRGroup?: boolean;
};
/** Freight preview returned by the detail endpoint / freight lookup. */
export type FreightPreview = {
  amount: number | null;
  matched: boolean;
  source: "RateMatrix" | "Manual" | "None";
};
export type OrderQuickView = Pick<
  Order,
  | "id"
  | "orderNumber"
  | "status"
  | "pickupDate"
  | "orderType"
  | "truckQuantity"
  | "bookingFreightAmount"
  | "contactPersonName"
  | "contactMobile"
  | "contactEmail"
  | "pickupAddressOverride"
  | "routeId"
> & {
  customer: { id: string; name: string } | null;
  fromBranch: { id: string; name: string; shortCode: string } | null;
  toBranch: { id: string; name: string; shortCode: string } | null;
  vehicleType: { id: string; name: string } | null;
  customerLocation: { id: string; name: string } | null;
  route?: OrderRouteDetail | null;
  lrGroupCount: number;
  hasLRGroup: boolean;
};
