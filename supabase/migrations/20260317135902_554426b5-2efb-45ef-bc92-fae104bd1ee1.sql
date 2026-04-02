
-- Add signing_date column to apartments
ALTER TABLE public.apartments ADD COLUMN IF NOT EXISTS signing_date date DEFAULT NULL;

-- Add 'In-Active' to entity_status enum if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'In-Active' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'entity_status')) THEN
    ALTER TYPE public.entity_status ADD VALUE 'In-Active';
  END IF;
END$$;

-- Remove 'Not-Ready' if no data uses it (safe: just add the new value, old ones stay)
