
-- Add late_fee, locked, billing_month to invoices
ALTER TABLE public.invoices 
  ADD COLUMN IF NOT EXISTS late_fee numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS locked boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS billing_month text;

-- Invoice line items
CREATE TABLE public.invoice_line_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  line_type text NOT NULL, -- rent, electricity, late_fee, other
  description text,
  amount numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.invoice_line_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Line items via invoice" ON public.invoice_line_items FOR ALL USING (
  EXISTS (SELECT 1 FROM invoices i WHERE i.id = invoice_line_items.invoice_id AND i.organization_id = get_user_org_id(auth.uid()))
);

-- Expenses table
CREATE TABLE public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  property_id uuid REFERENCES public.properties(id),
  apartment_id uuid REFERENCES public.apartments(id),
  bed_id uuid REFERENCES public.beds(id),
  category text NOT NULL, -- property_rent, eb_actual, maintenance, housekeeping, staff_salaries, repairs, wifi, misc
  vendor text,
  description text,
  amount numeric NOT NULL DEFAULT 0,
  expense_date date NOT NULL DEFAULT CURRENT_DATE,
  billing_month text,
  receipt_url text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members access expenses" ON public.expenses FOR ALL USING (
  organization_id = get_user_org_id(auth.uid())
);

-- Deposit settlements
CREATE TABLE public.deposit_settlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  allotment_id uuid REFERENCES public.tenant_allotments(id),
  deposit_amount numeric NOT NULL DEFAULT 0,
  pending_rent numeric DEFAULT 0,
  pending_eb numeric DEFAULT 0,
  pending_late_fees numeric DEFAULT 0,
  damages numeric DEFAULT 0,
  other_deductions numeric DEFAULT 0,
  total_deductions numeric DEFAULT 0,
  refund_amount numeric DEFAULT 0,
  settlement_date date DEFAULT CURRENT_DATE,
  status text DEFAULT 'pending', -- pending, settled, refunded
  notes text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.deposit_settlements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members access deposit_settlements" ON public.deposit_settlements FOR ALL USING (
  organization_id = get_user_org_id(auth.uid())
);
