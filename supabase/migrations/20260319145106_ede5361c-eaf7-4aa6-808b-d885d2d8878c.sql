
CREATE TABLE IF NOT EXISTS public.bed_type_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(name, organization_id)
);

ALTER TABLE public.bed_type_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members access bed_type_config" ON public.bed_type_config
  FOR ALL TO public USING (organization_id = get_user_org_id(auth.uid()));

CREATE POLICY "Enable read access for bed_type_config" ON public.bed_type_config
  FOR SELECT TO public USING (true);
