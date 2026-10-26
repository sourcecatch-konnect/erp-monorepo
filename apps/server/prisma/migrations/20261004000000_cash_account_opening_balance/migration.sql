-- Opening balances for cash / bank accounts: the real balance as on the
-- ERP start date, so payments can be checked against money actually held.
ALTER TYPE "JournalSourceType" ADD VALUE 'OPENING_BALANCE';

CREATE TABLE "CashAccountOpening" (
    "id" TEXT NOT NULL,
    "cashAccountId" TEXT NOT NULL,
    "asOf" TIMESTAMP(3) NOT NULL,
    "amountPaise" BIGINT NOT NULL,
    "journalEntryId" TEXT,
    "updatedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CashAccountOpening_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CashAccountOpening_cashAccountId_key" ON "CashAccountOpening"("cashAccountId");

ALTER TABLE "CashAccountOpening" ADD CONSTRAINT "CashAccountOpening_cashAccountId_fkey"
    FOREIGN KEY ("cashAccountId") REFERENCES "CashAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CashAccountOpening" ADD CONSTRAINT "CashAccountOpening_updatedById_fkey"
    FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
