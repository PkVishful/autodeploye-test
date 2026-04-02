
-- Add KYC and bank details to vendors table
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS gst_number text;
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS pan_number text;
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS bank_name text;
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS bank_account_number text;
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS bank_ifsc text;
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS id_proof_url text;
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS status text DEFAULT 'active';
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS notes text;

-- Add bill/invoice details to assets table
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS invoice_number text;
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS invoice_date date;
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS invoice_url text;
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS vendor_name_manual text;
