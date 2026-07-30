// apps/server/src/modules/grn/grn.service.ts

import { Prisma } from "../../../generated/prisma/index.js";
import { rupeesToPaise } from "../../lib/money.js";
import type { CreateGRNInput, UpdateGRNInput } from "@skerp/validators";

export {
  fyCodeFor,
  nextSequence,
  formatDocNumber,
} from "../_shared/doc-number.js";

type BranchScopedReq = {
  ctx?: {
    branchScope: "ALL" | "ASSIGNED";
    branchIds: string[];
  };
};

/**
 * This module records GRN at the source railhead. Access is owned by the
 * railhead branch selected on the Road & Rail LR group, not by the LR's final
 * destination branch.
 */
export const grnRailheadBranchFilter = (req: BranchScopedReq) => {
  if (!req.ctx) return {};
  if (req.ctx.branchScope === "ALL") return {};

  if (req.ctx.branchIds.length === 0) {
    return { id: { in: [] as string[] } };
  }

  return {
    group: {
      railheadBranchId: {
        in: req.ctx.branchIds,
      },
    },
  };
};

const branchSelect = {
  id: true,
  name: true,
  branchCode: true,
} satisfies Prisma.BranchSelect;

const customerSelect = {
  id: true,
  name: true,
} satisfies Prisma.CustomerSelect;

const locationSelect = {
  id: true,
  name: true,
  address: true,
  city: {
    select: {
      id: true,
      name: true,
    },
  },
} satisfies Prisma.CustomerLocationSelect;

const tripPreviewSelect = {
  id: true,
  tripNumber: true,
  tripName: true,
  onwardFreight: true,
  vehicle: {
    select: {
      id: true,
      vehicleNumber: true,
    },
  },
  driver: {
    select: {
      id: true,
      name: true,
      mobile: true,
    },
  },
} satisfies Prisma.VehicleTripSelect;

const userSelect = {
  id: true,
  firstName: true,
  lastName: true,
} satisfies Prisma.UserSelect;

const labourSelect = {
  id: true,
  name: true,
  type: true,
  mobileNo: true,
} satisfies Prisma.LabourSelect;

const lrLiteSelect = {
  id: true,
  lrNumber: true,
  status: true,
  invoiceNumber: true,
  invoiceAmount: true,

  ewayBill: {
    select: {
      id: true,
      ewayBillNo: true,
      generatedAt: true,
      expiresAt: true,
    },
  },

  group: {
    select: {
      id: true,
      groupNumber: true,
      transportType: true,
      originBranchId: true,
      destinationBranchId: true,
      sealNumber: true,

      consignor: { select: customerSelect },
      consignee: { select: customerSelect },
      originBranch: { select: branchSelect },
      destinationBranch: { select: branchSelect },
    },
  },
} satisfies Prisma.LorryReceiptSelect;
const lrDetailSelect = {
  id: true,
  lrNumber: true,
  status: true,
  fyCode: true,
  createdAt: true,
  invoiceNumber: true,
  invoiceAmount: true,

  loadingLocation: { select: locationSelect },
  unloadingLocation: { select: locationSelect },

  ewayBill: {
    select: {
      id: true,
      ewayBillNo: true,
      generatedAt: true,
      expiresAt: true,
    },
  },

  group: {
    select: {
      id: true,
      groupNumber: true,
      fyCode: true,
      source: true,
      transportType: true,
      tripLegType: true,
      priority: true,

      originBranchId: true,
      destinationBranchId: true,

      sealNumber: true,
      finalisedAt: true,

      // Important for edit preview
      isMarketVehicle: true,

      // Market vehicle fields
      marketVehicleNumber: true,
      marketDriverName: true,
      marketFreightAmount: true,
      marketAdvanceAmount: true,
      marketCommissionAmount: true,
      marketHamaliAmount: true,
      marketTdsAmount: true,

      // Own vehicle freight
      baseFreightAmount: true,

      consignor: { select: customerSelect },
      consignee: { select: customerSelect },

      originBranch: { select: branchSelect },
      destinationBranch: { select: branchSelect },
      hub: { select: branchSelect },
      railheadBranch: { select: branchSelect },

      // Own vehicle trip data
      primaryTrip: { select: tripPreviewSelect },
      secondaryTrip: { select: tripPreviewSelect },
    },
  },
} satisfies Prisma.LorryReceiptSelect;
/* ------------------------------------------------------------------ */
/* Eligible LR dropdown select                                         */
/* ------------------------------------------------------------------ */

export const eligibleLRSelect = {
  id: true,
  lrNumber: true,
  status: true,
  createdAt: true,
  invoiceNumber: true,
  invoiceAmount: true,
  groupId: true,
  group: {
    select: {
      id: true,
      groupNumber: true,
      destinationBranchId: true,
      railheadBranchId: true,
      consignor: { select: customerSelect },
      consignee: { select: customerSelect },
      originBranch: { select: branchSelect },
      destinationBranch: { select: branchSelect },
      railheadBranch: { select: branchSelect },
    },
  },
} satisfies Prisma.LorryReceiptSelect;

/* ------------------------------------------------------------------ */
/* GRN preview include                                                 */
/* ------------------------------------------------------------------ */

