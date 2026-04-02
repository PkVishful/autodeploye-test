
-- Update issue_types icons to lucide icon names
UPDATE public.issue_types SET icon = 'snowflake' WHERE name = 'AC Issues';
UPDATE public.issue_types SET icon = 'flame' WHERE name = 'Heater Issues';
UPDATE public.issue_types SET icon = 'spray-can' WHERE name = 'Cleaning Issues';
UPDATE public.issue_types SET icon = 'refrigerator' WHERE name = 'Fridge Issues';
UPDATE public.issue_types SET icon = 'cooking-pot' WHERE name = 'Kitchen Equipment';
UPDATE public.issue_types SET icon = 'droplets' WHERE name = 'Water Issues';
UPDATE public.issue_types SET icon = 'glass-water' WHERE name = 'RO Water Issues';
UPDATE public.issue_types SET icon = 'shower-head' WHERE name = 'Toilet Issues';
UPDATE public.issue_types SET icon = 'zap' WHERE name = 'Electrical Issues';
UPDATE public.issue_types SET icon = 'wifi' WHERE name = 'Internet Issues';
UPDATE public.issue_types SET icon = 'credit-card' WHERE name = 'Billing Issues';
UPDATE public.issue_types SET icon = 'wrench' WHERE name = 'Other';

-- Seed sub-issues for each category
-- AC Issues
INSERT INTO public.issue_sub_types (issue_type_id, organization_id, name, icon, description, sort_order)
SELECT it.id, it.organization_id, sub.name, sub.icon, sub.description, sub.sort_order
FROM public.issue_types it
CROSS JOIN (VALUES
  ('AC not cooling', 'thermometer-snowflake', 'AC is running but not producing cold air', 1),
  ('AC leaking water', 'droplets', 'Water is dripping from the AC unit', 2),
  ('AC making noise', 'volume-2', 'AC is producing unusual or loud noises', 3),
  ('AC not turning on', 'zap', 'AC unit does not power on at all', 4),
  ('AC remote not working', 'fan', 'Remote control is unresponsive or lost', 5),
  ('AC bad smell', 'wind', 'Foul smell coming from the AC when running', 6)
) AS sub(name, icon, description, sort_order)
WHERE it.name = 'AC Issues';

-- Heater Issues
INSERT INTO public.issue_sub_types (issue_type_id, organization_id, name, icon, description, sort_order)
SELECT it.id, it.organization_id, sub.name, sub.icon, sub.description, sub.sort_order
FROM public.issue_types it
CROSS JOIN (VALUES
  ('Heater not heating', 'flame', 'Heater is on but not producing hot water/air', 1),
  ('Heater leaking', 'droplets', 'Water leaking from the heater unit', 2),
  ('Heater tripping', 'zap', 'Heater trips the circuit breaker when turned on', 3),
  ('Heater making noise', 'volume-2', 'Unusual sounds from the heater during operation', 4)
) AS sub(name, icon, description, sort_order)
WHERE it.name = 'Heater Issues';

-- Cleaning Issues
INSERT INTO public.issue_sub_types (issue_type_id, organization_id, name, icon, description, sort_order)
SELECT it.id, it.organization_id, sub.name, sub.icon, sub.description, sub.sort_order
FROM public.issue_types it
CROSS JOIN (VALUES
  ('Room not cleaned', 'spray-can', 'Scheduled room cleaning was not done', 1),
  ('Bathroom dirty', 'shower-head', 'Bathroom needs urgent cleaning', 2),
  ('Common area dirty', 'brush', 'Common area or corridor is unclean', 3),
  ('Garbage not collected', 'trash-2', 'Garbage bin is full or not collected', 4),
  ('Pest/insect issue', 'bug', 'Cockroaches, ants, or other pests spotted', 5),
  ('Bad odor', 'wind', 'Unpleasant smell in the room or corridor', 6)
) AS sub(name, icon, description, sort_order)
WHERE it.name = 'Cleaning Issues';

-- Fridge Issues
INSERT INTO public.issue_sub_types (issue_type_id, organization_id, name, icon, description, sort_order)
SELECT it.id, it.organization_id, sub.name, sub.icon, sub.description, sub.sort_order
FROM public.issue_types it
CROSS JOIN (VALUES
  ('Fridge not cooling', 'refrigerator', 'Fridge is running but not cold enough', 1),
  ('Fridge making noise', 'volume-2', 'Unusual humming or rattling from the fridge', 2),
  ('Fridge leaking', 'droplets', 'Water pooling under or inside the fridge', 3),
  ('Freezer icing up', 'snowflake', 'Excess ice buildup in the freezer section', 4)
) AS sub(name, icon, description, sort_order)
WHERE it.name = 'Fridge Issues';

-- Kitchen Equipment
INSERT INTO public.issue_sub_types (issue_type_id, organization_id, name, icon, description, sort_order)
SELECT it.id, it.organization_id, sub.name, sub.icon, sub.description, sub.sort_order
FROM public.issue_types it
CROSS JOIN (VALUES
  ('Stove not working', 'cooking-pot', 'Gas or electric stove is not igniting', 1),
  ('Microwave issue', 'microwave', 'Microwave not heating or display malfunction', 2),
  ('Mixer/grinder broken', 'utensils-crossed', 'Kitchen mixer or grinder not functioning', 3),
  ('Exhaust fan issue', 'fan', 'Kitchen exhaust fan not working or noisy', 4)
) AS sub(name, icon, description, sort_order)
WHERE it.name = 'Kitchen Equipment';

