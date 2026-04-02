
-- Fix tenant staying_status for tenants whose latest allotment is Exited but status shows 'staying'
UPDATE tenants SET staying_status = 'exited' 
WHERE id IN (
  '6542b72b-196a-4538-a690-2db7cc212936',
  '71a2b1e6-ae5d-01fe-6e96-34a5a7d646fa',
  'bb91db20-f031-af83-8e52-9b613ace7567',
  'd6d33436-345a-e39c-9f8d-91c76dca514e',
  'd497808b-36e2-ea42-d247-85b4e409078c',
  '2ac2da6e-0954-f906-32d7-a1f55477c590',
  'af8d560f-407a-4e9b-49e9-88f54d8671f4',
  '503f204a-1840-9c61-b0fc-0c3228f0d967'
);
