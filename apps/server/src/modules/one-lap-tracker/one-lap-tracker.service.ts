import type {
    OneLapSignalHealth,
    OneLapTracker,
    OneLapTrackerErpStatus,
    OneLapTrackerStatusCounts,
    OneLapTrackerSyncResult,
    UpdateOneLapTrackerBody,
} from "@skerp/types";

import { Prisma } from "../../../generated/prisma/index.js";
import { db } from "../../../prisma/prisma.js";
import {
    BadRequestError,
    NotFoundError,
} from "../../lib/error.js";
import {
    getOneLapDevices,
    type OneLapDevice,
} from "../tracking/onelap.client.js";

const LIVE_SIGNAL_MS = 15 * 60 * 1000;
const DELAYED_SIGNAL_MS = 2 * 60 * 60 * 1000;

const trackerInclude = {
    assignments: {
        where: {
            releasedAt: null,
        },
        orderBy: {
            assignedAt: "desc" as const,
        },
        take: 1,
        select: {
            id: true,
            vpScheduleId: true,
            installedOnMrRrRowId: true,
            assignedAt: true,

            installedOnMrRrRow: {
                select: {
                    vpNo: true,
                },
            },

            vpSchedule: {
                select: {
                    scheduleNumber: true,
                    railRake: {
                        select: {
                            rakeNumber: true,
                        },
                    },
                },
            },
        },
    },
} as const;

const cleanText = (
    value: string | null | undefined,
): string | null => {
    if (typeof value !== "string") return null;

    const result = value.trim();
    return result.length ? result : null;
};

const parseDate = (
    value: string | null | undefined,
): Date | null => {
    if (!value) return null;

    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
};

const getVehicleNumber = (
    device: OneLapDevice,
): string | null => {
    const value = device.attributes?.vehicleNumber;
    return typeof value === "string"
        ? cleanText(value)
        : null;
};

export const calculateSignalHealth = (
    lastUpdate: Date | null,
): OneLapSignalHealth => {
    if (!lastUpdate) return "NEVER_REPORTED";

    const age = Date.now() - lastUpdate.getTime();

    if (age <= LIVE_SIGNAL_MS) return "LIVE";
    if (age <= DELAYED_SIGNAL_MS) return "DELAYED";

    return "STALE";
};

type StatusInput = {
    isEnabled: boolean;
    isPresentOnProvider: boolean;
    validityAt: Date | null;
    hasActiveAssignment: boolean;
};

export const calculateErpStatus = ({
    isEnabled,
    isPresentOnProvider,
    validityAt,
    hasActiveAssignment,
}: StatusInput): OneLapTrackerErpStatus => {
    // Assignment is shown first because the tracker is still connected
    // to a journey even if it becomes offline or disabled.
    if (hasActiveAssignment) return "ASSIGNED";
    if (!isEnabled) return "DISABLED";
    if (!isPresentOnProvider) return "MISSING_ON_PROVIDER";

    if (validityAt && validityAt.getTime() < Date.now()) {
        return "EXPIRED";
    }

    return "AVAILABLE";
};

const findTrackerRecord = (id: string) =>
    db.oneLapTracker.findUnique({
        where: { id },
        include: trackerInclude,
    });

type TrackerRecord = NonNullable<
    Awaited<ReturnType<typeof findTrackerRecord>>
>;

