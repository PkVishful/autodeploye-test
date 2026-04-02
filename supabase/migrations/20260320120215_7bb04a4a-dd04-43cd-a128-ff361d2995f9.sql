CREATE TABLE IF NOT EXISTS public.diagnostic_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES maintenance_tickets(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id),
  performed_by uuid,
  issue_type_id uuid REFERENCES issue_types(id),
  questions_answers jsonb DEFAULT '[]'::jsonb,
  ai_diagnosis jsonb DEFAULT '{}'::jsonb,
  employee_override jsonb DEFAULT NULL,
  status text NOT NULL DEFAULT 'in_progress',
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

ALTER TABLE public.diagnostic_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members access diagnostic_sessions" ON public.diagnostic_sessions
  FOR ALL USING (organization_id = get_user_org_id(auth.uid()));

CREATE POLICY "Enable read access for diagnostic_sessions" ON public.diagnostic_sessions
  FOR SELECT TO public USING (true);