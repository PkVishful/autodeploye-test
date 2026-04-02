
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  table_name text NOT NULL,
  record_id uuid NOT NULL,
  action text NOT NULL,
  changes jsonb DEFAULT '{}',
  performed_by uuid,
  performed_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members access audit_logs"
  ON public.audit_logs FOR ALL
  USING (organization_id = get_user_org_id(auth.uid()));

CREATE INDEX idx_audit_logs_table ON public.audit_logs(table_name, record_id);
CREATE INDEX idx_audit_logs_org ON public.audit_logs(organization_id, performed_at DESC);
