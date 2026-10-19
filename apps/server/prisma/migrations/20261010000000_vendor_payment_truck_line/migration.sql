-- Transporter slips are paid per truck (LR group): one line per truck, with
-- the truck's freight/advance/commission/hamali/TDS counted once and every
-- LR's detention/damage added in. Fixes ERP-58 (a truck with N LRs paid N
-- times). Existing LR lines stay valid.
ALTER TYPE "VendorPaymentSourceType" ADD VALUE IF NOT EXISTS 'LR_GROUP';
