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
import { Plus, Download, Upload, Search, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useRBAC } from '@/hooks/useRBAC';
import { exportSettlements } from '@/lib/export-utils';
import { useQueryClient } from '@tanstack/react-query';
import { useAuditLog } from '@/hooks/useAuditLog';
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

interface Props {
  settlements: any[];
  allotments: any[];
  tenants: any[];
  invoices: any[];
  orgId: string;
  properties?: any[];
}

const TEMPLATE_COLS = ['Tenant Name', 'Allotment ID', 'Deposit Amount', 'Pending Rent', 'Pending EB', 'Late Fees', 'Damages', 'Other Deductions', 'Settlement Date', 'Notes'];

export function SettlementsTab({ settlements, allotments, tenants, invoices, orgId, properties = [] }: Props) {
  const qc = useQueryClient();
  const { log: auditLog } = useAuditLog();
  const { canPerform } = useRBAC();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<any>({
    tenant_id: '', allotment_id: '', deposit_amount: '', pending_rent: '0', pending_eb: '0',
    pending_late_fees: '0', damages: '0', other_deductions: '0', notes: '',
  });

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [propertyFilter, setPropertyFilter] = useState('all');
  const [monthFilter, setMonthFilter] = useState(format(new Date(), 'yyyy-MM'));
  const { sortConfig, handleSort, sortData } = useSort('settlement_date', 'desc');

  // Import
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importProgress, setImportProgress] = useState<{ current: number; total: number; status: string } | null>(null);

  const uniqueMonths = useMemo(() => {
    const months = new Set<string>();
    settlements.forEach((s: any) => { if (s.settlement_date) months.add(s.settlement_date.slice(0, 7)); });
    return Array.from(months).sort().reverse();
  }, [settlements]);

  const exitedAllotments = allotments.filter((a: any) => a.staying_status === 'exited' || a.actual_exit_date);
  const tenantOptions = exitedAllotments.map((a: any) => {
    const t = tenants.find((t: any) => t.id === a.tenant_id);
    return { allotment: a, tenant: t };
  }).filter(x => x.tenant).sort((a, b) => (a.tenant?.full_name || '').localeCompare(b.tenant?.full_name || ''));

  const handleTenantSelect = (allotmentId: string) => {
    const allot = allotments.find((a: any) => a.id === allotmentId);
    if (!allot) return;
    const tenantInvoices = invoices.filter((inv: any) => inv.tenant_id === allot.tenant_id && inv.status !== 'paid');
    const pendingRent = tenantInvoices.reduce((s: number, inv: any) => s + Number(inv.rent_amount || 0), 0);
    const pendingEB = tenantInvoices.reduce((s: number, inv: any) => s + Number(inv.electricity_amount || 0), 0);
    const pendingLateFees = tenantInvoices.reduce((s: number, inv: any) => s + Number((inv as any).late_fee || 0), 0);
    setForm({ ...form, tenant_id: allot.tenant_id, allotment_id: allotmentId, deposit_amount: String(allot.deposit_paid || 0), pending_rent: String(pendingRent), pending_eb: String(pendingEB), pending_late_fees: String(pendingLateFees) });
  };

  const totalDeductions = ['pending_rent', 'pending_eb', 'pending_late_fees', 'damages', 'other_deductions'].reduce((s, k) => s + (parseFloat(form[k]) || 0), 0);
  const deposit = parseFloat(form.deposit_amount) || 0;
  const refund = deposit - totalDeductions;

  // Filtered & sorted
  const filtered = useMemo(() => {
    let list = settlements;
    if (propertyFilter !== 'all') list = list.filter((s: any) => s.tenant_allotments?.property_id === propertyFilter);
    if (monthFilter !== 'all') list = list.filter((s: any) => s.settlement_date?.slice(0, 7) === monthFilter);
    if (searchQuery.trim()) list = list.filter((s: any) => searchDisplayValues([
      s.tenants?.full_name, String(s.deposit_amount), String(s.pending_rent),
      String(s.pending_eb), String(s.refund_amount), s.status,
      s.settlement_date ? fmtDate(s.settlement_date) : '', s.notes,
    ], searchQuery));
    return sortData(list, (item, key) => {
      if (key === 'tenant') return item.tenants?.full_name || '';
      return item[key];
    });
  }, [settlements, propertyFilter, monthFilter, searchQuery, sortConfig]);

  const handleSave = async () => {
    if (!form.tenant_id || !form.deposit_amount) { toast({ title: 'Tenant and deposit required', variant: 'destructive' }); return; }
    try {
      const payload = {
        organization_id: orgId, tenant_id: form.tenant_id, allotment_id: form.allotment_id || null,
        deposit_amount: deposit, pending_rent: parseFloat(form.pending_rent) || 0, pending_eb: parseFloat(form.pending_eb) || 0,
        pending_late_fees: parseFloat(form.pending_late_fees) || 0, damages: parseFloat(form.damages) || 0,
        other_deductions: parseFloat(form.other_deductions) || 0, total_deductions: totalDeductions,
        refund_amount: refund, status: 'settled', notes: form.notes || null,
      };
      const { data, error } = await supabase.from('deposit_settlements' as any).insert(payload).select().single();
      if (error) throw error;
      auditLog('deposit_settlements', (data as any).id, 'created', payload);
      toast({ title: 'Settlement created' });
      setDialogOpen(false);
      qc.invalidateQueries({ queryKey: ['acc-settlements'] });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  // Template
  const handleDownloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([TEMPLATE_COLS, ['John Doe', 'allotment-uuid', '50000', '5000', '1000', '500', '2000', '0', '2025-01-15', 'Final settlement']]);
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Settlements');
    saveAs(new Blob([XLSX.write(wb, { bookType: 'xlsx', type: 'array' })]), 'settlements-import-template.xlsx');
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
        let created = 0, skipped = 0;
        setImportProgress({ current: 0, total: rows.length, status: 'Processing…' });

        if (mode === 'replace') {
          await supabase.from('deposit_settlements' as any).delete().eq('organization_id', orgId);
        }

        const BATCH = 200;
        for (let i = 0; i < rows.length; i += BATCH) {
          const batch = rows.slice(i, i + BATCH);
          setImportProgress({ current: i, total: rows.length, status: `Rows ${i + 1}–${Math.min(i + BATCH, rows.length)}…` });
          const inserts = batch.map(row => {
            const tenantName = String(row['Tenant Name'] || '').trim();
            const allotmentId = String(row['Allotment ID'] || '').trim();
            const depositAmt = Number(row['Deposit Amount'] || 0);
            const pendRent = Number(row['Pending Rent'] || 0);
            const pendEB = Number(row['Pending EB'] || 0);
            const lateFees = Number(row['Late Fees'] || 0);
            const damages = Number(row['Damages'] || 0);
            const otherDed = Number(row['Other Deductions'] || 0);
            const settDate = parseExcelDateUTC(row['Settlement Date']) || format(new Date(), 'yyyy-MM-dd');

            const tenant = tenants.find((t: any) => t.full_name?.toLowerCase() === tenantName.toLowerCase());
            if (!tenant) return null;

            const totalDed = pendRent + pendEB + lateFees + damages + otherDed;
            return {
              organization_id: orgId, tenant_id: tenant.id, allotment_id: allotmentId || null,
              deposit_amount: depositAmt, pending_rent: pendRent, pending_eb: pendEB,
              pending_late_fees: lateFees, damages, other_deductions: otherDed,
              total_deductions: totalDed, refund_amount: depositAmt - totalDed,
              settlement_date: settDate, status: 'settled', notes: String(row['Notes'] || '') || null,
            };
          }).filter(Boolean);

          if (inserts.length > 0) {
            const { data: inserted, error } = await supabase.from('deposit_settlements' as any).insert(inserts).select('id');
            if (error) { toast({ title: 'Insert error', description: error.message, variant: 'destructive' }); skipped += batch.length; continue; }
            created += inserted?.length || 0;
          }
          skipped += batch.length - inserts.length;
        }
        setImportProgress(null);
        qc.invalidateQueries({ queryKey: ['acc-settlements'] });
        toast({ title: `${created} settlements imported, ${skipped} skipped` });
      } catch (err: any) {
        setImportProgress(null); toast({ title: 'Import error', description: err.message, variant: 'destructive' });
      }
    };
    reader.readAsBinaryString(importFile);
  };

  const handleExportExcel = () => {
    const data = filtered.map((s: any) => ({
      'Tenant': s.tenants?.full_name || '', 'Deposit': Number(s.deposit_amount), 'Rent Due': Number(s.pending_rent),
      'EB Due': Number(s.pending_eb), 'Late Fees': Number(s.pending_late_fees), 'Damages': Number(s.damages),
      'Total Ded.': Number(s.total_deductions), 'Refund': Number(s.refund_amount), 'Status': s.status || '',
      'Date': s.settlement_date || '',
    }));
    const ws = XLSX.utils.json_to_sheet(data); const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Settlements');
    saveAs(new Blob([XLSX.write(wb, { bookType: 'xlsx', type: 'array' })]), `settlements-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
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
            {uniqueMonths.map(m => <SelectItem key={m} value={m}>{fmtMonthLabel(m)}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search settlements…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-8 h-9" />
        </div>
        <div className="ml-auto flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5"><Download className="h-3.5 w-3.5" /> Export</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => exportSettlements(filtered, 'csv')}>CSV</DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportSettlements(filtered, 'pdf')}>PDF</DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportExcel}>Excel</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {canPerform('settlement.create') && (
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
              <Button size="sm" className="gap-1.5" onClick={() => {
                setForm({ tenant_id: '', allotment_id: '', deposit_amount: '', pending_rent: '0', pending_eb: '0', pending_late_fees: '0', damages: '0', other_deductions: '0', notes: '' });
                setDialogOpen(true);
              }}><Plus className="h-3.5 w-3.5" /> Create Settlement</Button>
            </>
          )}
        </div>
      </div>

      <Card>
        <Table>
          <TableHeader className="bg-table-header">
            <tr>
              <SortableTableHead label="Tenant" sortKey="tenant" sortConfig={sortConfig} onSort={handleSort} />
              <SortableTableHead label="Deposit" sortKey="deposit_amount" sortConfig={sortConfig} onSort={handleSort} />
              <SortableTableHead label="Rent Due" sortKey="pending_rent" sortConfig={sortConfig} onSort={handleSort} />
              <SortableTableHead label="EB Due" sortKey="pending_eb" sortConfig={sortConfig} onSort={handleSort} />
              <SortableTableHead label="Late Fees" sortKey="pending_late_fees" sortConfig={sortConfig} onSort={handleSort} />
              <SortableTableHead label="Damages" sortKey="damages" sortConfig={sortConfig} onSort={handleSort} />
              <SortableTableHead label="Total Ded." sortKey="total_deductions" sortConfig={sortConfig} onSort={handleSort} />
              <SortableTableHead label="Refund" sortKey="refund_amount" sortConfig={sortConfig} onSort={handleSort} />
              <SortableTableHead label="Status" sortKey="status" sortConfig={sortConfig} onSort={handleSort} />
              <SortableTableHead label="Date" sortKey="settlement_date" sortConfig={sortConfig} onSort={handleSort} />
            </tr>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <tr><TableCell colSpan={10} className="text-center text-muted-foreground py-8">No settlements</TableCell></tr>
            ) : filtered.map((s: any) => (
              <tr key={s.id} className="border-b transition-colors hover:bg-muted/50 even:bg-table-row-alt">
                <TableCell>{s.tenants?.full_name}</TableCell>
                <TableCell>₹{Number(s.deposit_amount).toLocaleString()}</TableCell>
                <TableCell>₹{Number(s.pending_rent).toLocaleString()}</TableCell>
                <TableCell>₹{Number(s.pending_eb).toLocaleString()}</TableCell>
                <TableCell>₹{Number(s.pending_late_fees).toLocaleString()}</TableCell>
                <TableCell>₹{Number(s.damages).toLocaleString()}</TableCell>
                <TableCell className="font-semibold">₹{Number(s.total_deductions).toLocaleString()}</TableCell>
                <TableCell className={Number(s.refund_amount) >= 0 ? 'text-green-600 font-semibold' : 'text-destructive font-semibold'}>
                  {Number(s.refund_amount) >= 0 ? `₹${Number(s.refund_amount).toLocaleString()} refund` : `₹${Math.abs(Number(s.refund_amount)).toLocaleString()} payable`}
                </TableCell>
                <TableCell><Badge variant="default" className="capitalize">{s.status}</Badge></TableCell>
                <TableCell className="text-xs">{fmtDate(s.settlement_date)}</TableCell>
              </tr>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Replace/Append Dialog */}
      <Dialog open={!!importFile} onOpenChange={(open) => { if (!open) setImportFile(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Import Settlements</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">How would you like to handle existing settlement records?</p>
          <DialogFooter className="flex gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => executeImport('append')}>Append New Data</Button>
            <Button variant="destructive" onClick={() => executeImport('replace')}>Replace All</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Settlement Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Final Settlement Statement</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Select Tenant (Exited)</Label>
              <Select value={form.allotment_id} onValueChange={handleTenantSelect}>
                <SelectTrigger><SelectValue placeholder="Select tenant" /></SelectTrigger>
                <SelectContent>
                  {tenantOptions.map(({ allotment: a, tenant: t }: any) => (
                    <SelectItem key={a.id} value={a.id}>{t.full_name} — Exit: {fmtDate(a.actual_exit_date)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Deposit Amount (₹)</Label><Input type="number" value={form.deposit_amount} onChange={e => setForm({ ...form, deposit_amount: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Pending Rent (₹)</Label><Input type="number" value={form.pending_rent} onChange={e => setForm({ ...form, pending_rent: e.target.value })} /></div>
              <div><Label>Pending EB (₹)</Label><Input type="number" value={form.pending_eb} onChange={e => setForm({ ...form, pending_eb: e.target.value })} /></div>
              <div><Label>Late Fees (₹)</Label><Input type="number" value={form.pending_late_fees} onChange={e => setForm({ ...form, pending_late_fees: e.target.value })} /></div>
              <div><Label>Damages (₹)</Label><Input type="number" value={form.damages} onChange={e => setForm({ ...form, damages: e.target.value })} /></div>
            </div>
            <div><Label>Other Deductions (₹)</Label><Input type="number" value={form.other_deductions} onChange={e => setForm({ ...form, other_deductions: e.target.value })} /></div>
            <Card className="bg-muted/50"><CardContent className="p-3 space-y-1 text-sm">
              <div className="flex justify-between"><span>Deposit:</span><span>₹{deposit.toLocaleString()}</span></div>
              <div className="flex justify-between"><span>Total Deductions:</span><span className="text-destructive">-₹{totalDeductions.toLocaleString()}</span></div>
              <div className="flex justify-between font-bold border-t pt-1">
                <span>{refund >= 0 ? 'Refund:' : 'Amount Payable:'}</span>
                <span className={refund >= 0 ? 'text-green-600' : 'text-destructive'}>₹{Math.abs(refund).toLocaleString()}</span>
              </div>
            </CardContent></Card>
            <div><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
            <Button className="w-full" onClick={handleSave}>Create Settlement</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
