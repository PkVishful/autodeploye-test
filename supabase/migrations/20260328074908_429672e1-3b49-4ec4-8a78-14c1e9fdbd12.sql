
CREATE OR REPLACE FUNCTION public.get_eligible_assignees(_exclude_user_id uuid DEFAULT NULL)
RETURNS TABLE(
  team_member_id uuid,
  resolved_user_id uuid,
  display_name text,
  role text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT ON (tm.id)
    tm.id AS team_member_id,
    p.id AS resolved_user_id,
    TRIM(COALESCE(tm.first_name, '') || ' ' || COALESCE(tm.last_name, '')) AS display_name,
    ur.role::text AS role
  FROM team_members tm
  JOIN profiles p ON (
    (tm.user_id IS NOT NULL AND p.id = tm.user_id)
    OR (tm.user_id IS NULL AND tm.email IS NOT NULL AND p.email = tm.email)
    OR (tm.user_id IS NULL AND tm.email IS NULL AND tm.phone IS NOT NULL AND p.phone = tm.phone)
  )
  JOIN user_roles ur ON ur.user_id = p.id
  WHERE tm.status = 'active'
    AND ur.role IN ('technician', 'property_manager')
    AND (_exclude_user_id IS NULL OR p.id != _exclude_user_id)
$$;
