
-- Add apartment_id to owner_contracts
ALTER TABLE public.owner_contracts ADD COLUMN IF NOT EXISTS apartment_id uuid REFERENCES public.apartments(id);

-- Add tax amount and frequency fields
ALTER TABLE public.owner_contracts ADD COLUMN IF NOT EXISTS property_tax_amount numeric DEFAULT 0;
ALTER TABLE public.owner_contracts ADD COLUMN IF NOT EXISTS property_tax_frequency text DEFAULT 'yearly';
ALTER TABLE public.owner_contracts ADD COLUMN IF NOT EXISTS water_tax_id text;
ALTER TABLE public.owner_contracts ADD COLUMN IF NOT EXISTS water_tax_amount numeric DEFAULT 0;
ALTER TABLE public.owner_contracts ADD COLUMN IF NOT EXISTS water_tax_frequency text DEFAULT 'yearly';

-- Create owner_payments table for monthly payment tracking
CREATE TABLE public.owner_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  owner_id uuid NOT NULL REFERENCES public.owners(id) ON DELETE CASCADE,
  contract_id uuid NOT NULL REFERENCES public.owner_contracts(id) ON DELETE CASCADE,
  apartment_id uuid REFERENCES public.apartments(id),
  payment_month text NOT NULL, -- YYYY-MM format
  due_date date NOT NULL,
  base_amount numeric NOT NULL DEFAULT 0,
  escalated_amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  paid_date date,
  payment_mode text,
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.owner_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members access owner_payments"
  ON public.owner_payments FOR ALL
  USING (organization_id = get_user_org_id(auth.uid()));
