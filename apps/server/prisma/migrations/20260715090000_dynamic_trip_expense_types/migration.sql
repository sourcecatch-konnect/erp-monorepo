-- Replace the deployment-time TripExpenseType enum with a user-extensible
-- master while preserving every existing expense row.
-- PostgreSQL tables create a same-named row type, so free the enum name first.
ALTER TYPE "TripExpenseType" RENAME TO "TripExpenseTypeLegacy";

CREATE TABLE "TripExpenseType" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "requiresDieselDetails" BOOLEAN NOT NULL DEFAULT false,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TripExpenseType_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TripExpenseType_code_key" ON "TripExpenseType"("code");
CREATE UNIQUE INDEX "TripExpenseType_name_key" ON "TripExpenseType"("name");
CREATE INDEX "TripExpenseType_isActive_sortOrder_idx" ON "TripExpenseType"("isActive", "sortOrder");

INSERT INTO "TripExpenseType"
    ("id", "code", "name", "requiresDieselDetails", "isSystem", "sortOrder", "updatedAt")
VALUES
    ('expense-diesel',    'DIESEL',    'Diesel',        true,  true, 10, CURRENT_TIMESTAMP),
    ('expense-toll',      'TOLL',      'Toll',          false, true, 20, CURRENT_TIMESTAMP),
    ('expense-parking',   'PARKING',   'Parking',       false, true, 30, CURRENT_TIMESTAMP),
    ('expense-food',      'FOOD',      'Food',          false, true, 40, CURRENT_TIMESTAMP),
    ('expense-repair',    'REPAIR',    'Repair',        false, true, 50, CURRENT_TIMESTAMP),
    ('expense-fine',      'FINE',      'Fine',          false, true, 60, CURRENT_TIMESTAMP),
    ('expense-loading',   'LOADING',   'Loading',       false, true, 70, CURRENT_TIMESTAMP),
    ('expense-unloading', 'UNLOADING', 'Unloading',     false, true, 80, CURRENT_TIMESTAMP),
    ('expense-misc',      'MISC',      'Miscellaneous', false, true, 90, CURRENT_TIMESTAMP);

ALTER TABLE "TripExpense" ADD COLUMN "expenseTypeId" TEXT;

UPDATE "TripExpense" expense
SET "expenseTypeId" = expense_type."id"
FROM "TripExpenseType" expense_type
WHERE expense_type."code" = expense."expenseType"::text;

ALTER TABLE "TripExpense" ALTER COLUMN "expenseTypeId" SET NOT NULL;
ALTER TABLE "TripExpense" DROP COLUMN "expenseType";
DROP TYPE "TripExpenseTypeLegacy";

CREATE INDEX "TripExpense_expenseTypeId_idx" ON "TripExpense"("expenseTypeId");
ALTER TABLE "TripExpense"
    ADD CONSTRAINT "TripExpense_expenseTypeId_fkey"
    FOREIGN KEY ("expenseTypeId") REFERENCES "TripExpenseType"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
