import { z } from "zod";

import {
    oneLapTrackerSchema,
    oneLapTrackerErpStatusSchema,
    oneLapSignalHealthSchema,
    oneLapTrackerAssignmentSummarySchema,
    updateOneLapTrackerSchema,
    assignOneLapTrackerSchema,
    releaseOneLapTrackerSchema,
    replaceOneLapTrackerSchema,
} from "@skerp/validators";

export type OneLapTracker = z.infer<typeof oneLapTrackerSchema>;

export type OneLapTrackerErpStatus = z.infer<
    typeof oneLapTrackerErpStatusSchema
>;

export type OneLapSignalHealth = z.infer<
    typeof oneLapSignalHealthSchema
>;

export type OneLapTrackerAssignmentSummary = z.infer<
    typeof oneLapTrackerAssignmentSummarySchema
>;

export type UpdateOneLapTrackerBody = z.output<
    typeof updateOneLapTrackerSchema
>;

export type UpdateOneLapTrackerFormInput = z.input<
    typeof updateOneLapTrackerSchema
>;

export type AssignOneLapTrackerBody = z.output<
    typeof assignOneLapTrackerSchema
>;

export type ReplaceOneLapTrackerBody = z.output<
    typeof replaceOneLapTrackerSchema
>;

export type ReleaseOneLapTrackerBody = z.output<
    typeof releaseOneLapTrackerSchema
>;

export type AvailableOneLapTracker = {
    id: string;
    oneLapDeviceId: number;
    uniqueId: string;
    name: string;
    vehicleNumber: string | null;
    providerStatus: string | null;
    validityAt: string | null;
    lastProviderUpdateAt: string | null;
    signalHealth: OneLapSignalHealth;
};

export type OneLapTrackerAssignmentDetail = {
    id: string;
    trackerId: string;
    vpScheduleId: string;
    installedOnMrRrRowId: string;
    installedOnVpNo: string | null;
    assignedAt: string;
    releasedAt: string | null;
    releaseReason: string | null;
    releaseRemarks: string | null;
    tracker: {
        id: string;
        oneLapDeviceId: number;
        uniqueId: string;
        name: string;
        vehicleNumber: string | null;
        providerStatus: string | null;
        validityAt: string | null;
        lastProviderUpdateAt: string | null;
        signalHealth: OneLapSignalHealth;
    };
    schedule: {
        id: string;
        scheduleNumber: string;
        scheduleName: string;
        status: string;
        fromBranch: { id: string; name: string };
        toBranch: { id: string; name: string };
        sourceArea: { id: string; name: string };
        destinationArea: { id: string; name: string };
        railRake: {
            id: string;
            rakeNumber: string;
            status: string;
        } | null;
    };
};

export type OneLapTrackerStatusCounts = {
    total: number;
    available: number;
    assigned: number;
    disabled: number;
    missingOnProvider: number;
    expired: number;
    live: number;
    delayed: number;
    stale: number;
    neverReported: number;
};

export type OneLapTrackerSyncResult = {
    fetched: number;
    created: number;
    updated: number;
    markedMissing: number;
    syncedAt: string;
};
