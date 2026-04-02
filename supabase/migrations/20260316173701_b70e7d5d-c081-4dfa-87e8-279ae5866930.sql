
INSERT INTO public.issue_types (organization_id, name, icon, priority, sla_hours) VALUES
('00000000-0000-0000-0000-000000000001', 'AC Issues', '❄️', 'high', 12),
('00000000-0000-0000-0000-000000000001', 'Heater Issues', '🔥', 'high', 12),
('00000000-0000-0000-0000-000000000001', 'Cleaning Issues', '🧹', 'medium', 4),
('00000000-0000-0000-0000-000000000001', 'Fridge Issues', '🧊', 'medium', 12),
('00000000-0000-0000-0000-000000000001', 'Kitchen Equipment', '🍳', 'medium', 12),
('00000000-0000-0000-0000-000000000001', 'Water Issues', '💧', 'high', 2),
('00000000-0000-0000-0000-000000000001', 'RO Water Issues', '🚰', 'medium', 6),
('00000000-0000-0000-0000-000000000001', 'Toilet Issues', '🚽', 'high', 4),
('00000000-0000-0000-0000-000000000001', 'Electrical Issues', '⚡', 'high', 6),
('00000000-0000-0000-0000-000000000001', 'Internet Issues', '📶', 'medium', 6),
('00000000-0000-0000-0000-000000000001', 'Billing Issues', '💳', 'low', 24),
('00000000-0000-0000-0000-000000000001', 'Other', '🔧', 'low', 24);

INSERT INTO public.asset_categories (organization_id, name) VALUES
('00000000-0000-0000-0000-000000000001', 'Furniture'),
('00000000-0000-0000-0000-000000000001', 'Electronics'),
('00000000-0000-0000-0000-000000000001', 'Appliances'),
('00000000-0000-0000-0000-000000000001', 'Fixtures'),
('00000000-0000-0000-0000-000000000001', 'Soft Furnishing');
