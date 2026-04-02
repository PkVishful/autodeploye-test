import { useState, useMemo, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Progress } from '@/components/ui/progress';
import { Plus, Pencil, Trash2, Download, Upload, Search, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useRBAC } from '@/hooks/useRBAC';
import { exportExpenses } from '@/lib/export-utils';
import { useQueryClient } from '@tanstack/react-query';
import { useAuditLog } from '@/hooks/useAuditLog';
import { DatePickerField } from '@/components/shared/DatePickerField';
import { FileUploadField } from '@/components/shared/FileUploadField';
import { SortableTableHead, useSort } from '@/components/shared/SortableTableHead';
import { searchAllFields, searchDisplayValues } from '@/lib/search-utils';
import { parseExcelDateUTC, fmtMonthLabel } from '@/lib/date-utils';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

const CATEGORIES = [
  { value: 'property_rent', label: 'Property Rent' },
  { value: 'eb_actual', label: 'EB Actual Bill' },
  { value: 'maintenance', label: 'Maintenance & Repairs' },
  { value: 'housekeeping', label: 'Housekeeping' },
  { value: 'staff_salaries', label: 'Staff Salaries' },
  { value: 'wifi', label: 'WiFi' },
  { value: 'supplies', label: 'Supplies & Consumables' },
  { value: 'misc', label: 'Miscellaneous' },
];

const SUBCATEGORIES: Record<string, { value: string; label: string }[]> = {
  maintenance: [
    { value: 'ac', label: 'AC' }, { value: 'fridge', label: 'Fridge' }, { value: 'washing_machine', label: 'Washing Machine' },
    { value: 'carpentry', label: 'Carpentry' }, { value: 'plumbing', label: 'Plumbing' }, { value: 'electrical', label: 'Electrical' },
    { value: 'painting', label: 'Painting' }, { value: 'pest_control', label: 'Pest Control' }, { value: 'cctv', label: 'CCTV' },
    { value: 'lift', label: 'Lift / Elevator' }, { value: 'water_purifier', label: 'Water Purifier' }, { value: 'geyser', label: 'Geyser' },
    { value: 'other', label: 'Other' },
  ],
  housekeeping: [
    { value: 'cleaning', label: 'Cleaning' }, { value: 'laundry', label: 'Laundry' }, { value: 'waste_disposal', label: 'Waste Disposal' }, { value: 'other', label: 'Other' },
  ],
  supplies: [
    { value: 'cleaning_materials', label: 'Cleaning Materials' }, { value: 'toiletries', label: 'Toiletries' }, { value: 'kitchen', label: 'Kitchen Supplies' },
    { value: 'stationery', label: 'Stationery' }, { value: 'other', label: 'Other' },
  ],
  eb_actual: [
    { value: 'common_area', label: 'Common Area' }, { value: 'apartment', label: 'Apartment Meter' }, { value: 'other', label: 'Other' },
  ],
};

const catLabel = (v: string) => CATEGORIES.find(c => c.value === v)?.label || v;
const subCatLabel = (cat: string, sub: string) => SUBCATEGORIES[cat]?.find(s => s.value === sub)?.label || sub;

const fmtDate = (d: string | null) => {
  if (!d) return '—';
  try { return format(new Date(d), 'dd-MMM-yy'); } catch { return d; }
};

interface Props {
  expenses: any[];
  properties: any[];
  apartments: any[];
  beds: any[];
  vendors: any[];
  orgId: string;
}

const emptyForm = {
  property_id: '', apartment_id: '', bed_id: '', category: 'misc', subcategory: '',
  vendor_id: '', description: '', amount: '', expense_date: format(new Date(), 'yyyy-MM-dd'),
  billing_month: '', receipt_url: '', bill_photo_url: '',
};

const TEMPLATE_COLS = ['Property Name', 'Apartment Code', 'Category', 'Subcategory', 'Vendor', 'Description', 'Amount', 'Expense Date', 'Billing Month'];

