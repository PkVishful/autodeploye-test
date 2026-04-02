import { useState } from 'react';
import { Lock, Plus, Pencil, Trash2, ShieldCheck } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import { DrawerForm } from '@/components/shared/DrawerForm';
import { ROLE_LABELS, type AppRole } from '@/hooks/useRBAC';

const ALL_ROLES: AppRole[] = ['super_admin', 'org_admin', 'property_manager', 'employee', 'technician', 'tenant'];

const MODULES = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'properties', label: 'Properties' },
  { key: 'owners', label: 'Owners' },
  { key: 'tenants', label: 'Tenants' },
  { key: 'assets', label: 'Assets' },
  { key: 'tickets', label: 'Tickets' },
  { key: 'accounting', label: 'Accounting' },
  { key: 'electricity', label: 'Electricity' },
  { key: 'reports', label: 'Reports' },
  { key: 'team', label: 'Team' },
  { key: 'audit_logs', label: 'Audit Logs' },
  { key: 'settings', label: 'Settings' },
  { key: 'tenant_lifecycle', label: 'Tenant Lifecycle' },
];

const ROLE_COLORS: Record<string, string> = {
  super_admin: 'bg-destructive/10 text-destructive',
  org_admin: 'bg-primary/10 text-primary',
  property_manager: 'bg-blue-500/10 text-blue-600',
  employee: 'bg-green-500/10 text-green-600',
  technician: 'bg-orange-500/10 text-orange-600',
  tenant: 'bg-muted text-muted-foreground',
};

export default function PermissionManagement() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const orgId = profile?.organization_id;
  const [selectedRole, setSelectedRole] = useState<string>('super_admin');
  const [addOpen, setAddOpen] = useState(false);
  const [addModule, setAddModule] = useState('');
  const [addPerms, setAddPerms] = useState({ can_create: false, can_read: true, can_update: false, can_delete: false });

  const { data: permissions = [], isLoading } = useQuery({
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

  const rolePermissions = permissions.filter((p: any) => p.role === selectedRole);

  const updatePermission = useMutation({
    mutationFn: async ({ id, field, value }: { id: string; field: string; value: boolean }) => {
      const { error } = await supabase
        .from('role_permissions')
        .update({ [field]: value, updated_at: new Date().toISOString() } as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['role_permissions'] });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const addPermission = useMutation({
    mutationFn: async () => {
      if (!addModule) throw new Error('Select a module');
      const existing = permissions.find((p: any) => p.role === selectedRole && p.module === addModule);
      if (existing) throw new Error('Permission already exists for this role and module');

      const { error } = await supabase.from('role_permissions').insert({
        organization_id: orgId,
        role: selectedRole,
        module: addModule,
        ...addPerms,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['role_permissions'] });
      setAddOpen(false);
      setAddModule('');
      setAddPerms({ can_create: false, can_read: true, can_update: false, can_delete: false });
      toast({ title: 'Permission added' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const deletePermission = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('role_permissions').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['role_permissions'] });
      toast({ title: 'Permission removed' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const existingModules = rolePermissions.map((p: any) => p.module);
  const availableModules = MODULES.filter(m => !existingModules.includes(m.key));

  const getModuleLabel = (key: string) => MODULES.find(m => m.key === key)?.label || key;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Lock className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Permission Management</h3>
        </div>
      </div>

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
            {rolePermissions.length} module{rolePermissions.length !== 1 ? 's' : ''} configured
          </span>
        </div>
        {availableModules.length > 0 && (
          <Button size="sm" className="gap-2" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" /> Add Module Access
          </Button>
        )}
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Module</TableHead>
              <TableHead className="text-center w-24">Create</TableHead>
              <TableHead className="text-center w-24">Read</TableHead>
              <TableHead className="text-center w-24">Update</TableHead>
              <TableHead className="text-center w-24">Delete</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rolePermissions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  No permissions configured for this role
                </TableCell>
              </TableRow>
            ) : (
              rolePermissions.map((p: any) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{getModuleLabel(p.module)}</TableCell>
                  {(['can_create', 'can_read', 'can_update', 'can_delete'] as const).map((field) => (
                    <TableCell key={field} className="text-center">
                      <Checkbox
                        checked={p[field]}
                        onCheckedChange={(checked) =>
                          updatePermission.mutate({ id: p.id, field, value: !!checked })
                        }
                      />
                    </TableCell>
                  ))}
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => {
                        if (confirm(`Remove ${getModuleLabel(p.module)} access for ${ROLE_LABELS[selectedRole as AppRole]}?`)) {
                          deletePermission.mutate(p.id);
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

      <DrawerForm open={addOpen} onOpenChange={setAddOpen} title="Add Module Permission">
        <div>
          <Label>Module</Label>
          <Select value={addModule} onValueChange={setAddModule}>
            <SelectTrigger><SelectValue placeholder="Select module" /></SelectTrigger>
            <SelectContent>
              {availableModules.map((m) => (
                <SelectItem key={m.key} value={m.key}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-3">
          <Label>Permissions</Label>
          <div className="grid grid-cols-2 gap-3">
            {([
              { key: 'can_create', label: 'Create' },
              { key: 'can_read', label: 'Read' },
              { key: 'can_update', label: 'Update' },
              { key: 'can_delete', label: 'Delete' },
            ] as const).map(({ key, label }) => (
              <div key={key} className="flex items-center gap-2">
                <Checkbox
                  id={key}
                  checked={addPerms[key]}
                  onCheckedChange={(checked) => setAddPerms(prev => ({ ...prev, [key]: !!checked }))}
                />
                <Label htmlFor={key} className="text-sm cursor-pointer">{label}</Label>
              </div>
            ))}
          </div>
        </div>
        <Button
          className="w-full"
          onClick={() => addPermission.mutate()}
          disabled={addPermission.isPending || !addModule}
        >
          {addPermission.isPending ? 'Adding...' : 'Add Permission'}
        </Button>
      </DrawerForm>
    </div>
  );
}