-- Water Issues
INSERT INTO public.issue_sub_types (issue_type_id, organization_id, name, icon, description, sort_order)
SELECT it.id, it.organization_id, sub.name, sub.icon, sub.description, sub.sort_order
FROM public.issue_types it
CROSS JOIN (VALUES
  ('No water supply', 'droplets', 'Complete water supply cut off', 1),
  ('Low water pressure', 'cloud-rain', 'Water pressure is very low in taps', 2),
  ('Water discolored', 'pipette', 'Yellowish or muddy water from the taps', 3),
  ('Hot water not working', 'flame', 'No hot water in bathroom or kitchen', 4)
) AS sub(name, icon, description, sort_order)
WHERE it.name = 'Water Issues';

-- RO Water Issues
INSERT INTO public.issue_sub_types (issue_type_id, organization_id, name, icon, description, sort_order)
SELECT it.id, it.organization_id, sub.name, sub.icon, sub.description, sub.sort_order
FROM public.issue_types it
CROSS JOIN (VALUES
  ('RO not purifying', 'glass-water', 'Water taste is off, RO may need servicing', 1),
  ('RO leaking', 'droplets', 'Water leaking from the RO unit', 2),
  ('RO filter change needed', 'filter', 'RO filter replacement is overdue', 3),
  ('RO not dispensing', 'alert-octagon', 'RO machine does not dispense water', 4)
) AS sub(name, icon, description, sort_order)
WHERE it.name = 'RO Water Issues';

-- Toilet Issues
INSERT INTO public.issue_sub_types (issue_type_id, organization_id, name, icon, description, sort_order)
SELECT it.id, it.organization_id, sub.name, sub.icon, sub.description, sub.sort_order
FROM public.issue_types it
CROSS JOIN (VALUES
  ('Toilet clogged', 'shower-head', 'Toilet is blocked and not flushing properly', 1),
  ('Flush not working', 'droplets', 'Flush mechanism is broken or jammed', 2),
  ('Tap leaking', 'pipette', 'Bathroom tap is dripping continuously', 3),
  ('Drain blocked', 'alert-octagon', 'Water not draining from the bathroom floor', 4)
) AS sub(name, icon, description, sort_order)
WHERE it.name = 'Toilet Issues';

-- Electrical Issues
INSERT INTO public.issue_sub_types (issue_type_id, organization_id, name, icon, description, sort_order)
SELECT it.id, it.organization_id, sub.name, sub.icon, sub.description, sub.sort_order
FROM public.issue_types it
CROSS JOIN (VALUES
  ('Power outage in room', 'zap', 'No electricity in the room', 1),
  ('Switch/socket broken', 'plug', 'Wall switch or power socket is damaged', 2),
  ('Light not working', 'lightbulb', 'Room or bathroom light is not turning on', 3),
  ('Fan not working', 'fan', 'Ceiling or wall fan is not running', 4),
  ('MCB tripping', 'battery-warning', 'Circuit breaker keeps tripping repeatedly', 5)
) AS sub(name, icon, description, sort_order)
WHERE it.name = 'Electrical Issues';

-- Internet Issues
INSERT INTO public.issue_sub_types (issue_type_id, organization_id, name, icon, description, sort_order)
SELECT it.id, it.organization_id, sub.name, sub.icon, sub.description, sub.sort_order
FROM public.issue_types it
CROSS JOIN (VALUES
  ('No WiFi connection', 'wifi-off', 'Cannot connect to the WiFi network at all', 1),
  ('Slow internet speed', 'wifi', 'Internet speed is very slow', 2),
  ('WiFi dropping frequently', 'router', 'WiFi connection disconnects intermittently', 3),
  ('Router issue', 'router', 'Router needs restart or replacement', 4)
) AS sub(name, icon, description, sort_order)
WHERE it.name = 'Internet Issues';

-- Billing Issues
INSERT INTO public.issue_sub_types (issue_type_id, organization_id, name, icon, description, sort_order)
SELECT it.id, it.organization_id, sub.name, sub.icon, sub.description, sub.sort_order
FROM public.issue_types it
CROSS JOIN (VALUES
  ('Incorrect bill amount', 'receipt', 'Monthly bill amount seems incorrect', 1),
  ('Payment not reflected', 'credit-card', 'Payment was made but not updated in the system', 2),
  ('Electricity charge query', 'file-text', 'Question about electricity bill calculation', 3),
  ('Deposit refund pending', 'credit-card', 'Security deposit refund has not been processed', 4)
) AS sub(name, icon, description, sort_order)
WHERE it.name = 'Billing Issues';

-- Other Issues
INSERT INTO public.issue_sub_types (issue_type_id, organization_id, name, icon, description, sort_order)
SELECT it.id, it.organization_id, sub.name, sub.icon, sub.description, sub.sort_order
FROM public.issue_types it
CROSS JOIN (VALUES
  ('Furniture damaged', 'wrench', 'Bed, chair, table, or wardrobe is broken', 1),
  ('Door/lock issue', 'circle-dot', 'Door lock is jammed or not working', 2),
  ('Window broken', 'alert-triangle', 'Window glass cracked or handle broken', 3),
  ('Other', 'help-circle', 'Any other issue not listed above', 4)
) AS sub(name, icon, description, sort_order)
WHERE it.name = 'Other';
