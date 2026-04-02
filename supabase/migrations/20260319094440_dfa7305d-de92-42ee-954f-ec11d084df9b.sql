-- Add GPS and photos to properties
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS gps_latitude numeric NULL;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS gps_longitude numeric NULL;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS photo_urls text[] NULL;

-- Add tax & ownership doc fields to apartments
ALTER TABLE public.apartments ADD COLUMN IF NOT EXISTS property_tax_id text NULL;
ALTER TABLE public.apartments ADD COLUMN IF NOT EXISTS property_tax_amount numeric NULL DEFAULT 0;
ALTER TABLE public.apartments ADD COLUMN IF NOT EXISTS property_tax_frequency text NULL DEFAULT 'yearly';
ALTER TABLE public.apartments ADD COLUMN IF NOT EXISTS water_tax_id text NULL;
ALTER TABLE public.apartments ADD COLUMN IF NOT EXISTS water_tax_amount numeric NULL DEFAULT 0;
ALTER TABLE public.apartments ADD COLUMN IF NOT EXISTS water_tax_frequency text NULL DEFAULT 'yearly';
ALTER TABLE public.apartments ADD COLUMN IF NOT EXISTS ownership_doc_url text NULL;