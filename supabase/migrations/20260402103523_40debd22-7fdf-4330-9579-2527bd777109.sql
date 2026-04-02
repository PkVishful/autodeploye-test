CREATE TABLE public.bed_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bed_id uuid NOT NULL REFERENCES public.beds(id) ON DELETE CASCADE,
  status text NOT NULL,
  from_date date NOT NULL,
  to_date date,
  notes text,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.bed_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members access bed_status_history"
  ON public.bed_status_history FOR ALL TO public
  USING (organization_id = get_user_org_id(auth.uid()));

CREATE POLICY "Enable read access for all users"
  ON public.bed_status_history FOR SELECT TO public
  USING (true);

CREATE OR REPLACE FUNCTION public.validate_bed_status_no_overlap()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.bed_status_history
    WHERE bed_id = NEW.bed_id
      AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND from_date <= COALESCE(NEW.to_date, '9999-12-31'::date)
      AND COALESCE(to_date, '9999-12-31'::date) >= NEW.from_date
  ) THEN
    RAISE EXCEPTION 'Status period overlaps with an existing entry for this bed';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_bed_status_no_overlap
  BEFORE INSERT OR UPDATE ON public.bed_status_history
  FOR EACH ROW EXECUTE FUNCTION public.validate_bed_status_no_overlap();