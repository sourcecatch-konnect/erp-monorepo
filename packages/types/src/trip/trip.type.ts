import { z } from "zod";
import {
  createTripSchema,
  updateTripSchema,
  closeTripSchema,
  correctClosedTripSchema,
  cancelTripSchema,
  tripTypeSchema,
  tripStatusSchema,
} from "@skerp/validators";

export type TripType = z.infer<typeof tripTypeSchema>;
export type TripStatus = z.infer<typeof tripStatusSchema>;

// Both typed as z.input: with the form's `raw: true` resolver, the values
// reaching onSubmit are the untransformed (rupees) shape, not paise — the
// server is the sole rupees -> paise boundary. See TripForm.tsx.
export type CreateTripBody = z.input<typeof createTripSchema>;
export type CreateTripFormInput = z.input<typeof createTripSchema>;
export type UpdateTripBody = z.input<typeof updateTripSchema>;
export type CloseTripBody = z.output<typeof closeTripSchema>;
export type CorrectClosedTripFormInput = z.input<
  typeof correctClosedTripSchema
>;
export type CorrectClosedTripBody = z.output<typeof correctClosedTripSchema>;
export type CancelTripBody = z.output<typeof cancelTripSchema>;

export type TripStatusHistoryRow = {
  id: string;
  vehicleTripId: string;
  status: TripStatus;
  changedAt: string;
  note: string | null;
  userId: string;
  changedBy?: { id: string; firstName: string; lastName: string };
};

/** Cargo-state buckets for a trip's live LRs (trips list rows). */
export type TripLrSummary = {
  total: number;
  draft: number;
  undelivered: number;
  atHub: number;
  delivered: number;
};

/** LR row inside a trip detail's cargo card. */
export type TripLR = {
  id: string;
  lrNumber: string;
  status: "DRAFT" | "FINALISED" | "DELIVERED" | "ACKNOWLEDGED" | "CANCELLED";
  totalWeight: string | null;
  unit: string | null;
  invoiceNumber: string | null;
  delivery: {
    deliveredAt: string;
    receiverName: string | null;
    receiverPhone: string | null;
  } | null;
};

/** Live LR group attached to a trip (trip detail only). */
export type TripLRGroup = {
  id: string;
  groupNumber: string;
  status: "DRAFT" | "FINALISED" | "DELIVERED" | "CANCELLED";
  transportType: string;
  priority: string;
  sealNumber: string | null;
  isMarketVehicle: boolean;
  marketVehicleNumber: string | null;
  marketDriverName: string | null;
  tripLegType: string;
  hubId: string | null;
  hubArrivalAt: string | null;
  primaryTripId: string | null;
  secondaryTripId: string | null;
  consignor: { id: string; name: string };
  consignee: { id: string; name: string };
  originBranch: { id: string; name: string };
  destinationBranch: { id: string; name: string };
  hub: { id: string; name: string } | null;
  lorryReceipts: TripLR[];
};

/** Unloading stop on a trip (mainly DC/rake trips; trip detail only). */
export type TripUnloadingPointRow = {
  id: string;
  sequence: number;
  plannedDate: string | null;
  actualDate: string | null;
  actualArrivalAt: string | null;
  actualUnloadingAt: string | null;
  actualDepartureAt: string | null;
  receivedQty: number | null;
  damageQty: number | null;
  shortageQty: number | null;
  remarks: string | null;
  city: { id: string; name: string };
  location: { id: string; name: string } | null;
};

type RouteRef = {
  id: string;
  sourceCity?: { id: string; name: string };
  destinationCity?: { id: string; name: string };
};

/** Trip as returned by the API (Decimal/Date serialised to string on the wire). */
export type Trip = {
  id: string;
  tripNumber: string;
  tripName: string;
  status: TripStatus;
  tripType: TripType;
  vehicleId: string;
  driverId: string;
  routeId: string;
  consignorId: string | null;
  onwardFreight: string;
  isTripEmpty: boolean;
  rakeDate: string | null;
  openingKm: number;
  startDateTime: string | null;
  endDateTime: string | null;
  arrivalDateTime: string | null;
  unloadingCompletedAt: string | null;
  closingKm: number | null;
  closeReason: string | null;
  cancelReason: string | null;
  fyCode: string;
  createdById: string;
  updatedById: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;

  // Journey leg fields — every trip belongs to a vehicle journey (rows from
  // before the journey module carry null).
  journeyId: string | null;
  sequenceNo: number | null;
  isReturnLeg: boolean;
  chainExceptionReason: string | null;

  /**
   * List rows only: live not-yet-delivered LRs (DRAFT or FINALISED) on groups
   * whose final leg is this trip — the server blocks Close while it's > 0
   * ("Way 1" gate). A leg-1 group held at hub is exempt.
   */
  undeliveredLrCount?: number;

  /**
   * List rows only: live-LR status buckets for the cargo line under the trip
   * status badge. `delivered` includes ACKNOWLEDGED; cancelled LRs and groups
   * already handed over to a leg-2 trip are excluded.
   */
  lrSummary?: TripLrSummary;

  vehicle?: {
    id: string;
    vehicleNumber: string;
    ownershipType: string;
    // Detail include only.
    capacityMT?: number;
    bodyType?: string | null;
  };
  driver?: {
    id: string;
    name: string;
    // Detail include only.
    mobile?: string;
    licenseNo?: string;
    licenseExpiryDate?: string | null;
  };
  route?: RouteRef;
  consignor?: { id: string; name: string; shortName: string | null } | null;
  createdBy?: { id: string; firstName: string; lastName: string };
  journey?: { id: string; journeyNumber: string; status: string } | null;
  TripStatusHistory?: TripStatusHistoryRow[];

  // Detail include only: live LR groups riding this trip (leg 1 / leg 2) and
  // the trip's unloading stops.
  primaryGroups?: TripLRGroup[];
  secondaryGroups?: TripLRGroup[];
  TripUnloadingPoint?: TripUnloadingPointRow[];
};
