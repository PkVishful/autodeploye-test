
-- Add KYC fields to tenants table
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS first_name text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS last_name text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS date_of_birth date;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS food_preference text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS relation_type text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS relation_name text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS age integer;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS profession text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS city text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS state text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS pincode text;

-- Professional info
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS company_name text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS company_address text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS company_city text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS company_state text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS company_pincode text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS designation text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS date_of_joining date;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS id_card_url text;

-- Emergency contact
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS emergency_contact_name text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS emergency_contact_relation text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS emergency_contact_phone text;

-- Bank details
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS bank_name text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS bank_branch text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS bank_account_number text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS bank_account_holder text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS bank_ifsc text;

-- ID documents
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS aadhar_number text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS pan_number text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS gst_number text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS gst_name text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS aadhar_image_url text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS photo_url text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS user_id uuid;

-- Trigger to auto-update full_name from first_name + last_name
CREATE OR REPLACE FUNCTION public.update_tenant_full_name()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.full_name := TRIM(COALESCE(NEW.first_name, '') || ' ' || COALESCE(NEW.last_name, ''));
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trigger_update_tenant_full_name ON public.tenants;
CREATE TRIGGER trigger_update_tenant_full_name
  BEFORE INSERT OR UPDATE OF first_name, last_name ON public.tenants
  FOR EACH ROW
  EXECUTE FUNCTION public.update_tenant_full_name();

-- Add RLS policy for public KYC form insertion (unauthenticated)
CREATE POLICY "Public KYC insert" ON public.tenants FOR INSERT TO anon WITH CHECK (true);
