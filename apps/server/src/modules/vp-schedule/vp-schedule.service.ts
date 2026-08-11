import { Prisma } from "../../../generated/prisma/index.js";
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

  createdBy: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
    },
  },
  wagonCounts: {
    select: {
      id: true,
      wagonId: true,
      count: true,
      wagon: {
        select: {
          id: true,
          name: true,
        },
      },
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

export type VPScheduleFreightMatchType =
  | "EXACT_AREAS"
  | "SOURCE_AREA"
  | "DESTINATION_AREA"
  | "CITY_ROUTE";

export const resolveVPScheduleFreightMatrices = async (
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
          id: true,
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
          id: true,
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
      isActive: true,
      totalCft: true,
      capacityMt: true,
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
      id: true,
      wagonId: true,
      sourceAreaId: true,
      destinationAreaId: true,
      freightAmount: true,
      wagon: {
        select: {
          id: true,
          name: true,
          isActive: true,
        },
      },
    },
  });

  const findBestMatch = (wagonId: string) => {
    const matches = freightMatrices.filter(
      (matrix) => matrix.wagonId === wagonId,
    );

    const candidates: Array<{
      type: VPScheduleFreightMatchType;
      matrix: (typeof freightMatrices)[number] | undefined;
    }> = [
      {
        type: "EXACT_AREAS",
        matrix: matches.find(
          (matrix) =>
            matrix.sourceAreaId === sourceArea.id &&
            matrix.destinationAreaId === destinationArea.id,
        ),
      },
      {
        type: "SOURCE_AREA",
        matrix: matches.find(
          (matrix) =>
            matrix.sourceAreaId === sourceArea.id &&
            matrix.destinationAreaId === null,
        ),
      },
      {
        type: "DESTINATION_AREA",
        matrix: matches.find(
          (matrix) =>
            matrix.sourceAreaId === null &&
            matrix.destinationAreaId === destinationArea.id,
        ),
      },
      {
        type: "CITY_ROUTE",
        matrix: matches.find(
          (matrix) =>
            matrix.sourceAreaId === null && matrix.destinationAreaId === null,
        ),
      },
    ];

    return candidates.find((candidate) => candidate.matrix) ?? null;
  };

  const selectedWagonIds = new Set(wagonIds);
  const alternativeWagonIds = [
    ...new Set(
      freightMatrices
        .filter(
          (matrix) =>
            matrix.wagon.isActive && !selectedWagonIds.has(matrix.wagonId),
        )
        .map((matrix) => matrix.wagonId),
    ),
  ];
  const alternativeWagons = alternativeWagonIds
    .map((wagonId) => {
      const match = findBestMatch(wagonId);
      const matrix = match?.matrix;
      if (!match || !matrix) return null;

      return {
        wagonId,
        wagonName: matrix.wagon.name,
        freightMatrixId: matrix.id,
        matchType: match.type,
        freightAmount: matrix.freightAmount,
      };
    })
    .filter((wagon): wagon is NonNullable<typeof wagon> => Boolean(wagon))
    .sort((left, right) => left.wagonName.localeCompare(right.wagonName));

  const selectedMatches = new Map(
    wagonIds.map((wagonId) => [wagonId, findBestMatch(wagonId)]),
  );
  const missingWagonIds = wagonIds.filter(
    (wagonId) => !selectedMatches.get(wagonId),
  );

  const configuredRouteRows = missingWagonIds.length
    ? await tx.railwayFreightMatrix.findMany({
        where: {
          wagonId: { in: missingWagonIds },
        },
        select: {
          id: true,
          wagonId: true,
          sourceCityId: true,
          destinationCityId: true,
          sourceAreaId: true,
          destinationAreaId: true,
          freightAmount: true,
          sourceCity: { select: { id: true, name: true } },
          destinationCity: { select: { id: true, name: true } },
          sourceArea: { select: { id: true, name: true } },
          destinationArea: { select: { id: true, name: true } },
        },
      })
    : [];

  const appliesToSelectedRoute = (
    matrix: (typeof configuredRouteRows)[number],
  ) =>
    matrix.sourceCityId === sourceArea.cityId &&
    matrix.destinationCityId === destinationArea.cityId &&
    ((matrix.sourceAreaId === sourceArea.id &&
      matrix.destinationAreaId === destinationArea.id) ||
      (matrix.sourceAreaId === sourceArea.id &&
        matrix.destinationAreaId === null) ||
      (matrix.sourceAreaId === null &&
        matrix.destinationAreaId === destinationArea.id) ||
      (matrix.sourceAreaId === null && matrix.destinationAreaId === null));

  const configuredRoutesByWagon = new Map<
    string,
    Array<{
      freightMatrixId: string;
      sourceCity: { id: string; name: string };
      destinationCity: { id: string; name: string };
      sourceArea: { id: string; name: string } | null;
      destinationArea: { id: string; name: string } | null;
      freightAmount: bigint;
    }>
  >();

  for (const matrix of configuredRouteRows) {
    if (appliesToSelectedRoute(matrix)) continue;

    const routeKey = [
      matrix.sourceCityId,
      matrix.destinationCityId,
      matrix.sourceAreaId ?? "*",
      matrix.destinationAreaId ?? "*",
    ].join(":");
    const routes = configuredRoutesByWagon.get(matrix.wagonId) ?? [];
    const existingKeys = new Set(
      routes.map((route) =>
        [
          route.sourceCity.id,
          route.destinationCity.id,
          route.sourceArea?.id ?? "*",
          route.destinationArea?.id ?? "*",
        ].join(":"),
      ),
    );
    if (existingKeys.has(routeKey)) continue;

    routes.push({
      freightMatrixId: matrix.id,
      sourceCity: matrix.sourceCity,
      destinationCity: matrix.destinationCity,
      sourceArea: matrix.sourceArea,
      destinationArea: matrix.destinationArea,
      freightAmount: matrix.freightAmount,
    });
    configuredRoutesByWagon.set(matrix.wagonId, routes);
  }

  for (const routes of configuredRoutesByWagon.values()) {
    routes.sort((left, right) => {
      const leftLabel = `${left.sourceArea?.name ?? left.sourceCity.name}-${left.destinationArea?.name ?? left.destinationCity.name}`;
      const rightLabel = `${right.sourceArea?.name ?? right.sourceCity.name}-${right.destinationArea?.name ?? right.destinationCity.name}`;
      return leftLabel.localeCompare(rightLabel);
    });
  }

  const results = data.wagonCounts.map((item) => {
    const wagon = wagonMap.get(item.wagonId)!;
    const match = selectedMatches.get(item.wagonId) ?? null;

    return {
      wagonId: wagon.id,
      wagonName: wagon.name,
      count: item.count,
      isActive: wagon.isActive,
      capacityCft: Number(wagon.totalCft ?? 0),
      capacityMt: Number(wagon.capacityMt ?? 0),
      status: match ? ("AVAILABLE" as const) : ("MISSING" as const),
      matchType: match?.type ?? null,
      freightMatrixId: match?.matrix?.id ?? null,
      freightAmount: match?.matrix?.freightAmount ?? null,
      totalFreight: match?.matrix
        ? match.matrix.freightAmount * BigInt(item.count)
        : null,
      alternativeWagons: match ? [] : alternativeWagons,
      configuredRoutes: match
        ? []
        : (configuredRoutesByWagon.get(wagon.id) ?? []),
    };
  });

  return {
    sourceArea,
    destinationArea,
    wagons: results,
  };
};

