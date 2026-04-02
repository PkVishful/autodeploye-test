
-- Insert default organization
INSERT INTO public.organizations (id, organization_name, subscription_plan)
VALUES ('00000000-0000-0000-0000-000000000001', 'Vishful Properties', 'premium');

-- Update the handle_new_user trigger to auto-assign the default org and give org_admin role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  default_org_id uuid := '00000000-0000-0000-0000-000000000001';
BEGIN
  INSERT INTO public.profiles (id, phone, full_name, organization_id)
  VALUES (
    new.id,
    coalesce(new.phone, new.raw_user_meta_data->>'phone', ''),
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    default_org_id
  );
  
  -- Auto-assign org_admin role to new users (you can change this later)
  INSERT INTO public.user_roles (user_id, role)
  VALUES (new.id, 'org_admin');
  
  RETURN new;
END;
$$;
