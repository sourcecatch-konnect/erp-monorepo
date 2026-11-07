import { z } from "zod";
import {
  createDetentionSlabSchema,
  updateDetentionSlabSchema,
} from "@skerp/validators";

/** One stacked rate tier, as returned by `GET /detention/slabs`. Paise. */
export type DetentionSlabBand = {
  id: string;
  fromUnit: number;
  /** `null` = open-ended ("and above"). */
  toUnit: number | null;
  ratePaise: number;
};

type NamedRef = { id: string; name: string } | null;

/** A broker detention slab as the server returns it. Money is in paise. */
export type DetentionSlab = {
  id: string;
  name: string;
  transportId: string | null;
  customerId: string | null;
  vehicleTypeId: string | null;
  freightFromPaise: number | null;
  freightToPaise: number | null;
  basis: "DAY" | "HOUR";
  firstDayFree: boolean;
  lastDayFree: boolean;
  freeHours: number | null;
  blockHours: number | null;
  priority: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  isActive: boolean;
  transport: NamedRef;
  customer: NamedRef;
  vehicleType: NamedRef;
  bands: DetentionSlabBand[];
};

export type CreateDetentionSlabBody = z.output<
  typeof createDetentionSlabSchema
>;
export type CreateDetentionSlabFormInput = z.input<
  typeof createDetentionSlabSchema
>;
export type UpdateDetentionSlabBody = z.output<
  typeof updateDetentionSlabSchema
>;
/** Raw form shape: rupees as typed, converted to paise by the server's schema. */
export type UpdateDetentionSlabFormInput = z.input<
  typeof updateDetentionSlabSchema
>;

/* -----------------------------
   QUOTE  (GET /detention/challans/:id/quote)
------------------------------ */

/** One stacked tier of the charge, e.g. "Days 1-2". Paise as strings. */
export type DetentionChargeLine = {
  label: string;
  units: number;
  ratePaise: string;
  amountPaise: string;
};

/** The dates the charge was measured over. */
export type DetentionQuoteWindow = {
  finalReportingAt: string | null;
  finalUnloadingAt: string | null;
  /** Calendar days held, counting both end dates. */
  detentionDays: number | null;
  detentionHours: number | null;
  lrsMissingUnloading: string[];
  lrsMissingReporting: string[];
  reason: string | null;
};

/**
 * Why a challan's detention is what it is: the window, the slab that matched,
 * the slabs that also could have, and the band-by-band working.
 */
export type DetentionQuote = {
  challanId: string;
  challanNumber: string;
  broker: { id: string; name: string } | null;
  window: DetentionQuoteWindow;
  slab: { id: string; name: string; basis: "DAY" | "HOUR" } | null;
  /** Other slabs that matched — an operator may force one of these. */
  alternatives: { id: string; name: string }[];
  charge: {
    amountPaise: string;
    chargeableUnits: number;
    /** Units waived by first/last day free or the free-hours window. */
    freeUnits: number;
    lines: DetentionChargeLine[];
    warning: string | null;
  };
  /** Every LR this challan carries. */
  lrNumbers: string[];
  unresolvedLrNumbers: string[];
  warnings: string[];
};
