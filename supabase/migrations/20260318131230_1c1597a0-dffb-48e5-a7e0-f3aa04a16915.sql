
-- Insert missing profile for user 9348f230-33b9-441c-b9ef-48a54e9d7407
INSERT INTO public.profiles (id, phone, full_name, organization_id)
VALUES ('9348f230-33b9-441c-b9ef-48a54e9d7407', '9884387877', '', '00000000-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

-- Insert missing role
INSERT INTO public.user_roles (user_id, role)
VALUES ('9348f230-33b9-441c-b9ef-48a54e9d7407', 'org_admin')
ON CONFLICT (user_id, role) DO NOTHING;
