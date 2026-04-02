
-- Add product_photo_url column to assets
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS product_photo_url text;

-- Create asset_brands table for dropdown management
CREATE TABLE IF NOT EXISTS public.asset_brands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  created_at timestamptz DEFAULT now(),
  UNIQUE(name, organization_id)
);

ALTER TABLE public.asset_brands ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members access asset_brands" ON public.asset_brands
  FOR ALL USING (organization_id = get_user_org_id(auth.uid()));

CREATE POLICY "Enable read access for all users" ON public.asset_brands
  FOR SELECT USING (true);
