import { useState, useMemo, useCallback } from 'react';
import { Shield, ChevronDown, ChevronRight, Eye, EyeOff } from 'lucide-react';
import { icons } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Card } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import { ROLE_LABELS, type AppRole } from '@/hooks/useRBAC';
import { NAV_REGISTRY } from '@/lib/navigation-registry';

const ALL_ROLES: AppRole[] = ['super_admin', 'org_admin', 'property_manager', 'employee', 'technician', 'tenant'];

const ROLE_COLORS: Record<string, string> = {
  super_admin: 'bg-destructive/10 text-destructive border-destructive/20',
  org_admin: 'bg-primary/10 text-primary border-primary/20',
  property_manager: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  employee: 'bg-green-500/10 text-green-600 border-green-500/20',
  technician: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
  tenant: 'bg-muted text-muted-foreground border-border',
};

const CRUD_FIELDS = [
  { key: 'can_create', label: 'Create', short: 'C' },
  { key: 'can_read', label: 'Read', short: 'R' },
  { key: 'can_update', label: 'Update', short: 'U' },
  { key: 'can_delete', label: 'Delete', short: 'D' },
] as const;

function DynamicIcon({ name, className }: { name: string; className?: string }) {
  const LucideIcon = (icons as any)[name];
  if (!LucideIcon) return null;
  return <LucideIcon className={className} />;
}

