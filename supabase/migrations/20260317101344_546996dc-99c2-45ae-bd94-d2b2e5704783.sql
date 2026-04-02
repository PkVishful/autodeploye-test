ALTER TABLE public.apartments ADD COLUMN IF NOT EXISTS start_date date DEFAULT NULL;
ALTER TABLE public.apartments ADD COLUMN IF NOT EXISTS end_date date DEFAULT NULL;