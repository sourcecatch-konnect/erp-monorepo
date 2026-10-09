-- Driver Lifecycle G4: a driver who joins or leaves mid-month is paid only
-- for the days he was employed. Both nullable: empty = employed all along.
ALTER TABLE "Driver" ADD COLUMN "joiningDate" TIMESTAMP(3);
ALTER TABLE "Driver" ADD COLUMN "leavingDate" TIMESTAMP(3);
