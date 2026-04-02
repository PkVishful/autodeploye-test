INSERT INTO tab_permissions (organization_id, module, tab_key, role, is_visible)
VALUES 
  ('00000000-0000-0000-0000-000000000001', 'tenant_lifecycle', 'excel-upload', 'org_admin', true),
  ('00000000-0000-0000-0000-000000000001', 'tenant_lifecycle', 'excel-upload', 'super_admin', true)
ON CONFLICT DO NOTHING;