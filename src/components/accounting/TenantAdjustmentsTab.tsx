import { useState, useMemo, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Progress } from '@/components/ui/progress';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Plus, Pencil, Trash2, Download, Upload, Search, Loader2, FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useRBAC } from '@/hooks/useRBAC';
import { useQueryClient } from '@tanstack/react-query';
import { useAuditLog } from '@/hooks/useAuditLog';
import { DatePickerField } from '@/components/shared/DatePickerField';
import { SortableTableHead, useSort } from '@/components/shared/SortableTableHead';
import { searchAllFields } from '@/lib/search-utils';
import { fmtMonthLabel, parseExcelDateUTC } from '@/lib/date-utils';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

const fmtDate = (d: string | null) => {
  if (!d) return '—';
  try { return format(new Date(d), 'dd-MMM-yy'); } catch { return d; }
};
const fmtAmt = (v: number) => `₹${new Intl.NumberFormat('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Math.round(v))}`;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const TEMPLATE_COLS = ['Tenant ID', 'Allotment ID', 'Type (credit_note/debit_note)', 'Amount', 'Adjustment Date', 'Billing Month', 'Reason', 'Reference Number', 'Property ID', 'Apartment ID', 'Bed ID'];

interface Props {
  adjustments: any[];
  tenants: any[];
  allotments: any[];
  properties: any[];
  apartments: any[];
  beds: any[];
  orgId: string;
}

const emptyForm = {
  tenant_id: '', allotment_id: '', adjustment_type: 'credit_note', amount: '',
  reason: '', reference_number: '', adjustment_date: format(new Date(), 'yyyy-MM-dd'),
  billing_month: '', property_id: '', apartment_id: '', bed_id: '',
};

