-- Fix ticket_logs: Remove public read, use ticket-based policy
DROP POLICY IF EXISTS "Enable read access for all users" ON public.ticket_logs;
DROP POLICY IF EXISTS "logs_select" ON public.ticket_logs;
DROP POLICY IF EXISTS "logs_insert" ON public.ticket_logs;
DROP POLICY IF EXISTS "logs_org_access" ON public.ticket_logs;

CREATE POLICY "Ticket logs via ticket org" ON public.ticket_logs FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM maintenance_tickets mt
    WHERE mt.id = ticket_logs.ticket_id
    AND mt.organization_id = get_user_org_id(auth.uid())
  ));

-- TICKET_COST_ESTIMATES: Tighten
DROP POLICY IF EXISTS "Enable read access for all users" ON public.ticket_cost_estimates;
DROP POLICY IF EXISTS "Enable insert for all" ON public.ticket_cost_estimates;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ticket_cost_estimates' AND policyname='Org members read ticket_cost_estimates') THEN
    CREATE POLICY "Org members read ticket_cost_estimates" ON public.ticket_cost_estimates FOR SELECT TO authenticated
      USING (organization_id = get_user_org_id(auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ticket_cost_estimates' AND policyname='Org members insert ticket_cost_estimates') THEN
    CREATE POLICY "Org members insert ticket_cost_estimates" ON public.ticket_cost_estimates FOR INSERT TO authenticated
      WITH CHECK (organization_id = get_user_org_id(auth.uid()));
  END IF;
END $$;

-- ROOM_SWITCHES: Tighten
DROP POLICY IF EXISTS "Enable read access for all users" ON public.room_switches;
DROP POLICY IF EXISTS "Enable insert for all" ON public.room_switches;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='room_switches' AND policyname='Org members read room_switches') THEN
    CREATE POLICY "Org members read room_switches" ON public.room_switches FOR SELECT TO authenticated
      USING (organization_id = get_user_org_id(auth.uid()));
  END IF;
END $$;

-- TENANT_EXITS: Tighten
DROP POLICY IF EXISTS "Enable read access for all users" ON public.tenant_exits;
DROP POLICY IF EXISTS "Enable insert for all" ON public.tenant_exits;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='tenant_exits' AND policyname='Org members read tenant_exits') THEN
    CREATE POLICY "Org members read tenant_exits" ON public.tenant_exits FOR SELECT TO authenticated
      USING (organization_id = get_user_org_id(auth.uid()));
  END IF;
END $$;

-- TENANT_NOTICES: Tighten
DROP POLICY IF EXISTS "Enable read access for all users" ON public.tenant_notices;
DROP POLICY IF EXISTS "Enable insert for all" ON public.tenant_notices;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='tenant_notices' AND policyname='Org members read tenant_notices') THEN
    CREATE POLICY "Org members read tenant_notices" ON public.tenant_notices FOR SELECT TO authenticated
      USING (organization_id = get_user_org_id(auth.uid()));
  END IF;
END $$;