
-- Running maintenance cost tracking table
CREATE TABLE public.running_maintenance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  ticket_id uuid NOT NULL REFERENCES public.maintenance_tickets(id) ON DELETE CASCADE,
  purchase_id uuid REFERENCES public.ticket_purchases(id),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  bed_id uuid REFERENCES public.beds(id),
  apartment_id uuid REFERENCES public.apartments(id),
  property_id uuid REFERENCES public.properties(id),
  amount numeric NOT NULL DEFAULT 0,
  cost_scope text NOT NULL DEFAULT 'bed', -- 'bed', 'room', 'apartment', 'common'
  billing_month text,
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.running_maintenance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members access running_maintenance"
  ON public.running_maintenance FOR ALL
  USING (organization_id = get_user_org_id(auth.uid()));

CREATE POLICY "Enable read access for running_maintenance"
  ON public.running_maintenance FOR SELECT
  TO public
  USING (true);
