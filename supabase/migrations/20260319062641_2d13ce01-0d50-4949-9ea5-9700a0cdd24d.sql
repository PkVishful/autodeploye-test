-- Update handle_new_user to NOT assign any default role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
  
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

DO $$
BEGIN
  DROP POLICY IF EXISTS "Admins can manage user_roles" ON public.user_roles;
  DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
END $$;

CREATE POLICY "Admins can manage user_roles"
  ON public.user_roles
  FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'org_admin')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'super_admin') OR public.has_role(auth.uid(), 'org_admin')
  );

CREATE POLICY "Users can view own roles"
  ON public.user_roles
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());