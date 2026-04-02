
-- Remove old schedule if exists, then reschedule at 6:00 AM IST (00:30 UTC)
SELECT cron.unschedule('generate-maintenance-tickets-daily');

SELECT cron.schedule(
  'generate-maintenance-tickets-daily',
  '30 0 * * *',
  $$
  SELECT net.http_post(
    url := 'https://slljsigvfaxngpjaajjd.supabase.co/functions/v1/generate-maintenance-tickets',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNsbGpzaWd2ZmF4bmdwamFhampkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2NzI2NTQsImV4cCI6MjA4OTI0ODY1NH0.87jgDYMaRTM2JlVUulKZX0F4NKRg0GPWchwjCDmXmoU"}'::jsonb,
    body := concat('{"time": "', now(), '"}')::jsonb
  ) AS request_id;
  $$
);
