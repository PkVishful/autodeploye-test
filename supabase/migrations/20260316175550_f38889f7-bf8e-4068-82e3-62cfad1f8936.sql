
-- Create owners table
CREATE TABLE public.owners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  full_name text NOT NULL,
  phone text,
  email text,
  pan_number text,
  aadhar_number text,
  address text,
  city text,
  state text,
  pincode text,
  bank_name text,
  bank_account_number text,
  bank_ifsc text,
  gst_number text,
  photo_url text,
  id_proof_url text,
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.owners ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members access owners" ON public.owners FOR ALL USING (organization_id = get_user_org_id(auth.uid()));

-- Create owner_contracts table
CREATE TABLE public.owner_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  owner_id uuid NOT NULL REFERENCES public.owners(id) ON DELETE CASCADE,
  property_id uuid REFERENCES public.properties(id),
  contract_type text NOT NULL DEFAULT 'lease', -- lease, revenue_sharing, fixed_rent
  start_date date,
  end_date date,
  monthly_rent numeric,
  revenue_share_percentage numeric,
  security_deposit numeric,
  lock_in_months integer,
  escalation_percentage numeric,
  escalation_interval_months integer,
  payment_due_day integer DEFAULT 1,
  agreement_url text,
  notes text,
  status text DEFAULT 'active',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.owner_contracts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members access owner_contracts" ON public.owner_contracts FOR ALL USING (organization_id = get_user_org_id(auth.uid()));

-- Add new columns to apartments
ALTER TABLE public.apartments ADD COLUMN IF NOT EXISTS apartment_type text; -- 1BHK, 2BHK, 3BHK, 4BHK, Studio
ALTER TABLE public.apartments ADD COLUMN IF NOT EXISTS size_sqft numeric;
ALTER TABLE public.apartments ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES public.owners(id);
