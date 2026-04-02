
-- Add public insert policies for lifecycle data import
CREATE POLICY "Enable insert for all" ON public.tenant_allotments FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Enable update for all" ON public.tenant_allotments FOR UPDATE TO public USING (true) WITH CHECK (true);
CREATE POLICY "Enable delete for all" ON public.tenant_allotments FOR DELETE TO public USING (true);

CREATE POLICY "Enable insert for all" ON public.lifecycle_payments FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Enable delete for all" ON public.lifecycle_payments FOR DELETE TO public USING (true);

CREATE POLICY "Enable insert for all" ON public.tenant_notices FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Enable delete for all" ON public.tenant_notices FOR DELETE TO public USING (true);

CREATE POLICY "Enable insert for all" ON public.tenant_exits FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Enable delete for all" ON public.tenant_exits FOR DELETE TO public USING (true);

CREATE POLICY "Enable insert for all" ON public.deposit_settlements FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Enable delete for all" ON public.deposit_settlements FOR DELETE TO public USING (true);
