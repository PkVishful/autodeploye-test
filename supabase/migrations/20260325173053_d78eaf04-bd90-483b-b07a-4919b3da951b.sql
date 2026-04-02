-- Add estimated_eb column to invoices table for separate storage
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS estimated_eb numeric DEFAULT 0;

-- Add tenant_absence_records table for Not-in-Property notices
CREATE TABLE public.tenant_absence_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  allotment_id uuid REFERENCES public.tenant_allotments(id) ON DELETE SET NULL,
  from_date date NOT NULL,
  to_date date NOT NULL,
  reason text,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT absence_dates_valid CHECK (to_date >= from_date)
);

ALTER TABLE public.tenant_absence_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members access tenant_absence_records"
  ON public.tenant_absence_records
  FOR ALL
  TO public
  USING (organization_id = get_user_org_id(auth.uid()));
