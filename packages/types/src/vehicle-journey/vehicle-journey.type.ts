import { z } from "zod";
import {
  vehicleJourneyStatusSchema,
  journeySettlementStatusSchema,
  tripLegTypeSchema,
  closeJourneyLegSchema,
  dispatchJourneyLegSchema,
  cancelJourneySchema,
  closeJourneySchema,
  createTripExpenseSchema,
  updateTripExpenseSchema,
  rejectTripExpenseSchema,
  reverseTripExpenseSchema,
  createDriverAdvanceSchema,
  reverseDriverAdvanceSchema,
  tripExpenseTypeSchema,
  tripPaymentModeSchema,
  tripExpenseStatusSchema,
  driverAdvanceStatusSchema,
} from "@skerp/validators";
import type { TripStatus, TripType } from "../trip/trip.type.js";

/* ------------------------------------------------------------------ */
/* Enums                                                              */
/* ------------------------------------------------------------------ */

export type VehicleJourneyStatus = z.infer<typeof vehicleJourneyStatusSchema>;
export type JourneySettlementStatus = z.infer<
  typeof journeySettlementStatusSchema
>;
export type TripLegType = z.infer<typeof tripLegTypeSchema>;
export type TripExpenseType = z.infer<typeof tripExpenseTypeSchema>;
export type TripPaymentMode = z.infer<typeof tripPaymentModeSchema>;
export type TripExpenseStatus = z.infer<typeof tripExpenseStatusSchema>;
export type DriverAdvanceStatus = z.infer<typeof driverAdvanceStatusSchema>;

/* ------------------------------------------------------------------ */
/* Request bodies (inferred from validators)                          */
/* ------------------------------------------------------------------ */

export type CloseJourneyLegBody = z.output<typeof closeJourneyLegSchema>;
export type DispatchJourneyLegBody = z.output<typeof dispatchJourneyLegSchema>;
export type CancelJourneyBody = z.output<typeof cancelJourneySchema>;
export type CloseJourneyBody = z.output<typeof closeJourneySchema>;

// Form/API request bodies stay as z.input when the web form uses
// zodResolver(..., { raw: true }); the server owns rupees -> paise conversion.
export type CreateTripExpenseBody = z.input<typeof createTripExpenseSchema>;
export type TripExpenseFormInput = z.input<typeof createTripExpenseSchema>;
export type UpdateTripExpenseBody = z.input<typeof updateTripExpenseSchema>;
export type RejectTripExpenseBody = z.output<typeof rejectTripExpenseSchema>;
export type ReverseTripExpenseBody = z.output<typeof reverseTripExpenseSchema>;
export type CreateDriverAdvanceBody = z.input<
  typeof createDriverAdvanceSchema
>;
export type DriverAdvanceFormInput = z.input<typeof createDriverAdvanceSchema>;
export type ReverseDriverAdvanceBody = z.output<
  typeof reverseDriverAdvanceSchema
>;

/* ------------------------------------------------------------------ */
/* Wire shapes                                                        */
/* ------------------------------------------------------------------ */

type CityRef = { id: string; name: string };
type UserRef = { id: string; firstName: string; lastName: string };

/** A VehicleTrip acting as a journey leg (journey fields populated). */
export type JourneyLeg = {
  id: string;
  tripNumber: string;
  tripName: string;
  status: TripStatus;
  tripType: TripType;
  legType: TripLegType | null;
  journeyId: string | null;
  sequenceNo: number | null;
  fromCityId: string | null;
  toCityId: string | null;
  isReturnLeg: boolean;
  isTripEmpty: boolean;
  onwardFreight: number;
  openingKm: number;
  closingKm: number | null;
  startDateTime: string | null;
  endDateTime: string | null;
  arrivalDateTime: string | null;
  unloadingCompletedAt: string | null;
  closeReason: string | null;
  chainExceptionReason: string | null;
  rakeDate: string | null;
  cancelReason: string | null;
  consignorId: string | null;
  fromCity?: CityRef | null;
  toCity?: CityRef | null;
  consignor?: { id: string; name: string; shortName: string | null } | null;
  route?: {
    id: string;
    sourceCity?: CityRef;
    destinationCity?: CityRef;
  } | null;
};

