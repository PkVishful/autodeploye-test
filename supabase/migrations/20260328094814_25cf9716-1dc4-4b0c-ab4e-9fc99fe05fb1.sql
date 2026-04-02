-- Add receipt_type, base_amount, processing_fee to receipts
ALTER TABLE receipts 
  ADD COLUMN IF NOT EXISTS receipt_type text DEFAULT 'payment',
  ADD COLUMN IF NOT EXISTS base_amount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS processing_fee numeric DEFAULT 0;

-- Add property_id, apartment_id, bed_id to receipts for location tracking
ALTER TABLE receipts
  ADD COLUMN IF NOT EXISTS property_id uuid,
  ADD COLUMN IF NOT EXISTS apartment_id uuid,
  ADD COLUMN IF NOT EXISTS bed_id uuid;

-- Drop lifecycle_payments table
DROP TABLE IF EXISTS lifecycle_payments;