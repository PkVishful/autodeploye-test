-- Drop the existing anon-only policy and recreate for both roles
DROP POLICY IF EXISTS "Public KYC insert" ON public.tenants;

CREATE POLICY "Public KYC insert"
ON public.tenants
FOR INSERT
TO anon, authenticated
WITH CHECK (true);
