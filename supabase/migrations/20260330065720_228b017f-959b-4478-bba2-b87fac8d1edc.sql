
-- Ensure org members can insert tenant_notices
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='tenant_notices' AND policyname='Org members insert tenant_notices') THEN
    CREATE POLICY "Org members insert tenant_notices" ON public.tenant_notices
      FOR INSERT TO authenticated WITH CHECK (organization_id = get_user_org_id(auth.uid()));
  END IF;
END $$;

-- Ensure org members can update tenant_notices
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='tenant_notices' AND policyname='Org members update tenant_notices') THEN
    CREATE POLICY "Org members update tenant_notices" ON public.tenant_notices
      FOR UPDATE TO authenticated USING (organization_id = get_user_org_id(auth.uid()));
  END IF;
END $$;
