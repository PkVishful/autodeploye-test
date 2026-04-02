ALTER TABLE organizations ADD COLUMN IF NOT EXISTS gst_number text;
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS receipt_number text;