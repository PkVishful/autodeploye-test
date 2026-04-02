
-- Add first_name, last_name, staying_status columns to tenants
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS first_name text DEFAULT '';
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS last_name text DEFAULT '';
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS staying_status text DEFAULT 'new';

-- Migrate existing full_name data into first_name/last_name
UPDATE public.tenants SET 
  first_name = SPLIT_PART(full_name, ' ', 1),
  last_name = CASE 
    WHEN POSITION(' ' IN full_name) > 0 THEN SUBSTRING(full_name FROM POSITION(' ' IN full_name) + 1)
    ELSE ''
  END
WHERE first_name = '' OR first_name IS NULL;

-- Make first_name NOT NULL
ALTER TABLE public.tenants ALTER COLUMN first_name SET NOT NULL;

-- Create trigger to auto-update full_name from first_name + last_name
CREATE OR REPLACE FUNCTION public.update_tenant_full_name()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.full_name := TRIM(COALESCE(NEW.first_name, '') || ' ' || COALESCE(NEW.last_name, ''));
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_update_tenant_full_name
  BEFORE INSERT OR UPDATE ON public.tenants
  FOR EACH ROW
  EXECUTE FUNCTION public.update_tenant_full_name();

-- Set staying_status based on existing allotment data
UPDATE public.tenants t SET staying_status = 
  CASE 
    WHEN EXISTS (SELECT 1 FROM tenant_allotments ta WHERE ta.tenant_id = t.id AND ta.staying_status = 'Staying') THEN 'staying'
    WHEN EXISTS (SELECT 1 FROM tenant_allotments ta WHERE ta.tenant_id = t.id AND ta.staying_status = 'On-Notice') THEN 'on-notice'
    WHEN EXISTS (SELECT 1 FROM tenant_allotments ta WHERE ta.tenant_id = t.id AND ta.staying_status = 'Booked') THEN 'booked'
    WHEN EXISTS (SELECT 1 FROM tenant_allotments ta WHERE ta.tenant_id = t.id AND ta.staying_status = 'Exited') THEN 'exited'
    ELSE 'new'
  END;
