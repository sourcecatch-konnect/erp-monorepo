-- A tracker can belong to only one active rake journey at a time.
CREATE UNIQUE INDEX "OneLapTrackerAssignment_active_tracker_key"
ON "OneLapTrackerAssignment" ("trackerId")
WHERE "releasedAt" IS NULL;

-- A VP schedule/rake journey can have only one active tracker at a time.
CREATE UNIQUE INDEX "OneLapTrackerAssignment_active_schedule_key"
ON "OneLapTrackerAssignment" ("vpScheduleId")
WHERE "releasedAt" IS NULL;
