
-- Phase 1a: Make tenant_id nullable on maintenance_tickets
ALTER TABLE maintenance_tickets ALTER COLUMN tenant_id DROP NOT NULL;

-- Phase 1b: Create trigger to sync tenants.staying_status from tenant_allotments
CREATE OR REPLACE FUNCTION sync_tenant_staying_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  latest_status text;
BEGIN
  SELECT staying_status::text INTO latest_status
  FROM tenant_allotments
  WHERE tenant_id = NEW.tenant_id
  ORDER BY
    CASE staying_status::text
      WHEN 'Staying' THEN 1
      WHEN 'On-Notice' THEN 2
      WHEN 'Booked' THEN 3
      ELSE 4
    END,
    created_at DESC
  LIMIT 1;

  IF latest_status IS NOT NULL THEN
    UPDATE tenants SET staying_status = lower(latest_status) WHERE id = NEW.tenant_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sync_tenant_status
AFTER INSERT OR UPDATE OF staying_status ON tenant_allotments
FOR EACH ROW EXECUTE FUNCTION sync_tenant_staying_status();
