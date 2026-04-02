CREATE OR REPLACE FUNCTION public.validate_notice_exit_date()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Admins and property managers bypass the 30-day restriction
  IF NOT public.is_admin_user(auth.uid())
     AND NEW.exit_date < (CURRENT_DATE + INTERVAL '30 days')::date
  THEN
    RAISE EXCEPTION 'Exit date must be at least 30 days from today. Earliest allowed: %',
      (CURRENT_DATE + INTERVAL '30 days')::date;
  END IF;
  RETURN NEW;
END;
$$;