import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type TicketUserRole = 'admin' | 'employee' | 'technician' | 'tenant' | 'unknown';

export function useTicketRole() {
  const { user, roles, profile } = useAuth();

  // Find the tenant record with an active "Staying" allotment for this user
  const { data: tenantRecord } = useQuery({
    queryKey: ['tenant_by_user_active', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      // Step 1: get all tenant records linked to this user
      const { data: tenants, error } = await supabase
        .from('tenants')
        .select('id, full_name')
        .eq('user_id', user.id);

      if (error || !tenants || tenants.length === 0) return null;

      // If only one tenant, return it directly
      if (tenants.length === 1) return tenants[0];

      // Step 2: find which tenant has an active Staying allotment
      const tenantIds = tenants.map(t => t.id);
      const { data: allotments } = await supabase
        .from('tenant_allotments')
        .select('tenant_id')
        .in('tenant_id', tenantIds)
        .eq('staying_status', 'Staying' as any)
        .limit(1);

      if (allotments && allotments.length > 0) {
        return tenants.find(t => t.id === allotments[0].tenant_id) || tenants[0];
      }

      // Fallback to first tenant record
      return tenants[0];
    },
    enabled: !!user?.id,
  });

  const isTenantRole = roles.includes('tenant');
  const isAdmin = roles.includes('super_admin') || roles.includes('org_admin') || roles.includes('property_manager');
  const isEmployee = roles.includes('employee');
  const isTechnician = roles.includes('technician');

  const ticketRole: TicketUserRole = isAdmin
    ? 'admin'
    : isTenantRole
    ? 'tenant'
    : isEmployee
    ? 'employee'
    : isTechnician
    ? 'technician'
    : 'unknown';

  return {
    ticketRole,
    isAdmin,
    isTenantRole,
    isEmployee: isEmployee || isTechnician,
    tenantRecord,
    userId: user?.id,
  };
}
