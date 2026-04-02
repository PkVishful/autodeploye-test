
ALTER TABLE public.owner_contracts
  ADD COLUMN IF NOT EXISTS property_tax_id text,
  ADD COLUMN IF NOT EXISTS water_tax_details text,
  ADD COLUMN IF NOT EXISTS payment_schedule text DEFAULT 'monthly',
  ADD COLUMN IF NOT EXISTS renewal_date date,
  ADD COLUMN IF NOT EXISTS renewal_periods integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ownership_doc_url text;
