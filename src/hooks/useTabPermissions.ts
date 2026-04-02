import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface TabPermission {
  module: string;
  tab_key: string;
  is_visible: boolean;
}

export function useTabPermissions(module: string) {
  const { profile, roles } = useAuth();
  const orgId = profile?.organization_id;

  const { data: tabPermissions = [], isLoading } = useQuery({
    queryKey: ['tab_permissions', orgId, module, roles],
    queryFn: async () => {
      if (!orgId || roles.length === 0) return [];
      const { data } = await supabase
        .from('tab_permissions')
        .select('*')
        .eq('organization_id', orgId)
        .eq('module', module)
        .in('role', roles);
      return (data || []) as any[];
    },
    enabled: !!orgId && roles.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  const isTabVisible = (tabKey: string): boolean => {
    // If no tab permissions are configured at all for this module, show all tabs (default open)
    const modulePerms = tabPermissions.filter((p: any) => p.module === module);
    if (modulePerms.length === 0) return true;

    // When permissions ARE configured for this module, unconfigured tabs are HIDDEN
    const tabPerms = modulePerms.filter((p: any) => p.tab_key === tabKey);
    if (tabPerms.length === 0) return false; // Not configured = hidden when module has rules

    // Union: if any role has is_visible = true, tab is visible
    return tabPerms.some((p: any) => p.is_visible);
  };

  return { isTabVisible, isLoading, tabPermissions };
}
