
-- Create issue_sub_types table
CREATE TABLE public.issue_sub_types (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  issue_type_id UUID NOT NULL REFERENCES public.issue_types(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT 'circle-dot',
  description TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.issue_sub_types ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view issue sub types in their org"
  ON public.issue_sub_types FOR SELECT TO authenticated
  USING (organization_id = (SELECT get_user_org_id(auth.uid())));

CREATE POLICY "Admins can manage issue sub types"
  ON public.issue_sub_types FOR ALL TO authenticated
  USING (organization_id = (SELECT get_user_org_id(auth.uid())))
  WITH CHECK (organization_id = (SELECT get_user_org_id(auth.uid())));
