import { useState, useMemo, useRef } from 'react';
import { parseExcelDateUTC } from '@/lib/date-utils';
import { UserCircle, Plus, Search, Pencil, Trash2, FileText, AlertTriangle, Image as ImageIcon, ExternalLink, DollarSign, CreditCard, RefreshCw, Power, Upload, Download } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllRows } from '@/lib/supabase-utils';
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
import { SortableTableHead, useSort } from '@/components/shared/SortableTableHead';
import { searchAllFields } from '@/lib/search-utils';
import { format, differenceInDays, differenceInMonths, addMonths, subMonths, startOfMonth, isBefore, isAfter } from 'date-fns';
import { exportToCSV, exportToPDF } from '@/lib/export-utils';
import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';
import { useAuditLog } from '@/hooks/useAuditLog';
import { CardGridSkeleton } from '@/components/shared/SkeletonLoaders';

const fmtDate = (d: string | null) => {
  if (!d) return '—';
  try { return format(new Date(d), 'dd-MMM-yy'); } catch { return d; }
};

const fmtMonth = (m: string | null) => {
  if (!m) return '—';
  try {
    const [y, mo] = m.split('-');
    const d = new Date(parseInt(y), parseInt(mo) - 1, 1);
    return format(d, 'MMM-yy');
  } catch { return m; }
};

const isExpiringSoon = (endDate: string | null) => {
  if (!endDate) return false;
  const days = differenceInDays(new Date(endDate), new Date());
  return days >= 0 && days <= 60;
};

const isExpired = (endDate: string | null) => {
  if (!endDate) return false;
  return differenceInDays(new Date(endDate), new Date()) < 0;
};

// Compute effective payment status: paid stays paid, pending becomes overdue if past due date
const getPaymentStatus = (p: any): string => {
  if (p.status === 'paid') return 'paid';
  if (p.due_date && new Date(p.due_date) < new Date()) return 'overdue';
  return 'pending';
};

// Badge for payment status with proper colors
const PaymentStatusBadge = ({ payment }: { payment: any }) => {
  const status = getPaymentStatus(payment);
  if (status === 'paid') return <Badge className="bg-green-600 hover:bg-green-700 text-white capitalize">Paid</Badge>;
  if (status === 'overdue') return <Badge className="bg-red-600 hover:bg-red-700 text-white capitalize">Overdue</Badge>;
  return <Badge className="bg-yellow-500 hover:bg-yellow-600 text-white capitalize">Pending</Badge>;
};

// Generate monthly payments with separate bill_date (1st) and due_date (based on payment_due_day)
function generatePayments(contract: any): { month: string; billDate: string; dueDate: string; actualDueDate: string; baseAmount: number; amount: number }[] {
  if (!contract.start_date || !contract.end_date || !contract.monthly_rent || Number(contract.monthly_rent) <= 0) return [];
  const payments: { month: string; billDate: string; dueDate: string; actualDueDate: string; baseAmount: number; amount: number }[] = [];
  const start = new Date(contract.start_date);
  const end = new Date(contract.end_date);
  const baseAmount = Number(contract.monthly_rent);
  const escalationPct = Number(contract.escalation_percentage) || 0;
  const escalationInterval = Number(contract.escalation_interval_months) || 12;
  const dueDay = Math.min(Number(contract.payment_due_day) || 1, 28);
  const rentInAdvance = !!contract.rent_paid_in_advance;
  const today = new Date();

  let current = startOfMonth(start);
  let monthIndex = 0;

  while (current <= end) {
    const firstOfMonth = startOfMonth(current);
    if (isAfter(firstOfMonth, today)) break;

    let amount = baseAmount;
    if (escalationPct > 0 && escalationInterval > 0 && monthIndex > 0) {
      const escalations = Math.floor(monthIndex / escalationInterval);
      amount = baseAmount * Math.pow(1 + escalationPct / 100, escalations);
    }
    amount = Math.ceil(amount);

    const y = current.getFullYear();
    const m = current.getMonth();
    // If rent_paid_in_advance: bill & due in same month; otherwise both shift to next month
    const billMonth = rentInAdvance ? current : addMonths(current, 1);
    const by = billMonth.getFullYear();
    const bm = billMonth.getMonth();
    const billDateStr = `${by}-${String(bm + 1).padStart(2, '0')}-01`;
    const dueMonth = rentInAdvance ? current : addMonths(current, 1);
    const dy = dueMonth.getFullYear();
    const dm = dueMonth.getMonth();
    const dueDateStr = `${dy}-${String(dm + 1).padStart(2, '0')}-${String(dueDay).padStart(2, '0')}`;
    payments.push({
      month: `${y}-${String(m + 1).padStart(2, '0')}`,
      billDate: billDateStr,
      dueDate: dueDateStr,
      actualDueDate: dueDateStr,
      baseAmount,
      amount,
    });
    current = addMonths(current, 1);
    monthIndex++;
  }
  return payments;
}

