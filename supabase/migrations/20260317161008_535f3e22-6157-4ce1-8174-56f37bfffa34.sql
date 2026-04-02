
-- Create organization bank accounts table
CREATE TABLE public.organization_bank_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  bank_name text NOT NULL,
  account_name text,
  account_number text NOT NULL,
  ifsc_code text,
  branch text,
  account_type text DEFAULT 'current',
  swift_code text,
  upi_id text,
  is_primary boolean DEFAULT false,
  status text DEFAULT 'active',
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.organization_bank_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members access org_bank_accounts"
  ON public.organization_bank_accounts
  FOR ALL
  TO public
  USING (organization_id = get_user_org_id(auth.uid()));

-- Add bill_date column to owner_payments
ALTER TABLE public.owner_payments ADD COLUMN IF NOT EXISTS bill_date date;
