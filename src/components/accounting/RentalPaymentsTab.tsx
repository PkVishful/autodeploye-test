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
import { CreditCard, Pencil, Download, Upload, Search, Loader2, Trash2 } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { useAuditLog } from '@/hooks/useAuditLog';
import { DatePickerField } from '@/components/shared/DatePickerField';
import { SortableTableHead, useSort } from '@/components/shared/SortableTableHead';
import { searchDisplayValues } from '@/lib/search-utils';
import { parseExcelDateUTC, fmtMonthLabel } from '@/lib/date-utils';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

const fmtDate = (d: string | null) => {
  if (!d) return '—';
  try { return format(new Date(d), 'dd-MMM-yy'); } catch { return d; }
};
const fmtMonth = (m: string | null) => fmtMonthLabel(m);

const getPaymentStatus = (p: any): string => {
  if (p.status === 'paid') return 'paid';
  if (p.due_date && new Date(p.due_date) < new Date()) return 'overdue';
  return 'pending';
};
const PaymentStatusBadge = ({ payment }: { payment: any }) => {
  const status = getPaymentStatus(payment);
  if (status === 'paid') return <Badge className="bg-green-600 hover:bg-green-700 text-white capitalize">Paid</Badge>;
  if (status === 'overdue') return <Badge className="bg-red-600 hover:bg-red-700 text-white capitalize">Overdue</Badge>;
  return <Badge className="bg-yellow-500 hover:bg-yellow-600 text-white capitalize">Pending</Badge>;
};

interface Props {
  ownerPayments: any[];
  properties?: any[];
}

const TEMPLATE_COLS = ['Owner Name', 'Apartment Code', 'Payment Month', 'Amount', 'Due Date', 'Status', 'Paid Date', 'Payment Mode', 'Reference Number', 'Notes'];

