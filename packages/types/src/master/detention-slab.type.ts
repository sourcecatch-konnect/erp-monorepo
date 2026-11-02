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
