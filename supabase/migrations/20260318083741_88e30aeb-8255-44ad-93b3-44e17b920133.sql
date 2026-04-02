
-- Add tenant_rejection_reason to maintenance_tickets
ALTER TABLE public.maintenance_tickets ADD COLUMN IF NOT EXISTS tenant_rejection_reason text;

-- Cost estimates table (for approval workflow)
CREATE TABLE public.ticket_cost_estimates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid REFERENCES public.maintenance_tickets(id) ON DELETE CASCADE NOT NULL,
  organization_id uuid REFERENCES public.organizations(id) NOT NULL,
  item_name text NOT NULL,
  cost_type text NOT NULL DEFAULT 'parts', -- parts, labor
  quantity integer NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending', -- pending, approved, declined
  submitted_by uuid,
  approved_by uuid,
  decline_reason text,
  approved_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.ticket_cost_estimates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members access ticket_cost_estimates"
  ON public.ticket_cost_estimates FOR ALL
  USING (organization_id = get_user_org_id(auth.uid()));

-- Purchases table (actual procurement tracking)
CREATE TABLE public.ticket_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid REFERENCES public.maintenance_tickets(id) ON DELETE CASCADE NOT NULL,
  cost_estimate_id uuid REFERENCES public.ticket_cost_estimates(id),
  organization_id uuid REFERENCES public.organizations(id) NOT NULL,
  item_name text NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  estimated_cost numeric DEFAULT 0,
  actual_cost numeric NOT NULL DEFAULT 0,
  vendor_id uuid REFERENCES public.vendors(id),
  vendor_name_manual text,
  invoice_url text,
  purchased_by uuid,
  purchase_date date DEFAULT CURRENT_DATE,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.ticket_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members access ticket_purchases"
  ON public.ticket_purchases FOR ALL
  USING (organization_id = get_user_org_id(auth.uid()));