const mapTracker = (row: TrackerRecord): OneLapTracker => {
    const assignment = row.assignments[0] ?? null;

    return {
        id: row.id,
        oneLapDeviceId: row.oneLapDeviceId,
        uniqueId: row.uniqueId,
        name: row.name,

        phone: row.phone,
        providerStatus: row.providerStatus,
        vehicleNumber: row.vehicleNumber,
        validityAt: row.validityAt?.toISOString() ?? null,

        isEnabled: row.isEnabled,
        isPresentOnProvider: row.isPresentOnProvider,

        lastProviderUpdateAt:
            row.lastProviderUpdateAt?.toISOString() ?? null,
        lastSyncedAt: row.lastSyncedAt.toISOString(),

        signalHealth: calculateSignalHealth(
            row.lastProviderUpdateAt,
        ),

        erpStatus: calculateErpStatus({
            isEnabled: row.isEnabled,
            isPresentOnProvider: row.isPresentOnProvider,
            validityAt: row.validityAt,
            hasActiveAssignment: Boolean(assignment),
        }),

        activeAssignment: assignment
            ? {
                id: assignment.id,
                vpScheduleId: assignment.vpScheduleId,
                scheduleNumber:
                    assignment.vpSchedule.scheduleNumber,
                rakeNumber:
                    assignment.vpSchedule.railRake?.rakeNumber ??
                    null,
                installedOnMrRrRowId:
                    assignment.installedOnMrRrRowId,
                installedOnVpNo:
                    assignment.installedOnMrRrRow.vpNo,
                assignedAt: assignment.assignedAt.toISOString(),
            }
            : null,

        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
    };
};

export type OneLapTrackerListInput = {
    page: number;
    size: number;
    search?: string;
};

export const listOneLapTrackers = async ({
    page,
    size,
    search,
}: OneLapTrackerListInput) => {
    const normalizedSearch = search?.trim();

    const where = normalizedSearch
        ? {
            OR: [
                {
                    name: {
                        contains: normalizedSearch,
                        mode: "insensitive" as const,
                    },
                },
                {
                    uniqueId: {
                        contains: normalizedSearch,
                        mode: "insensitive" as const,
                    },
                },
                {
                    vehicleNumber: {
                        contains: normalizedSearch,
                        mode: "insensitive" as const,
                    },
                },
                {
                    phone: {
                        contains: normalizedSearch,
                        mode: "insensitive" as const,
                    },
                },
            ],
        }
        : {};

    const [rows, total] = await Promise.all([
        db.oneLapTracker.findMany({
            where,
            include: trackerInclude,
            orderBy: {
                name: "asc",
            },
            skip: page * size,
            take: size,
        }),

        db.oneLapTracker.count({
            where,
        }),
    ]);

    return {
        data: rows.map(mapTracker),
        total,
    };
};

export const getOneLapTracker = async (
    id: string,
): Promise<OneLapTracker> => {
    const row = await findTrackerRecord(id);

    if (!row) {
        throw new NotFoundError("OneLap tracker not found");
    }

    return mapTracker(row);
};

export const updateOneLapTracker = async (
    id: string,
    body: UpdateOneLapTrackerBody,
): Promise<OneLapTracker> => {
    const existing = await findTrackerRecord(id);

    if (!existing) {
        throw new NotFoundError("OneLap tracker not found");
    }

    if (
        body.isEnabled === false &&
        existing.assignments.length > 0
    ) {
        throw new BadRequestError(
            "An assigned tracker cannot be disabled. Replace or release it first.",
        );
    }

    await db.oneLapTracker.update({
        where: { id },
        data: {
            isEnabled: body.isEnabled,
        },
    });

    return getOneLapTracker(id);
};

