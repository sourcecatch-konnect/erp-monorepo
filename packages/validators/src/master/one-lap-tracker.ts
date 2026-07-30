import { z } from "zod";

export const oneLapTrackerErpStatusSchema = z.enum([
    "AVAILABLE",
    "ASSIGNED",
    "DISABLED",
    "MISSING_ON_PROVIDER",
    "EXPIRED",
]);

export const oneLapSignalHealthSchema = z.enum([
    "LIVE",
    "DELAYED",
    "STALE",
    "NEVER_REPORTED",
]);

export const oneLapTrackerAssignmentSummarySchema = z.object({
    id: z.string(),
    vpScheduleId: z.string(),
    scheduleNumber: z.string(),
    rakeNumber: z.string().nullable(),
    installedOnMrRrRowId: z.string(),
    installedOnVpNo: z.string().nullable(),
    assignedAt: z.string(),
});

export const oneLapTrackerSchema = z.object({
    id: z.string(),

    oneLapDeviceId: z.number().int(),
    uniqueId: z.string(),
    name: z.string(),

    phone: z.string().nullable(),
    providerStatus: z.string().nullable(),
    vehicleNumber: z.string().nullable(),
    validityAt: z.string().nullable(),

    isEnabled: z.boolean(),
    isPresentOnProvider: z.boolean(),

    lastProviderUpdateAt: z.string().nullable(),
    lastSyncedAt: z.string(),

    signalHealth: oneLapSignalHealthSchema,
    erpStatus: oneLapTrackerErpStatusSchema,



    activeAssignment: oneLapTrackerAssignmentSummarySchema.nullable(),

    createdAt: z.string(),
    updatedAt: z.string(),
});

export const updateOneLapTrackerSchema = z.object({
    isEnabled: z.boolean(),
});

const trackerAssignmentId = (label: string) =>
    z.string().trim().min(1, `${label} is required`);

export const assignOneLapTrackerSchema = z.object({
    trackerId: trackerAssignmentId("Tracker"),
    installedOnMrRrRowId: trackerAssignmentId("Host VP"),
});

export const replaceOneLapTrackerSchema = assignOneLapTrackerSchema.extend({
    reason: z
        .string()
        .trim()
        .min(3, "Replacement reason must be at least 3 characters")
        .max(500, "Replacement reason is too long"),
});

export const releaseOneLapTrackerSchema = z.object({
    reason: z
        .string()
        .trim()
        .min(3, "Release reason must be at least 3 characters")
        .max(500, "Release reason is too long"),
});
