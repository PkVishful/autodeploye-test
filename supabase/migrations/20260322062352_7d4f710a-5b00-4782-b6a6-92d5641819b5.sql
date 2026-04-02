
-- Delete Nandana's related records first (FK order)
DELETE FROM public.tenant_notices WHERE allotment_id IN ('a307b088-c549-4564-8b9c-bcc798960ac7', '586ef8dc-ec86-41b8-857d-edae93e712f3', 'ef5fa6ee-8696-4652-8ac0-58c6fd8fb5c0');
DELETE FROM public.lifecycle_payments WHERE tenant_id = 'd8860bc6-5e31-286d-c4aa-7f9582e000fd';
DELETE FROM public.tenant_allotments WHERE tenant_id = 'd8860bc6-5e31-286d-c4aa-7f9582e000fd';

-- Reset bed B1 back to vacant
UPDATE public.beds SET bed_lifecycle_status = 'vacant' WHERE id = '3e81e085-89a3-9615-e293-bf826bf9b08f';

-- Reset Nandana's tenant status to 'new'
UPDATE public.tenants SET staying_status = 'new' WHERE id = 'd8860bc6-5e31-286d-c4aa-7f9582e000fd';

-- Create payment_allocations table for FIFO payment tracking
CREATE TABLE IF NOT EXISTS public.payment_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id uuid NOT NULL REFERENCES public.receipts(id) ON DELETE CASCADE,
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  amount numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.payment_allocations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allocations via receipt" ON public.payment_allocations FOR ALL TO public
  USING (EXISTS (SELECT 1 FROM receipts r WHERE r.id = payment_allocations.receipt_id AND r.organization_id = get_user_org_id(auth.uid())));

-- Add tracking columns to invoices
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS amount_paid numeric DEFAULT 0;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS balance numeric DEFAULT 0;

-- Create eb_tenant_shares table for detailed EB breakdown
CREATE TABLE IF NOT EXISTS public.eb_tenant_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  apartment_id uuid REFERENCES public.apartments(id),
  billing_month text NOT NULL,
  total_apartment_bill numeric DEFAULT 0,
  total_tenant_days integer DEFAULT 0,
  per_day_rate numeric DEFAULT 0,
  tenant_stay_days integer DEFAULT 0,
  tenant_eb_charge numeric DEFAULT 0,
  total_units numeric DEFAULT 0,
  unit_cost numeric DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.eb_tenant_shares ENABLE ROW LEVEL SECURITY;
CREATE POLICY "EB shares via invoice" ON public.eb_tenant_shares FOR ALL TO public
  USING (EXISTS (SELECT 1 FROM invoices i WHERE i.id = eb_tenant_shares.invoice_id AND i.organization_id = get_user_org_id(auth.uid())));
