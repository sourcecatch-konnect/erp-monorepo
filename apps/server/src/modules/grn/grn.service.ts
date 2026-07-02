import { Prisma } from "../../../generated/prisma/index.js";
import { rupeesToPaise } from "../../lib/money.js";
import type { CreateGRNBody, UpdateGRNBody } from "@skerp/types";

export {
  fyCodeFor,
  nextSequence,
  formatDocNumber,
} from "../_shared/doc-number.js";

type GRNGoodsInput = CreateGRNBody["goods"][number];

/* ------------------------------------------------------------------ */
/* Selects / Includes                                                 */
/* ------------------------------------------------------------------ */

export const grnListSelect = {
  id: true,
  grnNumber: true,
  lorryReceiptId: true,
 
  status: true,
  gateNo: true,

  inDateTime: true,
  outDateTime: true,
  unloadingMinutes: true,

  totalQty: true,
  receivedQty: true,
  damageQty: true,
  shortageQty: true,
  totalWeightMt: true,

  grossTotal: true,
  netAmount: true,

  createdAt: true,
  updatedAt: true,
  version: true,

  lorryReceipt: {
    select: {
      id: true,
      lrNumber: true,
      status: true,
      invoiceNumber: true,
      invoiceAmount: true,
    },
  },


  createdBy: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
    },
  },
} satisfies Prisma.GRNSelect;

export const grnDetailInclude = {
  lorryReceipt: {
    select: {
      id: true,
      lrNumber: true,
      status: true,
      invoiceNumber: true,
      invoiceAmount: true,

      group: {
        select: {
          id: true,
          groupNumber: true,
          transportType: true,

          originBranch: {
            select: {
              id: true,
              name: true,
              branchCode: true,
            },
          },

          destinationBranch: {
            select: {
              id: true,
              name: true,
              branchCode: true,
            },
          },

          consignor: {
            select: {
              id: true,
              name: true,
            },
          },

          consignee: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
  },

 
  goods: {
    orderBy: {
      createdAt: "asc" as const,
    },
  },

  labour: {
    select: {
      id: true,
      name: true,
      type: true,
      mobileNo: true,
    },
  },

  unloadingSupervisor: {
    select: {
      id: true,
      name: true,
      type: true,
      mobileNo: true,
    },
  },

  createdBy: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
    },
  },

  updatedBy: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
    },
  },
} satisfies Prisma.GRNInclude;

export const grnPreviewLRInclude = {
  group: {
    select: {
      id: true,
      groupNumber: true,
      transportType: true,

      originBranch: {
        select: {
          id: true,
          name: true,
          branchCode: true,
        },
      },

      destinationBranch: {
        select: {
          id: true,
          name: true,
          branchCode: true,
        },
      },

      consignor: {
        select: {
          id: true,
          name: true,
        },
      },

      consignee: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  },

  goods: {
    orderBy: {
      createdAt: "asc" as const,
    },
    select: {
      id: true,
      name: true,
      description: true,
      quantity: true,
      unit: true,
      weight: true,
    },
  },

  ewayBill: {
    select: {
      id: true,
      ewayBillNo: true,
      expiresAt: true,
      generatedAt: true,
    },
  },
} satisfies Prisma.LorryReceiptInclude;

/* ------------------------------------------------------------------ */
/* Calculation helpers                                                */
/* ------------------------------------------------------------------ */
const toMoney = (value: number | undefined): number | undefined => {
  return value === undefined ? undefined : rupeesToPaise(value);
};

const toMoneyOrZero = (value: number | undefined): number => {
  return value === undefined ? 0 : rupeesToPaise(value);
};
export const calculateUnloadingMinutes = (
  inDateTime?: Date,
  outDateTime?: Date,
) => {
  if (!inDateTime || !outDateTime) return null;

  const diff = outDateTime.getTime() - inDateTime.getTime();

  if (diff < 0) return null;

  return Math.floor(diff / 60000);
};

export const calculateGRNGoodsTotals = (goods: GRNGoodsInput[]) => {
  return goods.reduce(
    (acc, item) => {
      acc.totalQty += item.totalQty;
      acc.receivedQty += item.receivedQty;
      acc.damageQty += item.damageQty;
      acc.shortageQty += item.shortageQty;

      if (item.weight !== undefined) {
        acc.totalWeightMt += item.weight;
      }

      return acc;
    },
    {
      totalQty: 0,
      receivedQty: 0,
      damageQty: 0,
      shortageQty: 0,
      totalWeightMt: 0,
    },
  );
};

export const calculateGRNAmounts = (
  data: Pick<
    CreateGRNBody | UpdateGRNBody,
    | "balanceFreight"
    | "detentionDays"
    | "detentionRate"
    | "advanceAmount"
    | "damageAmount"
    | "tdsAmount"
    | "hamaliAmount"
    | "printingStationaryAmount"
  >,
) => {
  const balanceFreight = toMoneyOrZero(data.balanceFreight);
  const detentionRate = toMoneyOrZero(data.detentionRate);

  const advanceAmount = toMoneyOrZero(data.advanceAmount);
  const damageAmount = toMoneyOrZero(data.damageAmount);
  const tdsAmount = toMoneyOrZero(data.tdsAmount);
  const hamaliAmount = toMoneyOrZero(data.hamaliAmount);
  const printingStationaryAmount = toMoneyOrZero(
    data.printingStationaryAmount,
  );

  const detentionAmount = (data.detentionDays ?? 0) * detentionRate;

  const grossTotal = balanceFreight + detentionAmount;

  const netAmount =
    grossTotal -
    advanceAmount -
    damageAmount -
    tdsAmount +
    hamaliAmount +
    printingStationaryAmount;

  return {
    detentionAmount,
    grossTotal,
    netAmount,
  };
};
export const buildGRNMoneyData = (data: CreateGRNBody | UpdateGRNBody) => {
  const amounts = calculateGRNAmounts(data);

  return {
    totalFreight: toMoney(data.totalFreight),
    balanceFreight: toMoney(data.balanceFreight),
    freightPerMt: toMoney(data.freightPerMt),

    detentionRate: toMoney(data.detentionRate),
    detentionAmount: amounts.detentionAmount,

    grossTotal: amounts.grossTotal,

    advanceAmount: toMoneyOrZero(data.advanceAmount),
    damageAmount: toMoneyOrZero(data.damageAmount),
    tdsAmount: toMoneyOrZero(data.tdsAmount),
    hamaliAmount: toMoneyOrZero(data.hamaliAmount),
    printingStationaryAmount: toMoneyOrZero(
      data.printingStationaryAmount,
    ),

    netAmount: amounts.netAmount,
  };
};

export const buildGRNGoodsCreateData = (goods: GRNGoodsInput[]) => {
  return goods.map((item) => ({
    lrGoodsId: item.lrGoodsId ?? null,
    goodsName: item.goodsName,
    description: item.description ?? null,
    totalQty: item.totalQty,
    receivedQty: item.receivedQty,
    damageQty: item.damageQty,
    shortageQty: item.shortageQty,
    unit: item.unit ?? null,
    weight:
      item.weight === undefined
        ? undefined
        : new Prisma.Decimal(item.weight),
    remarks: item.remarks ?? null,
  }));
};