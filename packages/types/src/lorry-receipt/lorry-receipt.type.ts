import { z } from "zod";
import {
  lrStatusSchema,
  lrSourceSchema,
  lrChargeTypeSchema,
  lrTransportTypeSchema,
  lrTripLegTypeSchema,
  lrPrioritySchema,
  createLRSchema,
  updateLRSchema,
  finaliseLRSchema,
  cancelLRSchema,
  addEwayBillSchema,
} from "@skerp/validators";

export type LRStatus = z.infer<typeof lrStatusSchema>;
export type LRSource = z.infer<typeof lrSourceSchema>;
export type LRChargeType = z.infer<typeof lrChargeTypeSchema>;
export type LRTransportType = z.infer<typeof lrTransportTypeSchema>;
export type LRTripLegType = z.infer<typeof lrTripLegTypeSchema>;
export type LRPriority = z.infer<typeof lrPrioritySchema>;

export type CreateLRBody = z.output<typeof createLRSchema>;
export type CreateLRFormInput = z.input<typeof createLRSchema>;
export type UpdateLRBody = z.output<typeof updateLRSchema>;
export type FinaliseLRBody = z.output<typeof finaliseLRSchema>;
export type FinaliseLRFormInput = z.input<typeof finaliseLRSchema>;
export type CancelLRBody = z.output<typeof cancelLRSchema>;
export type AddEwayBillBody = z.output<typeof addEwayBillSchema>;
export type AddEwayBillFormInput = z.input<typeof addEwayBillSchema>;

type CustomerRef = { id: string; name: string; shortName: string | null };
type BranchRef = { id: string; name: string; branchCode: string };
type UserRef = { id: string; firstName: string; lastName: string };
type OrderRef = { id: string; orderNumber: string; truckQuantity?: number | null };
type VehicleRef = { id: string; vehicleNumber: string };
type DriverRef = { id: string; name: string };

export type TripRef = {
  id: string;
  tripNumber: string;
  tripName: string;
  status: string;
  vehicle: VehicleRef | null;
  driver: DriverRef | null;
  route: {
    id: string;
    sourceCity: { id: string; name: string } | null;
    destinationCity: { id: string; name: string } | null;
  } | null;
};

export type LRGoods = {
  id: string;
  lorryReceiptId: string;
  name: string;
  description: string | null;
  quantity: number;
  unit: string;
  weight: number | null;
  length: number | null;
  width: number | null;
  height: number | null;
  createdAt: string;
  updatedAt: string;
};

export type LRCharge = {
  id: string;
  lorryReceiptId: string;
  chargeType: LRChargeType;
  amount: number;
  description: string | null;
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

/** Lorry receipt as returned by the list endpoint (select shape). */
export type LRListItem = {
  id: string;
  lrNumber: string;
  status: LRStatus;
  source: LRSource;
  transportType: LRTransportType;
  tripLegType: LRTripLegType;
  priority: LRPriority;
  fyCode: string;
  createdAt: string;
  isMarketVehicle: boolean;
  marketVehicleNumber: string | null;
  marketDriverName: string | null;
  primaryTrip: TripRef | null;
  secondaryTrip: TripRef | null;
  hub: BranchRef | null;
  consignor: CustomerRef | null;
  consignee: CustomerRef | null;
  originBranch: BranchRef | null;
  destinationBranch: BranchRef | null;
  order: { id: string; orderNumber: string } | null;
  createdBy: UserRef | null;
};

/** Lorry receipt as returned by the detail endpoint (include shape). */
export type LorryReceipt = LRListItem & {
  orderId: string | null;
  primaryTripId: string | null;
  secondaryTripId: string | null;
  hubId: string | null;
  consignorId: string;
  consigneeId: string;
  originBranchId: string;
  destinationBranchId: string;
  invoiceNumber: string | null;
  invoiceAmount: number | null;
  sealNumber: string | null;
  cancelReason: string | null;
  finalisedAt: string | null;
  finalisedById: string | null;
  createdById: string;
  updatedById: string | null;
  version: number;
  updatedAt: string;
  deletedAt: string | null;
  order: OrderRef | null;
  goods: LRGoods[];
  charges: LRCharge[];
  ewayBills: EwayBill[];
  updatedBy: UserRef | null;
  finalisedBy: UserRef | null;
};
