import { useState } from 'react';
import { Layers, Plus, Trash2, Eye, EyeOff } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import { DrawerForm } from '@/components/shared/DrawerForm';
import { ROLE_LABELS, type AppRole } from '@/hooks/useRBAC';

const ALL_ROLES: AppRole[] = ['super_admin', 'org_admin', 'property_manager', 'employee', 'technician', 'tenant'];

const MODULE_TABS: Record<string, { key: string; label: string }[]> = {
  tenant_lifecycle: [
    { key: 'visual-map', label: 'Visual Map' },
    { key: 'booking', label: 'Booking' },
    { key: 'onboarding', label: 'Onboarding' },
    { key: 'switching', label: 'Switching' },
    { key: 'notices', label: 'Notices' },
    { key: 'exit', label: 'Exit' },
    { key: 'payments', label: 'Payments' },
    { key: 'refunds', label: 'Refunds' },
    { key: 'excel-upload', label: 'Excel Upload' },
  ],
  accounting: [
    { key: 'billing', label: 'Billing' },
    { key: 'invoices', label: 'Invoices' },
    { key: 'collections', label: 'Collections' },
    { key: 'expenses', label: 'Expenses' },
    { key: 'settlements', label: 'Settlements' },
    { key: 'rental_payments', label: 'Rental Payments' },
    { key: 'reports', label: 'Reports' },
    { key: 'bank_accounts', label: 'Bank Accounts' },
  ],
  tickets: [
    { key: 'all', label: 'All Tickets' },
    { key: 'my_tickets', label: 'My Tickets' },
    { key: 'analytics', label: 'Analytics' },
  ],
};

const MODULES_WITH_TABS = Object.keys(MODULE_TABS).map(k => ({
  key: k,
  label: k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
}));

const ROLE_COLORS: Record<string, string> = {
  super_admin: 'bg-destructive/10 text-destructive',
  org_admin: 'bg-primary/10 text-primary',
  property_manager: 'bg-blue-500/10 text-blue-600',
  employee: 'bg-green-500/10 text-green-600',
  technician: 'bg-orange-500/10 text-orange-600',
  tenant: 'bg-muted text-muted-foreground',
};

