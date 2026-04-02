UPDATE role_permissions SET can_read = true WHERE role = 'tenant' AND module = 'dashboard';

INSERT INTO role_permissions (organization_id, role, module, can_create, can_read, can_update, can_delete)
SELECT '00000000-0000-0000-0000-000000000001', 'tenant', 'dashboard', false, true, false, false
WHERE NOT EXISTS (SELECT 1 FROM role_permissions WHERE role = 'tenant' AND module = 'dashboard');

UPDATE role_permissions SET can_create = true, can_read = true, can_update = true WHERE role = 'tenant' AND module = 'tickets';