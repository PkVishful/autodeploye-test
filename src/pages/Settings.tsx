import { useMemo, useState } from 'react';
import { Plus, Trash2, Pencil, Wrench, Sun, Moon, Palette } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllRows } from '@/lib/supabase-utils';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme, paletteOptions } from '@/contexts/ThemeContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import { DrawerForm } from '@/components/shared/DrawerForm';
import { useAuditLog } from '@/hooks/useAuditLog';
import RoleManagement from '@/components/settings/RoleManagement';
import UnifiedPermissions from '@/components/settings/UnifiedPermissions';
import { BankAccountsTab } from '@/components/accounting/BankAccountsTab';

export default function SettingsPage() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const orgId = profile?.organization_id;
  const { log: auditLog } = useAuditLog();
  const { theme, palette, toggleTheme, setPalette } = useTheme();

  // Issue Types
  const [issueOpen, setIssueOpen] = useState(false);
  const [editIssueOpen, setEditIssueOpen] = useState(false);
  const [issueForm, setIssueForm] = useState({ name: '', icon: '🔧', priority: 'medium', sla_hours: '24' });
  const [editIssueForm, setEditIssueForm] = useState<any>({});

  // Assignment Rules
  const [ruleOpen, setRuleOpen] = useState(false);
  const [editRuleOpen, setEditRuleOpen] = useState(false);
  const [ruleForm, setRuleForm] = useState({ rule_type: 'issue_type', issue_type_id: '', apartment_code: '', assigned_employee_id: '', priority: '0' });
  const [editRuleForm, setEditRuleForm] = useState<any>({});

  // Bed Types
  const [bedTypeOpen, setBedTypeOpen] = useState(false);
  const [bedTypeName, setBedTypeName] = useState('');

  const { data: issueTypes = [] } = useQuery({
    queryKey: ['issue_types'],
    queryFn: () => fetchAllRows((from, to) => supabase.from('issue_types').select('*').order('created_at').range(from, to)),
    enabled: !!orgId,
  });

  const { data: rules = [] } = useQuery({
    queryKey: ['ticket_assignment_rules'],
    queryFn: () => fetchAllRows((from, to) => supabase.from('ticket_assignment_rules').select('*').order('priority').range(from, to)),
    enabled: !!orgId,
  });

  const { data: teamMembers = [] } = useQuery({
    queryKey: ['team_members'],
    queryFn: () => fetchAllRows((from, to) => supabase.from('team_members').select('id, first_name, last_name').range(from, to)),
    enabled: !!orgId,
  });

  const { data: bedTypeConfig = [] } = useQuery({
    queryKey: ['bed_type_config'],
    queryFn: () => fetchAllRows((from, to) => supabase.from('bed_type_config' as any).select('*').order('sort_order').range(from, to)),
    enabled: !!orgId,
  });

  const issueTypeMap = useMemo(
    () => Object.fromEntries(issueTypes.map((issue: any) => [issue.id, issue])),
    [issueTypes]
  );

  const teamMemberMap = useMemo(
    () => Object.fromEntries(teamMembers.map((member: any) => [member.id, member])),
    [teamMembers]
  );

  // Issue Type CRUD
  const createIssueType = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.from('issue_types').insert({
        ...issueForm, sla_hours: parseInt(issueForm.sla_hours), organization_id: orgId,
      } as any).select('id').single();
      if (error) throw error;
      auditLog('issue_types', data.id, 'created', issueForm);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['issue_types'] }); setIssueOpen(false); setIssueForm({ name: '', icon: '🔧', priority: 'medium', sla_hours: '24' }); toast({ title: 'Issue type added' }); },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const updateIssueType = useMutation({
    mutationFn: async () => {
      const { id, created_at, organization_id, ...rest } = editIssueForm;
      const { error } = await supabase.from('issue_types').update({ ...rest, sla_hours: parseInt(rest.sla_hours) }).eq('id', id);
      if (error) throw error;
      auditLog('issue_types', id, 'updated', rest);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['issue_types'] }); setEditIssueOpen(false); toast({ title: 'Issue type updated' }); },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const deleteIssueType = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('issue_types').delete().eq('id', id);
      if (error) throw error;
      auditLog('issue_types', id, 'deleted');
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['issue_types'] }); toast({ title: 'Issue type deleted' }); },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  // Rule CRUD
  const createRule = useMutation({
    mutationFn: async () => {
      const payload = {
        ...ruleForm,
        priority: parseInt(ruleForm.priority),
        organization_id: orgId,
        issue_type_id: ruleForm.issue_type_id || null,
        apartment_code: ruleForm.apartment_code || null,
      };
      const { data, error } = await supabase.from('ticket_assignment_rules').insert(payload as any).select('id').single();
      if (error) throw error;
      auditLog('ticket_assignment_rules', data.id, 'created', payload);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ticket_assignment_rules'] }); setRuleOpen(false); toast({ title: 'Rule added' }); },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const updateRule = useMutation({
    mutationFn: async () => {
      const { id, created_at, organization_id, issue_types: _it, ...rest } = editRuleForm;
      const { error } = await supabase.from('ticket_assignment_rules').update({
        ...rest,
        priority: parseInt(rest.priority),
        issue_type_id: rest.issue_type_id || null,
        apartment_code: rest.apartment_code || null,
      }).eq('id', id);
      if (error) throw error;
      auditLog('ticket_assignment_rules', id, 'updated', rest);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ticket_assignment_rules'] }); setEditRuleOpen(false); toast({ title: 'Rule updated' }); },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const deleteRule = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('ticket_assignment_rules').delete().eq('id', id);
      if (error) throw error;
      auditLog('ticket_assignment_rules', id, 'deleted');
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ticket_assignment_rules'] }); toast({ title: 'Rule deleted' }); },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  // Bed Type CRUD
  const createBedType = useMutation({
    mutationFn: async () => {
      const nextOrder = bedTypeConfig.length;
      const { error } = await supabase.from('bed_type_config' as any).insert({
        name: bedTypeName, organization_id: orgId, sort_order: nextOrder,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['bed_type_config'] }); setBedTypeOpen(false); setBedTypeName(''); toast({ title: 'Bed type added' }); },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const deleteBedType = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('bed_type_config' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['bed_type_config'] }); toast({ title: 'Bed type deleted' }); },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const renderIssueFormFields = (f: any, setF: (v: any) => void) => (
    <>
      <div><Label>Name *</Label><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. AC Issues" /></div>
      <div><Label>Icon (emoji)</Label><Input value={f.icon} onChange={(e) => setF({ ...f, icon: e.target.value })} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Priority</Label>
          <Select value={f.priority} onValueChange={(v) => setF({ ...f, priority: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div><Label>SLA (hours)</Label><Input type="number" value={f.sla_hours} onChange={(e) => setF({ ...f, sla_hours: e.target.value })} /></div>
      </div>
    </>
  );

  const renderRuleFormFields = (f: any, setF: (v: any) => void) => (
    <>
      <div>
        <Label>Rule Type</Label>
        <Select value={f.rule_type} onValueChange={(v) => setF({ ...f, rule_type: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="issue_type">Issue-specific</SelectItem>
            <SelectItem value="apartment">Apartment-based</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {f.rule_type === 'issue_type' && (
        <div>
          <Label>Issue Type</Label>
          <Select value={f.issue_type_id || ''} onValueChange={(v) => setF({ ...f, issue_type_id: v })}>
            <SelectTrigger><SelectValue placeholder="Select issue type" /></SelectTrigger>
            <SelectContent>{issueTypes.map((i: any) => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      )}
      {f.rule_type === 'apartment' && (
        <div><Label>Apartment Code</Label><Input value={f.apartment_code || ''} onChange={(e) => setF({ ...f, apartment_code: e.target.value })} placeholder="e.g. A-101" /></div>
      )}
      <div>
        <Label>Assign To</Label>
        <Select value={f.assigned_employee_id || ''} onValueChange={(v) => setF({ ...f, assigned_employee_id: v })}>
          <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
          <SelectContent>
            {teamMembers.map((m: any) => <SelectItem key={m.id} value={m.id}>{m.first_name} {m.last_name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div><Label>Priority (lower = higher priority)</Label><Input type="number" value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value })} /></div>
    </>
  );

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold tracking-tight">Settings</h1><p className="text-sm text-muted-foreground mt-1">Configure roles, issue types, bed types, and assignment rules</p></div>

      <Tabs defaultValue="appearance">
        <TabsList className="flex-wrap">
          <TabsTrigger value="appearance">Appearance</TabsTrigger>
          <TabsTrigger value="roles">Role Assignment</TabsTrigger>
          <TabsTrigger value="permissions">Permissions</TabsTrigger>
          <TabsTrigger value="issue_types">Issue Types</TabsTrigger>
          <TabsTrigger value="rules">Assignment Rules</TabsTrigger>
          <TabsTrigger value="bed_types">Bed Types</TabsTrigger>
          <TabsTrigger value="bank_accounts">Bank Accounts</TabsTrigger>
        </TabsList>

        <TabsContent value="appearance" className="mt-4 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold">Theme Mode</h3>
              <p className="text-sm text-muted-foreground">Switch between light and dark mode</p>
            </div>
            <Button variant="outline" size="sm" className="gap-2" onClick={toggleTheme}>
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
            </Button>
          </div>

          <div>
            <h3 className="font-semibold mb-3">Color Palette</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
              {paletteOptions.map(opt => (
                <Card
                  key={opt.id}
                  className={`cursor-pointer transition-all hover:shadow-md ${palette === opt.id ? 'ring-2 ring-primary shadow-lg' : ''}`}
                  onClick={() => setPalette(opt.id)}
                >
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1">
                        {opt.previewColors.map((c, i) => (
                          <div key={i} className="h-6 w-6 rounded-full border border-border" style={{ backgroundColor: c }} />
                        ))}
                      </div>
                      {palette === opt.id && <Badge variant="default" className="ml-auto text-[10px]">Active</Badge>}
                    </div>
                    <div>
                      <p className="font-medium text-sm">{opt.label}</p>
                      <p className="text-[10px] text-muted-foreground">{opt.description}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          <div>
            <h3 className="font-semibold mb-3">Segment Preview</h3>
            <div className="space-y-3">
              <div className="flex gap-3">
                <div className="flex-1 bg-info-panel rounded-lg p-3 border border-border">
                  <p className="text-xs text-muted-foreground">Filter / Toolbar Area</p>
                  <p className="text-sm font-medium mt-1">--info-panel-bg</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="flex-1 bg-table-header rounded-lg p-3 border border-border">
                  <p className="text-xs text-muted-foreground">Table Header</p>
                  <p className="text-sm font-medium mt-1">--table-header-bg</p>
                </div>
                <div className="flex-1 bg-table-row-alt rounded-lg p-3 border border-border">
                  <p className="text-xs text-muted-foreground">Alternating Row</p>
                  <p className="text-sm font-medium mt-1">--table-row-alt-bg</p>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-3">
                <div className="bg-card-1 rounded-lg p-3 border border-border">
                  <p className="text-xs text-muted-foreground">Card 1</p>
                </div>
                <div className="bg-card-2 rounded-lg p-3 border border-border">
                  <p className="text-xs text-muted-foreground">Card 2</p>
                </div>
                <div className="bg-card-3 rounded-lg p-3 border border-border">
                  <p className="text-xs text-muted-foreground">Card 3</p>
                </div>
                <div className="bg-card-4 rounded-lg p-3 border border-border">
                  <p className="text-xs text-muted-foreground">Card 4</p>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="roles" className="mt-4">
          <RoleManagement />
        </TabsContent>

        <TabsContent value="permissions" className="mt-4">
          <UnifiedPermissions />
        </TabsContent>

        <TabsContent value="issue_types" className="space-y-4 mt-4">
          <div className="flex justify-end">
            <Button className="gap-2" onClick={() => setIssueOpen(true)}><Plus className="h-4 w-4" /> Add Issue Type</Button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {issueTypes.map((it: any) => (
              <Card key={it.id} className="hover:shadow-md transition-all group relative">
                <CardContent className="p-4 flex items-center gap-3">
                  <span className="text-2xl">{it.icon || '🔧'}</span>
                  <div className="flex-1">
                    <p className="font-medium text-sm">{it.name}</p>
                    <p className="text-[10px] text-muted-foreground">SLA: {it.sla_hours}h · {it.priority}</p>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100"><Pencil className="h-3.5 w-3.5" /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => { setEditIssueForm({ ...it, sla_hours: it.sla_hours?.toString() || '24' }); setEditIssueOpen(true); }}><Pencil className="h-4 w-4 mr-2" /> Edit</DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive" onClick={() => { if (confirm('Delete?')) deleteIssueType.mutate(it.id); }}><Trash2 className="h-4 w-4 mr-2" /> Delete</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="rules" className="space-y-4 mt-4">
          <div className="flex justify-end">
            <Button className="gap-2" onClick={() => setRuleOpen(true)}><Plus className="h-4 w-4" /> Add Rule</Button>
          </div>
          <Card>
            <Table>
              <TableHeader><TableRow><TableHead>Type</TableHead><TableHead>Criteria</TableHead><TableHead>Assigned To</TableHead><TableHead>Priority</TableHead><TableHead></TableHead></TableRow></TableHeader>
              <TableBody>
                {rules.length === 0 ? <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No rules configured</TableCell></TableRow> :
                  rules.map((r: any) => (
                    <TableRow key={r.id}>
                      <TableCell><Badge variant="secondary">{r.rule_type === 'issue_type' ? 'Issue' : 'Apartment'}</Badge></TableCell>
                      <TableCell>{r.rule_type === 'issue_type' ? (issueTypeMap[r.issue_type_id]?.name || 'Unknown issue type') : `Apartment ${r.apartment_code}`}</TableCell>
                      <TableCell>{teamMemberMap[r.assigned_employee_id] ? `${teamMemberMap[r.assigned_employee_id].first_name} ${teamMemberMap[r.assigned_employee_id].last_name || ''}`.trim() : 'Unknown'}</TableCell>
                      <TableCell>{r.priority}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7"><Pencil className="h-3.5 w-3.5" /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => { setEditRuleForm({ ...r, priority: r.priority?.toString() || '0' }); setEditRuleOpen(true); }}><Pencil className="h-4 w-4 mr-2" /> Edit</DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive" onClick={() => { if (confirm('Delete?')) deleteRule.mutate(r.id); }}><Trash2 className="h-4 w-4 mr-2" /> Delete</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="bed_types" className="space-y-4 mt-4">
          <div className="flex justify-end">
            <Button className="gap-2" onClick={() => setBedTypeOpen(true)}><Plus className="h-4 w-4" /> Add Bed Type</Button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {bedTypeConfig.length === 0 ? (
              <Card className="col-span-full p-8 text-center">
                <p className="text-sm text-muted-foreground">No custom bed types configured. Default types (Executive, Single, Double, Triple, Quad) are used.</p>
              </Card>
            ) : bedTypeConfig.map((bt: any) => (
              <Card key={bt.id} className="hover:shadow-md transition-all group relative">
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">{bt.name}</p>
                    <p className="text-[10px] text-muted-foreground">Order: {bt.sort_order}</p>
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 text-destructive" onClick={() => { if (confirm(`Delete bed type "${bt.name}"?`)) deleteBedType.mutate(bt.id); }}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="bank_accounts" className="mt-4">
          <BankAccountsTab />
        </TabsContent>
      </Tabs>

      {/* Drawers */}
      <DrawerForm open={issueOpen} onOpenChange={setIssueOpen} title="Add Issue Type">
        {renderIssueFormFields(issueForm, setIssueForm)}
        <Button className="w-full" onClick={() => createIssueType.mutate()} disabled={createIssueType.isPending}>Add</Button>
      </DrawerForm>

      <DrawerForm open={editIssueOpen} onOpenChange={setEditIssueOpen} title="Edit Issue Type">
        {renderIssueFormFields(editIssueForm, setEditIssueForm)}
        <Button className="w-full" onClick={() => updateIssueType.mutate()} disabled={updateIssueType.isPending}>Update</Button>
      </DrawerForm>

      <DrawerForm open={ruleOpen} onOpenChange={setRuleOpen} title="Add Assignment Rule">
        {renderRuleFormFields(ruleForm, setRuleForm)}
        <Button className="w-full" onClick={() => createRule.mutate()} disabled={createRule.isPending}>Add Rule</Button>
      </DrawerForm>

      <DrawerForm open={editRuleOpen} onOpenChange={setEditRuleOpen} title="Edit Assignment Rule">
        {renderRuleFormFields(editRuleForm, setEditRuleForm)}
        <Button className="w-full" onClick={() => updateRule.mutate()} disabled={updateRule.isPending}>Update Rule</Button>
      </DrawerForm>

      <DrawerForm open={bedTypeOpen} onOpenChange={setBedTypeOpen} title="Add Bed Type">
        <div><Label>Bed Type Name *</Label><Input value={bedTypeName} onChange={(e) => setBedTypeName(e.target.value)} placeholder="e.g. Executive" /></div>
        <Button className="w-full" onClick={() => createBedType.mutate()} disabled={createBedType.isPending || !bedTypeName.trim()}>Add Bed Type</Button>
      </DrawerForm>
    </div>
  );
}
