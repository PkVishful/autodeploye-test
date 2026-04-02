SELECT cron.schedule(
  'generate-maintenance-tickets-daily',
  '0 6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://slljsigvfaxngpjaajjd.supabase.co/functions/v1/generate-maintenance-tickets',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNsbGpzaWd2ZmF4bmdwamFhampkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2NzI2NTQsImV4cCI6MjA4OTI0ODY1NH0.87jgDYMaRTM2JlVUulKZX0F4NKRg0GPWchwjCDmXmoU"}'::jsonb,
    body := '{"time": "scheduled"}'::jsonb
  ) AS request_id;
  $$
)