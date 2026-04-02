import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTicketRole } from '@/hooks/useTicketRole';

export interface ApprovalAlerts {
  costApproval: number;
  adminApproval: number;
  tenantApproval: number;
  tenantPendingTickets: any[];
  total: number;
  isLoading: boolean;
}

export function useApprovalAlerts(): ApprovalAlerts {
  const { profile, user } = useAuth();
  const { isAdmin, isTenantRole, isEmployee, tenantRecord } = useTicketRole();
  const orgId = profile?.organization_id;

  const { data: alerts, isLoading } = useQuery({
    queryKey: ['approval-alerts', orgId, user?.id, isTenantRole, tenantRecord?.id],
    queryFn: async () => {
      const result = { costApproval: 0, adminApproval: 0, tenantApproval: 0, tenantPendingTickets: [] as any[] };

      if (isAdmin) {
        // Admin sees all approval counts
        const [cost, admin, tenant] = await Promise.all([
          supabase.from('maintenance_tickets').select('id', { count: 'exact', head: true }).eq('status', 'waiting_for_cost_approval'),
          supabase.from('maintenance_tickets').select('id', { count: 'exact', head: true }).eq('status', 'pending_admin_approval'),
          supabase.from('maintenance_tickets').select('id', { count: 'exact', head: true }).eq('status', 'pending_tenant_approval'),
        ]);
        result.costApproval = cost.count || 0;
        result.adminApproval = admin.count || 0;
        result.tenantApproval = tenant.count || 0;
      } else if (isTenantRole && tenantRecord?.id) {
        // Tenant sees their own pending approval tickets
        const { data, count } = await supabase.from('maintenance_tickets')
          .select('id, ticket_number, status')
          .eq('tenant_id', tenantRecord.id)
          .eq('status', 'pending_tenant_approval');
        result.tenantApproval = count || data?.length || 0;
        result.tenantPendingTickets = data || [];
      } else if (isEmployee && user?.id) {
        // Employee sees cost approval count for their assigned tickets
        const { count } = await supabase.from('maintenance_tickets')
          .select('id', { count: 'exact', head: true })
          .eq('assigned_to', user.id)
          .eq('status', 'waiting_for_cost_approval');
        result.costApproval = count || 0;
      }

      return result;
    },
    enabled: !!orgId,
    refetchInterval: 60000, // Refresh every minute
  });

  const data = alerts || { costApproval: 0, adminApproval: 0, tenantApproval: 0, tenantPendingTickets: [] };
  return {
    ...data,
    total: data.costApproval + data.adminApproval + data.tenantApproval,
    isLoading,
  };
}