export function TenantAdjustmentsTab({ adjustments, tenants, allotments, properties, apartments, beds, orgId }: Props) {
  const qc = useQueryClient();
  const { log: auditLog } = useAuditLog();
  const { canPerform } = useRBAC();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<any>({ ...emptyForm });
  const [editId, setEditId] = useState<string | null>(null);

  const [propertyFilter, setPropertyFilter] = useState('all');
  const [monthFilter, setMonthFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const { sortConfig, handleSort, sortData } = useSort('adjustment_date', 'desc');

  // Import state
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importMode, setImportMode] = useState<'replace' | 'append'>('append');
  const [importProgress, setImportProgress] = useState<{ current: number; total: number; status: string } | null>(null);

  const uniqueMonths = useMemo(() => {
    const months = new Set<string>();
    adjustments.forEach((a: any) => { if (a.billing_month) months.add(a.billing_month); });
    return Array.from(months).sort().reverse();
  }, [adjustments]);

  const activeTenants = useMemo(() => {
    return allotments
      .filter((a: any) => ['Staying', 'On-Notice'].includes(a.staying_status || ''))
      .map((a: any) => {
        const t = tenants.find((t: any) => t.id === a.tenant_id);
        const apt = apartments.find((ap: any) => ap.id === a.apartment_id);
        const bed = beds.find((b: any) => b.id === a.bed_id);
        return { tenant_id: a.tenant_id, allotment_id: a.id, full_name: t?.full_name || 'Unknown', apartment_code: apt?.apartment_code || '', bed_code: bed?.bed_code || '', property_id: a.property_id, apartment_id: a.apartment_id, bed_id: a.bed_id };
      })
      .sort((a, b) => a.full_name.localeCompare(b.full_name));
  }, [allotments, tenants, apartments, beds]);

  const filtered = useMemo(() => {
    let list = adjustments;
    if (propertyFilter !== 'all') list = list.filter((a: any) => a.property_id === propertyFilter);
    if (monthFilter !== 'all') list = list.filter((a: any) => a.billing_month === monthFilter);
    if (searchQuery.trim()) list = list.filter((a: any) => searchAllFields(a, searchQuery));
    return sortData(list, (item, key) => {
      if (key === 'tenant') return item.tenants?.full_name || '';
      if (key === 'type') return item.adjustment_type || '';
      return item[key];
    });
  }, [adjustments, propertyFilter, monthFilter, searchQuery, sortConfig]);

  const totalCredits = filtered.filter((a: any) => a.adjustment_type === 'credit_note').reduce((s: number, a: any) => s + Number(a.amount || 0), 0);
  const totalDebits = filtered.filter((a: any) => a.adjustment_type === 'debit_note').reduce((s: number, a: any) => s + Number(a.amount || 0), 0);

  const handleSave = async () => {
    if (!form.tenant_id || !form.amount || !form.adjustment_type) {
      toast({ title: 'Tenant, type & amount required', variant: 'destructive' }); return;
    }
    const selectedTenant = activeTenants.find((t: any) => t.tenant_id === form.tenant_id);
    const payload = {
      organization_id: orgId, tenant_id: form.tenant_id,
      allotment_id: selectedTenant?.allotment_id || form.allotment_id || null,
      adjustment_type: form.adjustment_type, amount: parseFloat(form.amount),
      reason: form.reason || null, reference_number: form.reference_number || null,
      adjustment_date: form.adjustment_date, billing_month: form.billing_month || null,
      property_id: selectedTenant?.property_id || form.property_id || null,
      apartment_id: selectedTenant?.apartment_id || form.apartment_id || null,
      bed_id: selectedTenant?.bed_id || form.bed_id || null,
    };
    try {
      if (editId) {
        const { error } = await supabase.from('tenant_adjustments' as any).update(payload).eq('id', editId);
        if (error) throw error;
        auditLog('tenant_adjustments', editId, 'updated', payload);
        toast({ title: 'Adjustment updated' });
      } else {
        const { data, error } = await supabase.from('tenant_adjustments' as any).insert(payload).select().single();
        if (error) throw error;
        auditLog('tenant_adjustments', (data as any).id, 'created', payload);
        toast({ title: 'Adjustment added' });
      }
      setDialogOpen(false); setEditId(null); setForm({ ...emptyForm });
      qc.invalidateQueries({ queryKey: ['acc-adjustments'] });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const handleEdit = (a: any) => {
    setEditId(a.id);
    setForm({
      tenant_id: a.tenant_id || '', allotment_id: a.allotment_id || '',
      adjustment_type: a.adjustment_type || 'credit_note', amount: String(a.amount),
      reason: a.reason || '', reference_number: a.reference_number || '',
      adjustment_date: a.adjustment_date || '', billing_month: a.billing_month || '',
      property_id: a.property_id || '', apartment_id: a.apartment_id || '', bed_id: a.bed_id || '',
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this adjustment?')) return;
    await supabase.from('tenant_adjustments' as any).delete().eq('id', id);
    auditLog('tenant_adjustments', id, 'deleted', {});
    qc.invalidateQueries({ queryKey: ['acc-adjustments'] });
    toast({ title: 'Adjustment deleted' });
  };

  // Download template
  const handleDownloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([TEMPLATE_COLS]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Adjustments');
    saveAs(new Blob([XLSX.write(wb, { bookType: 'xlsx', type: 'array' })]), 'adjustments-template.xlsx');
    toast({ title: 'Template downloaded' });
  };

  // Export Excel
  const handleExportExcel = () => {
    const data = filtered.map((a: any) => ({
      'Date': a.adjustment_date || '', 'Tenant': a.tenants?.full_name || '',
      'Type': a.adjustment_type === 'credit_note' ? 'Credit Note' : 'Debit Note',
      'Amount': Number(a.amount || 0), 'Reason': a.reason || '', 'Reference': a.reference_number || '',
      'Property': a.properties?.property_name || '', 'Month': a.billing_month || '',
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Adjustments');
    saveAs(new Blob([XLSX.write(wb, { bookType: 'xlsx', type: 'array' })]), `adjustments-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    toast({ title: 'Excel exported' });
  };

  // File select → open import mode dialog
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFile(file);
    setImportMode('append');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Execute import
  const executeImport = async () => {
    if (!importFile) return;
    const file = importFile;
    setImportFile(null);

    const tenantIds = new Set((tenants || []).map((t: any) => t.id));
    const allotmentIds = new Set((allotments || []).map((a: any) => a.id));
    const propertyIds = new Set((properties || []).map((p: any) => p.id));
    const apartmentIds = new Set((apartments || []).map((a: any) => a.id));
    const bedIds = new Set((beds || []).map((b: any) => b.id));
    const normalizeUuid = (value: unknown) => {
      const text = String(value || '').trim();
      return UUID_RE.test(text) ? text : '';
    };
    const parseAmountValue = (value: unknown) => {
      if (typeof value === 'number') return value;
      const cleaned = String(value || '').replace(/[₹,\s]/g, '');
      const parsed = Number(cleaned);
      return Number.isFinite(parsed) ? parsed : 0;
    };

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const wb = XLSX.read(evt.target?.result, { type: 'binary', cellDates: true });
        const rows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
        if (rows.length === 0) { toast({ title: 'No data rows found', variant: 'destructive' }); return; }

        const totalRows = rows.length;
        let created = 0, skipped = 0;
        const rowErrors: string[] = [];
        setImportProgress({ current: 0, total: totalRows, status: 'Parsing rows…' });

        if (importMode === 'replace') {
          setImportProgress({ current: 0, total: totalRows, status: 'Removing existing adjustments…' });
          const { error } = await supabase.from('tenant_adjustments' as any).delete().eq('organization_id', orgId);
          if (error) throw error;
        }

        const BATCH_SIZE = 50;
        for (let i = 0; i < rows.length; i += BATCH_SIZE) {
          const batch = rows.slice(i, i + BATCH_SIZE);
          setImportProgress({ current: i, total: totalRows, status: `Processing rows ${i + 1}–${Math.min(i + BATCH_SIZE, totalRows)}…` });

          const inserts: any[] = [];
          for (let index = 0; index < batch.length; index += 1) {
            const row = batch[index];
            const rowNumber = i + index + 2;
            const tenantId = normalizeUuid(row['Tenant ID']);
            const allotmentId = normalizeUuid(row['Allotment ID']);
            const rawType = String(row['Type (credit_note/debit_note)'] || row['Type'] || 'credit_note').trim().toLowerCase();
            const adjType = rawType.includes('debit') ? 'debit_note' : 'credit_note';
            const amount = parseAmountValue(row['Amount']);
            const rawDate = row['Adjustment Date'] || row['Date'] || '';
            const adjDate = parseExcelDateUTC(rawDate) || format(new Date(), 'yyyy-MM-dd');
            const rawBillingMonth = String(row['Billing Month'] || '').trim();
            const billingMonth = /^\d{4}-\d{2}$/.test(rawBillingMonth)
              ? rawBillingMonth
              : adjDate.substring(0, 7);
            const reason = String(row['Reason'] || '').trim();
            const refNum = String(row['Reference Number'] || row['Reference'] || '').trim();
            const propertyId = normalizeUuid(row['Property ID']);
            const apartmentId = normalizeUuid(row['Apartment ID']);
            const bedId = normalizeUuid(row['Bed ID']);

            if (!tenantId) {
              skipped += 1;
              rowErrors.push(`Row ${rowNumber}: missing or invalid Tenant ID`);
              continue;
            }
            if (!tenantIds.has(tenantId)) {
              skipped += 1;
              rowErrors.push(`Row ${rowNumber}: Tenant ID not found in current database`);
              continue;
            }
            if (allotmentId && !allotmentIds.has(allotmentId)) {
              skipped += 1;
              rowErrors.push(`Row ${rowNumber}: Allotment ID not found in current database`);
              continue;
            }
            if (propertyId && !propertyIds.has(propertyId)) {
              skipped += 1;
              rowErrors.push(`Row ${rowNumber}: Property ID not found in current database`);
              continue;
            }
            if (apartmentId && !apartmentIds.has(apartmentId)) {
              skipped += 1;
              rowErrors.push(`Row ${rowNumber}: Apartment ID not found in current database`);
              continue;
            }
            if (bedId && !bedIds.has(bedId)) {
              skipped += 1;
              rowErrors.push(`Row ${rowNumber}: Bed ID not found in current database`);
              continue;
            }
            if (amount <= 0) {
              skipped += 1;
              rowErrors.push(`Row ${rowNumber}: Amount must be greater than zero`);
              continue;
            }

            inserts.push({
              organization_id: orgId,
              tenant_id: tenantId,
              allotment_id: allotmentId || null,
              adjustment_type: adjType,
              amount,
              adjustment_date: adjDate,
              billing_month: billingMonth || null,
              reason: reason || null,
              reference_number: refNum || null,
              property_id: propertyId || null,
              apartment_id: apartmentId || null,
              bed_id: bedId || null,
            });
          }

          if (inserts.length > 0) {
            const { error } = await supabase.from('tenant_adjustments' as any).insert(inserts);
            if (error) {
              throw new Error(error.message || 'Failed to insert tenant adjustments');
            }
            created += inserts.length;
          }
        }

        setImportProgress(null);
        qc.invalidateQueries({ queryKey: ['acc-adjustments'] });
        if (rowErrors.length > 0) {
          toast({
            title: `${created} adjustment(s) imported, ${skipped} skipped`,
            description: rowErrors.slice(0, 3).join(' • ') + (rowErrors.length > 3 ? ` • +${rowErrors.length - 3} more` : ''),
            variant: 'destructive',
          });
          return;
        }
        toast({ title: `${created} adjustment(s) imported` });
      } catch (err: any) {
        setImportProgress(null);
        toast({ title: 'Import error', description: err.message, variant: 'destructive' });
      }
    };
    reader.readAsBinaryString(file);
  };

  return (
    <div className="space-y-4">
      {/* Import Progress */}
      {importProgress && (
        <Card className="border-primary">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span className="text-sm font-medium">{importProgress.status}</span>
              <span className="ml-auto text-xs text-muted-foreground">{importProgress.current}/{importProgress.total} rows</span>
            </div>
            <Progress value={importProgress.total > 0 ? (importProgress.current / importProgress.total) * 100 : 0} className="h-2" />
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-3 gap-4">
        <Card><CardContent className="p-4">
          <p className="text-2xl font-bold text-green-600">{fmtAmt(totalCredits)}</p>
          <p className="text-xs text-muted-foreground">Total Credits</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-2xl font-bold text-destructive">{fmtAmt(totalDebits)}</p>
          <p className="text-xs text-muted-foreground">Total Debits</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className={`text-2xl font-bold ${totalCredits - totalDebits >= 0 ? 'text-green-600' : 'text-destructive'}`}>{fmtAmt(totalCredits - totalDebits)}</p>
          <p className="text-xs text-muted-foreground">Net Adjustment</p>
        </CardContent></Card>
      </div>

      <div className="flex flex-wrap gap-3 items-center bg-info-panel rounded-lg p-3">
        <Select value={propertyFilter} onValueChange={setPropertyFilter}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Property" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Properties</SelectItem>
            {properties.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.property_name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={monthFilter} onValueChange={setMonthFilter}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Month" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Months</SelectItem>
            {uniqueMonths.map(m => <SelectItem key={m} value={m}>{fmtMonthLabel(m)}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search adjustments…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-8 h-9" />
        </div>
        <div className="ml-auto flex gap-2">
          <Button size="sm" className="gap-1.5" onClick={() => { setEditId(null); setForm({ ...emptyForm }); setDialogOpen(true); }}>
            <Plus className="h-3.5 w-3.5" /> Add Adjustment
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5"><Download className="h-3.5 w-3.5" /> Export</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={handleExportExcel}><Download className="h-3.5 w-3.5 mr-2" /> Excel</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5" disabled={!!importProgress}><Upload className="h-3.5 w-3.5" /> Import</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={handleDownloadTemplate}><Download className="h-3.5 w-3.5 mr-2" /> Download Template</DropdownMenuItem>
              <DropdownMenuItem onClick={() => fileInputRef.current?.click()}><Upload className="h-3.5 w-3.5 mr-2" /> Upload Excel</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileSelect} />
        </div>
      </div>

      <Card>
        <Table>
          <TableHeader className="bg-table-header">
            <tr>
              <SortableTableHead label="Date" sortKey="adjustment_date" sortConfig={sortConfig} onSort={handleSort} />
              <SortableTableHead label="Tenant" sortKey="tenant" sortConfig={sortConfig} onSort={handleSort} />
              <SortableTableHead label="Type" sortKey="type" sortConfig={sortConfig} onSort={handleSort} />
              <SortableTableHead label="Amount" sortKey="amount" sortConfig={sortConfig} onSort={handleSort} />
              <SortableTableHead label="Reason" sortKey="reason" sortConfig={sortConfig} onSort={handleSort} />
              <SortableTableHead label="Reference" sortKey="reference_number" sortConfig={sortConfig} onSort={handleSort} />
              <SortableTableHead label="Month" sortKey="billing_month" sortConfig={sortConfig} onSort={handleSort} />
              <SortableTableHead label="Actions" sortKey="" sortConfig={sortConfig} onSort={() => {}} />
            </tr>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <tr><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No adjustments</TableCell></tr>
            ) : filtered.map((a: any) => (
              <tr key={a.id} className="border-b transition-colors hover:bg-muted/50 even:bg-table-row-alt">
                <TableCell className="text-xs">{fmtDate(a.adjustment_date)}</TableCell>
                <TableCell>{a.tenants?.full_name || '—'}</TableCell>
                <TableCell>
                  <Badge variant={a.adjustment_type === 'credit_note' ? 'default' : 'destructive'} className="capitalize">
                    {a.adjustment_type === 'credit_note' ? 'Credit' : 'Debit'}
                  </Badge>
                </TableCell>
                <TableCell className={`font-semibold ${a.adjustment_type === 'credit_note' ? 'text-green-600' : 'text-destructive'}`}>
                  {fmtAmt(Number(a.amount))}
                </TableCell>
                <TableCell className="text-sm max-w-[200px] truncate">{a.reason || '—'}</TableCell>
                <TableCell className="text-xs">{a.reference_number || '—'}</TableCell>
                <TableCell className="text-xs">{fmtMonthLabel(a.billing_month)}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(a)}><Pencil className="h-3 w-3" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(a.id)}><Trash2 className="h-3 w-3" /></Button>
                  </div>
                </TableCell>
              </tr>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editId ? 'Edit' : 'Add'} Adjustment</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Tenant</Label>
              <Select value={form.tenant_id} onValueChange={v => {
                const t = activeTenants.find((t: any) => t.tenant_id === v);
                setForm({ ...form, tenant_id: v, property_id: t?.property_id || '', apartment_id: t?.apartment_id || '', bed_id: t?.bed_id || '', allotment_id: t?.allotment_id || '' });
              }}>
                <SelectTrigger><SelectValue placeholder="Select tenant" /></SelectTrigger>
                <SelectContent>
                  {activeTenants.map(t => <SelectItem key={t.tenant_id} value={t.tenant_id}>{t.full_name} — {t.apartment_code}/{t.bed_code}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Type</Label>
              <Select value={form.adjustment_type} onValueChange={v => setForm({ ...form, adjustment_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="credit_note">Credit Note</SelectItem>
                  <SelectItem value="debit_note">Debit Note</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Amount (₹)</Label><Input type="number" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} /></div>
            <DatePickerField label="Date" value={form.adjustment_date} onChange={v => setForm({ ...form, adjustment_date: v })} />
            <div><Label>Billing Month</Label><Input placeholder="yyyy-MM" value={form.billing_month} onChange={e => setForm({ ...form, billing_month: e.target.value })} /></div>
            <div><Label>Reason</Label><Textarea value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} /></div>
            <div><Label>Reference Number</Label><Input value={form.reference_number} onChange={e => setForm({ ...form, reference_number: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}>{editId ? 'Update' : 'Add'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Mode Dialog */}
      <Dialog open={!!importFile} onOpenChange={() => setImportFile(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Import Adjustments</DialogTitle></DialogHeader>
          <RadioGroup value={importMode} onValueChange={(v: any) => setImportMode(v)} className="space-y-2">
            <div className="flex items-center gap-2">
              <RadioGroupItem value="append" id="adj-append" />
              <Label htmlFor="adj-append">Append — add new rows</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="replace" id="adj-replace" />
              <Label htmlFor="adj-replace">Replace — delete all & re-import</Label>
            </div>
          </RadioGroup>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportFile(null)}>Cancel</Button>
            <Button onClick={executeImport}>Import</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
