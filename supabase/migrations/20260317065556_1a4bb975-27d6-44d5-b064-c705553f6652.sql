
CREATE TABLE public.eb_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  property_id uuid REFERENCES public.properties(id),
  unit_cost numeric NOT NULL,
  from_date date NOT NULL,
  to_date date,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.eb_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members access eb_rates" ON public.eb_rates
  FOR ALL TO public
  USING (organization_id = get_user_org_id(auth.uid()));
