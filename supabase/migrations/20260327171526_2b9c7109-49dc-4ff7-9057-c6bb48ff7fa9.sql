-- Consolidate advance_amount into deposit_paid where deposit_paid is missing
UPDATE tenant_allotments
SET deposit_paid = advance_amount
WHERE (deposit_paid IS NULL OR deposit_paid = 0)
  AND advance_amount IS NOT NULL AND advance_amount > 0;

-- Drop the redundant column
ALTER TABLE tenant_allotments DROP COLUMN IF EXISTS advance_amount;