export const syncOneLapTrackers =
    async (): Promise<OneLapTrackerSyncResult> => {
        // Fetch before opening the database transaction.
        const devices = await getOneLapDevices();

        if (devices.length === 0) {
            throw new BadRequestError(
                "OneLap returned no devices. Synchronization was cancelled.",
            );
        }

        const syncedAt = new Date();
        const remoteDeviceIds = devices.map((device) => device.id);

        let created = 0;
        let updated = 0;

        const markedMissing = await db.$transaction(
            async (tx) => {
                for (const device of devices) {
                    if (
                        !Number.isInteger(device.id) ||
                        !device.uniqueId?.trim()
                    ) {
                        throw new BadRequestError(
                            "OneLap returned a device with an invalid ID or IMEI.",
                        );
                    }

                    const uniqueId = device.uniqueId.trim();

                    const [byDeviceId, byUniqueId] =
                        await Promise.all([
                            tx.oneLapTracker.findUnique({
                                where: {
                                    oneLapDeviceId: device.id,
                                },
                            }),
                            tx.oneLapTracker.findUnique({
                                where: {
                                    uniqueId,
                                },
                            }),
                        ]);

                    if (
                        byDeviceId &&
                        byUniqueId &&
                        byDeviceId.id !== byUniqueId.id
                    ) {
                        throw new BadRequestError(
                            `OneLap device ${device.id} conflicts with IMEI ${uniqueId}.`,
                        );
                    }

                    const existing = byDeviceId ?? byUniqueId;

                    const providerData = {
                        oneLapDeviceId: device.id,
                        uniqueId,
                        name:
                            cleanText(device.name) ??
                            `Device ${device.id}`,
                        phone: cleanText(device.phone),
                        providerStatus: cleanText(device.status),
                        vehicleNumber: getVehicleNumber(device),
                        validityAt: parseDate(device.validity),
                        attributes: device.attributes
                            ? (device.attributes as Prisma.InputJsonValue)
                            : Prisma.DbNull,
                        lastProviderUpdateAt: parseDate(
                            device.lastUpdate,
                        ),
                        lastSyncedAt: syncedAt,
                        isPresentOnProvider: true,
                    };

                    if (existing) {
                        await tx.oneLapTracker.update({
                            where: { id: existing.id },
                            data: providerData,
                        });

                        updated += 1;
                    } else {
                        await tx.oneLapTracker.create({
                            data: {
                                ...providerData,
                                isEnabled: true,
                            },
                        });

                        created += 1;
                    }
                }

                const missingResult =
                    await tx.oneLapTracker.updateMany({
                        where: {
                            oneLapDeviceId: {
                                notIn: remoteDeviceIds,
                            },
                            isPresentOnProvider: true,
                        },
                        data: {
                            isPresentOnProvider: false,
                            lastSyncedAt: syncedAt,
                        },
                    });

                return missingResult.count;
            },
        );

        return {
            fetched: devices.length,
            created,
            updated,
            markedMissing,
            syncedAt: syncedAt.toISOString(),
        };
    };

export const getOneLapTrackerStatusCounts =
    async (): Promise<OneLapTrackerStatusCounts> => {
        const rows = await db.oneLapTracker.findMany({
            select: {
                isEnabled: true,
                isPresentOnProvider: true,
                validityAt: true,
                lastProviderUpdateAt: true,
                assignments: {
                    where: {
                        releasedAt: null,
                    },
                    take: 1,
                    select: {
                        id: true,
                    },
                },
            },
        });

        const counts: OneLapTrackerStatusCounts = {
            total: rows.length,
            available: 0,
            assigned: 0,
            disabled: 0,
            missingOnProvider: 0,
            expired: 0,
            live: 0,
            delayed: 0,
            stale: 0,
            neverReported: 0,
        };

        for (const row of rows) {
            const erpStatus = calculateErpStatus({
                isEnabled: row.isEnabled,
                isPresentOnProvider: row.isPresentOnProvider,
                validityAt: row.validityAt,
                hasActiveAssignment:
                    row.assignments.length > 0,
            });

            if (erpStatus === "AVAILABLE") counts.available += 1;
            if (erpStatus === "ASSIGNED") counts.assigned += 1;
            if (erpStatus === "DISABLED") counts.disabled += 1;
            if (erpStatus === "MISSING_ON_PROVIDER") {
                counts.missingOnProvider += 1;
            }
            if (erpStatus === "EXPIRED") counts.expired += 1;

            const signalHealth = calculateSignalHealth(
                row.lastProviderUpdateAt,
            );

            if (signalHealth === "LIVE") counts.live += 1;
            if (signalHealth === "DELAYED") {
                counts.delayed += 1;
            }
            if (signalHealth === "STALE") counts.stale += 1;
            if (signalHealth === "NEVER_REPORTED") {
                counts.neverReported += 1;
            }
        }

        return counts;
    };
