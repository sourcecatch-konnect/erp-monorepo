-- Cleans up ServiceBillLine rows left behind by service bills that were
-- cancelled before the cancel-handler fix (which now deletes these rows
-- itself). These stale rows still hold the unique jobCardServiceLineId,
-- blocking re-billing of that Job Card service line. Safe to delete: the
-- parent ServiceBill is CANCELLED, so these lines have no accounting effect.
DELETE FROM "ServiceBillLine"
WHERE "serviceBillId" IN (
  SELECT id FROM "ServiceBill" WHERE status = 'CANCELLED'
);
