
-- Lifecycle Configuration table
CREATE TABLE IF NOT EXISTS public.lifecycle_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  from_date date NOT NULL,
  to_date date,
  booking_fee numeric NOT NULL DEFAULT 1000,
  onboarding_fee numeric NOT NULL DEFAULT 1000,
  advance_ratio numeric NOT NULL DEFAULT 1.5,
  exit_fee_under_1yr numeric NOT NULL DEFAULT 2250,
  key_loss_fee numeric NOT NULL DEFAULT 500,
  notice_period_days integer NOT NULL DEFAULT 30,
  refund_deadline_days integer NOT NULL DEFAULT 5,
  created_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, from_date)
);

ALTER TABLE public.lifecycle_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members access lifecycle_config" ON public.lifecycle_config
  FOR ALL USING (organization_id = get_user_org_id(auth.uid()));

-- Lifecycle Payments table (tracks all lifecycle-related payments)
CREATE TABLE IF NOT EXISTS public.lifecycle_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  allotment_id uuid REFERENCES public.tenant_allotments(id),
  amount numeric NOT NULL,
  payment_date date DEFAULT CURRENT_DATE,
  payment_mode text,
  reference_number text,
  payment_type text NOT NULL DEFAULT 'booking',
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.lifecycle_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members access lifecycle_payments" ON public.lifecycle_payments
  FOR ALL USING (organization_id = get_user_org_id(auth.uid()));

-- Room Switches table
CREATE TABLE IF NOT EXISTS public.room_switches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  allotment_id uuid NOT NULL REFERENCES public.tenant_allotments(id),
  old_bed_id uuid NOT NULL REFERENCES public.beds(id),
  new_bed_id uuid NOT NULL REFERENCES public.beds(id),
  switch_type text NOT NULL DEFAULT 'immediate',
  switch_date date NOT NULL DEFAULT CURRENT_DATE,
  effective_date date,
  rent_difference numeric DEFAULT 0,
  adjustment_type text,
  status text DEFAULT 'completed',
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.room_switches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members access room_switches" ON public.room_switches
  FOR ALL USING (organization_id = get_user_org_id(auth.uid()));

-- Tenant Notices table
CREATE TABLE IF NOT EXISTS public.tenant_notices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  allotment_id uuid NOT NULL REFERENCES public.tenant_allotments(id),
  bed_id uuid NOT NULL REFERENCES public.beds(id),
  notice_date date NOT NULL DEFAULT CURRENT_DATE,
  exit_date date NOT NULL,
  actual_exit_date date,
  status text DEFAULT 'active',
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.tenant_notices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members access tenant_notices" ON public.tenant_notices
  FOR ALL USING (organization_id = get_user_org_id(auth.uid()));

-- Tenant Exits table
CREATE TABLE IF NOT EXISTS public.tenant_exits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  allotment_id uuid NOT NULL REFERENCES public.tenant_allotments(id),
  bed_id uuid NOT NULL REFERENCES public.beds(id),
  exit_date date NOT NULL DEFAULT CURRENT_DATE,
  has_notice boolean DEFAULT false,
  room_inspection boolean DEFAULT false,
  key_returned boolean DEFAULT true,
  damage_charges numeric DEFAULT 0,
  key_loss_fee numeric DEFAULT 0,
  exit_charges numeric DEFAULT 0,
  eb_charges numeric DEFAULT 0,
  pending_rent numeric DEFAULT 0,
  total_deductions numeric DEFAULT 0,
  advance_held numeric DEFAULT 0,
  refund_due numeric DEFAULT 0,
  refund_status text DEFAULT 'pending',
  refund_date date,
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.tenant_exits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members access tenant_exits" ON public.tenant_exits
  FOR ALL USING (organization_id = get_user_org_id(auth.uid()));

-- Add bed_lifecycle_status to beds for lifecycle-specific statuses
ALTER TABLE public.beds ADD COLUMN IF NOT EXISTS bed_lifecycle_status text DEFAULT 'vacant';

-- Add notice_date and onboarding_charges to tenant_allotments
ALTER TABLE public.tenant_allotments ADD COLUMN IF NOT EXISTS notice_date date;
ALTER TABLE public.tenant_allotments ADD COLUMN IF NOT EXISTS onboarding_charges numeric DEFAULT 0;
ALTER TABLE public.tenant_allotments ADD COLUMN IF NOT EXISTS advance_amount numeric DEFAULT 0;
ALTER TABLE public.tenant_allotments ADD COLUMN IF NOT EXISTS prorated_rent numeric DEFAULT 0;
ALTER TABLE public.tenant_allotments ADD COLUMN IF NOT EXISTS total_due numeric DEFAULT 0;
ALTER TABLE public.tenant_allotments ADD COLUMN IF NOT EXISTS paid_amount numeric DEFAULT 0;
ALTER TABLE public.tenant_allotments ADD COLUMN IF NOT EXISTS balance_due numeric DEFAULT 0;
ALTER TABLE public.tenant_allotments ADD COLUMN IF NOT EXISTS payment_status text DEFAULT 'pending';
ALTER TABLE public.tenant_allotments ADD COLUMN IF NOT EXISTS expected_payment_date date;
