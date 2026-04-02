
ALTER TABLE public.apartments ADD COLUMN IF NOT EXISTS eb_meter_number text;

ALTER TABLE public.electricity_readings ADD COLUMN IF NOT EXISTS meter_photo_url text;