export default function TabPermissionManagement() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const orgId = profile?.organization_id;
  const [selectedRole, setSelectedRole] = useState<string>('tenant');
  const [addOpen, setAddOpen] = useState(false);
  const [addModule, setAddModule] = useState('');
  const [addTab, setAddTab] = useState('');
  const [addVisible, setAddVisible] = useState(true);

  const { data: tabPerms = [], isLoading } = useQuery({
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

  const rolePerms = tabPerms.filter((p: any) => p.role === selectedRole);

  const toggleVisibility = useMutation({
    mutationFn: async ({ id, is_visible }: { id: string; is_visible: boolean }) => {
      const { error } = await supabase
        .from('tab_permissions')
        .update({ is_visible, updated_at: new Date().toISOString() } as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tab_permissions_admin'] });
      qc.invalidateQueries({ queryKey: ['tab_permissions'] });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const addTabPerm = useMutation({
    mutationFn: async () => {
      if (!addModule || !addTab) throw new Error('Select module and tab');
      const existing = tabPerms.find((p: any) => p.role === selectedRole && p.module === addModule && p.tab_key === addTab);
      if (existing) throw new Error('Permission already exists for this role, module and tab');
      const { error } = await supabase.from('tab_permissions').insert({
        organization_id: orgId,
        role: selectedRole,
        module: addModule,
        tab_key: addTab,
        is_visible: addVisible,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tab_permissions_admin'] });
      qc.invalidateQueries({ queryKey: ['tab_permissions'] });
      setAddOpen(false);
      setAddModule('');
      setAddTab('');
      setAddVisible(true);
      toast({ title: 'Tab permission added' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const deleteTabPerm = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('tab_permissions').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tab_permissions_admin'] });
      qc.invalidateQueries({ queryKey: ['tab_permissions'] });
      toast({ title: 'Tab permission removed' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const getModuleLabel = (key: string) => MODULES_WITH_TABS.find(m => m.key === key)?.label || key;
  const getTabLabel = (module: string, tabKey: string) => MODULE_TABS[module]?.find(t => t.key === tabKey)?.label || tabKey;

  // Tabs already configured for this role
  const existingTabKeys = rolePerms.map((p: any) => `${p.module}::${p.tab_key}`);
  // Available tabs to add (not yet configured)
  const availableTabs: { module: string; tab: { key: string; label: string } }[] = [];
  MODULES_WITH_TABS.forEach(mod => {
    (MODULE_TABS[mod.key] || []).forEach(tab => {
      if (!existingTabKeys.includes(`${mod.key}::${tab.key}`)) {
        availableTabs.push({ module: mod.key, tab });
      }
    });
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Tab Permission Control</h3>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        Control which tabs each role can see. Tabs without rules are <strong>visible by default</strong>.
      </p>

      <div className="flex items-center gap-3">
        <Label className="text-sm whitespace-nowrap">Select Role:</Label>
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

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={`${ROLE_COLORS[selectedRole] || ''}`}>
            {ROLE_LABELS[selectedRole as AppRole]}
          </Badge>
          <span className="text-sm text-muted-foreground">
            {rolePerms.length} tab rule{rolePerms.length !== 1 ? 's' : ''} configured
          </span>
        </div>
        {availableTabs.length > 0 && (
          <Button size="sm" className="gap-2" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" /> Add Tab Rule
          </Button>
        )}
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Module</TableHead>
              <TableHead>Tab</TableHead>
              <TableHead className="text-center w-24">Visible</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rolePerms.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                  No tab permissions configured for this role — all tabs visible by default
                </TableCell>
              </TableRow>
            ) : (
              rolePerms.map((p: any) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{getModuleLabel(p.module)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {p.is_visible ? (
                        <Eye className="h-3.5 w-3.5 text-emerald-500" />
                      ) : (
                        <EyeOff className="h-3.5 w-3.5 text-destructive" />
                      )}
                      {getTabLabel(p.module, p.tab_key)}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <Checkbox
                      checked={p.is_visible}
                      onCheckedChange={(checked) =>
                        toggleVisibility.mutate({ id: p.id, is_visible: !!checked })
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => {
                        if (confirm(`Remove tab rule for "${getTabLabel(p.module, p.tab_key)}" in ${getModuleLabel(p.module)}?`)) {
                          deleteTabPerm.mutate(p.id);
                        }
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <DrawerForm open={addOpen} onOpenChange={setAddOpen} title="Add Tab Permission Rule">
        <div>
          <Label>Module</Label>
          <Select value={addModule} onValueChange={(v) => { setAddModule(v); setAddTab(''); }}>
            <SelectTrigger><SelectValue placeholder="Select module" /></SelectTrigger>
            <SelectContent>
              {MODULES_WITH_TABS.map((m) => (
                <SelectItem key={m.key} value={m.key}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {addModule && (
          <div>
            <Label>Tab</Label>
            <Select value={addTab} onValueChange={setAddTab}>
              <SelectTrigger><SelectValue placeholder="Select tab" /></SelectTrigger>
              <SelectContent>
                {(MODULE_TABS[addModule] || [])
                  .filter(t => !existingTabKeys.includes(`${addModule}::${t.key}`))
                  .map((t) => (
                    <SelectItem key={t.key} value={t.key}>{t.label}</SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="flex items-center gap-2">
          <Checkbox
            id="tab-visible"
            checked={addVisible}
            onCheckedChange={(checked) => setAddVisible(!!checked)}
          />
          <Label htmlFor="tab-visible" className="text-sm cursor-pointer">Visible</Label>
        </div>
        <Button
          className="w-full"
          onClick={() => addTabPerm.mutate()}
          disabled={addTabPerm.isPending || !addModule || !addTab}
        >
          {addTabPerm.isPending ? 'Adding...' : 'Add Tab Rule'}
        </Button>
      </DrawerForm>
    </div>
  );
}