export const grnPreviewInclude = {
  loadingLocation: { select: locationSelect },
  unloadingLocation: { select: locationSelect },
  ewayBill: true,

  // Used only to block duplicate GRN.
  grn: {
    select: {
      id: true,
      grnNumber: true,
      status: true,
    },
  },

  goods: {
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      description: true,
      quantity: true,
      quantityUnitId: true,
      unit: true,
      weight: true,
      weightUnitId: true,
      quantityUnit: {
        select: {
          id: true,
          code: true,
          name: true,
        },
      },
      weightUnit: {
        select: {
          id: true,
          code: true,
          name: true,
        },
      },
      length: true,
      width: true,
      height: true,
    },
  },

  group: {
    select: {
      id: true,
      groupNumber: true,
      fyCode: true,
      source: true,
      transportType: true,
      tripLegType: true,
      priority: true,

      originBranchId: true,
      destinationBranchId: true,

      // Own / market vehicle logic
      isMarketVehicle: true,

      // Market vehicle fields
      marketVehicleNumber: true,
      marketDriverName: true,
      marketFreightAmount: true,
      marketAdvanceAmount: true,
      marketCommissionAmount: true,
      marketHamaliAmount: true,
      marketTdsAmount: true,

      // Own vehicle / common freight
      baseFreightAmount: true,
      sealNumber: true,
      finalisedAt: true,

      consignor: { select: customerSelect },
      consignee: { select: customerSelect },

      originBranch: { select: branchSelect },
      destinationBranch: { select: branchSelect },
      hub: { select: branchSelect },
      railheadBranch: { select: branchSelect },

      primaryTrip: { select: tripPreviewSelect },
      secondaryTrip: { select: tripPreviewSelect },
    },
  },
} satisfies Prisma.LorryReceiptInclude;

export const grnListSelect = {
  id: true,
  grnNumber: true,
  status: true,

  netAmount: true,
  createdAt: true,
  updatedAt: true,
  version: true,
  lorryReceipt: { select: lrLiteSelect },
} satisfies Prisma.GRNSelect;

export const grnDetailInclude = {
  lorryReceipt: { select: lrDetailSelect },
  goods: {
    orderBy: { createdAt: "asc" },
    include: {
      quantityUnit: {
        select: {
          id: true,
          code: true,
          name: true,
        },
      },
      weightUnit: {
        select: {
          id: true,
          code: true,
          name: true,
        },
      },
      vpLoadingGoods: {
        select: {
          loadedQty: true,
          loadingDamageQty: true,
          loadedWeightMt: true,
          loadedCft: true,
        },
      },
    },
  },
  labour: { select: labourSelect },
  unloadingSupervisor: { select: userSelect },
  createdBy: { select: userSelect },
  updatedBy: { select: userSelect },
} satisfies Prisma.GRNInclude;

type GRNMoneyInput = Pick<
  CreateGRNInput | UpdateGRNInput,
  | "totalFreight"
  | "balanceFreight"
  | "freightPerMt"
  | "detentionRate"
  | "advanceAmount"
  | "damageAmount"
  | "tdsAmount"
  | "hamaliAmount"
  | "printingStationaryAmount"
  | "labourCharge"
>;

const toMoney = (value: number | undefined) =>
  value === undefined ? undefined : BigInt(rupeesToPaise(value));

export const toDecimalOrNull = (value: number | undefined) =>
  value === undefined ? null : new Prisma.Decimal(value);

export const buildGRNMoneyData = (data: GRNMoneyInput) => ({
  totalFreight: toMoney(data.totalFreight),
  balanceFreight: toMoney(data.balanceFreight),
  freightPerMt: toMoney(data.freightPerMt),
  detentionRate: toMoney(data.detentionRate),
  advanceAmount: toMoney(data.advanceAmount),
  damageAmount: toMoney(data.damageAmount),
  tdsAmount: toMoney(data.tdsAmount),
  hamaliAmount: toMoney(data.hamaliAmount),
  printingStationaryAmount: toMoney(data.printingStationaryAmount),
  labourCharge: toMoney(data.labourCharge),
});

export const calculateGRNTotals = (
  goods: Array<{
    totalQty: number;
    receivedQty: number;
    damageQty: number;
    shortageQty: number;
  }>,
  money: {
    totalFreight?: bigint;
    detentionRate?: bigint;
    advanceAmount?: bigint;
    damageAmount?: bigint;
    tdsAmount?: bigint;
    hamaliAmount?: bigint;
    printingStationaryAmount?: bigint;
  },
  detentionDays: number,
) => {
  const totalQty = goods.reduce((sum, row) => sum + row.totalQty, 0);
  const receivedQty = goods.reduce((sum, row) => sum + row.receivedQty, 0);
  const damageQty = goods.reduce((sum, row) => sum + row.damageQty, 0);
  const shortageQty = goods.reduce((sum, row) => sum + row.shortageQty, 0);

  const detentionAmount =
    BigInt(detentionDays) * (money.detentionRate ?? BigInt(0));
  const grossTotal = (money.totalFreight ?? BigInt(0)) + detentionAmount;
  const deductions =
    (money.advanceAmount ?? BigInt(0)) +
    (money.damageAmount ?? BigInt(0)) +
    (money.tdsAmount ?? BigInt(0)) +
    (money.hamaliAmount ?? BigInt(0)) +
    (money.printingStationaryAmount ?? BigInt(0));

  return {
    totalQty,
    receivedQty,
    damageQty,
    shortageQty,
    detentionAmount,
    grossTotal,
    netAmount: grossTotal - deductions,
  };
};
