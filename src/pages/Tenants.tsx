import { useState } from 'react';
import { Users, Plus, Search, UserCheck, UserX } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import { DatePickerField } from '@/components/shared/DatePickerField';
import { SortableTableHead, useSort } from '@/components/shared/SortableTableHead';
import { NameGenderFields } from '@/components/shared/NameGenderFields';
import { useServerPagination } from '@/hooks/useServerPagination';
import { TablePagination } from '@/components/shared/TablePagination';
import { Skeleton } from '@/components/ui/skeleton';

export default function Tenants() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const { sortConfig, handleSort, sortData } = useSort();
  const [form, setForm] = useState({
    first_name: '', last_name: '', gender: '',
    phone: '', email: '', date_of_birth: '',
    id_proof_type: '', id_proof_number: '', permanent_address: '',
    company_name: '', company_address: '', designation: '',
    emergency_contact_name: '', emergency_contact_phone: '',
  });

  const { data: tenants, isLoading, page, setPage, totalPages, totalCount, pageSize } = useServerPagination({
    table: 'tenants',
    select: 'id, first_name, last_name, full_name, phone, email, staying_status, kyc_completed',
    pageSize: 25,
    filters: [{ column: 'staying_status', value: statusFilter }],
    searchColumns: ['full_name', 'phone', 'email'],
    searchTerm: search,
    orderBy: { column: 'created_at', ascending: false },
    enabled: !!profile?.organization_id,
    queryKey: ['tenants-page', statusFilter],
  });

  const createTenant = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('tenants').insert({
        first_name: form.first_name,
        last_name: form.last_name,
        full_name: `${form.first_name} ${form.last_name}`.trim(),
        phone: form.phone,
        email: form.email || null,
        gender: form.gender || null,
        date_of_birth: form.date_of_birth || null,
        id_proof_type: form.id_proof_type || null,
        id_proof_number: form.id_proof_number || null,
        permanent_address: form.permanent_address || null,
        company_name: form.company_name || null,
        company_address: form.company_address || null,
        designation: form.designation || null,
        emergency_contact_name: form.emergency_contact_name || null,
        emergency_contact_phone: form.emergency_contact_phone || null,
        organization_id: profile.organization_id,
        kyc_completed: true,
        staying_status: 'new',
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['paginated', 'tenants'] });
      setOpen(false);
      setForm({
        first_name: '', last_name: '', gender: '',
        phone: '', email: '', date_of_birth: '',
        id_proof_type: '', id_proof_number: '', permanent_address: '',
        company_name: '', company_address: '', designation: '',
        emergency_contact_name: '', emergency_contact_phone: '',
      });
      toast({ title: 'Tenant added' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const sortedTenants = sortData(tenants);

  const getStayingStatusBadge = (status: string) => {
    const map: Record<string, { label: string; className: string }> = {
      new: { label: 'New', className: 'bg-blue-100 text-blue-700' },
      booked: { label: 'Booked', className: 'bg-yellow-100 text-yellow-700' },
      staying: { label: 'Staying', className: 'bg-green-100 text-green-700' },
      'on-notice': { label: 'On Notice', className: 'bg-orange-100 text-orange-700' },
      exited: { label: 'Exited', className: 'bg-red-100 text-red-700' },
    };
    const s = map[status] || { label: status, className: 'bg-muted text-muted-foreground' };
    return <Badge className={`text-[10px] ${s.className}`}>{s.label}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tenants</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage tenant KYC records</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search tenants..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="new">New</SelectItem>
            <SelectItem value="booked">Booked</SelectItem>
            <SelectItem value="staying">Staying</SelectItem>
            <SelectItem value="on-notice">On Notice</SelectItem>
            <SelectItem value="exited">Exited</SelectItem>
          </SelectContent>
        </Select>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button className="gap-2"><Plus className="h-4 w-4" /> Add Tenant</Button></DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Tenant KYC</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-4">
              <NameGenderFields
                firstName={form.first_name}
                lastName={form.last_name}
                gender={form.gender}
                onFirstNameChange={(v) => setForm({ ...form, first_name: v })}
                onLastNameChange={(v) => setForm({ ...form, last_name: v })}
                onGenderChange={(v) => setForm({ ...form, gender: v })}
              />
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Phone *</Label><Input value={form.phone} onChange={(e) => setForm({...form, phone: e.target.value})} /></div>
                <div><Label>Email</Label><Input value={form.email} onChange={(e) => setForm({...form, email: e.target.value})} /></div>
                <DatePickerField label="Date of Birth" value={form.date_of_birth} onChange={(v) => setForm({...form, date_of_birth: v})} />
                <div><Label>ID Proof Type</Label><Input placeholder="Aadhar/PAN/Passport" value={form.id_proof_type} onChange={(e) => setForm({...form, id_proof_type: e.target.value})} /></div>
                <div><Label>ID Proof Number</Label><Input value={form.id_proof_number} onChange={(e) => setForm({...form, id_proof_number: e.target.value})} /></div>
                <div className="col-span-2"><Label>Permanent Address</Label><Input value={form.permanent_address} onChange={(e) => setForm({...form, permanent_address: e.target.value})} /></div>
                <div><Label>Company Name</Label><Input value={form.company_name} onChange={(e) => setForm({...form, company_name: e.target.value})} /></div>
                <div><Label>Designation</Label><Input value={form.designation} onChange={(e) => setForm({...form, designation: e.target.value})} /></div>
                <div className="col-span-2"><Label>Company Address</Label><Input value={form.company_address} onChange={(e) => setForm({...form, company_address: e.target.value})} /></div>
                <div><Label>Emergency Contact</Label><Input value={form.emergency_contact_name} onChange={(e) => setForm({...form, emergency_contact_name: e.target.value})} /></div>
                <div><Label>Emergency Phone</Label><Input value={form.emergency_contact_phone} onChange={(e) => setForm({...form, emergency_contact_phone: e.target.value})} /></div>
              </div>
              <Button className="w-full" onClick={() => createTenant.mutate()} disabled={createTenant.isPending || !form.first_name.trim() || !form.phone.trim()}>Save Tenant KYC</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <SortableTableHead label="First Name" sortKey="first_name" sortConfig={sortConfig} onSort={handleSort} />
              <SortableTableHead label="Last Name" sortKey="last_name" sortConfig={sortConfig} onSort={handleSort} />
              <SortableTableHead label="Phone" sortKey="phone" sortConfig={sortConfig} onSort={handleSort} />
              <SortableTableHead label="Email" sortKey="email" sortConfig={sortConfig} onSort={handleSort} />
              <TableHead>Status</TableHead>
              <TableHead>KYC</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, r) => (
                <TableRow key={r}>{Array.from({ length: 6 }).map((_, c) => <TableCell key={c}><Skeleton className="h-4 w-full" /></TableCell>)}</TableRow>
              ))
            ) : sortedTenants.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No tenants</TableCell></TableRow>
            ) : sortedTenants.map((t: any) => (
              <TableRow key={t.id}>
                <TableCell className="font-medium">{t.first_name || t.full_name?.split(' ')[0] || '—'}</TableCell>
                <TableCell>{t.last_name || t.full_name?.split(' ').slice(1).join(' ') || '—'}</TableCell>
                <TableCell>{t.phone}</TableCell>
                <TableCell>{t.email || '—'}</TableCell>
                <TableCell>{getStayingStatusBadge(t.staying_status || 'new')}</TableCell>
                <TableCell>{t.kyc_completed ? <UserCheck className="h-4 w-4 text-green-600" /> : <UserX className="h-4 w-4 text-destructive" />}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <TablePagination page={page} totalPages={totalPages} totalCount={totalCount} pageSize={pageSize} setPage={setPage} isLoading={isLoading} />
      </Card>
    </div>
  );
}
