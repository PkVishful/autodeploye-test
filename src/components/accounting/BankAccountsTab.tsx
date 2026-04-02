import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, Building2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import { DrawerForm } from '@/components/shared/DrawerForm';

export function BankAccountsTab() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const orgId = profile?.organization_id;

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editDrawerOpen, setEditDrawerOpen] = useState(false);

  const emptyForm = {
    bank_name: '', account_name: '', account_number: '', ifsc_code: '',
    branch: '', account_type: 'current', swift_code: '', upi_id: '',
    is_primary: false, notes: '',
  };
  const [form, setForm] = useState(emptyForm);
  const [editForm, setEditForm] = useState<any>({});

  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ['org_bank_accounts'],
    queryFn: async () => {
      const { data } = await supabase.from('organization_bank_accounts').select('*').order('is_primary', { ascending: false });
      return data || [];
    },
    enabled: !!orgId,
  });

  const createAccount = async () => {
    if (!form.bank_name || !form.account_number) { toast({ title: 'Bank name and account number required', variant: 'destructive' }); return; }
    const { error } = await supabase.from('organization_bank_accounts').insert({
      ...form, organization_id: orgId,
    } as any);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    qc.invalidateQueries({ queryKey: ['org_bank_accounts'] });
    setDrawerOpen(false);
    setForm(emptyForm);
    toast({ title: 'Bank account added' });
  };

  const updateAccount = async () => {
    const { id, created_at, organization_id, ...rest } = editForm;
    const { error } = await supabase.from('organization_bank_accounts').update(rest).eq('id', id);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    qc.invalidateQueries({ queryKey: ['org_bank_accounts'] });
    setEditDrawerOpen(false);
    toast({ title: 'Bank account updated' });
  };

  const deleteAccount = async (id: string) => {
    if (!confirm('Delete this bank account?')) return;
    const { error } = await supabase.from('organization_bank_accounts').delete().eq('id', id);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    qc.invalidateQueries({ queryKey: ['org_bank_accounts'] });
    toast({ title: 'Bank account deleted' });
  };

  const renderFormFields = (f: any, setF: (v: any) => void) => (
    <>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Bank Name *</Label><Input value={f.bank_name} onChange={(e) => setF({ ...f, bank_name: e.target.value })} /></div>
        <div><Label>Account Name</Label><Input value={f.account_name || ''} onChange={(e) => setF({ ...f, account_name: e.target.value })} /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Account Number *</Label><Input value={f.account_number} onChange={(e) => setF({ ...f, account_number: e.target.value })} /></div>
        <div><Label>IFSC Code</Label><Input value={f.ifsc_code || ''} onChange={(e) => setF({ ...f, ifsc_code: e.target.value })} /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Branch</Label><Input value={f.branch || ''} onChange={(e) => setF({ ...f, branch: e.target.value })} /></div>
        <div>
          <Label>Account Type</Label>
          <Select value={f.account_type || 'current'} onValueChange={(v) => setF({ ...f, account_type: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="current">Current</SelectItem>
              <SelectItem value="savings">Savings</SelectItem>
              <SelectItem value="cc">CC (Cash Credit)</SelectItem>
              <SelectItem value="od">OD (Overdraft)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>SWIFT Code</Label><Input value={f.swift_code || ''} onChange={(e) => setF({ ...f, swift_code: e.target.value })} /></div>
        <div><Label>UPI ID</Label><Input value={f.upi_id || ''} onChange={(e) => setF({ ...f, upi_id: e.target.value })} /></div>
      </div>
      <div className="flex items-center gap-2">
        <input type="checkbox" checked={f.is_primary || false} onChange={(e) => setF({ ...f, is_primary: e.target.checked })} className="rounded" />
        <Label>Set as Primary Account</Label>
      </div>
      <div><Label>Notes</Label><Textarea value={f.notes || ''} onChange={(e) => setF({ ...f, notes: e.target.value })} /></div>
    </>
  );

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">Manage organization bank accounts for payment reconciliation</p>
        <Button className="gap-2" onClick={() => setDrawerOpen(true)}><Plus className="h-4 w-4" /> Add Bank Account</Button>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Bank Name</TableHead>
              <TableHead>Account Name</TableHead>
              <TableHead>Account Number</TableHead>
              <TableHead>IFSC</TableHead>
              <TableHead>Branch</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>UPI ID</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {accounts.length === 0 ? (
              <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                <Building2 className="h-8 w-8 mx-auto mb-2 opacity-30" />No bank accounts added yet
              </TableCell></TableRow>
            ) : accounts.map((a: any) => (
              <TableRow key={a.id}>
                <TableCell className="font-medium">{a.bank_name}</TableCell>
                <TableCell className="text-xs">{a.account_name || '—'}</TableCell>
                <TableCell className="font-mono text-xs">{a.account_number}</TableCell>
                <TableCell className="text-xs">{a.ifsc_code || '—'}</TableCell>
                <TableCell className="text-xs">{a.branch || '—'}</TableCell>
                <TableCell className="text-xs capitalize">{a.account_type || '—'}</TableCell>
                <TableCell className="text-xs">{a.upi_id || '—'}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    {a.is_primary && <Badge className="text-xs">Primary</Badge>}
                    <Badge variant={a.status === 'active' ? 'default' : 'secondary'} className="text-xs capitalize">{a.status}</Badge>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { setEditForm(a); setEditDrawerOpen(true); }}><Pencil className="h-3 w-3" /></Button>
                    <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive" onClick={() => deleteAccount(a.id)}><Trash2 className="h-3 w-3" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <DrawerForm open={drawerOpen} onOpenChange={setDrawerOpen} title="Add Bank Account">
        {renderFormFields(form, setForm)}
        <Button className="w-full" onClick={createAccount}>Add Account</Button>
      </DrawerForm>

      <DrawerForm open={editDrawerOpen} onOpenChange={setEditDrawerOpen} title="Edit Bank Account">
        {renderFormFields(editForm, setEditForm)}
        <Button className="w-full" onClick={updateAccount}>Update Account</Button>
      </DrawerForm>
    </div>
  );
}
