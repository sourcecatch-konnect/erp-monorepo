import { Prisma } from "../../../generated/prisma/index.js";
import { db } from "../../../prisma/prisma.js";
import { BadRequestError } from "../../lib/error.js";
import {
  fyCodeFor,
  nextSequence,
  formatDocNumber,
} from "../_shared/doc-number.js";

type Tx = Prisma.TransactionClient;

type VPScheduleWagonInput = {
  wagonId: string;
  count: number;
};

type VPScheduleFreightMatrixInput = {
  sourceAreaId: string;
  destinationAreaId: string;
  wagonCounts: VPScheduleWagonInput[];
};

export const vpScheduleListSelect = {
  id: true,
  scheduleNumber: true,
  scheduleName: true,
  scheduleDate: true,
  status: true,
  remarks: true,

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

  totalWagonCount: true,
  totalCapacityMt: true,
  totalCapacityCft: true,

  createdBy: {
    select: {
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
        height: true,
        width: true,
        weight: true,
        totalCft: true,
        capacityMt: true,
        isActive: true,
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
  wagonCounts: VPScheduleWagonInput[],
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

export const assertVPScheduleFreightMatrices = async (
  tx: Tx,
  data: VPScheduleFreightMatrixInput,
) => {
  const sourceArea = await tx.area.findUnique({
    where: { id: data.sourceAreaId },
    select: {
      id: true,
      name: true,
      cityId: true,
      city: {
        select: {
          name: true,
        },
      },
    },
  });

  const destinationArea = await tx.area.findUnique({
    where: { id: data.destinationAreaId },
    select: {
      id: true,
      name: true,
      cityId: true,
      city: {
        select: {
          name: true,
        },
      },
    },
  });

  const wagons = await tx.wagon.findMany({
    where: {
      id: {
        in: data.wagonCounts.map((item) => item.wagonId),
      },
    },
    select: {
      id: true,
      name: true,
    },
  });

  if (!sourceArea) {
    throw new BadRequestError("Source area not found");
  }

  if (!destinationArea) {
    throw new BadRequestError("Destination area not found");
  }

  const wagonMap = new Map(wagons.map((wagon) => [wagon.id, wagon]));
  const wagonIds = [...new Set(data.wagonCounts.map((item) => item.wagonId))];

  if (wagonIds.some((wagonId) => !wagonMap.has(wagonId))) {
    throw new BadRequestError("Selected wagon not found");
  }

  const freightMatrices = await tx.railwayFreightMatrix.findMany({
    where: {
      wagonId: {
        in: wagonIds,
      },
      sourceCityId: sourceArea.cityId,
      destinationCityId: destinationArea.cityId,
      OR: [
        {
          sourceAreaId: sourceArea.id,
          destinationAreaId: destinationArea.id,
        },
        {
          sourceAreaId: sourceArea.id,
          destinationAreaId: null,
        },
        {
          sourceAreaId: null,
          destinationAreaId: destinationArea.id,
        },
        {
          sourceAreaId: null,
          destinationAreaId: null,
        },
      ],
    },
    select: {
      wagonId: true,
    },
  });

  const wagonIdsWithRate = new Set(
    freightMatrices.map((matrix) => matrix.wagonId),
  );

  const missing = data.wagonCounts
    .map((item) => item.wagonId)
    .filter((wagonId, index, ids) => ids.indexOf(wagonId) === index)
    .filter((wagonId) => !wagonIdsWithRate.has(wagonId))
    .map((wagonId) => wagonMap.get(wagonId)?.name)
    .filter((name): name is string => Boolean(name));

  if (!missing.length) return;

  const routeLabel = `${sourceArea.name}-${sourceArea.city.name} to ${destinationArea.name}-${destinationArea.city.name}`;
  const missingLines = missing.map((wagonName) => `${wagonName} (${routeLabel})`);

  throw new BadRequestError(
    `Railway Freight not found for below Route and Wagon:\n${missingLines.join(
      "\n",
    )}`,
  );
};

export const assertVPScheduleReferences = async (
  tx: Tx,
  data: {
    fromBranchId?: string;
    toBranchId?: string;
    sourceAreaId?: string;
    destinationAreaId?: string;
    wagonCounts?: VPScheduleWagonInput[];
  },
) => {
  const fromBranch = data.fromBranchId
    ? await tx.branch.findUnique({
        where: { id: data.fromBranchId },
        select: { id: true },
      })
    : null;

  const toBranch = data.toBranchId
    ? await tx.branch.findUnique({
        where: { id: data.toBranchId },
        select: { id: true },
      })
    : null;

  const sourceArea = data.sourceAreaId
    ? await tx.area.findUnique({
        where: { id: data.sourceAreaId },
        select: { id: true },
      })
    : null;

  const destinationArea = data.destinationAreaId
    ? await tx.area.findUnique({
        where: { id: data.destinationAreaId },
        select: { id: true },
      })
    : null;

  const wagons = data.wagonCounts?.length
    ? await tx.wagon.findMany({
        where: {
          id: {
            in: data.wagonCounts.map((item) => item.wagonId),
          },
        },
        select: { id: true },
      })
    : [];

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

export const assertVPScheduleBranchAreaAlignment = async (
  tx: Tx,
  data: {
    fromBranchId: string;
    toBranchId: string;
    sourceAreaId: string;
    destinationAreaId: string;
  },
) => {
  const fromBranch = await tx.branch.findUnique({
    where: { id: data.fromBranchId },
    select: { cityId: true },
  });

  const toBranch = await tx.branch.findUnique({
    where: { id: data.toBranchId },
    select: { cityId: true },
  });

  const sourceArea = await tx.area.findUnique({
    where: { id: data.sourceAreaId },
    select: { cityId: true },
  });

  const destinationArea = await tx.area.findUnique({
    where: { id: data.destinationAreaId },
    select: { cityId: true },
  });

  if (!fromBranch?.cityId) {
    throw new BadRequestError("From branch city not found");
  }

  if (!toBranch?.cityId) {
    throw new BadRequestError("To branch city not found");
  }

  if (!sourceArea?.cityId) {
    throw new BadRequestError("Source area city not found");
  }

  if (!destinationArea?.cityId) {
    throw new BadRequestError("Destination area city not found");
  }

  if (sourceArea.cityId !== fromBranch.cityId) {
    throw new BadRequestError("Source area must belong to the from branch city");
  }

  if (destinationArea.cityId !== toBranch.cityId) {
    throw new BadRequestError(
      "Destination area must belong to the to branch city",
    );
  }
};
