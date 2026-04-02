import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type AppRole = 'super_admin' | 'org_admin' | 'property_manager' | 'technician' | 'tenant' | 'employee';

// Role hierarchy
const ROLE_HIERARCHY: Record<AppRole, number> = {
  super_admin: 100,
  org_admin: 80,
  property_manager: 60,
  employee: 50,
  technician: 40,
  tenant: 20,
};

export const ROLE_LABELS: Record<AppRole, string> = {
  super_admin: 'Super Admin',
  org_admin: 'Admin',
  property_manager: 'Property Manager',
  employee: 'Employee',
  technician: 'Technician',
  tenant: 'Tenant',
};

// Module-to-route mapping
const MODULE_ROUTE_MAP: Record<string, string> = {
  '/dashboard': 'dashboard',
  '/properties': 'properties',
  '/owners': 'owners',
  '/tenants': 'tenants',
  '/assets': 'assets',
  '/tickets': 'tickets',
  '/accounting': 'accounting',
  '/electricity': 'electricity',
  '/reports': 'reports',
  '/team': 'team',
  '/audit-logs': 'audit_logs',
  '/settings': 'settings',
  '/tenant-lifecycle': 'tenant_lifecycle',
  '/announcements': 'announcements',
  '/tenant-home': 'tenant_dashboard',
};

export interface ModulePermission {
  module: string;
  can_create: boolean;
  can_read: boolean;
  can_update: boolean;
  can_delete: boolean;
}

export function useRBAC() {
  const { roles, loading, profile } = useAuth();
  const orgId = profile?.organization_id;

  const userRoles = roles as AppRole[];
  const highestRole = userRoles.length > 0
    ? userRoles.reduce<AppRole>((best, role) => {
        return ROLE_HIERARCHY[role] > ROLE_HIERARCHY[best] ? role : best;
      }, userRoles[0])
    : null;

  // Fetch dynamic permissions from DB
  const { data: dbPermissions = [], isLoading: permissionsLoading } = useQuery({
    queryKey: ['role_permissions', orgId, userRoles],
    queryFn: async () => {
      if (!orgId || userRoles.length === 0) return [];
      const { data } = await supabase
        .from('role_permissions')
        .select('*')
        .eq('organization_id', orgId)
        .in('role', userRoles);
      return data || [];
    },
    enabled: !!orgId && userRoles.length > 0,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Merge permissions across roles (union — most permissive wins)
  const mergedPermissions: Record<string, ModulePermission> = {};
  dbPermissions.forEach((p: any) => {
    if (!mergedPermissions[p.module]) {
      mergedPermissions[p.module] = {
        module: p.module,
        can_create: false,
        can_read: false,
        can_update: false,
        can_delete: false,
      };
    }
    const m = mergedPermissions[p.module];
    m.can_create = m.can_create || p.can_create;
    m.can_read = m.can_read || p.can_read;
    m.can_update = m.can_update || p.can_update;
    m.can_delete = m.can_delete || p.can_delete;
  });

  const hasRole = (role: AppRole) => userRoles.includes(role);
  const hasAnyRole = (requiredRoles: AppRole[]) => requiredRoles.some(r => userRoles.includes(r));
  const isAdmin = () => hasAnyRole(['super_admin', 'org_admin']);
  const hasNoRoles = () => !loading && userRoles.length === 0;

  const canAccessPage = (path: string) => {
    if (loading || permissionsLoading) return true; // Don't block while loading
    if (userRoles.length === 0) return false;
    
    const module = MODULE_ROUTE_MAP[path];
    if (!module) return true; // Unknown routes are allowed
    
    const perm = mergedPermissions[module];
    if (!perm) return false; // No permission entry = no access
    return perm.can_read; // Need at least read to access page
  };

  const canPerform = (feature: string) => {
    if (userRoles.length === 0) return false;
    
    // Parse feature string like "ticket.create" -> module: tickets, action: can_create
    const [modulePart, action] = feature.split('.');
    
    // Map feature module names to DB module names
    const moduleMap: Record<string, string> = {
      ticket: 'tickets',
      property: 'properties',
      tenant: 'tenants',
      owner: 'owners',
      asset: 'assets',
      invoice: 'accounting',
      expense: 'accounting',
      settlement: 'accounting',
      payment: 'accounting',
      export: 'reports',
      team: 'team',
      user: 'settings',
      report: 'reports',
      settings: 'settings',
    };

    const actionMap: Record<string, string> = {
      create: 'can_create',
      read: 'can_read',
      update: 'can_update',
      delete: 'can_delete',
      assign: 'can_update',
      lock: 'can_update',
      generate: 'can_create',
      record: 'can_create',
      manage: 'can_update',
      view: 'can_read',
      csv: 'can_read',
      pdf: 'can_read',
    };

    const dbModule = moduleMap[modulePart];
    const dbAction = actionMap[action];
    
    if (!dbModule || !dbAction) return true; // Unknown features allowed by default
    
    const perm = mergedPermissions[dbModule];
    if (!perm) return false;
    return (perm as any)[dbAction] || false;
  };

  const getModulePermission = (module: string): ModulePermission | null => {
    return mergedPermissions[module] || null;
  };

  const canAccessAccountingTab = (tab: string) => {
    if (userRoles.length === 0) return false;
    const perm = mergedPermissions['accounting'];
    if (!perm) return false;
    return perm.can_read;
  };

  const getAccessibleNavItems = (items: Array<{ url: string; [key: string]: any }>) => {
    if (userRoles.length === 0) return [];
    return items.filter(item => canAccessPage(item.url));
  };

  const getAccessibleAccountingTabs = () => {
    const perm = mergedPermissions['accounting'];
    if (!perm || !perm.can_read) return [];
    const tabs = ['billing', 'invoices', 'collections', 'expenses', 'settlements', 'rental_payments', 'reports'];
    return tabs;
  };

  return {
    loading: loading || permissionsLoading,
    roles: userRoles,
    highestRole,
    hasRole,
    hasAnyRole,
    isAdmin,
    hasNoRoles,
    canAccessPage,
    canAccessAccountingTab,
    canPerform,
    getModulePermission,
    getAccessibleNavItems,
    getAccessibleAccountingTabs,
  };
}
