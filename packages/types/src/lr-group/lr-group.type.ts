import { z } from "zod";
import {
  createLRGroupSchema,
  updateLRGroupSchema,
  finaliseGroupSchema,
  finaliseGroupLineSchema,
  splitGroupAtHubSchema,
  cancelGroupSchema,
  lrGroupLineSchema,
} from "@skerp/validators";
import type {
  LRSource,
  LRTransportType,
  LRTripLegType,
  LRPriority,
  LRStatus,
  LorryReceipt,
  LocationRef,
  EwayBill,
} from "../lorry-receipt/lorry-receipt.type.js";

export type LRGroupStatus = "DRAFT" | "FINALISED" | "DELIVERED" | "CANCELLED";

export type CreateLRGroupBody = z.input<typeof createLRGroupSchema>;
export type CreateLRGroupFormInput = z.input<typeof createLRGroupSchema>;
export type UpdateLRGroupBody = z.input<typeof updateLRGroupSchema>;
export type FinaliseGroupBody = z.input<typeof finaliseGroupSchema>;
export type FinaliseGroupFormInput = z.input<typeof finaliseGroupSchema>;
export type FinaliseGroupLineInput = z.input<typeof finaliseGroupLineSchema>;
export type SplitGroupAtHubBody = z.output<typeof splitGroupAtHubSchema>;
export type CancelGroupBody = z.output<typeof cancelGroupSchema>;
export type LRGroupLineInput = z.input<typeof lrGroupLineSchema>;

type CustomerRef = { id: string; name: string; shortName: string | null };
type BranchRef = { id: string; name: string; branchCode: string };
type UserRef = { id: string; firstName: string; lastName: string };
type OrderRef = {
  id: string;
  orderNumber: string;
  truckQuantity?: number | null;
  bookingFreightAmount?: number | null;
};
type VehicleRef = { id: string; vehicleNumber: string };
type DriverRef = { id: string; name: string };

export type LRGroupListReceipt = {
  id: string;
  lrNumber: string;
  status: LRStatus;
  loadingLocation: LocationRef | null;
  unloadingLocation: LocationRef | null;
  invoiceNumber: string | null;
  invoiceAmount: number | null;
  goods?: { id: string }[];
  ewayBill: EwayBill | null;
  delivery?: { deliveredAt: string } | null;
  acknowledgement?: { receivedAt: string } | null;
};

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

/** LRGroup as returned by the list endpoint (select shape). */
export type LRGroupListItem = {
  id: string;
  groupNumber: string;
  status: LRGroupStatus;
  source: LRSource;
  transportType: LRTransportType;
  tripLegType: LRTripLegType;
  priority: LRPriority;
  truckIndex: number;
  fyCode: string;
  createdAt: string;
  isMarketVehicle: boolean;
  marketVehicleNumber: string | null;
  marketDriverName: string | null;
  hubArrivalAt: string | null;
  baseFreightAmount: number | null;
  sealNumber: string | null;
  primaryTrip: TripRef | null;
  secondaryTrip: TripRef | null;
  hub: BranchRef | null;
  railheadBranch: BranchRef | null;
  consignor: CustomerRef | null;
  consignee: CustomerRef | null;
  originBranch: BranchRef | null;
  destinationBranch: BranchRef | null;
  order: OrderRef | null;
  lrCount?: number;
  lorryReceipts?: LRGroupListReceipt[];
};

/** LRGroup as returned by the detail endpoint (include shape). */
export type LRGroup = Omit<LRGroupListItem, "lorryReceipts"> & {
  orderId: string | null;
  primaryTripId: string | null;
  secondaryTripId: string | null;
  hubId: string | null;
  railheadBranchId: string | null;
  consignorId: string;
  consigneeId: string;
  originBranchId: string;
  destinationBranchId: string;
  cancelReason: string | null;
  finalisedAt: string | null;
  finalisedById: string | null;
  createdById: string;
  updatedById: string | null;
  version: number;
  updatedAt: string;
  deletedAt: string | null;
  lorryReceipts: LorryReceipt[];
  createdBy: UserRef | null;
  updatedBy: UserRef | null;
  finalisedBy: UserRef | null;
};
