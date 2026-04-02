import { useAuth } from '@/contexts/AuthContext';
import { useTicketRole } from '@/hooks/useTicketRole';
import TenantDashboard from './TenantDashboard';
import AdminDashboard from '@/components/dashboard/AdminDashboard';

export default function Dashboard() {
  const { roles } = useAuth();
  const { isTenantRole } = useTicketRole();

  // Tenant role gets tenant-specific dashboard
  const isOnlyTenant = roles.includes('tenant') && !roles.some(r => ['super_admin', 'org_admin', 'property_manager', 'employee', 'technician'].includes(r));

  if (isOnlyTenant || isTenantRole) {
    return <TenantDashboard />;
  }

  return <AdminDashboard />;
}
