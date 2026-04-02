-- Create regular_maintenance_rules table
CREATE TABLE public.regular_maintenance_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  issue_type_id uuid NOT NULL REFERENCES public.issue_types(id),
  maintenance_type text NOT NULL CHECK (maintenance_type IN ('Cleaning', 'Replacement', 'Service')),
  frequency text NOT NULL CHECK (frequency IN ('Monthly', 'Bi-Monthly', 'Quarterly', 'Half-Yearly', 'Yearly')),
  asset_type_id uuid REFERENCES public.asset_types(id),
  property_id uuid REFERENCES public.properties(id),
  apartment_id uuid REFERENCES public.apartments(id),
  start_date date NOT NULL,
  last_run_at timestamptz,
  next_run_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  auto_assign boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.regular_maintenance_rules ENABLE ROW LEVEL SECURITY;

-- RLS: org members can read
CREATE POLICY "Org members read regular_maintenance_rules"
  ON public.regular_maintenance_rules
  FOR SELECT
  TO authenticated
  USING (organization_id = get_user_org_id(auth.uid()));

-- RLS: admins can manage
CREATE POLICY "Admins manage regular_maintenance_rules"
  ON public.regular_maintenance_rules
  FOR ALL
  TO authenticated
  USING (
    organization_id = get_user_org_id(auth.uid())
    AND is_admin_user(auth.uid())
  )
  WITH CHECK (
    organization_id = get_user_org_id(auth.uid())
    AND is_admin_user(auth.uid())
  );

-- Function to calculate next run date
CREATE OR REPLACE FUNCTION public.calculate_next_run_date(p_frequency text, p_from_date timestamptz)
RETURNS timestamptz
LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  RETURN CASE p_frequency
    WHEN 'Monthly' THEN p_from_date + INTERVAL '1 month'
    WHEN 'Bi-Monthly' THEN p_from_date + INTERVAL '2 months'
    WHEN 'Quarterly' THEN p_from_date + INTERVAL '3 months'
    WHEN 'Half-Yearly' THEN p_from_date + INTERVAL '6 months'
    WHEN 'Yearly' THEN p_from_date + INTERVAL '12 months'
    ELSE p_from_date + INTERVAL '1 month'
  END;
END;
$$;