export default function UnifiedPermissions() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const orgId = profile?.organization_id;
  const [selectedRole, setSelectedRole] = useState<string>('super_admin');
  const [openModules, setOpenModules] = useState<Set<string>>(new Set());

  // Fetch both permission tables
  const { data: rolePermissions = [] } = useQuery({
    queryKey: ['role_permissions', orgId],
    queryFn: async () => {
      const { data } = await supabase
        .from('role_permissions')
        .select('*')
        .eq('organization_id', orgId!)
        .order('module');
      return data || [];
    },
    enabled: !!orgId,
  });

  const { data: tabPermissions = [] } = useQuery({
    queryKey: ['tab_permissions_admin', orgId],
    queryFn: async () => {
      const { data } = await supabase
        .from('tab_permissions')
        .select('*')
        .eq('organization_id', orgId!)
        .order('module');
      return data || [];
    },
    enabled: !!orgId,
  });

  // Filter for selected role
  const currentRolePerms = useMemo(
    () => rolePermissions.filter((p: any) => p.role === selectedRole),
    [rolePermissions, selectedRole]
  );
  const currentTabPerms = useMemo(
    () => tabPermissions.filter((p: any) => p.role === selectedRole),
    [tabPermissions, selectedRole]
  );

  const getModulePerm = useCallback(
    (module: string) => currentRolePerms.find((p: any) => p.module === module),
    [currentRolePerms]
  );
  const getTabPerm = useCallback(
    (module: string, tabKey: string) =>
      currentTabPerms.find((p: any) => p.module === module && p.tab_key === tabKey),
    [currentTabPerms]
  );

  // Mutations
  const upsertModulePerm = useMutation({
    mutationFn: async (payload: { module: string; can_create: boolean; can_read: boolean; can_update: boolean; can_delete: boolean }) => {
      const existing = getModulePerm(payload.module);
      if (existing) {
        const { error } = await supabase
          .from('role_permissions')
          .update({ ...payload, updated_at: new Date().toISOString() } as any)
          .eq('id', (existing as any).id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('role_permissions').insert({
          organization_id: orgId,
          role: selectedRole,
          ...payload,
        } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['role_permissions'] });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const deleteModulePerm = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('role_permissions').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['role_permissions'] });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const upsertTabPerm = useMutation({
    mutationFn: async (payload: { module: string; tab_key: string; is_visible: boolean; can_create?: boolean; can_read?: boolean; can_update?: boolean; can_delete?: boolean }) => {
      const existing = getTabPerm(payload.module, payload.tab_key);
      const { module, tab_key, ...rest } = payload;
      if (existing) {
        const { error } = await supabase
          .from('tab_permissions')
          .update({ ...rest, updated_at: new Date().toISOString() } as any)
          .eq('id', (existing as any).id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('tab_permissions').insert({
          organization_id: orgId,
          role: selectedRole,
          module,
          tab_key,
          is_visible: rest.is_visible,
          can_create: rest.can_create ?? false,
          can_read: rest.can_read ?? true,
          can_update: rest.can_update ?? false,
          can_delete: rest.can_delete ?? false,
        } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tab_permissions_admin'] });
      qc.invalidateQueries({ queryKey: ['tab_permissions'] });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  // Bulk actions
  const grantAll = useMutation({
    mutationFn: async () => {
      // Upsert all module permissions with full CRUD
      for (const mod of NAV_REGISTRY) {
        const existing = getModulePerm(mod.module);
        const payload = { module: mod.module, can_create: true, can_read: true, can_update: true, can_delete: true };
        if (existing) {
          await supabase.from('role_permissions')
            .update({ ...payload, updated_at: new Date().toISOString() } as any)
            .eq('id', (existing as any).id);
        } else {
          await supabase.from('role_permissions').insert({
            organization_id: orgId, role: selectedRole, ...payload,
          } as any);
        }
        // Set all tabs visible with full CRUD
        for (const tab of mod.tabs) {
          const existingTab = getTabPerm(mod.module, tab.key);
          const tabPayload = { is_visible: true, can_create: true, can_read: true, can_update: true, can_delete: true };
          if (existingTab) {
            await supabase.from('tab_permissions')
              .update({ ...tabPayload, updated_at: new Date().toISOString() } as any)
              .eq('id', (existingTab as any).id);
          } else {
            await supabase.from('tab_permissions').insert({
              organization_id: orgId, role: selectedRole, module: mod.module, tab_key: tab.key, ...tabPayload,
            } as any);
          }
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['role_permissions'] });
      qc.invalidateQueries({ queryKey: ['tab_permissions_admin'] });
      qc.invalidateQueries({ queryKey: ['tab_permissions'] });
      toast({ title: 'All permissions granted' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const revokeAll = useMutation({
    mutationFn: async () => {
      // Delete all role_permissions for this role
      const { error: e1 } = await supabase.from('role_permissions')
        .delete()
        .eq('organization_id', orgId!)
        .eq('role', selectedRole);
      if (e1) throw e1;
      // Delete all tab_permissions for this role
      const { error: e2 } = await supabase.from('tab_permissions')
        .delete()
        .eq('organization_id', orgId!)
        .eq('role', selectedRole);
      if (e2) throw e2;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['role_permissions'] });
      qc.invalidateQueries({ queryKey: ['tab_permissions_admin'] });
      qc.invalidateQueries({ queryKey: ['tab_permissions'] });
      toast({ title: 'All permissions revoked' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const toggleAccordion = (module: string) => {
    setOpenModules(prev => {
      const next = new Set(prev);
      next.has(module) ? next.delete(module) : next.add(module);
      return next;
    });
  };

  const isModuleEnabled = (module: string) => {
    const perm = getModulePerm(module);
    return !!perm;
  };

  const handleModuleToggle = (module: string, enabled: boolean) => {
    if (enabled) {
      upsertModulePerm.mutate({ module, can_create: false, can_read: true, can_update: false, can_delete: false });
    } else {
      const perm = getModulePerm(module);
      if (perm) deleteModulePerm.mutate((perm as any).id);
    }
  };

  const handleCrudChange = (module: string, field: string, value: boolean) => {
    const perm = getModulePerm(module);
    if (perm) {
      const updated = {
        module,
        can_create: (perm as any).can_create,
        can_read: (perm as any).can_read,
        can_update: (perm as any).can_update,
        can_delete: (perm as any).can_delete,
        [field]: value,
      };
      upsertModulePerm.mutate(updated);
    }
  };

  const handleTabToggle = (module: string, tabKey: string, visible: boolean) => {
    const existing = getTabPerm(module, tabKey) as any;
    upsertTabPerm.mutate({
      module,
      tab_key: tabKey,
      is_visible: visible,
      can_create: existing?.can_create ?? false,
      can_read: existing?.can_read ?? true,
      can_update: existing?.can_update ?? false,
      can_delete: existing?.can_delete ?? false,
    });
  };

  const handleTabCrudChange = (module: string, tabKey: string, field: string, value: boolean) => {
    const existing = getTabPerm(module, tabKey) as any;
    upsertTabPerm.mutate({
      module,
      tab_key: tabKey,
      is_visible: existing?.is_visible ?? true,
      can_create: existing?.can_create ?? false,
      can_read: existing?.can_read ?? true,
      can_update: existing?.can_update ?? false,
      can_delete: existing?.can_delete ?? false,
      [field]: value,
    });
  };

  const configuredCount = currentRolePerms.length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Shield className="h-5 w-5 text-primary" />
        <h3 className="font-semibold text-lg">Unified Permissions</h3>
      </div>
      <p className="text-sm text-muted-foreground">
        Manage module access (CRUD) and tab visibility for each role in one place.
      </p>

      {/* Role Selector */}
      <div className="flex items-center gap-3 flex-wrap">
        <Label className="text-sm whitespace-nowrap font-medium">Role:</Label>
        <div className="flex flex-wrap gap-2">
          {ALL_ROLES.map((role) => (
            <Button
              key={role}
              variant={selectedRole === role ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedRole(role)}
              className="text-xs"
            >
              {ROLE_LABELS[role]}
            </Button>
          ))}
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={`${ROLE_COLORS[selectedRole] || ''}`}>
            {ROLE_LABELS[selectedRole as AppRole]}
          </Badge>
          <span className="text-sm text-muted-foreground">
            {configuredCount} / {NAV_REGISTRY.length} modules configured
          </span>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (confirm(`Grant ALL permissions (every module + tab) for ${ROLE_LABELS[selectedRole as AppRole]}?`)) {
                grantAll.mutate();
              }
            }}
            disabled={grantAll.isPending}
          >
            Grant All
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() => {
              if (confirm(`Revoke ALL permissions for ${ROLE_LABELS[selectedRole as AppRole]}? This will remove all module and tab access.`)) {
                revokeAll.mutate();
              }
            }}
            disabled={revokeAll.isPending}
          >
            Revoke All
          </Button>
        </div>
      </div>

      {/* Module Accordions */}
      <div className="space-y-2">
        {NAV_REGISTRY.map((mod) => {
          const isOpen = openModules.has(mod.module);
          const enabled = isModuleEnabled(mod.module);
          const perm = getModulePerm(mod.module) as any;
          const hasTabs = mod.tabs.length > 0;

          return (
            <Card key={mod.module} className={`transition-all ${enabled ? '' : 'opacity-60'}`}>
              <Collapsible open={isOpen} onOpenChange={() => toggleAccordion(mod.module)}>
                <div className="flex items-center justify-between px-4 py-3">
                  <CollapsibleTrigger asChild>
                    <button className="flex items-center gap-3 flex-1 text-left hover:opacity-80 transition-opacity">
                      {isOpen ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                      )}
                      <DynamicIcon name={mod.icon} className="h-4 w-4 text-primary shrink-0" />
                      <span className="font-medium text-sm">{mod.label}</span>
                      {hasTabs && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          {mod.tabs.length} tabs
                        </Badge>
                      )}
                    </button>
                  </CollapsibleTrigger>
                  <Switch
                    checked={enabled}
                    onCheckedChange={(checked) => handleModuleToggle(mod.module, checked)}
                  />
                </div>

                <CollapsibleContent>
                  <div className="px-4 pb-4 space-y-4">
                    {/* CRUD Permissions */}
                    {enabled && (
                      <div className="rounded-lg border border-border bg-muted/30 p-3">
                        <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">
                          Page-Level Permissions
                        </p>
                        <div className="grid grid-cols-4 gap-3">
                          {CRUD_FIELDS.map(({ key, label }) => (
                            <label
                              key={key}
                              className="flex items-center gap-2 cursor-pointer"
                            >
                              <Checkbox
                                checked={perm?.[key] ?? false}
                                onCheckedChange={(checked) =>
                                  handleCrudChange(mod.module, key, !!checked)
                                }
                              />
                              <span className="text-sm">{label}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Tab Visibility & CRUD */}
                    {enabled && hasTabs && (
                      <div className="rounded-lg border border-border bg-muted/30 p-3">
                        <p className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wider">
                          Tab Permissions
                        </p>
                        <div className="space-y-2">
                          {mod.tabs.map((tab) => {
                            const tabPerm = getTabPerm(mod.module, tab.key) as any;
                            const isVisible = tabPerm ? tabPerm.is_visible : true;
                            const hasRule = !!tabPerm;

                            return (
                              <div
                                key={tab.key}
                                className="rounded-md border border-border/50 p-2.5 space-y-2"
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    {isVisible ? (
                                      <Eye className="h-3.5 w-3.5 text-primary" />
                                    ) : (
                                      <EyeOff className="h-3.5 w-3.5 text-destructive" />
                                    )}
                                    <span className="text-sm font-medium">{tab.label}</span>
                                    {!hasRule && (
                                      <span className="text-[10px] text-muted-foreground">(default)</span>
                                    )}
                                  </div>
                                  <Switch
                                    checked={isVisible}
                                    onCheckedChange={(checked) =>
                                      handleTabToggle(mod.module, tab.key, checked)
                                    }
                                  />
                                </div>
                                {isVisible && (
                                  <div className="grid grid-cols-4 gap-2 pl-6">
                                    {CRUD_FIELDS.map(({ key, label }) => (
                                      <label key={key} className="flex items-center gap-1.5 cursor-pointer">
                                        <Checkbox
                                          checked={tabPerm?.[key] ?? (key === 'can_read')}
                                          onCheckedChange={(checked) =>
                                            handleTabCrudChange(mod.module, tab.key, key, !!checked)
                                          }
                                        />
                                        <span className="text-xs text-muted-foreground">{label}</span>
                                      </label>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {!enabled && (
                      <p className="text-sm text-muted-foreground italic">
                        Enable this module to configure permissions and tab access.
                      </p>
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
