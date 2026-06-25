import { Prisma } from "../../../generated/prisma/index.js";
import { db } from "../../../prisma/prisma.js";
import { BadRequestError } from "../../lib/error.js";
import {
  fyCodeFor,
  nextSequence,
  formatDocNumber,
} from "../_shared/doc-number.js";

type Tx = Prisma.TransactionClient;

export const vpScheduleListSelect = {
  id: true,
  scheduleNumber: true,
  scheduleDate: true,
  scheduleName: true,
  status: true,
  totalWagonCount: true,
  totalCapacityCft: true,
  totalCapacityMt: true,
  remarks: true,
  createdAt: true,
  updatedAt: true,

  fromBranch: {
    select: {
      id: true,
      branchCode: true,
      name: true,
    },
  },

  toBranch: {
    select: {
      id: true,
      branchCode: true,
      name: true,
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

  createdBy: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
    },
  },
} satisfies Prisma.VPScheduleSelect;

export const vpScheduleInclude = {
  fromBranch: {
    select: {
      id: true,
      branchCode: true,
      name: true,
    },
  },

  toBranch: {
    select: {
      id: true,
      branchCode: true,
      name: true,
    },
  },

  sourceArea: {
    select: {
      id: true,
      name: true,
      city: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  },

  destinationArea: {
    select: {
      id: true,
      name: true,
      city: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  },

  wagonCounts: {
    include: {
      wagon: {
        select: {
          id: true,
          name: true,
          totalCft: true,
          capacityMt: true,
        },
      },
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
} satisfies Prisma.VPScheduleInclude;

export const generateVPScheduleNumber = async (
  tx: Tx,
  fromBranchId: string,
) => {
  const branch = await tx.branch.findUnique({
    where: { id: fromBranchId },
    select: {
      branchCode: true,
    },
  });

  if (!branch) {
    throw new BadRequestError("From branch not found");
  }

  const fyCode = fyCodeFor(new Date());
  const seq = await nextSequence(tx, branch.branchCode, fyCode, "VP");

  return {
    fyCode,
    scheduleNumber: formatDocNumber(branch.branchCode, fyCode, seq, "VP"),
  };
};

export const calculateVPScheduleTotals = async (
  tx: Tx,
  wagonCounts: {
    wagonId: string;
    count: number;
  }[],
) => {
  const wagonIds = wagonCounts.map((item) => item.wagonId);

  const wagons = await tx.wagon.findMany({
    where: {
      id: {
        in: wagonIds,
      },
    },
    select: {
      id: true,
      totalCft: true,
      capacityMt: true,
    },
  });

  const wagonMap = new Map(wagons.map((wagon) => [wagon.id, wagon]));

  let totalWagonCount = 0;
  let totalCapacityCft = 0;
  let totalCapacityMt = 0;

  for (const item of wagonCounts) {
    const wagon = wagonMap.get(item.wagonId);

    if (!wagon) {
      throw new BadRequestError("Selected wagon not found");
    }

    totalWagonCount += item.count;
    totalCapacityCft += Number(wagon.totalCft ?? 0) * item.count;
    totalCapacityMt += Number(wagon.capacityMt ?? 0) * item.count;
  }

  return {
    totalWagonCount,
    totalCapacityCft,
    totalCapacityMt,
  };
};

export const assertVPScheduleReferences = async (
  tx: Tx,
  data: {
    fromBranchId?: string;
    toBranchId?: string;
    sourceAreaId?: string;
    destinationAreaId?: string;
    wagonCounts?: {
      wagonId: string;
      count: number;
    }[];
  },
) => {
  const [
    fromBranch,
    toBranch,
    sourceArea,
    destinationArea,
    wagons,
  ] = await Promise.all([
    data.fromBranchId
      ? tx.branch.findUnique({
          where: { id: data.fromBranchId },
          select: { id: true },
        })
      : null,

    data.toBranchId
      ? tx.branch.findUnique({
          where: { id: data.toBranchId },
          select: { id: true },
        })
      : null,

    data.sourceAreaId
      ? tx.area.findUnique({
          where: { id: data.sourceAreaId },
          select: { id: true },
        })
      : null,

    data.destinationAreaId
      ? tx.area.findUnique({
          where: { id: data.destinationAreaId },
          select: { id: true },
        })
      : null,

    data.wagonCounts?.length
      ? tx.wagon.findMany({
          where: {
            id: {
              in: data.wagonCounts.map((item) => item.wagonId),
            },
          },
          select: { id: true },
        })
      : [],
  ]);

  if (data.fromBranchId && !fromBranch) {
    throw new BadRequestError("From branch not found");
  }

  if (data.toBranchId && !toBranch) {
    throw new BadRequestError("To branch not found");
  }

  if (data.sourceAreaId && !sourceArea) {
    throw new BadRequestError("Source area not found");
  }

  if (data.destinationAreaId && !destinationArea) {
    throw new BadRequestError("Destination area not found");
  }

  if (data.wagonCounts?.length) {
    const foundWagonIds = new Set(wagons.map((wagon) => wagon.id));

    const missingWagon = data.wagonCounts.find(
      (item) => !foundWagonIds.has(item.wagonId),
    );

    if (missingWagon) {
      throw new BadRequestError("Selected wagon not found");
    }
  }
};