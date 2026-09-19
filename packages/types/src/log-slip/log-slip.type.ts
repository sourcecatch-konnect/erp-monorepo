import { z } from "zod";
import {
  logSlipStatusSchema,
  logSlipLineTypeSchema,
  generateLogSlipSchema,
  reopenLogSlipSchema,
} from "@skerp/validators";

export type LogSlipStatus = z.infer<typeof logSlipStatusSchema>;
export type LogSlipLineType = z.infer<typeof logSlipLineTypeSchema>;

// z.input, not z.output: LogSlipWorkbench uses a `raw: true` resolver, which
// submits the untransformed (rupees) shape for dieselRate — the server is
// the sole rupees -> paise boundary. Same fix as CreateTripBody /
// CreateDriverAdvanceBody / etc.
export type GenerateLogSlipBody = z.input<typeof generateLogSlipSchema>;
export type GenerateLogSlipFormInput = z.input<typeof generateLogSlipSchema>;
export type ReopenLogSlipBody = z.output<typeof reopenLogSlipSchema>;

/** Snapshot line frozen at generation time. */
export type LogSlipLine = {
  id: string;
  logSlipId: string;
  lineType: LogSlipLineType;
  sourceType: string | null;
  sourceId: string | null;
  description: string;
  quantity: number | null;
  ratePaise: number | null;
  amountPaise: number;
  sortOrder: number;
  metadata: Record<string, unknown> | null;
};

/** Log slip as returned by the API. */
export type LogSlip = {
  id: string;
  journeyId: string;
  logSlipNumber: string | null;
  fyCode: string;
  logSlipDate: string;
  status: LogSlipStatus;
  vehicleId: string;
  driverId: string;
  openingKm: number;
  closingKm: number;
  totalKm: number;
  totalDays: number;
  totalFreightPaise: number;
  totalAdvancePaise: number;
  totalDieselQty: number;
  totalDieselAmountPaise: number;
  totalCashExpensePaise: number;
  totalCreditExpensePaise: number;
  totalExpensePaise: number;
  netVehicleResultPaise: number;
  driverCashExpensePaise: number;
  driverReceivablePaise: number;
  driverPayablePaise: number;
  previousDieselQty: number;
  dieselRatePaise: number | null;
  standardAverage: number | null;
  actualAverage: number | null;
  expectedDieselQty: number | null;
  shortDieselQty: number | null;
  remarks: string | null;
  generatedById: string | null;
  generatedAt: string | null;
  postedJournalEntryId: string | null;
  postedAt: string | null;
  reopenedById: string | null;
  reopenedAt: string | null;
  reopenReason: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;

  lines?: LogSlipLine[];
  vehicle?: { id: string; vehicleNumber: string };
  driver?: { id: string; name: string };
  journey?: {
    id: string;
    journeyNumber: string;
    startedAt: string;
    closedAt: string | null;
  };
  generatedBy?: { id: string; firstName: string; lastName: string } | null;
};

/**
 * Log slip preview — computed live from the journey (not yet frozen).
 * Same totals as LogSlip plus review warnings.
 */
export type LogSlipPreview = {
  journeyId: string;
  openingKm: number;
  closingKm: number | null;
  totalKm: number | null;
  totalDays: number | null;
  totalFreightPaise: number;
  totalAdvancePaise: number;
  totalDieselQty: number;
  totalDieselAmountPaise: number;
  totalCashExpensePaise: number;
  totalCreditExpensePaise: number;
  totalExpensePaise: number;
  netVehicleResultPaise: number;
  driverCashExpensePaise: number;
  driverReceivablePaise: number;
  driverPayablePaise: number;
  actualAverage: number | null;
  warnings: string[];
  lines: Array<
    Omit<LogSlipLine, "id" | "logSlipId"> & { id?: string; logSlipId?: string }
  >;
};
