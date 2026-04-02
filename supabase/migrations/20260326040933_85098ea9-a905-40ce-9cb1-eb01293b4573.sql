ALTER TABLE public.receipts 
  ADD COLUMN IF NOT EXISTS reference_number text,
  ADD COLUMN IF NOT EXISTS tenant_allotment_id uuid REFERENCES public.tenant_allotments(id);