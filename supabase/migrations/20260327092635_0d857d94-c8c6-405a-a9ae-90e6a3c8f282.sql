-- One-time data correction: sync tenants.staying_status from tenant_allotments
UPDATE tenants t
SET staying_status = lower(ta.staying_status::text)
FROM (
  SELECT DISTINCT ON (tenant_id) tenant_id, staying_status
  FROM tenant_allotments
  ORDER BY tenant_id,
    CASE staying_status::text
      WHEN 'Staying' THEN 1
      WHEN 'On-Notice' THEN 2
      WHEN 'Booked' THEN 3
      ELSE 4
    END,
    created_at DESC
) ta
WHERE t.id = ta.tenant_id
  AND t.staying_status IS DISTINCT FROM lower(ta.staying_status::text);