import { Prisma } from "../../../generated/prisma/index.js";

export const mrrrListSelect = {
  id: true,
  mrRrNumber: true,
  vpScheduleId: true,
  rakeType: true,
  status: true,
  remarks: true,
  version: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,

  vpSchedule: {
    select: {
      id: true,
      scheduleNumber: true,
      scheduleDate: true,
      scheduleName: true,
      status: true,
      totalWagonCount: true,
      fromBranchId: true,
      toBranchId: true,
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
    },
  },

  createdBy: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      userName: true,
    },
  },

  updatedBy: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      userName: true,
    },
  },
} satisfies Prisma.MRRRSelect;

export const mrrrInclude = {
  vpSchedule: {
    include: {
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
    },
  },

  rows: {
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
      vpScheduleWagonCount: {
        select: {
          id: true,
          count: true,
          wagonId: true,
          capacityCft: true,
          capacityMt: true,
          totalCft: true,
          totalMt: true,
          freightAmount: true,
          totalFreight: true,
        },
      },
    },
    orderBy: {
      rowNumber: "asc",
    },
  },

  createdBy: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      userName: true,
    },
  },

  updatedBy: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      userName: true,
    },
  },
} satisfies Prisma.MRRRInclude;

type WagonCountForPreview = {
  id: string;
  wagonId: string;
  count: number;
  wagon: {
    id: string;
    name: string;
  };
};

export const buildMRRRPreviewRows = (
  wagonCounts: WagonCountForPreview[],
) => {
  let globalRowNumber = 1;

  return wagonCounts.flatMap((item) =>
    Array.from({ length: item.count }, (_, index) => {
      const rowNumber = globalRowNumber++;

      return {
        vpScheduleWagonCountId: item.id,
        wagonId: item.wagonId,
        wagonTypeLabel: item.wagon.name,
        rowNumber,
        rowLabel: `${item.wagon.name}-${index + 1}`,
      };
    }),
  );
};

export const getMRRRSearchWhere = (
  search?: string,
): Prisma.MRRRWhereInput => {
  const value = search?.trim();

  if (!value) {
    return {};
  }

  return {
    OR: [
      {
        mrRrNumber: {
          contains: value,
          mode: "insensitive",
        },
      },
      {
        vpSchedule: {
          scheduleNumber: {
            contains: value,
            mode: "insensitive",
          },
        },
      },
      {
        vpSchedule: {
          scheduleName: {
            contains: value,
            mode: "insensitive",
          },
        },
      },
      {
        vpSchedule: {
          fromBranch: {
            name: {
              contains: value,
              mode: "insensitive",
            },
          },
        },
      },
      {
        vpSchedule: {
          toBranch: {
            name: {
              contains: value,
              mode: "insensitive",
            },
          },
        },
      },
    ],
  };
};

export const getMRRRRequiredRowsMissingFields = (
  rows: {
    id: string;
    rowLabel: string;
    sequenceNo: string | null;
    vpNo: string | null;
    mrRrNo: string | null;
    sealNo: string | null;
  }[],
) => {
  return rows
    .map((row) => {
      const missing: string[] = [];

      if (!row.sequenceNo?.trim()) missing.push("Sequence No");
      if (!row.vpNo?.trim()) missing.push("VP No");
      if (!row.mrRrNo?.trim()) missing.push("MR/RR No");
      if (!row.sealNo?.trim()) missing.push("Seal No");

      return {
        rowId: row.id,
        rowLabel: row.rowLabel,
        missing,
      };
    })
    .filter((item) => item.missing.length > 0);
};