-- Validation trigger to enforce 30-day minimum notice period
CREATE OR REPLACE FUNCTION public.validate_notice_exit_date()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.exit_date < (CURRENT_DATE + INTERVAL '30 days')::date THEN
    RAISE EXCEPTION 'Exit date must be at least 30 days from today. Earliest allowed: %', (CURRENT_DATE + INTERVAL '30 days')::date;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_notice_exit_date
  BEFORE INSERT ON public.tenant_notices
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_notice_exit_date();