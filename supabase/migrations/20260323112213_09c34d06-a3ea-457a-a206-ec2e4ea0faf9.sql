-- Tab permissions table for configurable tab-level access control
CREATE TABLE IF NOT EXISTS public.tab_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  role text NOT NULL,
  module text NOT NULL,
  tab_key text NOT NULL,
  is_visible boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, role, module, tab_key)
);

ALTER TABLE public.tab_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members read tab_permissions"
  ON public.tab_permissions FOR SELECT TO authenticated
  USING (organization_id = get_user_org_id(auth.uid()));

CREATE POLICY "Admins manage tab_permissions"
  ON public.tab_permissions FOR ALL TO authenticated
  USING (
    organization_id = get_user_org_id(auth.uid())
    AND (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'org_admin'))
  )
  WITH CHECK (
    organization_id = get_user_org_id(auth.uid())
    AND (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'org_admin'))
  );