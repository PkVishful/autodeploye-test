import { useState, useEffect, useMemo } from 'react';
import { Users, Plus, Search, Pencil, Trash2, MoreHorizontal, Calendar, IndianRupee, BarChart3, Tag } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllRows } from '@/lib/supabase-utils';
import { useServerPagination } from '@/hooks/useServerPagination';
import { TablePagination } from '@/components/shared/TablePagination';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import { motion } from 'framer-motion';
import { DrawerForm } from '@/components/shared/DrawerForm';
import { NameGenderFields } from '@/components/shared/NameGenderFields';
import { PhoneEmailFields, validatePhone, validateEmail } from '@/components/shared/PhoneEmailFields';
import { StateSelect } from '@/components/shared/StateSelect';
import { CitySelect } from '@/components/shared/CitySelect';
import { FileUploadField } from '@/components/shared/FileUploadField';
import { DatePickerField } from '@/components/shared/DatePickerField';
import { format } from 'date-fns';
import { useAuditLog } from '@/hooks/useAuditLog';
import { ROLE_LABELS, type AppRole } from '@/hooks/useRBAC';
import { CardGridSkeleton } from '@/components/shared/SkeletonLoaders';
const fmtDate = (d: string | null) => {
  if (!d) return '—';
  try { return format(new Date(d), 'dd-MMM-yy'); } catch { return d; }
};

