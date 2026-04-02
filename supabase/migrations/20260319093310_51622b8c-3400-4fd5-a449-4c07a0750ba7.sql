
-- Create role_permissions table for dynamic permission management
CREATE TABLE public.role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  role text NOT NULL,
  module text NOT NULL,
  can_create boolean NOT NULL DEFAULT false,
  can_read boolean NOT NULL DEFAULT false,
  can_update boolean NOT NULL DEFAULT false,
  can_delete boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, role, module)
);

-- Enable RLS
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Org members can read permissions"
  ON public.role_permissions FOR SELECT
  TO authenticated
  USING (organization_id = get_user_org_id(auth.uid()));

CREATE POLICY "Admins can manage permissions"
  ON public.role_permissions FOR ALL
  TO authenticated
  USING (
    organization_id = get_user_org_id(auth.uid()) 
    AND (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'org_admin'))
  )
  WITH CHECK (
    organization_id = get_user_org_id(auth.uid()) 
    AND (has_role(auth.uid(), 'super_admin') OR has_role(auth.uid(), 'org_admin'))
  );

-- Seed default permissions for the default org
INSERT INTO public.role_permissions (organization_id, role, module, can_create, can_read, can_update, can_delete) VALUES
-- Super Admin: full access
('00000000-0000-0000-0000-000000000001', 'super_admin', 'dashboard', true, true, true, true),
('00000000-0000-0000-0000-000000000001', 'super_admin', 'properties', true, true, true, true),
('00000000-0000-0000-0000-000000000001', 'super_admin', 'owners', true, true, true, true),
('00000000-0000-0000-0000-000000000001', 'super_admin', 'tenants', true, true, true, true),
('00000000-0000-0000-0000-000000000001', 'super_admin', 'assets', true, true, true, true),
('00000000-0000-0000-0000-000000000001', 'super_admin', 'tickets', true, true, true, true),
('00000000-0000-0000-0000-000000000001', 'super_admin', 'accounting', true, true, true, true),
('00000000-0000-0000-0000-000000000001', 'super_admin', 'electricity', true, true, true, true),
('00000000-0000-0000-0000-000000000001', 'super_admin', 'reports', true, true, true, true),
('00000000-0000-0000-0000-000000000001', 'super_admin', 'team', true, true, true, true),
('00000000-0000-0000-0000-000000000001', 'super_admin', 'audit_logs', true, true, true, true),
('00000000-0000-0000-0000-000000000001', 'super_admin', 'settings', true, true, true, true),
('00000000-0000-0000-0000-000000000001', 'super_admin', 'tenant_lifecycle', true, true, true, true),
-- Admin
('00000000-0000-0000-0000-000000000001', 'org_admin', 'dashboard', true, true, true, true),
('00000000-0000-0000-0000-000000000001', 'org_admin', 'properties', true, true, true, true),
('00000000-0000-0000-0000-000000000001', 'org_admin', 'owners', true, true, true, true),
('00000000-0000-0000-0000-000000000001', 'org_admin', 'tenants', true, true, true, true),
('00000000-0000-0000-0000-000000000001', 'org_admin', 'assets', true, true, true, true),
('00000000-0000-0000-0000-000000000001', 'org_admin', 'tickets', true, true, true, true),
('00000000-0000-0000-0000-000000000001', 'org_admin', 'accounting', true, true, true, true),
('00000000-0000-0000-0000-000000000001', 'org_admin', 'electricity', true, true, true, true),
('00000000-0000-0000-0000-000000000001', 'org_admin', 'reports', true, true, true, true),
('00000000-0000-0000-0000-000000000001', 'org_admin', 'team', true, true, true, true),
('00000000-0000-0000-0000-000000000001', 'org_admin', 'audit_logs', false, true, false, false),
('00000000-0000-0000-0000-000000000001', 'org_admin', 'settings', true, true, true, true),
('00000000-0000-0000-0000-000000000001', 'org_admin', 'tenant_lifecycle', true, true, true, true),
-- Property Manager
('00000000-0000-0000-0000-000000000001', 'property_manager', 'dashboard', false, true, false, false),
('00000000-0000-0000-0000-000000000001', 'property_manager', 'properties', false, true, true, false),
('00000000-0000-0000-0000-000000000001', 'property_manager', 'tenants', true, true, true, false),
('00000000-0000-0000-0000-000000000001', 'property_manager', 'assets', true, true, true, false),
('00000000-0000-0000-0000-000000000001', 'property_manager', 'tickets', true, true, true, false),
('00000000-0000-0000-0000-000000000001', 'property_manager', 'accounting', false, true, true, false),
('00000000-0000-0000-0000-000000000001', 'property_manager', 'electricity', true, true, true, false),
('00000000-0000-0000-0000-000000000001', 'property_manager', 'tenant_lifecycle', true, true, true, false),
-- Employee
('00000000-0000-0000-0000-000000000001', 'employee', 'dashboard', false, true, false, false),
('00000000-0000-0000-0000-000000000001', 'employee', 'assets', false, true, true, false),
('00000000-0000-0000-0000-000000000001', 'employee', 'tickets', false, true, true, false),
-- Technician
('00000000-0000-0000-0000-000000000001', 'technician', 'dashboard', false, true, false, false),
('00000000-0000-0000-0000-000000000001', 'technician', 'assets', false, true, false, false),
('00000000-0000-0000-0000-000000000001', 'technician', 'tickets', false, true, true, false),
-- Tenant
('00000000-0000-0000-0000-000000000001', 'tenant', 'dashboard', false, true, false, false),
('00000000-0000-0000-0000-000000000001', 'tenant', 'tickets', true, true, false, false);
