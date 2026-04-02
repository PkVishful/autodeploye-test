-- Update handle_new_user to also save email to profiles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  default_org_id uuid := '00000000-0000-0000-0000-000000000001';
BEGIN
  INSERT INTO public.profiles (id, phone, email, full_name, organization_id)
  VALUES (
    new.id,
    coalesce(new.phone, new.raw_user_meta_data->>'phone', ''),
    coalesce(new.email, new.raw_user_meta_data->>'email', ''),
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    default_org_id
  );
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (new.id, 'org_admin');
  
  RETURN new;
END;
$$;

-- Backfill email from auth.users into profiles where it's missing
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id AND (p.email IS NULL OR p.email = '');

-- Also backfill: link team_members to profiles by matching phone numbers
UPDATE public.team_members tm
SET user_id = p.id
FROM public.profiles p
WHERE tm.user_id IS NULL
  AND tm.phone IS NOT NULL
  AND p.phone IS NOT NULL
  AND tm.phone = p.phone
  AND tm.organization_id = p.organization_id;