export default function Team() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const orgId = profile?.organization_id;
  const { log: auditLog } = useAuditLog();

  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [attendanceOpen, setAttendanceOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedMember, setSelectedMember] = useState<any>(null);

  const SPECIALIZATIONS = ['Technician', 'Plumbing', 'IT Support', 'Application Tech', 'Housekeeping', 'Software', 'AC Technician'];
  const [selectedSpecs, setSelectedSpecs] = useState<string[]>([]);
  const [editSpecs, setEditSpecs] = useState<string[]>([]);

  const emptyForm = {
    first_name: '', last_name: '', gender: '', phone: '', email: '',
    date_of_birth: '', designation: '', department: '', joining_date: '',
    id_proof_type: '', id_proof_number: '', id_proof_url: '', photo_url: '',
    pan_number: '', aadhar_number: '', address: '', city: '', state: '', pincode: '',
    bank_name: '', bank_account_number: '', bank_ifsc: '',
    emergency_contact_name: '', emergency_contact_phone: '',
    salary_amount: '',
  };
  const [form, setForm] = useState(emptyForm);
  const [editForm, setEditForm] = useState<any>({});

  const emptyPaymentForm = { payment_type: 'salary', amount: '', payment_date: '', payment_month: '', payment_mode: 'bank_transfer', notes: '' };
  const [paymentForm, setPaymentForm] = useState(emptyPaymentForm);

  const emptyAttForm = { date: '', status: 'present', check_in: '', check_out: '', notes: '' };
  const [attForm, setAttForm] = useState(emptyAttForm);

  const { data: rawMembers, isLoading, page, setPage, totalPages, totalCount, pageSize } = useServerPagination({
    table: 'team_members',
    select: '*',
    pageSize: 25,
    searchColumns: ['first_name', 'last_name', 'phone'],
    searchTerm: search,
    orderBy: { column: 'created_at', ascending: false },
    enabled: !!orgId,
    queryKey: ['team-page'],
  });

  // Enrich with roles
  const { data: roleData = [] } = useQuery({
    queryKey: ['team-roles', rawMembers.map((m: any) => m.user_id).filter(Boolean)],
    queryFn: async () => {
      const userIds = rawMembers.filter((m: any) => m.user_id).map((m: any) => m.user_id);
      if (!userIds.length) return [];
      const { data } = await supabase.from('user_roles').select('user_id, role').in('user_id', userIds);
      return data || [];
    },
    enabled: rawMembers.length > 0,
  });

  const members = useMemo(() => {
    const rolesMap: Record<string, string> = {};
    roleData.forEach((r: any) => { rolesMap[r.user_id] = r.role; });
    return rawMembers.map((m: any) => ({ ...m, _role: m.user_id ? rolesMap[m.user_id] || '' : '' }));
  }, [rawMembers, roleData]);

  const { data: payments = [] } = useQuery({
    queryKey: ['team_payments', selectedMember?.id],
    queryFn: () => fetchAllRows((from, to) => supabase.from('team_payments').select('*').eq('team_member_id', selectedMember.id).order('payment_date', { ascending: false }).range(from, to)),
    enabled: !!selectedMember?.id,
  });

  const { data: attendance = [] } = useQuery({
    queryKey: ['team_attendance', selectedMember?.id],
    queryFn: () => fetchAllRows((from, to) => supabase.from('team_attendance').select('*').eq('team_member_id', selectedMember.id).order('date', { ascending: false }).range(from, to)),
    enabled: !!selectedMember?.id,
  });

  const { data: tickets = [] } = useQuery({
    queryKey: ['member_tickets', selectedMember?.user_id],
    queryFn: () => fetchAllRows((from, to) => supabase.from('maintenance_tickets').select('status, priority, created_at, resolved_at').eq('assigned_to', selectedMember.user_id).range(from, to)),
    enabled: !!selectedMember?.user_id,
  });

  // Fetch specialties for selected member
  const { data: memberSpecialties = [] } = useQuery({
    queryKey: ['member_specialties', selectedMember?.user_id],
    queryFn: async () => {
      if (!selectedMember?.user_id) return [];
      const { data } = await supabase.from('employee_specialties').select('specialty').eq('user_id', selectedMember.user_id);
      return data?.map((s: any) => s.specialty) || [];
    },
    enabled: !!selectedMember?.user_id,
  });

  const validate = (f: any) => {
    if (!f.first_name?.trim() || !f.last_name?.trim()) { toast({ title: 'First and Last name required', variant: 'destructive' }); return false; }
    if (validatePhone(f.phone)) { toast({ title: 'Phone must be 10 digits', variant: 'destructive' }); return false; }
    if (validateEmail(f.email)) { toast({ title: 'Invalid email', variant: 'destructive' }); return false; }
    return true;
  };


  const createMember = useMutation({
    mutationFn: async () => {
      if (!validate(form)) throw new Error('Validation failed');
      const { salary_amount, date_of_birth, joining_date, ...rest } = form;
      let linkedUserId: string | null = null;

      if (rest.email?.trim()) {
        const { data: linkedProfile } = await supabase
          .from('profiles')
          .select('id')
          .eq('email', rest.email.trim())
          .maybeSingle();
        linkedUserId = linkedProfile?.id || null;
      }

      const { data, error } = await supabase.from('team_members').insert({
        ...rest,
        user_id: linkedUserId,
        salary_amount: salary_amount ? parseFloat(salary_amount) : 0,
        date_of_birth: date_of_birth || null,
        joining_date: joining_date || null,
        organization_id: orgId,
      } as any).select('id').single();
      if (error) throw error;

      auditLog('team_members', data.id, 'created', rest);

      // Save specializations
      if (selectedSpecs.length > 0 && data.id) {
        if (linkedUserId) {
          const specInserts = selectedSpecs.map(s => ({ user_id: linkedUserId, specialty: s }));
          await supabase.from('employee_specialties').insert(specInserts);
        }
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['team_members'] }); setOpen(false); setForm(emptyForm); setSelectedSpecs([]); toast({ title: 'Team member added' }); },
    onError: (e: any) => { if (e.message !== 'Validation failed') toast({ title: 'Error', description: e.message, variant: 'destructive' }); },
  });

  const updateMember = useMutation({
    mutationFn: async () => {
      if (!validate(editForm)) throw new Error('Validation failed');
      const { id, created_at, organization_id, user_id, salary_amount, date_of_birth, joining_date, _role, ...rest } = editForm;
      let linkedUserId = user_id || null;

      if (rest.email?.trim()) {
        const { data: linkedProfile } = await supabase
          .from('profiles')
          .select('id')
          .eq('email', rest.email.trim())
          .maybeSingle();
        linkedUserId = linkedProfile?.id || linkedUserId;
      }

      const { error } = await supabase.from('team_members').update({
        ...rest,
        user_id: linkedUserId,
        salary_amount: salary_amount ? parseFloat(salary_amount) : 0,
        date_of_birth: date_of_birth || null,
        joining_date: joining_date || null,
      }).eq('id', id);
      if (error) throw error;

      auditLog('team_members', id, 'updated', rest);

      // Update specializations
      if (linkedUserId) {
        await supabase.from('employee_specialties').delete().eq('user_id', linkedUserId);
        if (editSpecs.length > 0) {
          const specInserts = editSpecs.map(s => ({ user_id: linkedUserId, specialty: s }));
          await supabase.from('employee_specialties').insert(specInserts);
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['team_members'] });
      qc.invalidateQueries({ queryKey: ['member_specialties'] });
      setEditOpen(false);
      toast({ title: 'Team member updated' });
    },
    onError: (e: any) => { if (e.message !== 'Validation failed') toast({ title: 'Error', description: e.message, variant: 'destructive' }); },
  });

  const deleteMember = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('team_members').delete().eq('id', id);
      if (error) throw error;
      auditLog('team_members', id, 'deleted');
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['team_members'] }); setSelectedMember(null); toast({ title: 'Team member deleted' }); },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const addPayment = useMutation({
    mutationFn: async () => {
      const payload = {
        team_member_id: selectedMember.id,
        organization_id: orgId,
        payment_type: paymentForm.payment_type,
        amount: parseFloat(paymentForm.amount),
        payment_date: paymentForm.payment_date || null,
        payment_month: paymentForm.payment_month || null,
        payment_mode: paymentForm.payment_mode || null,
        notes: paymentForm.notes || null,
      };
      const { data, error } = await supabase.from('team_payments').insert(payload as any).select('id').single();
      if (error) throw error;
      auditLog('team_payments', data.id, 'created', payload);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['team_payments'] }); setPaymentOpen(false); setPaymentForm(emptyPaymentForm); toast({ title: 'Payment recorded' }); },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const addAttendance = useMutation({
    mutationFn: async () => {
      const payload = {
        team_member_id: selectedMember.id,
        organization_id: orgId,
        date: attForm.date,
        status: attForm.status,
        check_in: attForm.check_in || null,
        check_out: attForm.check_out || null,
        notes: attForm.notes || null,
      };
      const { data, error } = await supabase.from('team_attendance').insert(payload as any).select('id').single();
      if (error) throw error;
      auditLog('team_attendance', data.id, 'created', payload);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['team_attendance'] }); setAttendanceOpen(false); setAttForm(emptyAttForm); toast({ title: 'Attendance recorded' }); },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  // Search is now server-side, no client filter needed
  const filtered = members;

  // Performance stats
  const totalTickets = tickets.length;
  const resolvedTickets = tickets.filter((t: any) => t.status === 'resolved' || t.status === 'closed').length;
  const avgResolutionTime = tickets.filter((t: any) => t.resolved_at).reduce((acc: number, t: any) => {
    const diff = new Date(t.resolved_at).getTime() - new Date(t.created_at).getTime();
    return acc + diff / (1000 * 60 * 60);
  }, 0) / Math.max(resolvedTickets, 1);

  const totalPaid = payments.filter((p: any) => p.payment_type === 'salary').reduce((s: number, p: any) => s + (p.amount || 0), 0);
  const totalAdvance = payments.filter((p: any) => p.payment_type === 'advance').reduce((s: number, p: any) => s + (p.amount || 0), 0);

  const presentDays = attendance.filter((a: any) => a.status === 'present').length;
  const totalDays = attendance.length;

  const renderMemberFormFields = (f: any, setF: (v: any) => void) => (
    <>
      <NameGenderFields
        firstName={f.first_name || ''} lastName={f.last_name || ''} gender={f.gender || ''}
        onFirstNameChange={(v) => setF({ ...f, first_name: v })}
        onLastNameChange={(v) => setF({ ...f, last_name: v })}
        onGenderChange={(v) => setF({ ...f, gender: v })}
      />
      <PhoneEmailFields
        phone={f.phone || ''} email={f.email || ''}
        onPhoneChange={(v) => setF({ ...f, phone: v })}
        onEmailChange={(v) => setF({ ...f, email: v })}
      />
      <FileUploadField label="Photo" value={f.photo_url || null} onChange={(v) => setF({ ...f, photo_url: v || '' })} folder="team/photos" accept="image/*" />
      <div className="grid grid-cols-2 gap-3">
        <DatePickerField label="Date of Birth" value={f.date_of_birth || ''} onChange={(v) => setF({ ...f, date_of_birth: v })} />
        <DatePickerField label="Joining Date" value={f.joining_date || ''} onChange={(v) => setF({ ...f, joining_date: v })} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Designation</Label><Input value={f.designation || ''} onChange={(e) => setF({ ...f, designation: e.target.value })} /></div>
        <div><Label>Department</Label><Input value={f.department || ''} onChange={(e) => setF({ ...f, department: e.target.value })} /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>PAN Number</Label><Input value={f.pan_number || ''} onChange={(e) => setF({ ...f, pan_number: e.target.value })} /></div>
        <div><Label>Aadhar Number</Label><Input value={f.aadhar_number || ''} onChange={(e) => setF({ ...f, aadhar_number: e.target.value })} /></div>
      </div>
      <FileUploadField label="ID Proof Document" value={f.id_proof_url || null} onChange={(v) => setF({ ...f, id_proof_url: v || '' })} folder="team/id-proofs" />
      <div><Label>Address</Label><Input value={f.address || ''} onChange={(e) => setF({ ...f, address: e.target.value })} /></div>
      <div className="grid grid-cols-2 gap-3">
        <StateSelect value={f.state || ''} onChange={(v) => setF({ ...f, state: v, city: '' })} />
        <CitySelect value={f.city || ''} onChange={(v) => setF({ ...f, city: v })} state={f.state} />
      </div>
      <div><Label>Pincode</Label><Input value={f.pincode || ''} onChange={(e) => setF({ ...f, pincode: e.target.value })} /></div>
      <div className="grid grid-cols-3 gap-3">
        <div><Label>Bank Name</Label><Input value={f.bank_name || ''} onChange={(e) => setF({ ...f, bank_name: e.target.value })} /></div>
        <div><Label>Account No.</Label><Input value={f.bank_account_number || ''} onChange={(e) => setF({ ...f, bank_account_number: e.target.value })} /></div>
        <div><Label>IFSC</Label><Input value={f.bank_ifsc || ''} onChange={(e) => setF({ ...f, bank_ifsc: e.target.value })} /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Emergency Contact</Label><Input value={f.emergency_contact_name || ''} onChange={(e) => setF({ ...f, emergency_contact_name: e.target.value })} /></div>
        <div><Label>Emergency Phone</Label><Input value={f.emergency_contact_phone || ''} onChange={(e) => setF({ ...f, emergency_contact_phone: e.target.value })} /></div>
      </div>
      <div><Label>Monthly Salary (₹)</Label><Input type="number" value={f.salary_amount || ''} onChange={(e) => setF({ ...f, salary_amount: e.target.value })} /></div>
    </>
  );

  const renderSpecializationCheckboxes = (specs: string[], setSpecs: (v: string[]) => void) => (
    <div>
      <Label className="mb-2 block">Specializations</Label>
      <div className="grid grid-cols-2 gap-2">
        {SPECIALIZATIONS.map(spec => (
          <div key={spec} className="flex items-center gap-2">
            <Checkbox
              id={`spec-${spec}`}
              checked={specs.includes(spec)}
              onCheckedChange={(checked) => {
                if (checked) setSpecs([...specs, spec]);
                else setSpecs(specs.filter(s => s !== spec));
              }}
            />
            <Label htmlFor={`spec-${spec}`} className="text-sm cursor-pointer">{spec}</Label>
          </div>
        ))}
      </div>
    </div>
  );

  // Detail view
  if (selectedMember) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setSelectedMember(null)}>← Back</Button>
          <div className="flex items-center gap-3 flex-1">
            {selectedMember.photo_url && <img src={selectedMember.photo_url} className="h-10 w-10 rounded-full object-cover" alt="" />}
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{selectedMember.first_name} {selectedMember.last_name}</h1>
              <p className="text-sm text-muted-foreground">{selectedMember.designation || 'No designation'} · {selectedMember.department || ''}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => {
            setEditForm({ ...selectedMember });
            setEditSpecs(memberSpecialties);
            setEditOpen(true);
          }}><Pencil className="h-4 w-4 mr-2" /> Edit</Button>
          <Button variant="destructive" size="sm" onClick={() => { if (confirm('Delete?')) deleteMember.mutate(selectedMember.id); }}><Trash2 className="h-4 w-4 mr-2" /> Delete</Button>
        </div>

        <Tabs defaultValue="kyc">
          <TabsList>
            <TabsTrigger value="kyc">KYC</TabsTrigger>
            <TabsTrigger value="specializations">Specializations</TabsTrigger>
            <TabsTrigger value="attendance">Attendance</TabsTrigger>
            <TabsTrigger value="payments">Salary & Payments</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
          </TabsList>

          <TabsContent value="kyc" className="mt-4">
            <Card>
              <CardContent className="p-6 grid grid-cols-2 md:grid-cols-3 gap-4">
                {[
                  ['Phone', selectedMember.phone], ['Email', selectedMember.email],
                  ['DOB', fmtDate(selectedMember.date_of_birth)], ['Joining', fmtDate(selectedMember.joining_date)],
                  ['PAN', selectedMember.pan_number], ['Aadhar', selectedMember.aadhar_number],
                  ['Address', [selectedMember.address, selectedMember.city, selectedMember.state].filter(Boolean).join(', ')],
                  ['Bank', selectedMember.bank_name], ['Account', selectedMember.bank_account_number], ['IFSC', selectedMember.bank_ifsc],
                  ['Emergency', `${selectedMember.emergency_contact_name || ''} ${selectedMember.emergency_contact_phone || ''}`],
                  ['Salary', selectedMember.salary_amount ? `₹${selectedMember.salary_amount}` : '—'],
                ].map(([label, value]) => (
                  <div key={label as string}><p className="text-xs text-muted-foreground">{label}</p><p className="font-medium text-sm">{(value as string) || '—'}</p></div>
                ))}
                {selectedMember.id_proof_url && (
                  <div><p className="text-xs text-muted-foreground">ID Proof</p><a href={selectedMember.id_proof_url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary underline">View document</a></div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="specializations" className="mt-4">
            <Card>
              <CardContent className="p-6">
                {memberSpecialties.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No specializations assigned. Edit the member to add specializations.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {memberSpecialties.map((spec: string) => (
                      <Badge key={spec} variant="secondary" className="gap-1"><Tag className="h-3 w-3" />{spec}</Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="attendance" className="mt-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex gap-3">
                <Badge variant="secondary">{presentDays} Present</Badge>
                <Badge variant="secondary">{totalDays - presentDays} Absent/Leave</Badge>
                <Badge variant="secondary">{totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 0}% Attendance</Badge>
              </div>
              <Button className="gap-2" onClick={() => setAttendanceOpen(true)}><Plus className="h-4 w-4" /> Mark Attendance</Button>
            </div>
            <Card>
              <Table>
                <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Status</TableHead><TableHead>Check In</TableHead><TableHead>Check Out</TableHead><TableHead>Notes</TableHead></TableRow></TableHeader>
                <TableBody>
                  {attendance.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No records</TableCell></TableRow>
                  ) : attendance.map((a: any) => (
                    <TableRow key={a.id}>
                      <TableCell>{fmtDate(a.date)}</TableCell>
                      <TableCell>
                        <Badge variant={a.status === 'present' ? 'default' : 'secondary'} className="capitalize">{a.status?.replace('_', ' ')}</Badge>
                      </TableCell>
                      <TableCell>{a.check_in || '—'}</TableCell>
                      <TableCell>{a.check_out || '—'}</TableCell>
                      <TableCell className="text-sm">{a.notes || '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          <TabsContent value="payments" className="mt-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex gap-3">
                <Badge variant="secondary">Salary Paid: ₹{totalPaid.toLocaleString()}</Badge>
                <Badge variant="secondary">Advances: ₹{totalAdvance.toLocaleString()}</Badge>
              </div>
              <Button className="gap-2" onClick={() => setPaymentOpen(true)}><Plus className="h-4 w-4" /> Add Payment</Button>
            </div>
            <Card>
              <Table>
                <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Type</TableHead><TableHead>Amount</TableHead><TableHead>Month</TableHead><TableHead>Mode</TableHead><TableHead>Notes</TableHead></TableRow></TableHeader>
                <TableBody>
                  {payments.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No payments</TableCell></TableRow>
                  ) : payments.map((p: any) => (
                    <TableRow key={p.id}>
                      <TableCell>{fmtDate(p.payment_date)}</TableCell>
                      <TableCell><Badge variant="secondary" className="capitalize">{p.payment_type}</Badge></TableCell>
                      <TableCell className="font-medium">₹{p.amount?.toLocaleString()}</TableCell>
                      <TableCell>{p.payment_month || '—'}</TableCell>
                      <TableCell className="capitalize">{p.payment_mode?.replace('_', ' ') || '—'}</TableCell>
                      <TableCell className="text-sm">{p.notes || '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          <TabsContent value="performance" className="mt-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold">{totalTickets}</p><p className="text-xs text-muted-foreground">Total Tickets</p></CardContent></Card>
              <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold">{resolvedTickets}</p><p className="text-xs text-muted-foreground">Resolved</p></CardContent></Card>
              <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold">{totalTickets > 0 ? Math.round((resolvedTickets / totalTickets) * 100) : 0}%</p><p className="text-xs text-muted-foreground">Resolution Rate</p></CardContent></Card>
              <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold">{avgResolutionTime.toFixed(1)}h</p><p className="text-xs text-muted-foreground">Avg Resolution</p></CardContent></Card>
            </div>
            {totalTickets === 0 && <p className="text-center text-muted-foreground text-sm">No tickets assigned to this member yet.</p>}
          </TabsContent>
        </Tabs>

        {/* Drawers */}
        <DrawerForm open={editOpen} onOpenChange={setEditOpen} title="Edit Team Member">
          {renderMemberFormFields(editForm, setEditForm)}
          {renderSpecializationCheckboxes(editSpecs, setEditSpecs)}
          <Button className="w-full" onClick={() => updateMember.mutate()} disabled={updateMember.isPending}>Update</Button>
        </DrawerForm>

        <DrawerForm open={paymentOpen} onOpenChange={setPaymentOpen} title="Record Payment">
          <div>
            <Label>Payment Type</Label>
            <Select value={paymentForm.payment_type} onValueChange={(v) => setPaymentForm({ ...paymentForm, payment_type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="salary">Salary</SelectItem>
                <SelectItem value="advance">Advance</SelectItem>
                <SelectItem value="bonus">Bonus</SelectItem>
                <SelectItem value="deduction">Deduction</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label>Amount (₹) *</Label><Input type="number" value={paymentForm.amount} onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })} /></div>
          <DatePickerField label="Payment Date" value={paymentForm.payment_date} onChange={(v) => setPaymentForm({ ...paymentForm, payment_date: v })} />
          <div><Label>Payment Month</Label><Input placeholder="e.g. Mar-2026" value={paymentForm.payment_month} onChange={(e) => setPaymentForm({ ...paymentForm, payment_month: e.target.value })} /></div>
          <div>
            <Label>Payment Mode</Label>
            <Select value={paymentForm.payment_mode} onValueChange={(v) => setPaymentForm({ ...paymentForm, payment_mode: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="upi">UPI</SelectItem>
                <SelectItem value="cheque">Cheque</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label>Notes</Label><Textarea value={paymentForm.notes} onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })} /></div>
          <Button className="w-full" onClick={() => addPayment.mutate()} disabled={addPayment.isPending}>Record Payment</Button>
        </DrawerForm>

        <DrawerForm open={attendanceOpen} onOpenChange={setAttendanceOpen} title="Mark Attendance">
          <DatePickerField label="Date" value={attForm.date} onChange={(v) => setAttForm({ ...attForm, date: v })} required />
          <div>
            <Label>Status</Label>
            <Select value={attForm.status} onValueChange={(v) => setAttForm({ ...attForm, status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="present">Present</SelectItem>
                <SelectItem value="absent">Absent</SelectItem>
                <SelectItem value="half_day">Half Day</SelectItem>
                <SelectItem value="leave">Leave</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Check In</Label><Input type="time" value={attForm.check_in} onChange={(e) => setAttForm({ ...attForm, check_in: e.target.value })} /></div>
            <div><Label>Check Out</Label><Input type="time" value={attForm.check_out} onChange={(e) => setAttForm({ ...attForm, check_out: e.target.value })} /></div>
          </div>
          <div><Label>Notes</Label><Textarea value={attForm.notes} onChange={(e) => setAttForm({ ...attForm, notes: e.target.value })} /></div>
          <Button className="w-full" onClick={() => addAttendance.mutate()} disabled={addAttendance.isPending}>Save</Button>
        </DrawerForm>
      </div>
    );
  }

  // List view
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Team</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage team members, attendance, salary and performance</p>
        </div>
        <Button className="gap-2" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Add Member</Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search team..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      {isLoading ? (
        <CardGridSkeleton count={6} />
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center"><Users className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" /><p className="text-muted-foreground">No team members yet.</p></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((m: any, i: number) => (
            <motion.div key={m.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Card className="hover:shadow-md transition-all cursor-pointer" onClick={() => setSelectedMember(m)}>
                <CardContent className="p-5">
                  <div className="flex items-center gap-3">
                    {m.photo_url ? (
                      <img src={m.photo_url} className="h-10 w-10 rounded-full object-cover" alt="" />
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Users className="h-5 w-5 text-primary" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold truncate">{m.first_name} {m.last_name}</h3>
                      <p className="text-xs text-muted-foreground">{m.designation || m.department || m.phone}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {m._role && <Badge variant="outline" className="text-xs">{ROLE_LABELS[m._role as AppRole] || m._role}</Badge>}
                      <Badge variant={m.status === 'active' ? 'default' : 'secondary'}>{m.status}</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Create Member Drawer */}
      <DrawerForm open={open} onOpenChange={setOpen} title="Add Team Member">
        {renderMemberFormFields(form, setForm)}
        {renderSpecializationCheckboxes(selectedSpecs, setSelectedSpecs)}
        <Button className="w-full" onClick={() => createMember.mutate()} disabled={createMember.isPending}>Add Member</Button>
      </DrawerForm>
    </div>
  );
}