/** Journey/trip expense as returned by the API. */
export type TripExpense = {
  id: string;
  journeyId: string;
  tripId: string | null;
  expenseType: TripExpenseType;
  amountPaise: number;
  paymentMode: TripPaymentMode;
  cityId: string | null;
  pumpId: string | null;
  dieselQty: number | null;
  dieselRatePaise: number | null;
  expenseDate: string;
  receiptNo: string | null;
  paidByDriver: boolean;
  remarks: string | null;
  status: TripExpenseStatus;
  approvedById: string | null;
  approvedAt: string | null;
  rejectReason: string | null;
  reversedAt: string | null;
  reverseReason: string | null;
  createdById: string;
  createdAt: string;
  city?: CityRef | null;
  pump?: { id: string; name: string } | null;
  trip?: { id: string; tripNumber: string; sequenceNo: number | null } | null;
  createdBy?: UserRef;
};

/** Driver advance as returned by the API. */
export type DriverAdvance = {
  id: string;
  journeyId: string;
  tripId: string | null;
  driverId: string;
  vehicleId: string;
  amountPaise: number;
  paymentMode: TripPaymentMode;
  cashAccountId: string | null;
  paidAt: string;
  narration: string | null;
  status: DriverAdvanceStatus;
  reversedAt: string | null;
  reverseReason: string | null;
  createdAt: string;
  cashAccount?: { id: string; name: string } | null;
  trip?: { id: string; tripNumber: string; sequenceNo: number | null } | null;
  createdBy?: UserRef;
};

/** Running totals for a journey (expenses/advances tabs + review). */
export type JourneyTotals = {
  totalFreightPaise: number;
  totalAdvancePaise: number;
  totalDieselQty: number;
  totalDieselAmountPaise: number;
  totalCashExpensePaise: number;
  totalCreditExpensePaise: number;
  totalExpensePaise: number;
  driverCashExpensePaise: number;
  unapprovedExpenseCount: number;
  openLegCount: number;
};

/** Vehicle journey as returned by the API. */
export type VehicleJourney = {
  id: string;
  journeyNumber: string;
  fyCode: string;
  vehicleId: string;
  driverId: string;
  homeBranchId: string;
  startCityId: string;
  returnCityId: string;
  currentCityId: string;
  openingKm: number;
  closingKm: number | null;
  startedAt: string;
  closedAt: string | null;
  status: VehicleJourneyStatus;
  settlementStatus: JourneySettlementStatus;
  closeReason: string | null;
  cancelReason: string | null;
  remarks: string | null;
  createdById: string;
  updatedById: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;

  vehicle?: { id: string; vehicleNumber: string };
  driver?: { id: string; name: string };
  homeBranch?: { id: string; name: string; branchCode: string };
  startCity?: CityRef;
  returnCity?: CityRef;
  currentCity?: CityRef;
  createdBy?: UserRef;
  trips?: JourneyLeg[];
  expenses?: TripExpense[];
  advances?: DriverAdvance[];
  totals?: JourneyTotals;
  logSlip?: { id: string; logSlipNumber: string | null; status: string } | null;
};

/**
 * Journey context for the trip form: the vehicle's active journey (if any)
 * with its chain tip, plus the head-office base every journey returns to.
 */
export type ActiveJourneyInfo = {
  headOffice: { branchId: string; cityId: string; cityName: string };
  journey: {
    id: string;
    journeyNumber: string;
    driverId: string;
    driverName: string | null;
    returnCityId: string;
    returnCityName: string | null;
    lastLeg: {
      id: string;
      sequenceNo: number | null;
      status: TripStatus;
      toCityId: string | null;
      toCityName: string | null;
      closingKm: number | null;
      endDateTime: string | null;
    } | null;
  } | null;
};