export function RentalPaymentsTab({ ownerPayments, properties = [] }: Props) {
  const qc = useQueryClient();
  const { log: auditLog } = useAuditLog();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<any>(null);
  const [payForm, setPayForm] = useState({ paid_date: '', payment_mode: 'transfer', reference_number: '', notes: '' });
  const [editForm, setEditForm] = useState<any>({});
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [monthFilter, setMonthFilter] = useState(format(new Date(), 'yyyy-MM'));
  const [propertyFilter, setPropertyFilter] = useState('all');
  const { sortConfig, handleSort, sortData } = useSort('due_date', 'desc');

  // Import
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importProgress, setImportProgress] = useState<{ current: number; total: number; status: string } | null>(null);

  const uniqueMonths = useMemo(() => {
    const months = new Set<string>();
    ownerPayments.forEach((p: any) => { if (p.payment_month) months.add(p.payment_month); });
    return Array.from(months).sort().reverse();
  }, [ownerPayments]);

  const filtered = useMemo(() => {
    let list = ownerPayments;
    if (monthFilter !== 'all') list = list.filter((p: any) => p.payment_month === monthFilter);
    if (propertyFilter !== 'all') list = list.filter((p: any) => {
      const apt = p.apartments;
      return apt?.property_id === propertyFilter;
    });
    if (searchQuery.trim()) list = list.filter((p: any) => searchDisplayValues([
      p.owners?.full_name, p.apartments?.apartment_code, p.payment_month,
      String(p.escalated_amount), p.status, p.payment_mode, (p as any).reference_number,
      p.due_date ? fmtDate(p.due_date) : '', p.paid_date ? fmtDate(p.paid_date) : '',
    ], searchQuery));
    return sortData(list, (item, key) => {
      if (key === 'owner') return item.owners?.full_name || '';
      if (key === 'apartment') return item.apartments?.apartment_code || '';
      if (key === 'month') return item.payment_month || '';
      return item[key];
    });
  }, [ownerPayments, monthFilter, propertyFilter, searchQuery, sortConfig]);

  const generatePaymentNote = (payment: any) => {
    const ownerName = payment?.owners?.full_name || 'Owner';
    const aptCode = payment?.apartments?.apartment_code || '';
    const month = fmtMonth(payment?.payment_month);
    const billDate = payment?.bill_date ? fmtDate(payment.bill_date) : '';
    return `Bills Raised on ${billDate} and paid for the Month of ${month} for the ${aptCode}`;
  };

  const recordPayment = async () => {
    if (!payForm.paid_date) { toast({ title: 'Date required', variant: 'destructive' }); return; }
    const { error } = await supabase.from('owner_payments').update({
      status: 'paid', paid_date: payForm.paid_date, payment_mode: payForm.payment_mode,
      reference_number: payForm.reference_number || null, notes: payForm.notes || null,
    } as any).eq('id', selectedPayment.id);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    auditLog('owner_payments', selectedPayment.id, 'updated', { status: 'paid' });
    qc.invalidateQueries({ queryKey: ['acc-owner-payments'] }); setPaymentDialogOpen(false);
    toast({ title: 'Payment recorded' });
  };

  const saveEdit = async () => {
    const updates: any = {
      escalated_amount: parseFloat(editForm.escalated_amount) || 0,
      due_date: editForm.due_date, notes: editForm.notes || null, reference_number: editForm.reference_number || null,
    };
    if (editForm.status === 'paid') { updates.status = 'paid'; updates.paid_date = editForm.paid_date || null; updates.payment_mode = editForm.payment_mode || null; }
    else { updates.status = 'pending'; updates.paid_date = null; updates.payment_mode = null; }
    const { error } = await supabase.from('owner_payments').update(updates).eq('id', editForm.id);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    auditLog('owner_payments', editForm.id, 'updated', updates);
    qc.invalidateQueries({ queryKey: ['acc-owner-payments'] }); setEditDialogOpen(false);
    toast({ title: 'Payment updated' });
  };

  // Template
  const handleDownloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([TEMPLATE_COLS, ['Owner Name', 'APT-101', '2025-01', '25000', '2025-01-05', 'paid', '2025-01-03', 'transfer', 'UTR123', 'Monthly rent']]);
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'RentalPayments');
    saveAs(new Blob([XLSX.write(wb, { bookType: 'xlsx', type: 'array' })]), 'rental-payments-import-template.xlsx');
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setImportFile(file); if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const executeImport = async (mode: 'replace' | 'append') => {
    if (!importFile) return; setImportFile(null);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const wb = XLSX.read(evt.target?.result, { type: 'binary' });
        const rows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
        if (!rows.length) { toast({ title: 'No data', variant: 'destructive' }); return; }
        let updated = 0, skipped = 0;
        setImportProgress({ current: 0, total: rows.length, status: 'Processing…' });

        for (let i = 0; i < rows.length; i++) {
          setImportProgress({ current: i, total: rows.length, status: `Row ${i + 1}/${rows.length}…` });
          const row = rows[i];
          const ownerName = String(row['Owner Name'] || '').trim();
          const aptCode = String(row['Apartment Code'] || '').trim();
          const payMonth = String(row['Payment Month'] || '').trim();
          const status = String(row['Status'] || '').trim().toLowerCase();
          const paidDate = parseExcelDateUTC(row['Paid Date']);
          const payMode = String(row['Payment Mode'] || '').trim();
          const refNum = String(row['Reference Number'] || '').trim();
          const notes = String(row['Notes'] || '').trim();

          // Match existing payment
          const match = ownerPayments.find((p: any) =>
            p.owners?.full_name?.toLowerCase() === ownerName.toLowerCase() &&
            p.payment_month === payMonth &&
            (aptCode ? p.apartments?.apartment_code?.toLowerCase() === aptCode.toLowerCase() : true)
          );
          if (!match) { skipped++; continue; }

          const updates: any = {};
          if (status === 'paid') { updates.status = 'paid'; updates.paid_date = paidDate || null; updates.payment_mode = payMode || null; }
          if (refNum) updates.reference_number = refNum;
          if (notes) updates.notes = notes;
          if (Object.keys(updates).length === 0) { skipped++; continue; }

          const { error } = await supabase.from('owner_payments').update(updates).eq('id', match.id);
          if (error) { skipped++; continue; }
          updated++;
        }
        setImportProgress(null);
        qc.invalidateQueries({ queryKey: ['acc-owner-payments'] });
        toast({ title: `${updated} payments updated, ${skipped} skipped` });
      } catch (err: any) {
        setImportProgress(null); toast({ title: 'Import error', description: err.message, variant: 'destructive' });
      }
    };
    reader.readAsBinaryString(importFile);
  };

  const handleExportExcel = () => {
    const data = filtered.map((p: any) => ({
      'Owner': p.owners?.full_name || '', 'Apartment': p.apartments?.apartment_code || '',
      'Month': p.payment_month || '', 'Due Date': p.due_date || '', 'Amount': Number(p.escalated_amount),
      'Status': p.status || '', 'Paid Date': p.paid_date || '', 'Mode': p.payment_mode || '', 'Ref #': (p as any).reference_number || '',
    }));
    const ws = XLSX.utils.json_to_sheet(data); const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'RentalPayments');
    saveAs(new Blob([XLSX.write(wb, { bookType: 'xlsx', type: 'array' })]), `rental-payments-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const toggleAll = () => {
    if (selectedIds.size === filtered.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filtered.map((p: any) => p.id)));
  };
  const deleteSelected = async () => {
    setDeleting(true);
    const ids = Array.from(selectedIds);
    const { error } = await supabase.from('owner_payments').delete().in('id', ids);
    setDeleting(false);
    setDeleteDialogOpen(false);
    if (error) { toast({ title: 'Error deleting', description: error.message, variant: 'destructive' }); return; }
    ids.forEach(id => auditLog('owner_payments', id, 'deleted', {}));
    setSelectedIds(new Set());
    qc.invalidateQueries({ queryKey: ['acc-owner-payments'] });
    toast({ title: `${ids.length} payment(s) deleted` });
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
            {uniqueMonths.map(m => <SelectItem key={m} value={m}>{fmtMonth(m)}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search owner, apartment…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-8 h-9" />
        </div>
        <div className="ml-auto flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5"><Download className="h-3.5 w-3.5" /> Export</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={handleExportExcel}>Excel</DropdownMenuItem>
              <DropdownMenuItem onClick={() => {
                import('@/lib/export-utils').then(({ exportToPDF }) => {
                  const cols = [
                    { key: 'owner', label: 'Owner' }, { key: 'apartment', label: 'Apartment' }, { key: 'month', label: 'Month' },
                    { key: 'amount', label: 'Amount (₹)' }, { key: 'status', label: 'Status' }, { key: 'due_date', label: 'Due Date' },
                  ];
                  const pdfData = filtered.map((p: any) => ({
                    owner: p.owners?.full_name || '', apartment: p.apartments?.apartment_code || '', month: fmtMonth(p.payment_month),
                    amount: `₹${Number(p.escalated_amount).toLocaleString()}`, status: p.status, due_date: fmtDate(p.due_date),
                  }));
                  exportToPDF('Rental Payments Report', pdfData, cols);
                });
              }}>PDF</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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
          {selectedIds.size > 0 && (
            <Button variant="destructive" size="sm" className="gap-1.5" onClick={() => setDeleteDialogOpen(true)}>
              <Trash2 className="h-3.5 w-3.5" /> Delete ({selectedIds.size})
            </Button>
          )}
        </div>
      </div>

      <Card>
        <Table>
          <TableHeader className="bg-table-header">
            <tr>
              <th className="h-12 px-2 align-middle">
                <Checkbox checked={filtered.length > 0 && selectedIds.size === filtered.length} onCheckedChange={toggleAll} />
              </th>
              <SortableTableHead label="Owner" sortKey="owner" sortConfig={sortConfig} onSort={handleSort} />
              <SortableTableHead label="Apartment" sortKey="apartment" sortConfig={sortConfig} onSort={handleSort} />
              <SortableTableHead label="Month" sortKey="month" sortConfig={sortConfig} onSort={handleSort} />
              <SortableTableHead label="Bill Date" sortKey="bill_date" sortConfig={sortConfig} onSort={handleSort} />
              <SortableTableHead label="Due Date" sortKey="due_date" sortConfig={sortConfig} onSort={handleSort} />
              <SortableTableHead label="Amount" sortKey="escalated_amount" sortConfig={sortConfig} onSort={handleSort} />
              <SortableTableHead label="Status" sortKey="status" sortConfig={sortConfig} onSort={handleSort} />
              <SortableTableHead label="Paid Date" sortKey="paid_date" sortConfig={sortConfig} onSort={handleSort} />
              <SortableTableHead label="Mode" sortKey="payment_mode" sortConfig={sortConfig} onSort={handleSort} />
              <SortableTableHead label="Ref #" sortKey="reference_number" sortConfig={sortConfig} onSort={handleSort} />
              <SortableTableHead label="Actions" sortKey="" sortConfig={sortConfig} onSort={() => {}} />
            </tr>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <tr><TableCell colSpan={12} className="text-center text-muted-foreground py-8">No rental payments</TableCell></tr>
            ) : filtered.map((p: any) => (
              <tr key={p.id} className="border-b transition-colors hover:bg-muted/50 even:bg-table-row-alt">
                <TableCell className="px-2">
                  <Checkbox checked={selectedIds.has(p.id)} onCheckedChange={() => toggleSelect(p.id)} />
                </TableCell>
                <TableCell>{p.owners?.full_name}</TableCell>
                <TableCell className="font-mono text-xs">{p.apartments?.apartment_code || '—'}</TableCell>
                <TableCell className="font-mono text-xs">{fmtMonth(p.payment_month)}</TableCell>
                <TableCell className="text-xs">{fmtDate((p as any).bill_date || null)}</TableCell>
                <TableCell className="text-xs">{fmtDate(p.due_date)}</TableCell>
                <TableCell className="font-semibold">₹{Number(p.escalated_amount).toLocaleString()}</TableCell>
                <TableCell><PaymentStatusBadge payment={p} /></TableCell>
                <TableCell className="text-xs">{fmtDate(p.paid_date)}</TableCell>
                <TableCell className="text-xs capitalize">{p.payment_mode || '—'}</TableCell>
                <TableCell className="text-xs">{(p as any).reference_number || '—'}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    {p.status !== 'paid' && (
                      <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => {
                        setSelectedPayment(p);
                        setPayForm({ paid_date: format(new Date(), 'yyyy-MM-dd'), payment_mode: 'transfer', reference_number: '', notes: generatePaymentNote(p) });
                        setPaymentDialogOpen(true);
                      }}><CreditCard className="h-3 w-3" /> Pay</Button>
                    )}
                    <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => {
                      setEditForm({ id: p.id, escalated_amount: p.escalated_amount?.toString() || '0', due_date: p.due_date || '', status: p.status || 'pending', paid_date: p.paid_date || '', payment_mode: p.payment_mode || 'transfer', reference_number: (p as any).reference_number || '', notes: p.notes || '' });
                      setEditDialogOpen(true);
                    }}><Pencil className="h-3 w-3" /> Edit</Button>
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
          <DialogHeader><DialogTitle>Import Rental Payments</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Import will match existing owner payments by owner name, apartment, and month to update statuses.</p>
          <DialogFooter className="flex gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => executeImport('append')}>Update Matching</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Record Payment */}
      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Record Payment — {fmtMonth(selectedPayment?.payment_month)}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Amount: <strong className="text-foreground">₹{Number(selectedPayment?.escalated_amount || 0).toLocaleString()}</strong></p>
            <DatePickerField label="Payment Date *" value={payForm.paid_date} onChange={v => setPayForm({ ...payForm, paid_date: v })} />
            <div><Label>Mode</Label>
              <Select value={payForm.payment_mode} onValueChange={v => setPayForm({ ...payForm, payment_mode: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="transfer">Bank Transfer</SelectItem><SelectItem value="cash">Cash</SelectItem><SelectItem value="cheque">Cheque</SelectItem><SelectItem value="upi">UPI</SelectItem><SelectItem value="credit_card">Credit Card</SelectItem></SelectContent>
              </Select>
            </div>
            <div><Label>Reference Number</Label><Input value={payForm.reference_number} onChange={e => setPayForm({ ...payForm, reference_number: e.target.value })} placeholder="Cheque number, Transaction ID, etc." /></div>
            <div><Label>Notes</Label><Textarea value={payForm.notes} onChange={e => setPayForm({ ...payForm, notes: e.target.value })} rows={3} /></div>
            <Button className="w-full" onClick={recordPayment}>Confirm Payment</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Payment */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Payment Due</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Amount (₹)</Label><Input type="number" value={editForm.escalated_amount || ''} onChange={e => setEditForm({ ...editForm, escalated_amount: e.target.value })} /></div>
            <DatePickerField label="Due Date" value={editForm.due_date || ''} onChange={v => setEditForm({ ...editForm, due_date: v })} />
            <div><Label>Status</Label>
              <Select value={editForm.status || 'pending'} onValueChange={v => setEditForm({ ...editForm, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="pending">Pending</SelectItem><SelectItem value="paid">Paid</SelectItem></SelectContent>
              </Select>
            </div>
            {editForm.status === 'paid' && (
              <>
                <DatePickerField label="Paid Date" value={editForm.paid_date || ''} onChange={v => setEditForm({ ...editForm, paid_date: v })} />
                <div><Label>Mode</Label>
                  <Select value={editForm.payment_mode || 'transfer'} onValueChange={v => setEditForm({ ...editForm, payment_mode: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="transfer">Bank Transfer</SelectItem><SelectItem value="cash">Cash</SelectItem><SelectItem value="cheque">Cheque</SelectItem><SelectItem value="upi">UPI</SelectItem><SelectItem value="credit_card">Credit Card</SelectItem></SelectContent>
                  </Select>
                </div>
              </>
            )}
            <div><Label>Reference Number</Label><Input value={editForm.reference_number || ''} onChange={e => setEditForm({ ...editForm, reference_number: e.target.value })} placeholder="Cheque number, Transaction ID, etc." /></div>
            <div><Label>Notes</Label><Textarea value={editForm.notes || ''} onChange={e => setEditForm({ ...editForm, notes: e.target.value })} /></div>
            <Button className="w-full" onClick={saveEdit}>Save Changes</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedIds.size} payment(s)?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone. The selected owner payment records will be permanently removed.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={deleteSelected} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? <><Loader2 className="h-4 w-4 animate-spin mr-1" /> Deleting…</> : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
