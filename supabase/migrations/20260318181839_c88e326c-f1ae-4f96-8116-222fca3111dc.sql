ALTER TABLE tenant_allotments ADD COLUMN IF NOT EXISTS kyc_front_url text;
ALTER TABLE tenant_allotments ADD COLUMN IF NOT EXISTS kyc_back_url text;