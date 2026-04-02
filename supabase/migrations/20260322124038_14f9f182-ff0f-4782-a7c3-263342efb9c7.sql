
-- Step 1: Reset ALL beds to vacant
UPDATE beds SET bed_lifecycle_status = 'vacant'
WHERE organization_id = '00000000-0000-0000-0000-000000000001';

-- Step 2: Set bed status based on active allotments (Staying)
UPDATE beds SET bed_lifecycle_status = 'occupied'
WHERE id IN (
  SELECT DISTINCT ta.bed_id FROM tenant_allotments ta
  WHERE ta.staying_status = 'Staying'
  AND ta.organization_id = '00000000-0000-0000-0000-000000000001'
);

-- Step 3: Set bed status for Booked
UPDATE beds SET bed_lifecycle_status = 'booked'
WHERE id IN (
  SELECT DISTINCT ta.bed_id FROM tenant_allotments ta
  WHERE ta.staying_status = 'Booked'
  AND ta.organization_id = '00000000-0000-0000-0000-000000000001'
);

-- Step 4: Set bed status for On-Notice
UPDATE beds SET bed_lifecycle_status = 'notice'
WHERE id IN (
  SELECT DISTINCT ta.bed_id FROM tenant_allotments ta
  WHERE ta.staying_status = 'On-Notice'
  AND ta.organization_id = '00000000-0000-0000-0000-000000000001'
);

-- Step 5: Set bed status for notice-booked (bed has both a notice tenant and a booked tenant)
UPDATE beds SET bed_lifecycle_status = 'notice-booked'
WHERE id IN (
  SELECT ta1.bed_id FROM tenant_allotments ta1
  WHERE ta1.staying_status = 'On-Notice'
  AND ta1.organization_id = '00000000-0000-0000-0000-000000000001'
  AND EXISTS (
    SELECT 1 FROM tenant_allotments ta2
    WHERE ta2.bed_id = ta1.bed_id AND ta2.staying_status = 'Booked'
  )
);

-- Step 6: Reset ALL tenant staying_status to 'exited' first
UPDATE tenants SET staying_status = 'exited'
WHERE organization_id = '00000000-0000-0000-0000-000000000001'
AND staying_status NOT IN ('new');

-- Step 7: Set tenant status based on active allotments
UPDATE tenants SET staying_status = 'staying'
WHERE id IN (
  SELECT DISTINCT tenant_id FROM tenant_allotments
  WHERE staying_status = 'Staying'
  AND organization_id = '00000000-0000-0000-0000-000000000001'
);

UPDATE tenants SET staying_status = 'booked'
WHERE id IN (
  SELECT DISTINCT tenant_id FROM tenant_allotments
  WHERE staying_status = 'Booked'
  AND organization_id = '00000000-0000-0000-0000-000000000001'
)
AND id NOT IN (
  SELECT DISTINCT tenant_id FROM tenant_allotments
  WHERE staying_status = 'Staying'
  AND organization_id = '00000000-0000-0000-0000-000000000001'
);

UPDATE tenants SET staying_status = 'on-notice'
WHERE id IN (
  SELECT DISTINCT tenant_id FROM tenant_allotments
  WHERE staying_status = 'On-Notice'
  AND organization_id = '00000000-0000-0000-0000-000000000001'
)
AND id NOT IN (
  SELECT DISTINCT tenant_id FROM tenant_allotments
  WHERE staying_status = 'Staying'
  AND organization_id = '00000000-0000-0000-0000-000000000001'
);
