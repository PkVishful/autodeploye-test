
CREATE TABLE public.cost_estimate_approvers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  approver_user_id uuid NOT NULL,
  scope_type text NOT NULL DEFAULT 'global',
  property_id uuid REFERENCES properties(id),
  issue_type_id uuid REFERENCES issue_types(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.cost_estimate_approvers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members access cost_estimate_approvers"
  ON public.cost_estimate_approvers FOR ALL
  USING (organization_id = get_user_org_id(auth.uid()));