export function ExpensesTab({ expenses, properties, apartments, beds, vendors, orgId }: Props) {
  const qc = useQueryClient();
  const { log: auditLog } = useAuditLog();
  const { canPerform } = useRBAC();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<any>({ ...emptyForm });
  const [editId, setEditId] = useState<string | null>(null);

  // Filters
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [propertyFilter, setPropertyFilter] = useState('all');
  const [monthFilter, setMonthFilter] = useState(format(new Date(), 'yyyy-MM'));
  const [searchQuery, setSearchQuery] = useState('');

  // Sort
  const { sortConfig, handleSort, sortData } = useSort('expense_date', 'desc');

  // Import state
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importProgress, setImportProgress] = useState<{ current: number; total: number; status: string } | null>(null);

  // Unique months
  const uniqueMonths = useMemo(() => {
    const months = new Set<string>();
    expenses.forEach((e: any) => { if (e.billing_month) months.add(e.billing_month); });
    return Array.from(months).sort().reverse();
  }, [expenses]);

  // Filtered & sorted
  const filteredExpenses = useMemo(() => {
    let list = expenses;
    if (categoryFilter !== 'all') list = list.filter((e: any) => e.category?.startsWith(categoryFilter));
    if (propertyFilter !== 'all') list = list.filter((e: any) => e.property_id === propertyFilter);
    if (monthFilter !== 'all') list = list.filter((e: any) => e.billing_month === monthFilter);
    if (searchQuery.trim()) list = list.filter((e: any) => searchDisplayValues([
      e.properties?.property_name, e.apartments?.apartment_code, e.category,
      e.description, e.vendor, getVendorName(e), String(e.amount),
      e.expense_date ? fmtDate(e.expense_date) : '', e.billing_month,
    ], searchQuery));
    return sortData(list, (item, key) => {
      if (key === 'property') return item.properties?.property_name || '';
      if (key === 'apartment') return item.apartments?.apartment_code || '';
      if (key === 'category') return item.category || '';
      return item[key];
    });
  }, [expenses, categoryFilter, propertyFilter, monthFilter, searchQuery, sortConfig]);

  const filteredApartments = form.property_id ? apartments.filter((a: any) => a.property_id === form.property_id) : apartments;
  const filteredBeds = form.apartment_id ? beds.filter((b: any) => b.apartment_id === form.apartment_id) : [];
  const subcategories = SUBCATEGORIES[form.category] || [];
  const totalExpenses = filteredExpenses.reduce((s: number, e: any) => s + Number(e.amount || 0), 0);

  const getVendorName = (expense: any) => {
    if (expense.vendor) return expense.vendor;
    const v = vendors.find((vn: any) => vn.id === expense.vendor_id);
    return v?.vendor_name || '—';
  };

  const handleSave = async () => {
    if (!form.property_id || !form.category || !form.amount) {
      toast({ title: 'Property, category & amount required', variant: 'destructive' }); return;
    }
    const selectedVendor = vendors.find((v: any) => v.id === form.vendor_id);
    const payload = {
      organization_id: orgId, property_id: form.property_id,
      apartment_id: form.apartment_id || null, bed_id: form.bed_id || null,
      category: form.subcategory ? `${form.category}:${form.subcategory}` : form.category,
      vendor: selectedVendor ? selectedVendor.vendor_name : (form.vendor_id || null),
      description: form.description || null, amount: parseFloat(form.amount),
      expense_date: form.expense_date, billing_month: form.billing_month || null,
      receipt_url: form.receipt_url || form.bill_photo_url || null,
    };
    try {
      if (editId) {
        const { error } = await supabase.from('expenses' as any).update(payload).eq('id', editId);
        if (error) throw error;
        auditLog('expenses', editId, 'updated', payload);
        toast({ title: 'Expense updated' });
      } else {
        const { data, error } = await supabase.from('expenses' as any).insert(payload).select().single();
        if (error) throw error;
        auditLog('expenses', (data as any).id, 'created', payload);
        toast({ title: 'Expense added' });
      }
      setDialogOpen(false); setEditId(null); setForm({ ...emptyForm });
      qc.invalidateQueries({ queryKey: ['acc-expenses'] });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    await supabase.from('expenses' as any).delete().eq('id', id);
    auditLog('expenses', id, 'deleted', {});
    qc.invalidateQueries({ queryKey: ['acc-expenses'] });
    toast({ title: 'Expense deleted' });
  };

  const handleEdit = (e: any) => {
    const catParts = (e.category || '').split(':');
    setEditId(e.id);
    setForm({
      property_id: e.property_id || '', apartment_id: e.apartment_id || '', bed_id: e.bed_id || '',
      category: catParts[0], subcategory: catParts[1] || '', vendor_id: '', description: e.description || '',
      amount: String(e.amount), expense_date: e.expense_date || '', billing_month: e.billing_month || '',
      receipt_url: e.receipt_url || '', bill_photo_url: '',
    });
    setDialogOpen(true);
  };

  const displayCategory = (cat: string) => {
    const parts = cat.split(':');
    const main = catLabel(parts[0]);
    if (parts[1]) return `${main} › ${subCatLabel(parts[0], parts[1])}`;
    return main;
  };

  // Template download
  const handleDownloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([TEMPLATE_COLS, ['Property A', 'APT-101', 'maintenance', 'plumbing', 'Vendor Name', 'Fixed leak', '2500', '2025-01-15', '2025-01']]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Expenses');
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([wbout]), 'expenses-import-template.xlsx');
  };

  // File select
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFile(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Import
  const executeImport = async (mode: 'replace' | 'append') => {
    if (!importFile) return;
    setImportFile(null);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const wb = XLSX.read(evt.target?.result, { type: 'binary' });
        const rows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
        if (!rows.length) { toast({ title: 'No data rows', variant: 'destructive' }); return; }

        let created = 0, skipped = 0;
        setImportProgress({ current: 0, total: rows.length, status: 'Processing…' });

        if (mode === 'replace') {
          setImportProgress({ current: 0, total: rows.length, status: 'Clearing existing expenses…' });
          await supabase.from('expenses' as any).delete().eq('organization_id', orgId);
        }

        const BATCH = 200;
        for (let i = 0; i < rows.length; i += BATCH) {
          const batch = rows.slice(i, i + BATCH);
          setImportProgress({ current: i, total: rows.length, status: `Rows ${i + 1}–${Math.min(i + BATCH, rows.length)}…` });

          const inserts = batch.map(row => {
            const propName = String(row['Property Name'] || '').trim();
            const aptCode = String(row['Apartment Code'] || '').trim();
            const cat = String(row['Category'] || 'misc').trim();
            const subCat = String(row['Subcategory'] || '').trim();
            const vendor = String(row['Vendor'] || '').trim();
            const desc = String(row['Description'] || '').trim();
            const amount = Number(row['Amount'] || 0);
            const expDate = parseExcelDateUTC(row['Expense Date']) || format(new Date(), 'yyyy-MM-dd');
            const billingMonth = String(row['Billing Month'] || '').trim();

            const prop = properties.find((p: any) => p.property_name?.toLowerCase() === propName.toLowerCase());
            const apt = aptCode ? apartments.find((a: any) => a.apartment_code?.toLowerCase() === aptCode.toLowerCase() && (!prop || a.property_id === prop?.id)) : null;

            if (!prop || amount <= 0) return null;
            return {
              organization_id: orgId, property_id: prop.id, apartment_id: apt?.id || null,
              category: subCat ? `${cat}:${subCat}` : cat, vendor: vendor || null,
              description: desc || null, amount, expense_date: expDate,
              billing_month: billingMonth || null,
            };
          }).filter(Boolean);

          if (inserts.length > 0) {
            const { data: inserted, error } = await supabase.from('expenses' as any).insert(inserts).select('id');
            if (error) { toast({ title: 'Insert error', description: error.message, variant: 'destructive' }); skipped += batch.length; continue; }
            created += inserted?.length || 0;
          }
          skipped += batch.length - inserts.length;
        }

        setImportProgress(null);
        qc.invalidateQueries({ queryKey: ['acc-expenses'] });
        toast({ title: `${created} expenses imported, ${skipped} skipped` });
      } catch (err: any) {
        setImportProgress(null);
        toast({ title: 'Import error', description: err.message, variant: 'destructive' });
      }
    };
    reader.readAsBinaryString(importFile);
  };

  // Excel export
  const handleExportExcel = () => {
    const data = filteredExpenses.map((e: any) => ({
      'Date': e.expense_date || '', 'Category': e.category || '', 'Property': e.properties?.property_name || '',
      'Apartment': e.apartments?.apartment_code || '', 'Vendor': getVendorName(e), 'Description': e.description || '',
      'Amount': Number(e.amount || 0), 'Month': e.billing_month || '',
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Expenses');
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([wbout]), `expenses-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  return (
    <div className="space-y-4">
      {importProgress && (
        <Card className="border-primary"><CardContent className="p-4 space-y-2">
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span className="text-sm font-medium">{importProgress.status}</span>
            <span className="ml-auto text-xs text-muted-foreground">{importProgress.current}/{importProgress.total}</span>
          </div>
          <Progress value={importProgress.total > 0 ? (importProgress.current / importProgress.total) * 100 : 0} className="h-2" />
        </CardContent></Card>
      )}

      {/* Filters */}
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
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search expenses…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-8 h-9" />
        </div>
        <div className="text-sm text-muted-foreground flex items-center gap-2">
          Total: <strong className="text-foreground">₹{totalExpenses.toLocaleString()}</strong> ({filteredExpenses.length})
        </div>
        <div className="ml-auto flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5"><Download className="h-3.5 w-3.5" /> Export</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => exportExpenses(filteredExpenses, 'csv')}>CSV</DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportExpenses(filteredExpenses, 'pdf')}>PDF</DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportExcel}>Excel</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {canPerform('expense.create') && (
            <>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1.5" disabled={!!importProgress}><Upload className="h-3.5 w-3.5" /> Import</Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={handleDownloadTemplate}>Download Template</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>Upload Excel</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileSelect} />
              <Button size="sm" className="gap-1.5" onClick={() => { setEditId(null); setForm({ ...emptyForm }); setDialogOpen(true); }}>
                <Plus className="h-3.5 w-3.5" /> Add Expense
              </Button>
            </>
          )}
        </div>
      </div>

      <Card>
        <Table>
          <TableHeader className="bg-table-header">
            <tr>
              <SortableTableHead label="Date" sortKey="expense_date" sortConfig={sortConfig} onSort={handleSort} />
              <SortableTableHead label="Category" sortKey="category" sortConfig={sortConfig} onSort={handleSort} />
              <SortableTableHead label="Property" sortKey="property" sortConfig={sortConfig} onSort={handleSort} />
              <SortableTableHead label="Apartment" sortKey="apartment" sortConfig={sortConfig} onSort={handleSort} />
              <SortableTableHead label="Vendor" sortKey="vendor" sortConfig={sortConfig} onSort={handleSort} />
              <SortableTableHead label="Description" sortKey="description" sortConfig={sortConfig} onSort={handleSort} />
              <SortableTableHead label="Amount" sortKey="amount" sortConfig={sortConfig} onSort={handleSort} />
              <SortableTableHead label="Receipt" sortKey="" sortConfig={sortConfig} onSort={() => {}} />
              <SortableTableHead label="Actions" sortKey="" sortConfig={sortConfig} onSort={() => {}} />
            </tr>
          </TableHeader>
          <TableBody>
            {filteredExpenses.length === 0 ? (
              <tr><TableCell colSpan={9} className="text-center text-muted-foreground py-8">No expenses</TableCell></tr>
            ) : filteredExpenses.map((e: any) => (
              <tr key={e.id} className="border-b transition-colors hover:bg-muted/50 even:bg-table-row-alt">
                <TableCell className="text-xs">{fmtDate(e.expense_date)}</TableCell>
                <TableCell className="text-xs">{displayCategory(e.category)}</TableCell>
                <TableCell className="text-xs">{e.properties?.property_name || '—'}</TableCell>
                <TableCell className="text-xs font-mono">{e.apartments?.apartment_code || '—'}</TableCell>
                <TableCell className="text-xs">{getVendorName(e)}</TableCell>
                <TableCell className="text-xs max-w-[200px] truncate">{e.description || '—'}</TableCell>
                <TableCell className="font-semibold">₹{Number(e.amount).toLocaleString()}</TableCell>
                <TableCell>{e.receipt_url ? <a href={e.receipt_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline">View</a> : '—'}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    {canPerform('expense.create') && <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(e)}><Pencil className="h-3 w-3" /></Button>}
                    {canPerform('expense.delete') && <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(e.id)}><Trash2 className="h-3 w-3" /></Button>}
                  </div>
                </TableCell>
              </tr>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Replace/Append Dialog */}
      <Dialog open={!!importFile} onOpenChange={(open) => { if (!open) setImportFile(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Import Expenses</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">How would you like to handle existing expense records?</p>
          <DialogFooter className="flex gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => executeImport('append')}>Append New Data</Button>
            <Button variant="destructive" onClick={() => executeImport('replace')}>Replace All</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editId ? 'Edit' : 'Add'} Expense</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Property *</Label>
              <Select value={form.property_id} onValueChange={v => setForm({ ...form, property_id: v, apartment_id: '', bed_id: '' })}>
                <SelectTrigger><SelectValue placeholder="Select property" /></SelectTrigger>
                <SelectContent>{properties.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.property_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Apartment (optional)</Label>
              <Select value={form.apartment_id || 'none'} onValueChange={v => setForm({ ...form, apartment_id: v === 'none' ? '' : v, bed_id: '' })}>
                <SelectTrigger><SelectValue placeholder="Select apartment" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {filteredApartments.map((a: any) => <SelectItem key={a.id} value={a.id}>{a.apartment_code}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {form.apartment_id && filteredBeds.length > 0 && (
              <div><Label>Bed (optional)</Label>
                <Select value={form.bed_id || 'none'} onValueChange={v => setForm({ ...form, bed_id: v === 'none' ? '' : v })}>
                  <SelectTrigger><SelectValue placeholder="Select bed" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {filteredBeds.map((b: any) => <SelectItem key={b.id} value={b.id}>{b.bed_code} ({b.bed_type})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div><Label>Category *</Label>
              <Select value={form.category} onValueChange={v => setForm({ ...form, category: v, subcategory: '' })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {subcategories.length > 0 && (
              <div><Label>Subcategory</Label>
                <Select value={form.subcategory || 'none'} onValueChange={v => setForm({ ...form, subcategory: v === 'none' ? '' : v })}>
                  <SelectTrigger><SelectValue placeholder="Select subcategory" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {subcategories.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div><Label>Vendor</Label>
              <Select value={form.vendor_id || 'none'} onValueChange={v => setForm({ ...form, vendor_id: v === 'none' ? '' : v })}>
                <SelectTrigger><SelectValue placeholder="Select vendor" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {vendors.map((v: any) => <SelectItem key={v.id} value={v.id}>{v.vendor_name}{v.contact_person ? ` (${v.contact_person})` : ''}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Amount (₹) *</Label><Input type="number" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} /></div>
            <DatePickerField label="Expense Date" value={form.expense_date} onChange={v => setForm({ ...form, expense_date: v })} />
            <div><Label>Description</Label><Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
            <FileUploadField label="Bill / Receipt Photo" value={form.receipt_url || null} onChange={url => setForm({ ...form, receipt_url: url || '' })} folder="expense-receipts" accept="image/*,.pdf" />
            <FileUploadField label="Product / Item Photo" value={form.bill_photo_url || null} onChange={url => setForm({ ...form, bill_photo_url: url || '' })} folder="expense-photos" accept="image/*" />
            <Button className="w-full" onClick={handleSave}>{editId ? 'Update' : 'Add'} Expense</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
