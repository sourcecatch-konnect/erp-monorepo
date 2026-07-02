import { Prisma } from "../../../generated/prisma/index.js";
import { rupeesToPaise } from "../../lib/money.js";
import type {
  CreateVPLoadingBody,
  UpdateVPLoadingBody,
} from "@skerp/types";

export {
  fyCodeFor,
  nextSequence,
  formatDocNumber,
} from "../_shared/doc-number.js";

/* ------------------------------------------------------------------ */
/* Selects / Includes                                                 */
/* ------------------------------------------------------------------ */

export const vpLoadingListSelect = {
  id: true,
  loadingNumber: true,
  status: true,
  gateNo: true,

  loadedQty: true,
  loadedCft: true,
  loadedWeightMt: true,

  loadingStartedAt: true,
  loadingCompletedAt: true,

  createdAt: true,
  updatedAt: true,
  version: true,

  vpSchedule: {
    select: {
      id: true,
      scheduleNumber: true,
      scheduleName: true,
      scheduleDate: true,

      sourceArea: {
        select: {
          id: true,
          name: true,
        },
      },

      destinationArea: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  },

  mrRr: {
    select: {
      id: true,
      mrRrNumber: true,
      status: true,
      rakeType: true,
    },
  },

  mrRrRow: {
    select: {
      id: true,
      rowNumber: true,
      rowLabel: true,
      wagonTypeLabel: true,
      vpNo: true,
      mrRrNo: true,
      sealNo: true,
    },
  },

  lorryReceipt: {
    select: {
      id: true,
      lrNumber: true,
      status: true,
    },
  },

  grn: {
    select: {
      id: true,
      grnNumber: true,
      status: true,
      receivedQty: true,
      damageQty: true,
      shortageQty: true,
    },
  },
} satisfies Prisma.VPLoadingSelect;

export const vpLoadingDetailInclude = {
  vpSchedule: {
    select: {
      id: true,
      scheduleNumber: true,
      scheduleName: true,
      scheduleDate: true,
      status: true,
      fromBranchId: true,

      fromBranch: {
        select: {
          id: true,
          name: true,
          branchCode: true,
        },
      },

      toBranch: {
        select: {
          id: true,
          name: true,
          branchCode: true,
        },
      },

      sourceArea: {
        select: {
          id: true,
          name: true,
        },
      },

      destinationArea: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  },

  mrRr: {
    select: {
      id: true,
      mrRrNumber: true,
      status: true,
      rakeType: true,
    },
  },

  mrRrRow: {
    select: {
      id: true,
      rowNumber: true,
      rowLabel: true,
      wagonTypeLabel: true,
      sequenceNo: true,
      vpNo: true,
      mrRrNo: true,
      sealNo: true,
    },
  },

  lorryReceipt: {
    select: {
      id: true,
      lrNumber: true,
      status: true,
    },
  },

  grn: {
    select: {
      id: true,
      grnNumber: true,
      status: true,
      totalQty: true,
      receivedQty: true,
      damageQty: true,
      shortageQty: true,
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

  loadingSupervisor: {
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
} satisfies Prisma.VPLoadingInclude;

/* ------------------------------------------------------------------ */
/* Money / Decimal helpers                                            */
/* ------------------------------------------------------------------ */

const toMoney = (value: number | undefined): number | undefined => {
  return value === undefined ? undefined : rupeesToPaise(value);
};

export const buildVPLoadingMoneyData = (
  data: CreateVPLoadingBody | UpdateVPLoadingBody,
) => {
  return {
    labourCharge: toMoney(data.labourCharge),
  };
};

export const toDecimalOrNull = (value: number | undefined) => {
  return value === undefined ? null : new Prisma.Decimal(value);
};