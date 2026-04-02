import { useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTicketRole } from '@/hooks/useTicketRole';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllRows } from '@/lib/supabase-utils';
import { toast } from '@/hooks/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Plus, Calendar, RotateCw, Pause, Play, Trash2, Shield } from 'lucide-react';
import { format } from 'date-fns';

const MAINTENANCE_TYPES = ['Cleaning', 'Replacement', 'Service'] as const;
const FREQUENCIES = ['Monthly', 'Bi-Monthly', 'Quarterly', 'Half-Yearly', 'Yearly'] as const;

const FREQUENCY_LABELS: Record<string, string> = {
  'Monthly': 'Every Month',
  'Bi-Monthly': 'Every 2 Months',
  'Quarterly': 'Every 3 Months',
  'Half-Yearly': 'Every 6 Months',
  'Yearly': 'Every Year',
};

export function RegularMaintenanceTab() {
  const { profile, user } = useAuth();
  const { isAdmin } = useTicketRole();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    issue_type_id: '',
    maintenance_type: '',
    frequency: '',
    asset_type_id: '',
    property_id: '',
    apartment_id: '',
    start_date: '',
    auto_assign: true,
  });

  const orgId = profile?.organization_id;

  // Queries
  const { data: rules = [], isLoading } = useQuery({
    queryKey: ['regular_maintenance_rules', orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('regular_maintenance_rules' as any)
        .select('*')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!orgId,
  });

  const { data: issueTypes = [] } = useQuery({
    queryKey: ['issue_types'],
    queryFn: () => fetchAllRows((from, to) => supabase.from('issue_types').select('*').range(from, to)),
    enabled: !!orgId,
  });

  const { data: assetTypes = [] } = useQuery({
    queryKey: ['asset_types_for_rules'],
    queryFn: () => fetchAllRows((from, to) =>
      supabase.from('asset_types').select('id, name, category_id').range(from, to)
    ),
    enabled: !!orgId,
  });

  const { data: assetCategories = [] } = useQuery({
    queryKey: ['asset_categories_for_rules'],
    queryFn: () => fetchAllRows((from, to) =>
      supabase.from('asset_categories').select('id, name').range(from, to)
    ),
    enabled: !!orgId,
  });

  const { data: properties = [] } = useQuery({
    queryKey: ['properties_for_rules'],
    queryFn: () => fetchAllRows((from, to) =>
      supabase.from('properties').select('id, property_name').eq('status', 'Live').range(from, to)
    ),
    enabled: !!orgId,
  });

  const { data: apartments = [] } = useQuery({
    queryKey: ['apartments_for_rules', form.property_id],
    queryFn: () => fetchAllRows((from, to) =>
      supabase.from('apartments').select('id, apartment_code, property_id')
        .eq('property_id', form.property_id).range(from, to)
    ),
    enabled: !!orgId && !!form.property_id,
  });

  // Lookup maps
  const issueTypeMap = useMemo(() => new Map(issueTypes.map((i: any) => [i.id, i.name])), [issueTypes]);
  const assetTypeMap = useMemo(() => new Map(assetTypes.map((a: any) => [a.id, a.name])), [assetTypes]);
  const propertyMap = useMemo(() => new Map(properties.map((p: any) => [p.id, p.property_name])), [properties]);

  // Create rule
  const createRule = useMutation({
    mutationFn: async () => {
      if (!form.issue_type_id || !form.maintenance_type || !form.frequency || !form.start_date) {
        throw new Error('Please fill all required fields');
      }

      const startDate = new Date(form.start_date);
      const nextRun = startDate <= new Date() ? new Date() : startDate;

      const insertData: any = {
        organization_id: orgId,
        issue_type_id: form.issue_type_id,
        maintenance_type: form.maintenance_type,
        frequency: form.frequency,
        asset_type_id: form.asset_type_id || null,
        property_id: form.property_id || null,
        apartment_id: form.apartment_id || null,
        start_date: form.start_date,
        next_run_at: nextRun.toISOString(),
        auto_assign: form.auto_assign,
        created_by: user?.id || null,
        is_active: true,
      };

      const { error } = await supabase.from('regular_maintenance_rules' as any).insert(insertData);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Rule created', description: 'Regular maintenance rule has been added.' });
      queryClient.invalidateQueries({ queryKey: ['regular_maintenance_rules'] });
      setOpen(false);
      setForm({ issue_type_id: '', maintenance_type: '', frequency: '', asset_type_id: '', property_id: '', apartment_id: '', start_date: '', auto_assign: true });
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  // Toggle active
  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('regular_maintenance_rules' as any)
        .update({ is_active } as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['regular_maintenance_rules'] });
      toast({ title: 'Rule updated' });
    },
  });

  // Delete rule
  const deleteRule = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('regular_maintenance_rules' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['regular_maintenance_rules'] });
      toast({ title: 'Rule deleted' });
    },
  });

  // Non-admin: read-only view
  if (!isAdmin) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Shield className="h-4 w-4" />
          <p className="text-sm">You have read-only access to regular maintenance rules.</p>
        </div>
        <RulesTable
          rules={rules}
          issueTypeMap={issueTypeMap}
          assetTypeMap={assetTypeMap}
          propertyMap={propertyMap}
          isLoading={isLoading}
          isAdmin={false}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Regular Maintenance Rules</h2>
          <p className="text-sm text-muted-foreground">Define recurring maintenance schedules for automatic ticket generation</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" /> New Rule</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Create Maintenance Rule</DialogTitle>
              <DialogDescription>Set up a recurring maintenance schedule. Tickets will be generated automatically.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-2 max-h-[70vh] overflow-y-auto">
              {/* Issue Category */}
              <div className="space-y-1.5">
                <Label>Issue Category *</Label>
                <Select value={form.issue_type_id} onValueChange={v => setForm(f => ({ ...f, issue_type_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select issue type" /></SelectTrigger>
                  <SelectContent>
                    {issueTypes.map((i: any) => (
                      <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Maintenance Type */}
              <div className="space-y-1.5">
                <Label>Maintenance Type *</Label>
                <Select value={form.maintenance_type} onValueChange={v => setForm(f => ({ ...f, maintenance_type: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                  <SelectContent>
                    {MAINTENANCE_TYPES.map(t => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Frequency */}
              <div className="space-y-1.5">
                <Label>Frequency *</Label>
                <Select value={form.frequency} onValueChange={v => setForm(f => ({ ...f, frequency: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select frequency" /></SelectTrigger>
                  <SelectContent>
                    {FREQUENCIES.map(f => (
                      <SelectItem key={f} value={f}>{f} ({FREQUENCY_LABELS[f]})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Asset Scope */}
              <div className="space-y-1.5">
                <Label>Asset Type (optional)</Label>
                <Select value={form.asset_type_id} onValueChange={v => setForm(f => ({ ...f, asset_type_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="All asset types" /></SelectTrigger>
                  <SelectContent>
                    {assetTypes.map((a: any) => {
                      const cat = assetCategories.find((c: any) => c.id === a.category_id);
                      return (
                        <SelectItem key={a.id} value={a.id}>
                          {cat ? `${cat.name} → ` : ''}{a.name}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              {/* Property Scope */}
              <div className="space-y-1.5">
                <Label>Property (optional)</Label>
                <Select value={form.property_id} onValueChange={v => setForm(f => ({ ...f, property_id: v, apartment_id: '' }))}>
                  <SelectTrigger><SelectValue placeholder="All properties" /></SelectTrigger>
                  <SelectContent>
                    {properties.map((p: any) => (
                      <SelectItem key={p.id} value={p.id}>{p.property_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Apartment Scope */}
              {form.property_id && (
                <div className="space-y-1.5">
                  <Label>Apartment (optional)</Label>
                  <Select value={form.apartment_id} onValueChange={v => setForm(f => ({ ...f, apartment_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="All apartments" /></SelectTrigger>
                    <SelectContent>
                      {apartments.map((a: any) => (
                        <SelectItem key={a.id} value={a.id}>{a.apartment_code}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Start Date */}
              <div className="space-y-1.5">
                <Label>Start Date *</Label>
                <Input
                  type="date"
                  value={form.start_date}
                  onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
                />
              </div>

              {/* Auto-Assign */}
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <Label>Auto-Assign</Label>
                  <p className="text-xs text-muted-foreground">Automatically assign tickets using existing assignment rules</p>
                </div>
                <Switch
                  checked={form.auto_assign}
                  onCheckedChange={v => setForm(f => ({ ...f, auto_assign: v }))}
                />
              </div>

              <Button
                className="w-full"
                onClick={() => createRule.mutate()}
                disabled={createRule.isPending || !form.issue_type_id || !form.maintenance_type || !form.frequency || !form.start_date}
              >
                {createRule.isPending ? 'Creating...' : 'Create Rule'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <RulesTable
        rules={rules}
        issueTypeMap={issueTypeMap}
        assetTypeMap={assetTypeMap}
        propertyMap={propertyMap}
        isLoading={isLoading}
        isAdmin={true}
        onToggle={(id, active) => toggleActive.mutate({ id, is_active: active })}
        onDelete={(id) => deleteRule.mutate(id)}
      />
    </div>
  );
}

// Extracted table component
function RulesTable({
  rules, issueTypeMap, assetTypeMap, propertyMap, isLoading, isAdmin,
  onToggle, onDelete,
}: {
  rules: any[];
  issueTypeMap: Map<string, string>;
  assetTypeMap: Map<string, string>;
  propertyMap: Map<string, string>;
  isLoading: boolean;
  isAdmin: boolean;
  onToggle?: (id: string, active: boolean) => void;
  onDelete?: (id: string) => void;
}) {
  if (isLoading) {
    return <Card><CardContent className="p-8 text-center text-muted-foreground">Loading rules...</CardContent></Card>;
  }

  if (rules.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <RotateCw className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">No regular maintenance rules defined yet.</p>
          {isAdmin && <p className="text-xs text-muted-foreground mt-1">Create your first rule to automate recurring maintenance tickets.</p>}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Issue Type</TableHead>
            <TableHead>Maint. Type</TableHead>
            <TableHead>Frequency</TableHead>
            <TableHead>Asset Type</TableHead>
            <TableHead>Property</TableHead>
            <TableHead>Next Run</TableHead>
            <TableHead>Status</TableHead>
            {isAdmin && <TableHead className="w-[100px]">Actions</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rules.map((rule: any) => (
            <TableRow key={rule.id}>
              <TableCell className="font-medium text-sm">{issueTypeMap.get(rule.issue_type_id) || '—'}</TableCell>
              <TableCell className="text-sm">{rule.maintenance_type}</TableCell>
              <TableCell className="text-sm">{rule.frequency}</TableCell>
              <TableCell className="text-sm">{assetTypeMap.get(rule.asset_type_id) || 'All'}</TableCell>
              <TableCell className="text-sm">{propertyMap.get(rule.property_id) || 'All'}</TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {rule.next_run_at ? format(new Date(rule.next_run_at), 'dd MMM yyyy') : '—'}
              </TableCell>
              <TableCell>
                <StatusBadge status={rule.is_active ? 'Live' : 'inactive'} type="entity" />
              </TableCell>
              {isAdmin && (
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => onToggle?.(rule.id, !rule.is_active)}
                      title={rule.is_active ? 'Pause' : 'Activate'}
                    >
                      {rule.is_active ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive"
                      onClick={() => onDelete?.(rule.id)}
                      title="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}
