ALTER TABLE public.assets
  ADD COLUMN IF NOT EXISTS capacity_value numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS capacity_unit text DEFAULT NULL;