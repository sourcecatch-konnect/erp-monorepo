import { z } from "zod";
import {
  createTripSchema,
  updateTripSchema,
  closeTripSchema,
  cancelTripSchema,
  tripTypeSchema,
  tripStatusSchema,
} from "@skerp/validators";

export type TripType = z.infer<typeof tripTypeSchema>;
export type TripStatus = z.infer<typeof tripStatusSchema>;

export type CreateTripBody = z.output<typeof createTripSchema>;
export type CreateTripFormInput = z.input<typeof createTripSchema>;
export type UpdateTripBody = z.output<typeof updateTripSchema>;
export type CloseTripBody = z.output<typeof closeTripSchema>;
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
  closingKm: number | null;
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

  vehicle?: { id: string; vehicleNumber: string; ownershipType: string };
  driver?: { id: string; name: string };
  route?: RouteRef;
  consignor?: { id: string; name: string; shortName: string | null } | null;
  createdBy?: { id: string; firstName: string; lastName: string };
  journey?: { id: string; journeyNumber: string; status: string } | null;
  TripStatusHistory?: TripStatusHistoryRow[];
};