export const assertVPScheduleFreightMatrices = async (
  tx: Tx,
  data: VPScheduleFreightMatrixInput,
) => {
  const preview = await resolveVPScheduleFreightMatrices(tx, data);
  const missing = preview.wagons.filter((wagon) => wagon.status === "MISSING");

  if (!missing.length) return;

  const routeLabel = `${preview.sourceArea.name}-${preview.sourceArea.city.name} to ${preview.destinationArea.name}-${preview.destinationArea.city.name}`;
  const missingLines = missing.map(
    (wagon) => `${wagon.wagonName} (${routeLabel})`,
  );

  throw new BadRequestError(
    `Railway Freight not found for below Route and Wagon:\n${missingLines.join(
      "\n",
    )}`,
    "RAILWAY_FREIGHT_MISSING",
    {
      route: routeLabel,
      wagons: missing.map((wagon) => ({
        wagonId: wagon.wagonId,
        wagonName: wagon.wagonName,
      })),
    },
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
  const [sourceArea, destinationArea, sourceMapping, destinationMapping] =
    await Promise.all([
      tx.area.findUnique({
        where: { id: data.sourceAreaId },
        select: { id: true, name: true, isRailHead: true },
      }),
      tx.area.findUnique({
        where: { id: data.destinationAreaId },
        select: { id: true, name: true, isRailHead: true },
      }),
      tx.branchRailheadArea.findUnique({
        where: {
          branchId_areaId: {
            branchId: data.fromBranchId,
            areaId: data.sourceAreaId,
          },
        },
        select: { isActive: true },
      }),
      tx.branchRailheadArea.findUnique({
        where: {
          branchId_areaId: {
            branchId: data.toBranchId,
            areaId: data.destinationAreaId,
          },
        },
        select: { isActive: true },
      }),
    ]);

  if (!sourceArea?.isRailHead) {
    throw new BadRequestError("Source Area must be marked as a Rail Head");
  }
  if (!destinationArea?.isRailHead) {
    throw new BadRequestError("Destination Area must be marked as a Rail Head");
  }
  if (!sourceMapping?.isActive) {
    throw new BadRequestError(
      `${sourceArea.name} is not managed by the selected From Branch`,
    );
  }
  if (!destinationMapping?.isActive) {
    throw new BadRequestError(
      `${destinationArea.name} is not managed by the selected To Branch`,
    );
  }
};
