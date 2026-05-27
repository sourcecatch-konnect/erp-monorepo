import type { EwayBill, EwbStatus } from "./ewaybill.types.js";
import { seedEwayBills } from "./ewaybill.mock.js";

let bills: EwayBill[] = seedEwayBills();

const recomputeStatus = (bill: EwayBill): EwayBill => {
  if (bill.status === "DELIVERED" || bill.status === "CANCELLED") {
    return bill;
  }

  const expired = new Date(bill.validUntil).getTime() < Date.now();
  if (expired && bill.status !== "EXPIRED") {
    return { ...bill, status: "EXPIRED" };
  }
  return bill;
};

const sync = () => {
  bills = bills.map(recomputeStatus);
};

export const store = {
  all(): EwayBill[] {
    sync();
    return bills;
  },

  get(ewbNo: string): EwayBill | undefined {
    sync();
    return bills.find((b) => b.ewbNo === ewbNo);
  },

  updateVehicle(
    ewbNo: string,
    input: {
      vehicleNo: string;
      transDocNo?: string;
      transDocDate?: string;
      fromPlace: string;
      fromState: number;
      reasonCode: string;
      reasonRem: string;
      transMode: EwayBill["transMode"];
    }
  ): EwayBill {
    const idx = bills.findIndex((b) => b.ewbNo === ewbNo);
    if (idx === -1) {
      throw new Error("EWB not found");
    }

    const prev = bills[idx]!;
    const nextStatus: EwbStatus =
      prev.status === "PART_B_PENDING" ? "IN_TRANSIT" : prev.status;

    const updated: EwayBill = {
      ...prev,
      vehicleNo: input.vehicleNo,
      transDocNo: input.transDocNo ?? prev.transDocNo,
      transDocDate: input.transDocDate ?? prev.transDocDate,
      transMode: input.transMode,
      status: nextStatus,
      vehicleHistory: [
        ...prev.vehicleHistory,
        {
          vehicleNo: input.vehicleNo,
          transDocNo: input.transDocNo,
          transDocDate: input.transDocDate,
          fromPlace: input.fromPlace,
          fromState: input.fromState,
          reasonCode: input.reasonCode,
          reasonRem: input.reasonRem,
          updatedAt: new Date().toISOString(),
        },
      ],
    };

    bills[idx] = updated;
    return updated;
  },

  extend(
    ewbNo: string,
    input: {
      remainingDistanceKm: number;
      extnRsnCode: string;
      extnRemarks: string;
      fromPlace: string;
      additionalHours: number;
    }
  ): EwayBill {
    const idx = bills.findIndex((b) => b.ewbNo === ewbNo);
    if (idx === -1) {
      throw new Error("EWB not found");
    }

    const prev = bills[idx]!;
    const baseTime = Math.max(new Date(prev.validUntil).getTime(), Date.now());
    const newValidUntil = new Date(
      baseTime + input.additionalHours * 60 * 60 * 1000
    ).toISOString();

    const updated: EwayBill = {
      ...prev,
      validUntil: newValidUntil,
      status: prev.status === "EXPIRED" ? "ACTIVE" : prev.status,
      extensions: [
        ...prev.extensions,
        {
          extendedAt: new Date().toISOString(),
          newValidUntil,
          remainingDistanceKm: input.remainingDistanceKm,
          reasonCode: input.extnRsnCode,
          reasonRem: input.extnRemarks,
          fromPlace: input.fromPlace,
        },
      ],
    };

    bills[idx] = updated;
    return updated;
  },
};