export default function Owners() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const orgId = profile?.organization_id;
  const { log: auditLog } = useAuditLog();

  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [contractOpen, setContractOpen] = useState(false);
  const [editContractOpen, setEditContractOpen] = useState(false);
  const [contractDetailId, setContractDetailId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [contractSearch, setContractSearch] = useState('');
  const [paymentSearch, setPaymentSearch] = useState('');
  const [selectedOwner, setSelectedOwner] = useState<any>(null);

  // Payment recording / editing state
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [editPaymentDialogOpen, setEditPaymentDialogOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<any>(null);
  const [paymentForm, setPaymentForm] = useState({ paid_date: '', payment_mode: 'transfer', reference_number: '', notes: '' });
  const [editPaymentForm, setEditPaymentForm] = useState<any>({});

  // Regenerate dialog
  const [regenDialogOpen, setRegenDialogOpen] = useState(false);
  const [regenMode, setRegenMode] = useState<'all' | 'pending' | 'current'>('all');

  // Import dialog
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importMode, setImportMode] = useState<'append' | 'replace'>('append');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);

  // Sort hooks - must be called at top level
  const contractSort = useSort();
  const paymentSort = useSort();
  const allPaymentSort = useSort();

  const emptyForm = {
    first_name: '', last_name: '', gender: '', phone: '', email: '',
    pan_number: '', aadhar_number: '', address: '', city: '', state: '', pincode: '',
    bank_name: '', bank_account_number: '', bank_ifsc: '', gst_number: '', notes: '',
    photo_url: '', id_proof_url: '',
  };
  const [form, setForm] = useState(emptyForm);
  const [editForm, setEditForm] = useState<any>({});

  const emptyContractForm = {
    apartment_ids: [] as string[],
    contract_type: 'lease', start_date: '', end_date: '',
    monthly_rent: '', revenue_share_percentage: '', security_deposit: '',
    lock_in_months: '', escalation_percentage: '', escalation_interval_months: '',
    payment_due_day: '1', rent_paid_in_advance: false, notes: '', agreement_url: '',
    payment_schedule: 'monthly', renewal_periods: '',
  };
  const [contractForm, setContractForm] = useState(emptyContractForm);
  const [editContractForm, setEditContractForm] = useState<any>({});

  const { data: owners = [], isLoading } = useQuery({
    queryKey: ['owners'],
    queryFn: () => fetchAllRows((from, to) => supabase.from('owners').select('*').order('created_at', { ascending: false }).range(from, to)),
    enabled: !!orgId,
  });

  const { data: apartments = [] } = useQuery({
    queryKey: ['apartments_with_property'],
    queryFn: () => fetchAllRows((from, to) => supabase.from('apartments').select('id, apartment_code, property_id, status, properties(property_name, address, city, state)').range(from, to)),
    enabled: !!orgId,
  });

  // Sort apartments by property name then apartment code
  const sortedApartments = useMemo(() => {
    return [...apartments].sort((a: any, b: any) => {
      const propA = (a.properties?.property_name || '').toLowerCase();
      const propB = (b.properties?.property_name || '').toLowerCase();
      if (propA !== propB) return propA.localeCompare(propB);
      return (a.apartment_code || '').toLowerCase().localeCompare((b.apartment_code || '').toLowerCase());
    });
  }, [apartments]);

  const { data: contracts = [] } = useQuery({
    queryKey: ['owner_contracts', selectedOwner?.id],
    queryFn: () => fetchAllRows((from, to) => supabase.from('owner_contracts').select('*, apartments(apartment_code, property_id, properties(property_name, address, city, state))').eq('owner_id', selectedOwner.id).order('created_at', { ascending: false }).range(from, to)),
    enabled: !!selectedOwner?.id,
  });

  const { data: ownerPayments = [] } = useQuery({
    queryKey: ['owner_payments', contractDetailId],
    queryFn: () => fetchAllRows((from, to) => supabase.from('owner_payments').select('*').eq('contract_id', contractDetailId!).order('due_date', { ascending: true }).range(from, to)),
    enabled: !!contractDetailId,
  });

  // Consolidated payments for the owner (all contracts)
  const { data: allOwnerPayments = [] } = useQuery({
    queryKey: ['owner_payments_consolidated', selectedOwner?.id],
    queryFn: () => fetchAllRows((from, to) => supabase.from('owner_payments').select('*, apartments(apartment_code), owner_contracts(contract_type)').eq('owner_id', selectedOwner.id).order('due_date', { ascending: false }).range(from, to)),
    enabled: !!selectedOwner?.id,
  });

  // Org bank accounts
  const { data: bankAccounts = [] } = useQuery({
    queryKey: ['org_bank_accounts'],
    queryFn: () => fetchAllRows((from, to) => supabase.from('organization_bank_accounts').select('*').order('is_primary', { ascending: false }).range(from, to)),
    enabled: !!orgId,
  });

  // All owner contracts for card enrichment
  const { data: allOwnerContracts = [] } = useQuery({
    queryKey: ['all_owner_contracts_for_cards'],
    queryFn: () => fetchAllRows((from, to) => supabase.from('owner_contracts').select('owner_id, apartment_id, start_date, apartments(apartment_code)').order('start_date').range(from, to)),
    enabled: !!orgId,
  });

  // All paid owner payments for card totals
  const { data: allOwnerPaymentsForCards = [] } = useQuery({
    queryKey: ['all_owner_payments_for_cards'],
    queryFn: () => fetchAllRows((from, to) => supabase.from('owner_payments').select('owner_id, escalated_amount, status').eq('status', 'paid').range(from, to)),
    enabled: !!orgId,
  });

  // All active contracts for filtering available apartments
  const { data: allActiveContracts = [] } = useQuery({
    queryKey: ['all_active_contracts_for_filter'],
    queryFn: () => fetchAllRows((from, to) => supabase.from('owner_contracts').select('apartment_id, end_date, status').range(from, to)),
    enabled: !!orgId,
  });

  const splitName = (fullName: string) => {
    const parts = (fullName || '').trim().split(' ');
    return { first_name: parts[0] || '', last_name: parts.slice(1).join(' ') || '' };
  };

  const validate = (f: any) => {
    if (!f.first_name?.trim() || !f.last_name?.trim()) { toast({ title: 'First and Last name required', variant: 'destructive' }); return false; }
    if (validatePhone(f.phone)) { toast({ title: 'Phone must be 10 digits', variant: 'destructive' }); return false; }
    if (validateEmail(f.email)) { toast({ title: 'Invalid email', variant: 'destructive' }); return false; }
    return true;
  };

  const autoRenewalDate = (endDate: string) => {
    if (!endDate) return '';
    try { return format(subMonths(new Date(endDate), 3), 'yyyy-MM-dd'); } catch { return ''; }
  };

  // Derive effective contract status
  const getContractStatus = (c: any) => {
    if (isExpired(c.end_date)) return 'expired';
    return c.status || 'active';
  };

  // --- Auto-generate payment notes ---
  const generateBillNote = (ownerName: string, month: string, aptCode: string) => {
    return `Bills Raised for ${ownerName} for the Month of ${fmtMonth(month)} for the ${aptCode}`;
  };
  const generatePaymentNote = (payment: any) => {
    const ownerName = selectedOwner?.full_name || payment?.owners?.full_name || 'Owner';
    const aptCode = payment?.apartments?.apartment_code || '';
    const month = fmtMonth(payment?.payment_month);
    const billDate = payment?.bill_date ? fmtDate(payment.bill_date) : '';
    return `Bills Raised on ${billDate} and paid for the Month of ${month} for the ${aptCode}`;
  };

  // --- Owner CRUD ---
  const createOwner = useMutation({
    mutationFn: async () => {
      if (!validate(form)) throw new Error('Validation failed');
      const { first_name, last_name, gender, photo_url, id_proof_url, ...rest } = form;
      const { data, error } = await supabase.from('owners').insert({
        ...rest, full_name: `${first_name} ${last_name}`.trim(),
        photo_url: photo_url || null, id_proof_url: id_proof_url || null, organization_id: orgId,
        status: 'active',
      } as any).select('id').single();
      if (error) throw error;
      auditLog('owners', data.id, 'created', { first_name, last_name, ...rest });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['owners'] }); setOpen(false); setForm(emptyForm); toast({ title: 'Owner created' }); },
    onError: (e: any) => { if (e.message !== 'Validation failed') toast({ title: 'Error', description: e.message, variant: 'destructive' }); },
  });

  const updateOwner = useMutation({
    mutationFn: async () => {
      if (!validate(editForm)) throw new Error('Validation failed');
      const { id, created_at, organization_id, first_name, last_name, gender, ...rest } = editForm;
      const { error } = await supabase.from('owners').update({ ...rest, full_name: `${first_name} ${last_name}`.trim() }).eq('id', id);
      if (error) throw error;
      auditLog('owners', id, 'updated', rest);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['owners'] });
      setEditOpen(false);
      setSelectedOwner({ ...selectedOwner, ...editForm, full_name: `${editForm.first_name} ${editForm.last_name}`.trim() });
      toast({ title: 'Owner updated' });
    },
    onError: (e: any) => { if (e.message !== 'Validation failed') toast({ title: 'Error', description: e.message, variant: 'destructive' }); },
  });

  const toggleOwnerStatus = useMutation({
    mutationFn: async () => {
      const newStatus = selectedOwner.status === 'active' ? 'inactive' : 'active';
      const { error } = await supabase.from('owners').update({ status: newStatus } as any).eq('id', selectedOwner.id);
      if (error) throw error;
      auditLog('owners', selectedOwner.id, 'updated', { status: newStatus });
      return newStatus;
    },
    onSuccess: (newStatus) => {
      qc.invalidateQueries({ queryKey: ['owners'] });
      setSelectedOwner({ ...selectedOwner, status: newStatus });
      toast({ title: `Owner ${newStatus === 'active' ? 'activated' : 'deactivated'}` });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  // --- Contract CRUD ---
  const buildContractPayload = (cf: any, aptId?: string) => {
    const finalAptId = aptId || cf.apartment_id || null;
    const apt = apartments.find((a: any) => a.id === finalAptId);
    return {
      contract_type: cf.contract_type,
      apartment_id: finalAptId,
      property_id: apt ? (apt as any).property_id : null,
      start_date: cf.start_date || null,
      end_date: cf.end_date || null,
      monthly_rent: cf.monthly_rent ? parseFloat(cf.monthly_rent) : null,
      revenue_share_percentage: cf.revenue_share_percentage ? parseFloat(cf.revenue_share_percentage) : null,
      security_deposit: cf.security_deposit ? parseFloat(cf.security_deposit) : null,
      lock_in_months: cf.lock_in_months ? parseInt(cf.lock_in_months) : null,
      escalation_percentage: cf.escalation_percentage ? parseFloat(cf.escalation_percentage) : null,
      escalation_interval_months: cf.escalation_interval_months ? parseInt(cf.escalation_interval_months) : null,
      payment_due_day: parseInt(cf.payment_due_day) || 1,
      rent_paid_in_advance: !!cf.rent_paid_in_advance,
      notes: cf.notes || null,
      agreement_url: cf.agreement_url || null,
      payment_schedule: cf.payment_schedule || 'monthly',
      renewal_date: cf.end_date ? autoRenewalDate(cf.end_date) : null,
      renewal_periods: cf.renewal_periods ? parseInt(cf.renewal_periods) : 0,
    };
  };

  const generateAndSavePayments = async (contractId: string, cf: any, aptId?: string) => {
    const payload = buildContractPayload(cf, aptId);
    const payments = generatePayments(payload);
    if (payments.length === 0) return;

    const { data: existing } = await supabase.from('owner_payments').select('*').eq('contract_id', contractId);
    const existingMap = new Map((existing || []).map((p: any) => [p.payment_month, p]));

    await supabase.from('owner_payments').delete().eq('contract_id', contractId);

    // Look up apartment code for auto-notes
    const apt = apartments.find((a: any) => a.id === payload.apartment_id);
    const aptCode = apt?.apartment_code || '';
    const ownerName = selectedOwner?.full_name || 'Owner';

    const rows = payments.map(p => {
      const prev = existingMap.get(p.month) as any;
      const autoNote = generateBillNote(ownerName, p.month, aptCode);
      return {
        organization_id: orgId!,
        owner_id: selectedOwner.id,
        contract_id: contractId,
        apartment_id: payload.apartment_id,
        payment_month: p.month,
        bill_date: p.billDate,
        due_date: p.dueDate,
        actual_due_date: prev?.actual_due_date || p.actualDueDate,
        base_amount: p.baseAmount,
        escalated_amount: p.amount,
        status: prev?.status || 'pending',
        paid_date: prev?.paid_date || null,
        payment_mode: prev?.payment_mode || null,
        notes: prev?.notes || autoNote,
        reference_number: prev?.reference_number || null,
      };
    });
    await supabase.from('owner_payments').insert(rows as any);
  };

  const createContract = useMutation({
    mutationFn: async () => {
      const aptIds = contractForm.apartment_ids;
      if (!aptIds || aptIds.length === 0) { toast({ title: 'Select at least one apartment', variant: 'destructive' }); throw new Error('Validation failed'); }
      
      for (const aptId of aptIds) {
        const payload: any = { owner_id: selectedOwner.id, organization_id: orgId, ...buildContractPayload(contractForm, aptId) };
        const { data, error } = await supabase.from('owner_contracts').insert(payload).select('id').single();
        if (error) throw error;
        await generateAndSavePayments(data.id, contractForm, aptId);
        // Sync contract dates to apartment
        if (payload.start_date || payload.end_date) {
          await supabase.from('apartments').update({
            start_date: payload.start_date,
            end_date: payload.end_date,
          } as any).eq('id', aptId);
        }
        auditLog('owner_contracts', data.id, 'created', payload);
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['owner_contracts'] }); qc.invalidateQueries({ queryKey: ['apartments'] }); setContractOpen(false); setContractForm(emptyContractForm); toast({ title: 'Contract(s) added' }); },
    onError: (e: any) => { if (e.message !== 'Validation failed') toast({ title: 'Error', description: e.message, variant: 'destructive' }); },
  });

  const updateContract = useMutation({
    mutationFn: async () => {
      const payload = buildContractPayload(editContractForm);
      // Auto-set status to expired if end_date is past
      if (isExpired(payload.end_date)) {
        (payload as any).status = 'expired';
      }
      const { error } = await supabase.from('owner_contracts').update(payload).eq('id', editContractForm.id);
      if (error) throw error;
      await generateAndSavePayments(editContractForm.id, editContractForm);
      // Sync contract dates to apartment
      if (payload.apartment_id && (payload.start_date || payload.end_date)) {
        await supabase.from('apartments').update({
          start_date: payload.start_date,
          end_date: payload.end_date,
        } as any).eq('id', payload.apartment_id);
      }
      auditLog('owner_contracts', editContractForm.id, 'updated', payload);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['owner_contracts'] }); qc.invalidateQueries({ queryKey: ['owner_payments'] }); qc.invalidateQueries({ queryKey: ['apartments'] }); setEditContractOpen(false); setContractDetailId(null); toast({ title: 'Contract updated' }); },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const deleteContract = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('owner_contracts').delete().eq('id', id);
      if (error) throw error;
      auditLog('owner_contracts', id, 'deleted');
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['owner_contracts'] }); setContractDetailId(null); toast({ title: 'Contract deleted' }); },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  // --- Renew Contract ---
  const renewContract = (contract: any) => {
    setContractForm({
      ...emptyContractForm,
      apartment_ids: contract.apartment_id ? [contract.apartment_id] : [],
      contract_type: contract.contract_type || 'lease',
      monthly_rent: contract.monthly_rent?.toString() || '',
      revenue_share_percentage: contract.revenue_share_percentage?.toString() || '',
      security_deposit: contract.security_deposit?.toString() || '',
      lock_in_months: contract.lock_in_months?.toString() || '',
      escalation_percentage: contract.escalation_percentage?.toString() || '',
      escalation_interval_months: contract.escalation_interval_months?.toString() || '',
      payment_due_day: contract.payment_due_day?.toString() || '1',
      payment_schedule: contract.payment_schedule || 'monthly',
      start_date: contract.end_date ? format(addMonths(new Date(contract.end_date), 0), 'yyyy-MM-dd') : '',
    });
    setContractOpen(true);
  };

  // --- Payment Recording ---
  const recordPayment = useMutation({
    mutationFn: async () => {
      if (!paymentForm.paid_date) { toast({ title: 'Payment date is required', variant: 'destructive' }); throw new Error('Validation'); }
      const { error } = await supabase.from('owner_payments').update({
        status: 'paid',
        paid_date: paymentForm.paid_date,
        payment_mode: paymentForm.payment_mode,
        reference_number: paymentForm.reference_number || null,
        notes: paymentForm.notes || null,
      } as any).eq('id', selectedPayment.id);
      if (error) throw error;
      auditLog('owner_payments', selectedPayment.id, 'updated', { status: 'paid', ...paymentForm });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['owner_payments'] });
      qc.invalidateQueries({ queryKey: ['owner_payments_consolidated'] });
      qc.invalidateQueries({ queryKey: ['owner_payments_all'] });
      setPaymentDialogOpen(false);
      setSelectedPayment(null);
      setPaymentForm({ paid_date: '', payment_mode: 'transfer', reference_number: '', notes: '' });
      toast({ title: 'Payment recorded' });
    },
    onError: (e: any) => { if (e.message !== 'Validation') toast({ title: 'Error', description: e.message, variant: 'destructive' }); },
  });

  // --- Edit Payment Due ---
  const editPayment = useMutation({
    mutationFn: async () => {
      const updates: any = {
        escalated_amount: parseFloat(editPaymentForm.escalated_amount) || 0,
        due_date: editPaymentForm.due_date,
        actual_due_date: editPaymentForm.actual_due_date || editPaymentForm.due_date,
        notes: editPaymentForm.notes || null,
        reference_number: editPaymentForm.reference_number || null,
      };
      if (editPaymentForm.status === 'paid') {
        updates.status = 'paid';
        updates.paid_date = editPaymentForm.paid_date || null;
        updates.payment_mode = editPaymentForm.payment_mode || null;
      } else {
        updates.status = 'pending';
        updates.paid_date = null;
        updates.payment_mode = null;
      }
      const { error } = await supabase.from('owner_payments').update(updates).eq('id', editPaymentForm.id);
      if (error) throw error;
      auditLog('owner_payments', editPaymentForm.id, 'updated', updates);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['owner_payments'] });
      qc.invalidateQueries({ queryKey: ['owner_payments_consolidated'] });
      qc.invalidateQueries({ queryKey: ['owner_payments_all'] });
      setEditPaymentDialogOpen(false);
      toast({ title: 'Payment updated' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  // --- Regenerate Bills ---
  const regenerateBills = useMutation({
    mutationFn: async () => {
      const { data: ownerContracts } = await supabase.from('owner_contracts').select('*').eq('owner_id', selectedOwner.id);
      if (!ownerContracts || ownerContracts.length === 0) return;

      for (const contract of ownerContracts) {
        if (regenMode === 'current') {
          const currentMonth = format(new Date(), 'yyyy-MM');
          const payments = generatePayments(contract);
          const currentPayment = payments.find(p => p.month === currentMonth);
          if (currentPayment) {
            const { data: existing } = await supabase.from('owner_payments').select('*').eq('contract_id', contract.id).eq('payment_month', currentMonth).single();
            if (existing && (existing as any).status !== 'paid') {
              await supabase.from('owner_payments').update({
                escalated_amount: currentPayment.amount,
                bill_date: currentPayment.billDate,
                due_date: currentPayment.dueDate,
              } as any).eq('id', (existing as any).id);
            } else if (!existing) {
              await supabase.from('owner_payments').insert({
                organization_id: orgId!,
                owner_id: selectedOwner.id,
                contract_id: contract.id,
                apartment_id: contract.apartment_id,
                payment_month: currentPayment.month,
                bill_date: currentPayment.billDate,
                due_date: currentPayment.dueDate,
                actual_due_date: currentPayment.actualDueDate,
                base_amount: currentPayment.baseAmount,
                escalated_amount: currentPayment.amount,
                status: 'pending',
              } as any);
            }
          }
        } else if (regenMode === 'pending') {
          const { data: existing } = await supabase.from('owner_payments').select('*').eq('contract_id', contract.id);
          const existingMap = new Map((existing || []).map((p: any) => [p.payment_month, p]));
          const payments = generatePayments(contract);
          
          const pendingIds = (existing || []).filter((p: any) => p.status !== 'paid').map((p: any) => p.id);
          if (pendingIds.length > 0) {
            await supabase.from('owner_payments').delete().in('id', pendingIds);
          }
          
          const rows = payments.filter(p => {
            const prev = existingMap.get(p.month) as any;
            return !prev || prev.status !== 'paid';
          }).map(p => ({
            organization_id: orgId!,
            owner_id: selectedOwner.id,
            contract_id: contract.id,
            apartment_id: contract.apartment_id,
            payment_month: p.month,
            bill_date: p.billDate,
            due_date: p.dueDate,
            actual_due_date: p.actualDueDate,
            base_amount: p.baseAmount,
            escalated_amount: p.amount,
            status: 'pending',
          }));
          if (rows.length > 0) await supabase.from('owner_payments').insert(rows as any);
        } else {
          await generateAndSavePayments(contract.id, contract);
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['owner_payments'] });
      qc.invalidateQueries({ queryKey: ['owner_payments_consolidated'] });
      setRegenDialogOpen(false);
      toast({ title: 'Bills regenerated' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  // --- Payment Template Download ---
  const downloadPaymentTemplate = () => {
    const headers = ['Payment Month (YYYY-MM)', 'Apartment Code', 'Contract Type', 'Bill Date (YYYY-MM-DD)', 'Due Date (YYYY-MM-DD)', 'Base Amount', 'Escalated Amount', 'Status (pending/paid)', 'Paid Date (YYYY-MM-DD)', 'Payment Mode (transfer/cash/cheque/upi/credit_card)', 'Reference Number', 'Notes'];
    const sampleRow = ['2025-04', 'APT-101', 'rent', '2025-04-01', '2025-04-05', '25000', '26250', 'paid', '2025-04-03', 'transfer', 'UTR123456', 'April rent payment'];
    const ws = XLSX.utils.aoa_to_sheet([headers, sampleRow]);
    ws['!cols'] = headers.map(() => ({ wch: 28 }));

    // Add a "Field Reference" sheet with detailed descriptions
    const refData = [
      ['Field Name', 'Required?', 'Format / Accepted Values', 'Description'],
      ['Payment Month', 'Yes', 'YYYY-MM (e.g. 2025-04)', 'The billing month this payment corresponds to.'],
      ['Apartment Code', 'Yes', 'Text (e.g. APT-101)', 'Must match an apartment code linked to this owner\'s contracts.'],
      ['Contract Type', 'No', 'rent / revenue_share', 'Type of owner contract. Defaults to "rent" if left blank. "rent" = fixed monthly rent, "revenue_share" = percentage of bed revenue.'],
      ['Bill Date', 'No', 'YYYY-MM-DD', 'Date the bill was generated. Defaults to the 1st of Payment Month if blank.'],
      ['Due Date', 'No', 'YYYY-MM-DD', 'Payment due date. Defaults to contract\'s payment_due_day or the 5th of the month.'],
      ['Base Amount', 'Yes', 'Number (no commas)', 'Original contract rent amount before any escalation.'],
      ['Escalated Amount', 'No', 'Number (no commas)', 'Rent after applying escalation %. If blank, defaults to Base Amount.'],
      ['Status', 'No', 'pending / paid', 'Payment status. Defaults to "pending" if left blank.'],
      ['Paid Date', 'No', 'YYYY-MM-DD', 'Date payment was actually received. Required if Status is "paid".'],
      ['Payment Mode', 'No', 'transfer / cash / cheque / upi / credit_card', 'How the payment was made. Leave blank if not yet paid.'],
      ['Reference Number', 'No', 'Text (e.g. UTR / Cheque No)', 'Transaction reference like UTR number, cheque number, etc.'],
      ['Notes', 'No', 'Free text', 'Any additional remarks about this payment.'],
    ];
    const refWs = XLSX.utils.aoa_to_sheet(refData);
    refWs['!cols'] = [{ wch: 22 }, { wch: 12 }, { wch: 40 }, { wch: 60 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Owner Payments');
    XLSX.utils.book_append_sheet(wb, refWs, 'Field Reference');
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), 'owner-payments-template.xlsx');
    toast({ title: 'Template downloaded' });
  };

  // --- Export Payments ---
  const exportPayments = (mode: 'csv' | 'pdf' | 'xlsx') => {
    const columns = [
      { key: 'apartment', label: 'Apartment' },
      { key: 'type', label: 'Contract Type' },
      { key: 'month', label: 'Month' },
      { key: 'bill_date', label: 'Bill Date' },
      { key: 'due_date', label: 'Due Date' },
      { key: 'base_amount', label: 'Base Amount (₹)' },
      { key: 'amount', label: 'Amount (₹)' },
      { key: 'status', label: 'Status' },
      { key: 'paid_date', label: 'Paid Date' },
      { key: 'payment_mode', label: 'Mode' },
      { key: 'reference', label: 'Reference #' },
      { key: 'notes', label: 'Notes' },
    ];
    const data = filteredAllPayments.map((p: any) => ({
      apartment: p.apartments?.apartment_code || '—',
      type: p.owner_contracts?.contract_type?.replace(/_/g, ' ') || '—',
      month: fmtMonth(p.payment_month),
      bill_date: fmtDate(p.bill_date),
      due_date: fmtDate(p.due_date),
      base_amount: Number(p.base_amount || 0).toLocaleString(),
      amount: Number(p.escalated_amount || 0).toLocaleString(),
      status: getPaymentStatus(p),
      paid_date: fmtDate(p.paid_date),
      payment_mode: p.payment_mode || '—',
      reference: p.reference_number || '—',
      notes: p.notes || '—',
    }));
    const ownerName = selectedOwner?.full_name || 'Owner';
    if (mode === 'csv') exportToCSV(data, `${ownerName}-payments-${format(new Date(), 'yyyy-MM-dd')}`, columns);
    else if (mode === 'pdf') {
      const totalP = filteredAllPayments.filter((p: any) => p.status === 'paid').reduce((s: number, p: any) => s + Number(p.escalated_amount || 0), 0);
      const totalD = filteredAllPayments.filter((p: any) => p.status !== 'paid').reduce((s: number, p: any) => s + Number(p.escalated_amount || 0), 0);
      exportToPDF(`Owner Payments — ${ownerName}`, data, columns, { 'Total Paid': `₹${totalP.toLocaleString()}`, 'Total Pending': `₹${totalD.toLocaleString()}` });
    } else {
      const ws = XLSX.utils.json_to_sheet(data.map(d => {
        const obj: any = {};
        columns.forEach(c => { obj[c.label] = d[c.key as keyof typeof d]; });
        return obj;
      }));
      ws['!cols'] = columns.map(() => ({ wch: 18 }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Payments');
      const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      saveAs(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `${ownerName}-payments-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    }
    toast({ title: `Payments exported (${mode.toUpperCase()})` });
  };

  // --- Import Payments ---
  const handleImportPayments = async () => {
    if (!importFile || !selectedOwner) return;
    setImporting(true);
    try {
      const buf = await importFile.arrayBuffer();
      const wb = XLSX.read(buf);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: any[] = XLSX.utils.sheet_to_json(ws);
      if (rows.length === 0) { toast({ title: 'No data found in file', variant: 'destructive' }); return; }

      // Build lookup maps
      const aptMap = new Map(apartments.map((a: any) => [a.apartment_code?.toLowerCase(), a]));
      const contractMap = new Map(contracts.map((c: any) => [c.id, c]));
      // Find contracts for this owner
      const ownerContractsByApt = new Map<string, any>();
      contracts.forEach((c: any) => {
        const apt = apartments.find((a: any) => a.id === c.apartment_id);
        if (apt) ownerContractsByApt.set(apt.apartment_code?.toLowerCase(), c);
      });

      const paymentRows: any[] = [];
      for (const row of rows) {
        const month = String(row['Payment Month (YYYY-MM)'] || '').trim();
        const aptCode = String(row['Apartment Code'] || '').trim().toLowerCase();
        const contract = ownerContractsByApt.get(aptCode);
        if (!month || !contract) continue;

        const status = String(row['Status (pending/paid)'] || 'pending').toLowerCase();
        const billDate = parseExcelDateUTC(row['Bill Date (YYYY-MM-DD)']);
        const dueDate = parseExcelDateUTC(row['Due Date (YYYY-MM-DD)']);
        const paidDate = parseExcelDateUTC(row['Paid Date (YYYY-MM-DD)']);
        paymentRows.push({
          organization_id: orgId!,
          owner_id: selectedOwner.id,
          contract_id: contract.id,
          apartment_id: contract.apartment_id,
          payment_month: month,
          bill_date: billDate,
          due_date: dueDate,
          actual_due_date: dueDate,
          base_amount: parseFloat(row['Base Amount']) || 0,
          escalated_amount: parseFloat(row['Escalated Amount']) || 0,
          status: status === 'paid' ? 'paid' : 'pending',
          paid_date: paidDate,
          payment_mode: row['Payment Mode (transfer/cash/cheque/upi/credit_card)'] || null,
          reference_number: row['Reference Number'] ? String(row['Reference Number']) : null,
          notes: row['Notes'] || null,
        });
      }

      if (paymentRows.length === 0) { toast({ title: 'No valid rows to import', variant: 'destructive' }); setImporting(false); return; }

      if (importMode === 'replace') {
        // Delete existing payments for this owner's contracts
        for (const c of contracts) {
          await supabase.from('owner_payments').delete().eq('contract_id', (c as any).id);
        }
      }

      const batchSize = 50;
      for (let i = 0; i < paymentRows.length; i += batchSize) {
        const batch = paymentRows.slice(i, i + batchSize);
        const { error } = await supabase.from('owner_payments').insert(batch as any);
        if (error) throw error;
      }

      qc.invalidateQueries({ queryKey: ['owner_payments'] });
      qc.invalidateQueries({ queryKey: ['owner_payments_consolidated'] });
      setImportDialogOpen(false);
      setImportFile(null);
      toast({ title: `${paymentRows.length} payments imported (${importMode})` });
    } catch (err: any) {
      toast({ title: 'Import failed', description: err.message, variant: 'destructive' });
    } finally {
      setImporting(false);
    }
  };

  const filtered = owners.filter((o: any) => {
    return o.full_name?.toLowerCase().includes(search.toLowerCase());
  });

  // Filtered & sorted contracts
  const filteredContracts = useMemo(() => {
    let result = contracts.filter((c: any) => searchAllFields(c, contractSearch));
    return contractSort.sortData(result, (item: any, key: string) => {
      if (key === 'apartment') return item.apartments?.apartment_code;
      if (key === 'property') return item.apartments?.properties?.property_name;
      if (key === 'type') return item.contract_type;
      if (key === 'status') return getContractStatus(item);
      if (key === 'start_date') return item.start_date;
      if (key === 'end_date') return item.end_date;
      if (key === 'monthly_rent') return Number(item.monthly_rent || 0);
      return item[key];
    });
  }, [contracts, contractSearch, contractSort.sortConfig]);

  // Filtered & sorted contract detail payments
  const filteredPayments = useMemo(() => {
    let result = ownerPayments.filter((p: any) => searchAllFields(p, paymentSearch));
    return paymentSort.sortData(result, (item: any, key: string) => {
      if (key === 'month') return item.payment_month;
      if (key === 'bill_date') return item.bill_date;
      if (key === 'due_date') return item.due_date;
      if (key === 'amount') return Number(item.escalated_amount || 0);
      if (key === 'status') return getPaymentStatus(item);
      if (key === 'paid_date') return item.paid_date;
      if (key === 'mode') return item.payment_mode;
      if (key === 'ref') return (item as any).reference_number;
      return item[key];
    });
  }, [ownerPayments, paymentSearch, paymentSort.sortConfig]);

  // Filtered & sorted all payments
  const filteredAllPayments = useMemo(() => {
    let result = allOwnerPayments.filter((p: any) => searchAllFields(p, paymentSearch));
    return allPaymentSort.sortData(result, (item: any, key: string) => {
      if (key === 'apartment') return (item as any).apartments?.apartment_code;
      if (key === 'type') return (item as any).owner_contracts?.contract_type;
      if (key === 'month') return item.payment_month;
      if (key === 'bill_date') return item.bill_date;
      if (key === 'due_date') return item.due_date;
      if (key === 'amount') return Number(item.escalated_amount || 0);
      if (key === 'status') return getPaymentStatus(item);
      if (key === 'paid_date') return item.paid_date;
      if (key === 'mode') return item.payment_mode;
      if (key === 'ref') return (item as any).reference_number;
      return item[key];
    });
  }, [allOwnerPayments, paymentSearch, allPaymentSort.sortConfig]);

  // Shared form fields
  const renderOwnerFormFields = (f: any, setF: (v: any) => void) => (
    <>
      <NameGenderFields firstName={f.first_name || ''} lastName={f.last_name || ''} gender={f.gender || ''} onFirstNameChange={(v) => setF({ ...f, first_name: v })} onLastNameChange={(v) => setF({ ...f, last_name: v })} onGenderChange={(v) => setF({ ...f, gender: v })} />
      <PhoneEmailFields phone={f.phone || ''} email={f.email || ''} onPhoneChange={(v) => setF({ ...f, phone: v })} onEmailChange={(v) => setF({ ...f, email: v })} />
      <FileUploadField label="Owner Photo" value={f.photo_url || null} onChange={(v) => setF({ ...f, photo_url: v || '' })} folder="owners/photos" accept="image/*" />
      <div className="grid grid-cols-2 gap-3">
        <div><Label>PAN Number</Label><Input value={f.pan_number || ''} onChange={(e) => setF({ ...f, pan_number: e.target.value })} /></div>
        <div><Label>Aadhar Number</Label><Input value={f.aadhar_number || ''} onChange={(e) => setF({ ...f, aadhar_number: e.target.value })} /></div>
      </div>
      <FileUploadField label="ID Proof Document" value={f.id_proof_url || null} onChange={(v) => setF({ ...f, id_proof_url: v || '' })} folder="owners/id-proofs" />
      <div><Label>Address</Label><Input value={f.address || ''} onChange={(e) => setF({ ...f, address: e.target.value })} /></div>
      <div className="grid grid-cols-2 gap-3">
        <StateSelect value={f.state || ''} onChange={(v) => setF({ ...f, state: v, city: '' })} />
        <CitySelect value={f.city || ''} onChange={(v) => setF({ ...f, city: v })} state={f.state} />
      </div>
      <div><Label>Pincode</Label><Input value={f.pincode || ''} onChange={(e) => setF({ ...f, pincode: e.target.value })} /></div>
      <div className="grid grid-cols-3 gap-3">
        <div><Label>Bank Name</Label><Input value={f.bank_name || ''} onChange={(e) => setF({ ...f, bank_name: e.target.value })} /></div>
        <div><Label>Account Number</Label><Input value={f.bank_account_number || ''} onChange={(e) => setF({ ...f, bank_account_number: e.target.value })} /></div>
        <div><Label>IFSC</Label><Input value={f.bank_ifsc || ''} onChange={(e) => setF({ ...f, bank_ifsc: e.target.value })} /></div>
      </div>
      <div><Label>GST Number</Label><Input value={f.gst_number || ''} onChange={(e) => setF({ ...f, gst_number: e.target.value })} /></div>
      <div><Label>Notes</Label><Textarea value={f.notes || ''} onChange={(e) => setF({ ...f, notes: e.target.value })} /></div>
    </>
  );

  const renderContractFormFields = (f: any, setF: (v: any) => void, isEdit = false) => {
    const hasMonthlyRent = parseFloat(f.monthly_rent) > 0;
    const hasRevenueShare = parseFloat(f.revenue_share_percentage) > 0;

    return (
      <>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Contract Identity</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Contract Type *</Label>
            <Select value={f.contract_type} onValueChange={(v) => setF({ ...f, contract_type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="lease">Lease</SelectItem>
                <SelectItem value="rental">Rental</SelectItem>
                <SelectItem value="revenue_sharing">Revenue Sharing</SelectItem>
                <SelectItem value="profit_sharing">Profit Sharing</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {isEdit ? (
            <div>
              <Label>Apartment *</Label>
              <Select value={f.apartment_id} onValueChange={(v) => setF({ ...f, apartment_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select apartment" /></SelectTrigger>
                <SelectContent>
                  {sortedApartments.map((a: any) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.properties?.property_name} — {a.apartment_code} <span className="text-muted-foreground ml-1">({a.status || 'In-Progress'})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="col-span-2">
              <Label>Apartments * (select multiple)</Label>
              <div className="border rounded-md p-3 max-h-48 overflow-y-auto space-y-2">
                {sortedApartments.filter((a: any) => {
                  // Only show apartments not currently associated with an active contract
                  const hasActiveContract = allActiveContracts.some((c: any) => c.apartment_id === a.id && !isExpired(c.end_date));
                  return !hasActiveContract;
                }).map((a: any) => {
                  const isChecked = (f.apartment_ids || []).includes(a.id);
                  return (
                    <label key={a.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 rounded px-2 py-1">
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={(checked) => {
                          const ids = f.apartment_ids || [];
                          if (checked) {
                            setF({ ...f, apartment_ids: [...ids, a.id] });
                          } else {
                            setF({ ...f, apartment_ids: ids.filter((id: string) => id !== a.id) });
                          }
                        }}
                      />
                      <span>{a.properties?.property_name} — {a.apartment_code} <span className="text-muted-foreground">({a.status || 'In-Progress'})</span></span>
                    </label>
                  );
                })}
              </div>
              {(f.apartment_ids || []).length > 0 && (
                <p className="text-xs text-muted-foreground mt-1">{f.apartment_ids.length} apartment(s) selected</p>
              )}
            </div>
          )}
        </div>

        <Separator />
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Financials</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Monthly / Base Amount (₹)</Label>
            <Input type="number" value={f.monthly_rent} onChange={(e) => setF({ ...f, monthly_rent: e.target.value, ...(parseFloat(e.target.value) > 0 ? { revenue_share_percentage: '' } : {}) })} disabled={hasRevenueShare} />
            {hasRevenueShare && <p className="text-xs text-muted-foreground mt-1">Disabled when revenue share is set</p>}
          </div>
          <div>
            <Label>Revenue / Profit Share (%)</Label>
            <Input type="number" value={f.revenue_share_percentage} onChange={(e) => setF({ ...f, revenue_share_percentage: e.target.value, ...(parseFloat(e.target.value) > 0 ? { monthly_rent: '' } : {}) })} disabled={hasMonthlyRent} />
            {hasMonthlyRent && <p className="text-xs text-muted-foreground mt-1">Disabled when monthly rent is set</p>}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Security Deposit (₹)</Label><Input type="number" value={f.security_deposit} onChange={(e) => setF({ ...f, security_deposit: e.target.value })} /></div>
          <div><Label>Lock-in Period (months)</Label><Input type="number" value={f.lock_in_months} onChange={(e) => setF({ ...f, lock_in_months: e.target.value })} /></div>
        </div>
        <div>
          <Label>Payment Due Day (1-28)</Label>
          <Input type="number" min="1" max="28" value={f.payment_due_day} onChange={(e) => setF({ ...f, payment_due_day: e.target.value })} />
        </div>
        <div className="flex items-center space-x-2 mt-1">
          <Checkbox
            id="rent_paid_in_advance"
            checked={!!f.rent_paid_in_advance}
            onCheckedChange={(checked) => setF({ ...f, rent_paid_in_advance: !!checked })}
          />
          <label htmlFor="rent_paid_in_advance" className="text-sm cursor-pointer">
            Rent Paid in Advance
          </label>
        </div>
        <p className="text-xs text-muted-foreground">If checked, rent is due in the same month. Otherwise, rent is due the following month.</p>

        <Separator />
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Escalation Terms</p>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Escalation (%)</Label><Input type="number" value={f.escalation_percentage} onChange={(e) => setF({ ...f, escalation_percentage: e.target.value })} placeholder="e.g. 5" /></div>
          <div><Label>Frequency (months)</Label><Input type="number" value={f.escalation_interval_months} onChange={(e) => setF({ ...f, escalation_interval_months: e.target.value })} placeholder="e.g. 12" /></div>
        </div>

        <Separator />
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Timeline Management</p>
        <div className="grid grid-cols-2 gap-3">
          <DatePickerField label="Start Date" value={f.start_date} onChange={(v) => setF({ ...f, start_date: v })} />
          <DatePickerField label="End Date" value={f.end_date} onChange={(v) => setF({ ...f, end_date: v })} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Renewal Date (auto: 3 months before end)</Label>
            <Input value={f.end_date ? fmtDate(autoRenewalDate(f.end_date)) : '—'} disabled className="bg-muted" />
          </div>
          <div><Label>Future Renewal Period (months)</Label><Input type="number" value={f.renewal_periods} onChange={(e) => setF({ ...f, renewal_periods: e.target.value })} placeholder="e.g. 12" /></div>
        </div>

        <Separator />
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Documents</p>
        <FileUploadField label="Agreement Copy" value={f.agreement_url || null} onChange={(v) => setF({ ...f, agreement_url: v || '' })} folder="owners/agreements" />
        <div><Label>Notes</Label><Textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></div>
      </>
    );
  };

  // --- Payment action buttons renderer ---
  const renderPaymentActions = (payment: any) => (
    <div className="flex gap-1">
      {payment.status !== 'paid' && (
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={(e) => {
          e.stopPropagation();
          setSelectedPayment(payment);
          const autoNote = generatePaymentNote(payment);
          setPaymentForm({ paid_date: format(new Date(), 'yyyy-MM-dd'), payment_mode: 'transfer', reference_number: '', notes: autoNote });
          setPaymentDialogOpen(true);
        }}>
          <CreditCard className="h-3 w-3" /> Record Payment
        </Button>
      )}
      <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={(e) => {
        e.stopPropagation();
        setEditPaymentForm({
          id: payment.id,
          escalated_amount: payment.escalated_amount?.toString() || '0',
          due_date: payment.due_date || '',
          actual_due_date: payment.actual_due_date || payment.due_date || '',
          status: payment.status || 'pending',
          paid_date: payment.paid_date || '',
          payment_mode: payment.payment_mode || 'transfer',
          reference_number: (payment as any).reference_number || '',
          notes: payment.notes || '',
        });
        setEditPaymentDialogOpen(true);
      }}>
        <Pencil className="h-3 w-3" /> Edit
      </Button>
    </div>
  );

  // --- Record / Edit Payment Dialogs (shared) ---
  const renderRecordPaymentDialog = () => (
    <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
      <DialogContent>
        <DialogHeader><DialogTitle>Record Payment — {fmtMonth(selectedPayment?.payment_month)}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div><p className="text-sm text-muted-foreground">Amount Due: <span className="font-semibold text-foreground">₹{Number(selectedPayment?.escalated_amount || 0).toLocaleString()}</span></p></div>
          <DatePickerField label="Payment Date *" value={paymentForm.paid_date} onChange={(v) => setPaymentForm({ ...paymentForm, paid_date: v })} />
          <div>
            <Label>Payment Mode</Label>
            <Select value={paymentForm.payment_mode} onValueChange={(v) => setPaymentForm({ ...paymentForm, payment_mode: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="transfer">Bank Transfer</SelectItem><SelectItem value="cash">Cash</SelectItem><SelectItem value="cheque">Cheque</SelectItem><SelectItem value="upi">UPI</SelectItem><SelectItem value="credit_card">Credit Card</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {bankAccounts.length > 0 && (
            <div>
              <Label>Bank Account (for reconciliation)</Label>
              <div className="border rounded-md p-3 space-y-2 max-h-32 overflow-y-auto">
                {bankAccounts.map((ba: any) => (
                  <div key={ba.id} className="text-xs">
                    <span className="font-medium">{ba.bank_name}</span> — {ba.account_number} {ba.ifsc_code ? `(${ba.ifsc_code})` : ''} {ba.is_primary && <Badge className="text-[10px] h-4 ml-1">Primary</Badge>}
                  </div>
                ))}
              </div>
            </div>
          )}
          <div><Label>Reference Number</Label><Input value={paymentForm.reference_number} onChange={(e) => setPaymentForm({ ...paymentForm, reference_number: e.target.value })} placeholder="Cheque number, Transaction ID, etc." /></div>
          <div><Label>Notes</Label><Textarea value={paymentForm.notes} onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })} rows={3} /></div>
          <Button className="w-full" onClick={() => recordPayment.mutate()} disabled={recordPayment.isPending}>Confirm Payment</Button>
        </div>
      </DialogContent>
    </Dialog>
  );

  const renderEditPaymentDialog = () => (
    <Dialog open={editPaymentDialogOpen} onOpenChange={setEditPaymentDialogOpen}>
      <DialogContent>
        <DialogHeader><DialogTitle>Edit Payment Due</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div><Label>Amount Due (₹)</Label><Input type="number" value={editPaymentForm.escalated_amount || ''} onChange={(e) => setEditPaymentForm({ ...editPaymentForm, escalated_amount: e.target.value })} /></div>
          <DatePickerField label="Due Date" value={editPaymentForm.due_date || ''} onChange={(v) => setEditPaymentForm({ ...editPaymentForm, due_date: v })} />
          <DatePickerField label="Actual Due Date (for cash flow)" value={editPaymentForm.actual_due_date || ''} onChange={(v) => setEditPaymentForm({ ...editPaymentForm, actual_due_date: v })} />
          <div>
            <Label>Status</Label>
            <Select value={editPaymentForm.status || 'pending'} onValueChange={(v) => setEditPaymentForm({ ...editPaymentForm, status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="pending">Pending</SelectItem><SelectItem value="paid">Paid</SelectItem></SelectContent>
            </Select>
          </div>
          {editPaymentForm.status === 'paid' && (
            <>
              <DatePickerField label="Paid Date" value={editPaymentForm.paid_date || ''} onChange={(v) => setEditPaymentForm({ ...editPaymentForm, paid_date: v })} />
              <div>
                <Label>Payment Mode</Label>
                <Select value={editPaymentForm.payment_mode || 'transfer'} onValueChange={(v) => setEditPaymentForm({ ...editPaymentForm, payment_mode: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="transfer">Bank Transfer</SelectItem><SelectItem value="cash">Cash</SelectItem><SelectItem value="cheque">Cheque</SelectItem><SelectItem value="upi">UPI</SelectItem><SelectItem value="credit_card">Credit Card</SelectItem></SelectContent>
                </Select>
              </div>
            </>
          )}
          <div><Label>Reference Number</Label><Input value={editPaymentForm.reference_number || ''} onChange={(e) => setEditPaymentForm({ ...editPaymentForm, reference_number: e.target.value })} placeholder="Cheque number, Transaction ID, etc." /></div>
          <div><Label>Notes</Label><Textarea value={editPaymentForm.notes || ''} onChange={(e) => setEditPaymentForm({ ...editPaymentForm, notes: e.target.value })} /></div>
          <Button className="w-full" onClick={() => editPayment.mutate()} disabled={editPayment.isPending}>Save Changes</Button>
        </div>
      </DialogContent>
    </Dialog>
  );

  // --- Contract Detail View ---
  const detailContract = contracts.find((c: any) => c.id === contractDetailId);

  if (selectedOwner && contractDetailId && detailContract) {
    const c = detailContract as any;
    const effectiveStatus = getContractStatus(c);
    const aptLabel = c.apartments?.apartment_code || 'No apartment';
    const propName = c.apartments?.properties?.property_name || '';
    const propAddr = [propName, c.apartments?.properties?.address, c.apartments?.properties?.city, c.apartments?.properties?.state].filter(Boolean).join(', ');
    const docs = [
      c.agreement_url && { label: 'Agreement Copy', url: c.agreement_url },
    ].filter(Boolean) as { label: string; url: string }[];

    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setContractDetailId(null)}>← Back to Contracts</Button>
          <div className="flex-1" />
          <Button variant="outline" size="sm" onClick={() => renewContract(c)}>
            <RefreshCw className="h-4 w-4 mr-2" /> Renew
          </Button>
          <Button variant="outline" size="sm" onClick={() => {
            setEditContractForm({
              ...c, apartment_id: c.apartment_id || '',
              monthly_rent: c.monthly_rent?.toString() || '', revenue_share_percentage: c.revenue_share_percentage?.toString() || '',
              security_deposit: c.security_deposit?.toString() || '', lock_in_months: c.lock_in_months?.toString() || '',
              escalation_percentage: c.escalation_percentage?.toString() || '', escalation_interval_months: c.escalation_interval_months?.toString() || '',
              payment_due_day: c.payment_due_day?.toString() || '1', renewal_periods: c.renewal_periods?.toString() || '',
              payment_schedule: c.payment_schedule || 'monthly',
              agreement_url: c.agreement_url || '', notes: c.notes || '',
            });
            setEditContractOpen(true);
          }}><Pencil className="h-4 w-4 mr-2" /> Edit</Button>
          <Button variant="destructive" size="sm" onClick={() => { if (confirm('Delete this contract?')) deleteContract.mutate(c.id); }}><Trash2 className="h-4 w-4 mr-2" /> Delete</Button>
        </div>

        <div className="flex items-center gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold">Contract: {c.contract_type?.replace(/_/g, ' ')}</h1>
              <Badge variant={effectiveStatus === 'active' ? 'default' : 'destructive'} className="capitalize">{effectiveStatus}</Badge>
              {isExpiringSoon(c.end_date) && !isExpired(c.end_date) && <Badge className="bg-orange-500 text-white"><AlertTriangle className="h-3 w-3 mr-1" />Expiring Soon</Badge>}
            </div>
            <p className="text-sm text-muted-foreground mt-1">{selectedOwner.full_name} · Apt: {aptLabel} · {propAddr || 'No property linked'}</p>
          </div>
        </div>

        <Tabs defaultValue="details">
          <TabsList>
            <TabsTrigger value="details">Contract Details</TabsTrigger>
            <TabsTrigger value="payments">Payments ({ownerPayments.length})</TabsTrigger>
            <TabsTrigger value="documents">Documents ({docs.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="mt-4 space-y-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Financials</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[['Monthly / Base', c.monthly_rent ? `₹${Number(c.monthly_rent).toLocaleString()}` : '—'], ['Share %', c.revenue_share_percentage ? `${c.revenue_share_percentage}%` : '—'], ['Security Deposit', c.security_deposit ? `₹${Number(c.security_deposit).toLocaleString()}` : '—'], ['Lock-in', c.lock_in_months ? `${c.lock_in_months} months` : '—'], ['Due Day', c.payment_due_day || '—']].map(([l, v]) => (
                  <div key={l as string}><p className="text-xs text-muted-foreground">{l}</p><p className="font-semibold text-sm">{v}</p></div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Escalation Terms</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div><p className="text-xs text-muted-foreground">Percentage</p><p className="font-semibold text-sm">{c.escalation_percentage ? `${c.escalation_percentage}%` : '—'}</p></div>
                <div><p className="text-xs text-muted-foreground">Frequency</p><p className="font-semibold text-sm">{c.escalation_interval_months ? `Every ${c.escalation_interval_months} months` : '—'}</p></div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Timeline</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[['Start Date', fmtDate(c.start_date)], ['End Date', fmtDate(c.end_date)], ['Renewal Date', c.end_date ? fmtDate(autoRenewalDate(c.end_date)) : '—'], ['Renewal Period', c.renewal_periods ? `${c.renewal_periods} months` : '0']].map(([l, v]) => (
                  <div key={l as string}><p className="text-xs text-muted-foreground">{l}</p><p className={`font-semibold text-sm ${l === 'End Date' && isExpiringSoon(c.end_date) ? 'text-orange-600' : ''} ${l === 'End Date' && isExpired(c.end_date) ? 'text-destructive' : ''}`}>{v}</p></div>
                ))}
              </CardContent>
            </Card>
            {c.notes && <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Notes</CardTitle></CardHeader><CardContent><p className="text-sm whitespace-pre-wrap">{c.notes}</p></CardContent></Card>}
          </TabsContent>

          <TabsContent value="payments" className="mt-4 space-y-3">
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search payments..." value={paymentSearch} onChange={(e) => setPaymentSearch(e.target.value)} className="pl-9" />
            </div>
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortableTableHead label="Month" sortKey="month" sortConfig={paymentSort.sortConfig} onSort={paymentSort.handleSort} />
                    <SortableTableHead label="Bill Date" sortKey="bill_date" sortConfig={paymentSort.sortConfig} onSort={paymentSort.handleSort} />
                    <SortableTableHead label="Due Date" sortKey="due_date" sortConfig={paymentSort.sortConfig} onSort={paymentSort.handleSort} />
                    <SortableTableHead label="Amount Due" sortKey="amount" sortConfig={paymentSort.sortConfig} onSort={paymentSort.handleSort} />
                    <SortableTableHead label="Status" sortKey="status" sortConfig={paymentSort.sortConfig} onSort={paymentSort.handleSort} />
                    <SortableTableHead label="Paid Date" sortKey="paid_date" sortConfig={paymentSort.sortConfig} onSort={paymentSort.handleSort} />
                    <SortableTableHead label="Mode" sortKey="mode" sortConfig={paymentSort.sortConfig} onSort={paymentSort.handleSort} />
                    <SortableTableHead label="Ref #" sortKey="ref" sortConfig={paymentSort.sortConfig} onSort={paymentSort.handleSort} />
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPayments.length === 0 ? (
                    <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">No payments generated yet</TableCell></TableRow>
                  ) : filteredPayments.map((p: any) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-mono text-xs">{fmtMonth(p.payment_month)}</TableCell>
                      <TableCell className="text-xs">{fmtDate((p as any).bill_date || p.due_date)}</TableCell>
                      <TableCell className="text-xs">{fmtDate(p.due_date)}</TableCell>
                      <TableCell className="font-semibold">₹{Number(p.escalated_amount).toLocaleString()}</TableCell>
                      <TableCell><PaymentStatusBadge payment={p} /></TableCell>
                      <TableCell className="text-xs">{fmtDate(p.paid_date)}</TableCell>
                      <TableCell className="text-xs capitalize">{p.payment_mode || '—'}</TableCell>
                      <TableCell className="text-xs">{(p as any).reference_number || '—'}</TableCell>
                      <TableCell>{renderPaymentActions(p)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          <TabsContent value="documents" className="mt-4">
            {docs.length === 0 ? (
              <Card className="p-8 text-center"><FileText className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" /><p className="text-muted-foreground text-sm">No documents uploaded.</p></Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {docs.map((doc) => {
                  const isImg = doc.url.match(/\.(jpg|jpeg|png|gif|webp)(\?|$)/i);
                  return (
                    <Card key={doc.label}><CardContent className="p-4">
                      <p className="text-xs font-semibold text-muted-foreground mb-2">{doc.label}</p>
                      {isImg ? <a href={doc.url} target="_blank" rel="noopener noreferrer"><img src={doc.url} alt={doc.label} className="w-full max-h-48 object-contain rounded border" /></a>
                        : <a href={doc.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-primary hover:underline p-4 border rounded bg-muted/30"><FileText className="h-5 w-5" /><span>View {doc.label}</span><ExternalLink className="h-3 w-3 ml-auto" /></a>}
                    </CardContent></Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>

        <DrawerForm open={editContractOpen} onOpenChange={setEditContractOpen} title="Edit Contract">
          {renderContractFormFields(editContractForm, setEditContractForm, true)}
          <Button className="w-full" onClick={() => updateContract.mutate()} disabled={updateContract.isPending}>Update Contract</Button>
        </DrawerForm>
        {renderRecordPaymentDialog()}
        {renderEditPaymentDialog()}
      </div>
    );
  }

  // --- Owner Detail View ---
  if (selectedOwner) {
    const totalDue = allOwnerPayments.filter((p: any) => p.status === 'pending').reduce((s: number, p: any) => s + Number(p.escalated_amount || 0), 0);
    const totalPaid = allOwnerPayments.filter((p: any) => p.status === 'paid').reduce((s: number, p: any) => s + Number(p.escalated_amount || 0), 0);
    const isActive = selectedOwner.status !== 'inactive';

    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setSelectedOwner(null)}>← Back</Button>
          <div className="flex items-center gap-3 flex-1">
            {selectedOwner.photo_url && <img src={selectedOwner.photo_url} className="h-10 w-10 rounded-full object-cover" alt="" />}
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight">{selectedOwner.full_name}</h1>
                <Badge variant={isActive ? 'default' : 'secondary'}>{isActive ? 'Active' : 'Inactive'}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">{selectedOwner.phone} · {selectedOwner.email}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => { setEditForm({ ...selectedOwner, ...splitName(selectedOwner.full_name) }); setEditOpen(true); }}><Pencil className="h-4 w-4 mr-2" /> Edit</Button>
          <Button variant={isActive ? 'destructive' : 'default'} size="sm" onClick={() => { if (confirm(`${isActive ? 'Deactivate' : 'Activate'} this owner?`)) toggleOwnerStatus.mutate(); }}>
            <Power className="h-4 w-4 mr-2" /> {isActive ? 'Deactivate' : 'Activate'}
          </Button>
        </div>

        <Tabs defaultValue="kyc">
          <TabsList>
            <TabsTrigger value="kyc">KYC Details</TabsTrigger>
            <TabsTrigger value="contracts">Contracts ({contracts.length})</TabsTrigger>
            <TabsTrigger value="all_payments">All Payments ({allOwnerPayments.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="kyc" className="mt-4">
            <Card>
              <CardContent className="p-6 grid grid-cols-2 md:grid-cols-3 gap-4">
                {[['PAN', selectedOwner.pan_number], ['Aadhar', selectedOwner.aadhar_number], ['GST', selectedOwner.gst_number],
                  ['Address', [selectedOwner.address, selectedOwner.city, selectedOwner.state, selectedOwner.pincode].filter(Boolean).join(', ')],
                  ['Bank', selectedOwner.bank_name], ['Account', selectedOwner.bank_account_number], ['IFSC', selectedOwner.bank_ifsc]
                ].map(([label, value]) => (
                  <div key={label as string}><p className="text-xs text-muted-foreground">{label}</p><p className="font-medium text-sm">{(value as string) || '—'}</p></div>
                ))}
                {selectedOwner.id_proof_url && <div><p className="text-xs text-muted-foreground">ID Proof</p><a href={selectedOwner.id_proof_url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary underline">View document</a></div>}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="contracts" className="mt-4 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="relative max-w-sm flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search contracts..." value={contractSearch} onChange={(e) => setContractSearch(e.target.value)} className="pl-9" />
              </div>
              <Button className="gap-2" onClick={() => setContractOpen(true)}><Plus className="h-4 w-4" /> Add Contract</Button>
            </div>

            {filteredContracts.length === 0 ? (
              <Card className="p-8 text-center"><FileText className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" /><p className="text-muted-foreground text-sm">No contracts found.</p></Card>
            ) : (
              <Card>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <SortableTableHead label="Apartment" sortKey="apartment" sortConfig={contractSort.sortConfig} onSort={contractSort.handleSort} />
                      <SortableTableHead label="Property" sortKey="property" sortConfig={contractSort.sortConfig} onSort={contractSort.handleSort} />
                      <SortableTableHead label="Type" sortKey="type" sortConfig={contractSort.sortConfig} onSort={contractSort.handleSort} />
                      <SortableTableHead label="Start" sortKey="start_date" sortConfig={contractSort.sortConfig} onSort={contractSort.handleSort} />
                      <SortableTableHead label="End" sortKey="end_date" sortConfig={contractSort.sortConfig} onSort={contractSort.handleSort} />
                      <SortableTableHead label="Rent" sortKey="monthly_rent" sortConfig={contractSort.sortConfig} onSort={contractSort.handleSort} />
                      <SortableTableHead label="Status" sortKey="status" sortConfig={contractSort.sortConfig} onSort={contractSort.handleSort} />
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredContracts.map((c: any) => {
                      const eStatus = getContractStatus(c);
                      const expiring = isExpiringSoon(c.end_date) && !isExpired(c.end_date);
                      return (
                        <TableRow key={c.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setContractDetailId(c.id)}>
                          <TableCell className="font-mono text-xs">{c.apartments?.apartment_code || '—'}</TableCell>
                          <TableCell className="text-xs">{c.apartments?.properties?.property_name || '—'}</TableCell>
                          <TableCell className="capitalize text-xs">{c.contract_type?.replace(/_/g, ' ')}</TableCell>
                          <TableCell className="text-xs">{fmtDate(c.start_date)}</TableCell>
                          <TableCell className={`text-xs ${expiring ? 'text-orange-600 font-medium' : ''}`}>{fmtDate(c.end_date)}</TableCell>
                          <TableCell className="text-xs">{c.monthly_rent ? `₹${Number(c.monthly_rent).toLocaleString()}` : c.revenue_share_percentage ? `${c.revenue_share_percentage}%` : '—'}</TableCell>
                          <TableCell>
                            <Badge variant={eStatus === 'active' ? 'default' : 'destructive'} className="capitalize">{eStatus}</Badge>
                            {expiring && <Badge className="bg-orange-500 text-white text-[10px] ml-1">Expiring</Badge>}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); renewContract(c); }}><RefreshCw className="h-3 w-3" /></Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={(e) => { e.stopPropagation(); if (confirm('Delete contract?')) deleteContract.mutate(c.id); }}><Trash2 className="h-3 w-3" /></Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="all_payments" className="mt-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card><CardContent className="p-4"><p className="text-2xl font-bold text-green-600">₹{totalPaid.toLocaleString()}</p><p className="text-xs text-muted-foreground">Total Paid</p></CardContent></Card>
              <Card><CardContent className="p-4"><p className="text-2xl font-bold text-yellow-600">₹{totalDue.toLocaleString()}</p><p className="text-xs text-muted-foreground">Total Pending</p></CardContent></Card>
              <Card><CardContent className="p-4"><p className="text-2xl font-bold">{allOwnerPayments.length}</p><p className="text-xs text-muted-foreground">Total Entries</p></CardContent></Card>
            </div>

            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="relative max-w-sm flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search payments..." value={paymentSearch} onChange={(e) => setPaymentSearch(e.target.value)} className="pl-9" />
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button variant="outline" size="sm" className="gap-1" onClick={downloadPaymentTemplate}>
                  <Download className="h-3.5 w-3.5" /> Template
                </Button>
                <Button variant="outline" size="sm" className="gap-1" onClick={() => setImportDialogOpen(true)}>
                  <Upload className="h-3.5 w-3.5" /> Import
                </Button>
                <Button variant="outline" size="sm" className="gap-1" onClick={() => exportPayments('xlsx')}>
                  <Download className="h-3.5 w-3.5" /> Excel
                </Button>
                <Button variant="outline" size="sm" className="gap-1" onClick={() => exportPayments('pdf')}>
                  <Download className="h-3.5 w-3.5" /> PDF
                </Button>
                <Button variant="outline" size="sm" className="gap-2" onClick={() => setRegenDialogOpen(true)}>
                  <RefreshCw className="h-4 w-4" /> Regenerate
                </Button>
              </div>
            </div>

            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortableTableHead label="Apartment" sortKey="apartment" sortConfig={allPaymentSort.sortConfig} onSort={allPaymentSort.handleSort} />
                    <SortableTableHead label="Type" sortKey="type" sortConfig={allPaymentSort.sortConfig} onSort={allPaymentSort.handleSort} />
                    <SortableTableHead label="Month" sortKey="month" sortConfig={allPaymentSort.sortConfig} onSort={allPaymentSort.handleSort} />
                    <SortableTableHead label="Bill Date" sortKey="bill_date" sortConfig={allPaymentSort.sortConfig} onSort={allPaymentSort.handleSort} />
                    <SortableTableHead label="Due Date" sortKey="due_date" sortConfig={allPaymentSort.sortConfig} onSort={allPaymentSort.handleSort} />
                    <SortableTableHead label="Amount" sortKey="amount" sortConfig={allPaymentSort.sortConfig} onSort={allPaymentSort.handleSort} />
                    <SortableTableHead label="Status" sortKey="status" sortConfig={allPaymentSort.sortConfig} onSort={allPaymentSort.handleSort} />
                    <SortableTableHead label="Paid Date" sortKey="paid_date" sortConfig={allPaymentSort.sortConfig} onSort={allPaymentSort.handleSort} />
                    <SortableTableHead label="Mode" sortKey="mode" sortConfig={allPaymentSort.sortConfig} onSort={allPaymentSort.handleSort} />
                    <SortableTableHead label="Ref #" sortKey="ref" sortConfig={allPaymentSort.sortConfig} onSort={allPaymentSort.handleSort} />
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAllPayments.length === 0 ? (
                    <TableRow><TableCell colSpan={11} className="text-center text-muted-foreground py-8">No payments</TableCell></TableRow>
                  ) : filteredAllPayments.map((p: any) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-mono text-xs">{(p as any).apartments?.apartment_code || '—'}</TableCell>
                      <TableCell className="text-xs capitalize">{(p as any).owner_contracts?.contract_type?.replace(/_/g, ' ') || '—'}</TableCell>
                      <TableCell className="font-mono text-xs">{fmtMonth(p.payment_month)}</TableCell>
                      <TableCell className="text-xs">{fmtDate((p as any).bill_date || null)}</TableCell>
                      <TableCell className="text-xs">{fmtDate(p.due_date)}</TableCell>
                      <TableCell className="font-semibold">₹{Number(p.escalated_amount).toLocaleString()}</TableCell>
                      <TableCell><PaymentStatusBadge payment={p} /></TableCell>
                      <TableCell className="text-xs">{fmtDate(p.paid_date)}</TableCell>
                      <TableCell className="text-xs capitalize">{p.payment_mode || '—'}</TableCell>
                      <TableCell className="text-xs">{(p as any).reference_number || '—'}</TableCell>
                      <TableCell>{renderPaymentActions(p)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>
        </Tabs>

        <DrawerForm open={editOpen} onOpenChange={setEditOpen} title="Edit Owner">
          {renderOwnerFormFields(editForm, setEditForm)}
          <Button className="w-full" onClick={() => updateOwner.mutate()} disabled={updateOwner.isPending}>Update Owner</Button>
        </DrawerForm>

        <DrawerForm open={contractOpen} onOpenChange={setContractOpen} title={`Add Contract for ${selectedOwner.full_name}`}>
          {renderContractFormFields(contractForm, setContractForm, false)}
          <Button className="w-full" onClick={() => createContract.mutate()} disabled={createContract.isPending}>Add Contract</Button>
        </DrawerForm>

        {renderRecordPaymentDialog()}
        {renderEditPaymentDialog()}

        {/* Regenerate Bills Dialog */}
        <Dialog open={regenDialogOpen} onOpenChange={setRegenDialogOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Regenerate Bills</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Choose which bills to regenerate for {selectedOwner?.full_name}. Paid bills will be preserved.</p>
              <div>
                <Label>Regenerate Mode</Label>
                <Select value={regenMode} onValueChange={(v: any) => setRegenMode(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Bills (preserve paid status)</SelectItem>
                    <SelectItem value="pending">Only Pending Bills</SelectItem>
                    <SelectItem value="current">Current Month Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button className="w-full" onClick={() => regenerateBills.mutate()} disabled={regenerateBills.isPending}>
                <RefreshCw className="h-4 w-4 mr-2" /> Regenerate
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Import Payments Dialog */}
        <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Import Payments</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Upload an Excel file with payment data for {selectedOwner?.full_name}. Use the template for the correct format.</p>
              <div>
                <Label>Import Mode</Label>
                <Select value={importMode} onValueChange={(v: any) => setImportMode(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="append">Append to existing data</SelectItem>
                    <SelectItem value="replace">Replace all existing data</SelectItem>
                  </SelectContent>
                </Select>
                {importMode === 'replace' && <p className="text-xs text-destructive mt-1">⚠ This will delete all existing payment records for this owner's contracts.</p>}
              </div>
              <div>
                <Label>Excel File</Label>
                <div
                  onClick={() => importRef.current?.click()}
                  className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors"
                >
                  {importFile ? (
                    <p className="text-sm font-medium">{importFile.name}</p>
                  ) : (
                    <>
                      <Upload className="h-6 w-6 mx-auto text-muted-foreground mb-1" />
                      <p className="text-xs text-muted-foreground">Click to select .xlsx file</p>
                    </>
                  )}
                </div>
                <input ref={importRef} type="file" accept=".xlsx,.xls" onChange={(e) => setImportFile(e.target.files?.[0] || null)} className="hidden" />
              </div>
              <Button className="w-full" onClick={handleImportPayments} disabled={!importFile || importing}>
                <Upload className="h-4 w-4 mr-2" /> {importing ? 'Importing...' : 'Import'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // --- Owner List View ---
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Owners</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage property owners, KYC and contracts</p>
        </div>
        <Button className="gap-2" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Add Owner</Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search owners..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      {isLoading ? (
        <CardGridSkeleton count={6} />
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center"><UserCircle className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" /><p className="text-muted-foreground">No owners yet.</p></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((o: any, i: number) => {
            const ownerContracts = allOwnerContracts.filter((c: any) => c.owner_id === o.id);
            const aptCodes = ownerContracts.map((c: any) => c.apartments?.apartment_code).filter(Boolean);
            const earliestStart = ownerContracts.reduce((min: string | null, c: any) => {
              if (!c.start_date) return min;
              return !min || c.start_date < min ? c.start_date : min;
            }, null as string | null);
            const landlordMonths = earliestStart ? differenceInMonths(new Date(), new Date(earliestStart)) : 0;
            const landlordYears = (landlordMonths / 12).toFixed(2);
            const totalPaid = allOwnerPaymentsForCards.filter((p: any) => p.owner_id === o.id).reduce((s: number, p: any) => s + Number(p.escalated_amount || 0), 0);
            const pastelColors = [
              'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800',
              'bg-sky-50 dark:bg-sky-950/30 border-sky-200 dark:border-sky-800',
              'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800',
              'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800',
              'bg-violet-50 dark:bg-violet-950/30 border-violet-200 dark:border-violet-800',
              'bg-teal-50 dark:bg-teal-950/30 border-teal-200 dark:border-teal-800',
            ];
            const cardColor = pastelColors[i % pastelColors.length];
            return (
            <motion.div key={o.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Card className={`hover:shadow-lg transition-all cursor-pointer border-2 ${cardColor} ${o.status === 'inactive' ? 'opacity-60' : ''}`} onClick={() => setSelectedOwner(o)}>
                <CardContent className="p-5">
                  <div className="flex items-center gap-3">
                    {o.photo_url ? <img src={o.photo_url} className="h-12 w-12 rounded-full object-cover ring-2 ring-primary/20" alt="" /> : <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center"><UserCircle className="h-6 w-6 text-primary" /></div>}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-base truncate">{o.full_name}</h3>
                        {o.status === 'inactive' && <Badge variant="secondary" className="text-xs">Inactive</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground font-medium">{o.phone || o.email || 'No contact'}</p>
                    </div>
                  </div>
                  {ownerContracts.length > 0 && (
                    <div className="mt-3 space-y-1.5 border-t pt-3">
                      {aptCodes.length > 0 && (
                        <p className="text-xs text-muted-foreground"><span className="font-bold text-foreground">Apartments:</span> {aptCodes.join(', ')}</p>
                      )}
                      {earliestStart && (
                        <p className="text-xs text-muted-foreground">Landlord since: <span className="font-bold text-foreground">{landlordMonths} months ({landlordYears} yrs)</span></p>
                      )}
                      <p className="text-xs text-muted-foreground">Total Rental Paid: <span className="font-bold text-green-700 dark:text-green-400">₹{totalPaid.toLocaleString()}</span></p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
            );
          })}
        </div>
      )}

      <DrawerForm open={open} onOpenChange={setOpen} title="Add New Owner">
        {renderOwnerFormFields(form, setForm)}
        <Button className="w-full" onClick={() => createOwner.mutate()} disabled={createOwner.isPending}>Create Owner</Button>
      </DrawerForm>
    </div>
  );
}
