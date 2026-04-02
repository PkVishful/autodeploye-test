
-- Create running_bed_maintenance_details table
CREATE TABLE IF NOT EXISTS public.running_bed_maintenance_details (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  ticket_id uuid REFERENCES maintenance_tickets(id),
  purchase_id uuid,
  tenant_id uuid REFERENCES tenants(id),
  bed_id uuid REFERENCES beds(id),
  apartment_id uuid REFERENCES apartments(id),
  property_id uuid REFERENCES properties(id),
  item_name text,
  quantity integer DEFAULT 1,
  unit_price numeric DEFAULT 0,
  actual_cost numeric DEFAULT 0,
  vendor_name text,
  cost_scope text DEFAULT 'bed',
  distributed_amount numeric DEFAULT 0,
  billing_month text,
  maintenance_type text,
  parts_details jsonb DEFAULT '[]'::jsonb,
  diagnosis_summary text,
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.running_bed_maintenance_details ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members access running_bed_maintenance_details"
  ON public.running_bed_maintenance_details FOR ALL
  USING (organization_id = get_user_org_id(auth.uid()));

CREATE POLICY "Enable read for all"
  ON public.running_bed_maintenance_details FOR SELECT
  TO public USING (true);
