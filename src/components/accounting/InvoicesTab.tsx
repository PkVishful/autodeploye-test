import { useState, useMemo, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Lock, Unlock, Trash2, Download, Upload, Search, Eye, ArrowUpDown, ArrowUp, ArrowDown, Pencil, FileText, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { useAuditLog } from '@/hooks/useAuditLog';
import { useRBAC } from '@/hooks/useRBAC';
import { toast } from '@/hooks/use-toast';
import { format, subMonths } from 'date-fns';
import { calcLateFee } from '@/lib/billing-engine';
import { parseExcelDateUTC } from '@/lib/date-utils';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

const fmtDate = (d: string | null) => {
  if (!d) return '—';
  try { return format(new Date(d), 'dd-MMM-yy'); } catch { return d; }
};
const fmtAmt = (v: number) => `₹${new Intl.NumberFormat('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Math.ceil(v))}`;

/** Format billing_month (yyyy-MM or MMM-yy) to display as MMM-yy */
const fmtMonth = (m: string | null) => {
  if (!m) return '—';
  try {
    // Handle yyyy-MM format
    if (/^\d{4}-\d{2}$/.test(m)) {
      return format(new Date(m + '-01'), 'MMM-yy');
    }
    return m;
  } catch { return m; }
};

interface Props {
  invoices: any[];
  receipts?: any[];
  properties: any[];
  organization?: any;
  isTenantView?: boolean;
}

type SortKey = 'location' | 'tenant' | 'rent' | 'actual_eb' | 'est_eb' | 'other' | 'total' | 'status_badge';

/** Derive tenant staying status for the billing month from allotment data */
const getTenantStatus = (inv: any): { label: string; color: string } => {
  const allotment = inv.tenant_allotments;
  if (!allotment) return { label: 'Unknown', color: 'bg-muted text-muted-foreground' };
  const status = allotment.staying_status;
  if (status === 'On-Notice') return { label: 'On Notice', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300' };
  if (status === 'Exited' || status === 'Vacated') return { label: 'Vacated', color: 'bg-destructive/10 text-destructive' };
  return { label: 'Staying', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' };
};

export function InvoicesTab({ invoices, receipts = [], properties, organization, isTenantView = false }: Props) {
  const qc = useQueryClient();
  const { log: auditLog } = useAuditLog();
  const { canPerform } = useRBAC();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Default month filter to current month
  const currentMonth = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  const [statusFilter, setStatusFilter] = useState('all');
  const [propertyFilter, setPropertyFilter] = useState('all');
  const [monthFilter, setMonthFilter] = useState(currentMonth);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('location');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [detailInvoice, setDetailInvoice] = useState<any>(null);
  const [detailLineItems, setDetailLineItems] = useState<any[]>([]);
  const [detailEbShares, setDetailEbShares] = useState<any[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({ rent_amount: 0, electricity_amount: 0, late_fee: 0, other_charges: 0 });

  // Import state
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importMode, setImportMode] = useState<'overwrite' | 'append'>('overwrite');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importProgress, setImportProgress] = useState(0);
  const [importTotal, setImportTotal] = useState(0);
  const [importRunning, setImportRunning] = useState(false);
  const [importStatus, setImportStatus] = useState('');

  // Build unique billing months from data — display as MMM-yy
  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    invoices.forEach((inv: any) => { if (inv.billing_month) months.add(inv.billing_month); });
    return Array.from(months).sort().reverse();
  }, [invoices]);

  // Compute dynamic status per invoice based on receipts
  const getComputedStatus = useCallback((inv: any) => {
    const collected = receipts
      .filter((r: any) => r.tenant_id === inv.tenant_id && r.billing_month === inv.billing_month)
      .reduce((sum: number, r: any) => sum + Number(r.amount_paid || 0), 0);
    const balance = Number(inv.total_amount || 0) - collected;
    if (balance === 0) return 'Paid';
    if (balance < 0) return 'Excess';
    // balance > 0 — check if overdue (past 7th of billing month)
    if (inv.billing_month) {
      const billingDate = new Date(inv.billing_month + '-07');
      if (new Date() > billingDate) return 'Overdue';
    }
    return 'Pending';
  }, [receipts]);

  // Filter
  const filtered = useMemo(() => {
    return invoices.filter((inv: any) => {
      if (statusFilter !== 'all') {
        const computed = getComputedStatus(inv);
        if (computed.toLowerCase() !== statusFilter.toLowerCase()) return false;
      }
      if (propertyFilter !== 'all' && inv.property_id !== propertyFilter) return false;
      if (monthFilter !== 'all' && inv.billing_month !== monthFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const aptBed = `${inv.apartments?.apartment_code || ''}-${inv.beds?.bed_code || ''}`.toLowerCase();
        const name = (inv.tenants?.full_name || '').toLowerCase();
        const invNum = (inv.invoice_number || '').toLowerCase();
        if (!aptBed.includes(q) && !name.includes(q) && !invNum.includes(q)) return false;
      }
      return true;
    });
  }, [invoices, statusFilter, propertyFilter, monthFilter, searchQuery, getComputedStatus]);

  // Sort
  const sorted = useMemo(() => {
    return [...filtered].sort((a: any, b: any) => {
      let valA: any, valB: any;
      switch (sortKey) {
        case 'location':
          valA = `${a.apartments?.apartment_code || ''}-${a.beds?.bed_code || ''}`;
          valB = `${b.apartments?.apartment_code || ''}-${b.beds?.bed_code || ''}`;
          break;
        case 'status_badge': valA = getTenantStatus(a).label; valB = getTenantStatus(b).label; break;
        case 'tenant': valA = a.tenants?.full_name || ''; valB = b.tenants?.full_name || ''; break;
        case 'rent': valA = Number(a.rent_amount || 0); valB = Number(b.rent_amount || 0); return sortDir === 'asc' ? valA - valB : valB - valA;
        case 'actual_eb': valA = Number(a.electricity_amount || 0); valB = Number(b.electricity_amount || 0); return sortDir === 'asc' ? valA - valB : valB - valA;
        case 'est_eb': valA = Number(a.estimated_eb || 0); valB = Number(b.estimated_eb || 0); return sortDir === 'asc' ? valA - valB : valB - valA;
        case 'other': valA = Number(a.other_charges || 0); valB = Number(b.other_charges || 0); return sortDir === 'asc' ? valA - valB : valB - valA;
        case 'total': valA = Number(a.total_amount || 0); valB = Number(b.total_amount || 0); return sortDir === 'asc' ? valA - valB : valB - valA;
        default: return 0;
      }
      const cmp = String(valA).localeCompare(String(valB), undefined, { numeric: true });
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowUpDown className="h-3 w-3 opacity-30 inline ml-1" />;
    return sortDir === 'asc' ? <ArrowUp className="h-3 w-3 text-primary inline ml-1" /> : <ArrowDown className="h-3 w-3 text-primary inline ml-1" />;
  };

  // Selection
  const toggleAll = () => {
    if (selectedIds.size === sorted.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(sorted.map((inv: any) => inv.id)));
  };
  const toggleOne = (id: string) => {
    const s = new Set(selectedIds);
    s.has(id) ? s.delete(id) : s.add(id);
    setSelectedIds(s);
  };

  // Open detail
  const openDetail = async (inv: any) => {
    setDetailInvoice(inv);
    setDetailLoading(true);
    setEditMode(false);
    setEditForm({
      rent_amount: Number(inv.rent_amount || 0),
      electricity_amount: Number(inv.electricity_amount || 0),
      late_fee: Number(inv.late_fee || 0),
      other_charges: Number(inv.other_charges || 0),
    });
    try {
      const [liRes, ebRes] = await Promise.all([
        supabase.from('invoice_line_items').select('*').eq('invoice_id', inv.id).order('created_at'),
        supabase.from('eb_tenant_shares').select('*').eq('invoice_id', inv.id),
      ]);
      setDetailLineItems(liRes.data || []);
      setDetailEbShares(ebRes.data || []);
    } catch { }
    setDetailLoading(false);
  };

  // Save edit — block if locked
  const handleSaveEdit = async () => {
    if (!detailInvoice) return;
    if (detailInvoice.locked) {
      toast({ title: 'Invoice is locked. Unlock first to edit.', variant: 'destructive' });
      return;
    }
    const totalAmount = editForm.rent_amount + editForm.electricity_amount + editForm.late_fee + editForm.other_charges;
    const paid = Number(detailInvoice.amount_paid || 0);
    const balance = Math.max(0, totalAmount - paid);
    const status = balance <= 0 ? 'paid' : paid > 0 ? 'partial' : 'pending';
    const { error } = await supabase.from('invoices').update({
      rent_amount: editForm.rent_amount,
      electricity_amount: editForm.electricity_amount,
      late_fee: editForm.late_fee,
      other_charges: editForm.other_charges,
      total_amount: totalAmount,
      balance,
      status,
    } as any).eq('id', detailInvoice.id);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    auditLog('invoices', detailInvoice.id, 'updated', editForm);
    qc.invalidateQueries({ queryKey: ['acc-invoices'] });
    setDetailInvoice({ ...detailInvoice, ...editForm, total_amount: totalAmount, balance, status });
    setEditMode(false);
    toast({ title: 'Invoice updated' });
  };

  // Lock/Unlock
  const handleLock = async (inv: any) => {
    if (!canPerform('invoice.lock')) { toast({ title: 'Permission denied', variant: 'destructive' }); return; }
    await supabase.from('invoices').update({ locked: !inv.locked } as any).eq('id', inv.id);
    auditLog('invoices', inv.id, 'updated', { locked: !inv.locked });
    qc.invalidateQueries({ queryKey: ['acc-invoices'] });
    toast({ title: inv.locked ? 'Invoice unlocked' : 'Invoice locked' });
  };

  // Bulk lock selected
  const handleBulkLock = async (lock: boolean) => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) { toast({ title: 'Select invoices first', variant: 'destructive' }); return; }
    for (const id of ids) {
      await supabase.from('invoices').update({ locked: lock } as any).eq('id', id);
    }
    qc.invalidateQueries({ queryKey: ['acc-invoices'] });
    toast({ title: `${ids.length} invoice(s) ${lock ? 'locked' : 'unlocked'}` });
    setSelectedIds(new Set());
  };

  const handleDelete = async (inv: any) => {
    if (!canPerform('invoice.delete')) { toast({ title: 'Permission denied', variant: 'destructive' }); return; }
    if (inv.locked) { toast({ title: 'Cannot delete locked invoice', variant: 'destructive' }); return; }
    await Promise.all([
      supabase.from('eb_tenant_shares' as any).delete().eq('invoice_id', inv.id),
      supabase.from('invoice_line_items' as any).delete().eq('invoice_id', inv.id),
    ]);
    await supabase.from('invoices').delete().eq('id', inv.id);
    auditLog('invoices', inv.id, 'deleted', { invoice_number: inv.invoice_number });
    qc.invalidateQueries({ queryKey: ['acc-invoices'] });
    toast({ title: 'Invoice deleted' });
  };

  // PDF Export
  const handleExportPDF = () => {
    const selected = sorted.filter((inv: any) => selectedIds.has(inv.id));
    if (selected.length === 0) { toast({ title: 'Select invoices to export', variant: 'destructive' }); return; }
    const orgName = organization?.organization_name || 'Vishful Living';
    const gstNumber = organization?.gst_number || '';

    const invoicePages = selected.map((inv: any) => {
      const aptBed = `${inv.apartments?.apartment_code || ''}-${inv.beds?.bed_code || ''}`;
      const rent = Number(inv.rent_amount || 0);
      const eb = Number(inv.electricity_amount || 0);
      const late = Number(inv.late_fee || 0);
      const other = Number(inv.other_charges || 0);
      const total = Number(inv.total_amount || 0);
      const paid = Number(inv.amount_paid || 0);
      const balance = Number(inv.balance || 0);

      return `<div class="invoice-page">
        <div class="inv-header">
          <div><h2>${orgName}</h2><p class="sub">Tax Invoice</p>
            ${gstNumber ? `<p class="gst-info">GSTIN: ${gstNumber}</p>` : ''}
            <p class="hsn-info">HSN Code: 99632</p>
          </div>
          <div class="inv-meta">
            <p><strong>Invoice #:</strong> ${inv.invoice_number || '—'}</p>
            <p><strong>Date:</strong> ${fmtDate(inv.invoice_date)}</p>
            <p><strong>Due:</strong> ${fmtDate(inv.due_date)}</p>
            <p><strong>Month:</strong> ${fmtMonth(inv.billing_month)}</p>
          </div>
        </div>
        <div class="tenant-info">
          <p><strong>Bill To:</strong> ${inv.tenants?.full_name || '—'}</p>
          <p><strong>Unit:</strong> ${aptBed}</p>
          <p><strong>Property:</strong> ${inv.properties?.property_name || '—'}</p>
        </div>
        <table class="line-items">
          <thead><tr><th>Description</th><th class="r">Amount (₹)</th></tr></thead>
          <tbody>
            ${rent > 0 ? `<tr><td>Rent</td><td class="r">${rent.toLocaleString('en-IN')}</td></tr>` : ''}
            ${eb > 0 ? `<tr><td>Electricity (EB)</td><td class="r">${eb.toLocaleString('en-IN')}</td></tr>` : ''}
            ${late > 0 ? `<tr><td>Late Fee</td><td class="r">${late.toLocaleString('en-IN')}</td></tr>` : ''}
            ${other > 0 ? `<tr><td>Other Charges</td><td class="r">${other.toLocaleString('en-IN')}</td></tr>` : ''}
          </tbody>
          <tfoot>
            <tr class="total-row"><td><strong>Total Due</strong></td><td class="r"><strong>${total.toLocaleString('en-IN')}</strong></td></tr>
            ${paid > 0 ? `<tr><td>Amount Paid</td><td class="r text-green">${paid.toLocaleString('en-IN')}</td></tr>` : ''}
            ${balance > 0 ? `<tr class="balance-row"><td><strong>Balance Due</strong></td><td class="r"><strong>${balance.toLocaleString('en-IN')}</strong></td></tr>` : ''}
          </tfoot>
        </table>
        <div class="inv-status">Status: <span class="badge-${inv.status}">${(inv.status || 'pending').toUpperCase()}</span></div>
        <div class="inv-footer"><p>This is a computer-generated invoice. | ${orgName}${gstNumber ? ` | GSTIN: ${gstNumber}` : ''} | HSN: 99632</p></div>
      </div>`;
    }).join('');

    const html = `<!DOCTYPE html><html><head><title>Invoices — ${orgName}</title>
    <style>
      *{margin:0;padding:0;box-sizing:border-box}body{font-family:'Segoe UI',Arial,sans-serif;color:#1a1a1a}
      .invoice-page{padding:40px;page-break-after:always;max-width:800px;margin:0 auto}
      .invoice-page:last-child{page-break-after:auto}
      .inv-header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #2563eb;padding-bottom:16px;margin-bottom:20px}
      .inv-header h2{font-size:22px;color:#2563eb}.inv-header .sub{font-size:13px;color:#6b7280;margin-top:2px}
      .gst-info{font-size:11px;color:#374151;margin-top:4px;font-weight:600}.hsn-info{font-size:10px;color:#6b7280}
      .inv-meta{text-align:right;font-size:12px;line-height:1.6}
      .tenant-info{background:#f8fafc;padding:12px 16px;border-radius:6px;margin-bottom:20px;font-size:13px;line-height:1.8}
      .line-items{width:100%;border-collapse:collapse;margin-bottom:20px}
      .line-items th{background:#f1f5f9;padding:10px 14px;text-align:left;font-size:12px;font-weight:600;border-bottom:2px solid #cbd5e1}
      .line-items td{padding:8px 14px;border-bottom:1px solid #e2e8f0;font-size:13px}
      .line-items .r{text-align:right}
      .total-row td{border-top:2px solid #1e3a5f;font-size:14px}
      .balance-row td{color:#dc2626}
      .text-green{color:#16a34a}
      .inv-status{text-align:right;margin-bottom:30px;font-size:13px}
      .badge-paid{background:#dcfce7;color:#166534;padding:2px 10px;border-radius:4px;font-weight:600;font-size:11px}
      .badge-pending{background:#fef3c7;color:#92400e;padding:2px 10px;border-radius:4px;font-weight:600;font-size:11px}
      .badge-partial{background:#dbeafe;color:#1e40af;padding:2px 10px;border-radius:4px;font-weight:600;font-size:11px}
      .badge-overdue{background:#fecaca;color:#991b1b;padding:2px 10px;border-radius:4px;font-weight:600;font-size:11px}
      .inv-footer{border-top:1px solid #e2e8f0;padding-top:12px;font-size:10px;color:#9ca3af;text-align:center}
      @media print{body{padding:0}.invoice-page{padding:20px}}
    </style></head><body>${invoicePages}</body></html>`;
    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); setTimeout(() => w.print(), 500); }
  };

  // Download template for import
  const handleDownloadTemplate = () => {
    const headers = ['Invoice ID', 'Invoice #', 'Tenant ID', 'Property ID', 'Apartment ID', 'Bed ID', 'Allotment ID', 'Invoice Date', 'Due Date', 'Billing Month', 'Rent', 'Estimated EB', 'Late Fee', 'Other Charges', 'Total', 'Paid', 'Balance', 'Status', 'Locked',
      'Bed Rate', 'Discount', 'Premium', 'Stay Days', 'Total Days in Month', 'Per Day Rent',
      'EB Reading Start', 'EB Reading End', 'EB Units Consumed', 'EB Unit Cost', 'EB Apt Total Bill', 'EB Total Tenant Days', 'EB Per Day Rate', 'EB Tenant Stay Days', 'EB Tenant Charge'];
    const ws = XLSX.utils.aoa_to_sheet([headers]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Invoices');

    // Field Reference sheet
    const refData = [
      ['Column', 'Description', 'Data Type', 'Example'],
      ['Invoice ID', 'UUID of existing invoice (required for overwrite)', 'UUID', 'a1b2c3d4-...'],
      ['Invoice #', 'Display invoice number', 'Text', 'VISH/24-25/01/00001'],
      ['Tenant ID', 'UUID of tenant', 'UUID', ''],
      ['Property ID', 'UUID of property', 'UUID', ''],
      ['Apartment ID', 'UUID of apartment', 'UUID', ''],
      ['Bed ID', 'UUID of bed', 'UUID', ''],
      ['Allotment ID', 'UUID of tenant allotment', 'UUID', ''],
      ['Invoice Date', 'Date of invoice', 'Date (YYYY-MM-DD)', '2025-01-01'],
      ['Due Date', 'Payment due date', 'Date', '2025-01-07'],
      ['Billing Month', 'Month in yyyy-MM format', 'Text', '2025-01'],
      ['Rent', 'Rental amount', 'Number', '5000'],
      ['Estimated EB', 'Electricity amount (actual + estimated)', 'Number', '800'],
      ['Late Fee', 'Late fee amount', 'Number', '0'],
      ['Other Charges', 'Exit charges / other', 'Number', '2250'],
      ['Total', 'Total invoice amount', 'Number', '8050'],
      ['Paid', 'Amount already paid', 'Number', '0'],
      ['Balance', 'Remaining balance', 'Number', '8050'],
      ['Status', 'Invoice status', 'Text (pending/paid/partial)', 'pending'],
      ['Locked', 'Whether invoice is locked', 'Yes/No', 'No'],
      ['Bed Rate', 'Monthly bed rate used for rent calc', 'Number', '7500'],
      ['Discount', 'Discount applied to bed rate', 'Number', '500'],
      ['Premium', 'Premium applied to bed rate', 'Number', '0'],
      ['Stay Days', 'Number of days tenant stayed in billing month', 'Number', '30'],
      ['Total Days in Month', 'Total calendar days in billing month', 'Number', '31'],
      ['Per Day Rent', 'Computed per-day rental rate', 'Number', '225.81'],
      ['EB Reading Start', 'Electricity meter start reading', 'Number', '1200'],
      ['EB Reading End', 'Electricity meter end reading', 'Number', '1350'],
      ['EB Units Consumed', 'Total units consumed by apartment', 'Number', '150'],
      ['EB Unit Cost', 'Cost per unit of electricity', 'Number', '8'],
      ['EB Apt Total Bill', 'Total apartment electricity bill', 'Number', '1200'],
      ['EB Total Tenant Days', 'Sum of all tenants stay days in apartment', 'Number', '90'],
      ['EB Per Day Rate', 'EB bill / total tenant days', 'Number', '13'],
      ['EB Tenant Stay Days', 'This tenant\'s stay days for EB period', 'Number', '30'],
      ['EB Tenant Charge', 'This tenant\'s computed EB charge', 'Number', '400'],
    ];
    const refWs = XLSX.utils.aoa_to_sheet(refData);
    refWs['!cols'] = [{ wch: 22 }, { wch: 50 }, { wch: 28 }, { wch: 22 }];
    XLSX.utils.book_append_sheet(wb, refWs, 'Field Reference');

    saveAs(new Blob([XLSX.write(wb, { bookType: 'xlsx', type: 'array' })]), 'invoices-template.xlsx');
    toast({ title: 'Template downloaded' });
  };

  // Excel Export
  const handleExportExcel = () => {
    const selected = sorted.filter((inv: any) => selectedIds.has(inv.id));
    const data = (selected.length > 0 ? selected : sorted).map((inv: any) => ({
      'Invoice #': inv.invoice_number || '',
      'Apt-Bed': `${inv.apartments?.apartment_code || ''}-${inv.beds?.bed_code || ''}`,
      'Tenant': inv.tenants?.full_name || '',
      'Month': fmtMonth(inv.billing_month),
      'Rent': Number(inv.rent_amount || 0),
      'Estimated EB': Number(inv.electricity_amount || 0),
      'Late Fee': Number(inv.late_fee || 0),
      'Other Charges': Number(inv.other_charges || 0),
      'Total': Number(inv.total_amount || 0),
      'Paid': Number(inv.amount_paid || 0),
      'Balance': Number(inv.balance || 0),
      'Due Date': inv.due_date || '',
      'Status': inv.status || '',
      'Locked': inv.locked ? 'Yes' : 'No',
      'Invoice ID': inv.id,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Invoices');
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `invoices-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    toast({ title: 'Excel exported' });
  };

  // File selected — open dialog to choose mode
  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFile(file);
    setImportMode('overwrite');
    setImportProgress(0);
    setImportTotal(0);
    setImportStatus('');
    setImportRunning(false);
    setImportDialogOpen(true);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const executeImport = async () => {
    if (!importFile) return;
    setImportRunning(true);
    setImportStatus('Reading Excel file…');
    setImportProgress(0);

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const wb = XLSX.read(evt.target?.result, { type: 'binary', cellDates: false });
        const rows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
        if (rows.length === 0) {
          toast({ title: 'No data found in Excel', variant: 'destructive' });
          setImportRunning(false);
          return;
        }

        const getVal = (row: any, keys: string[]) => {
          for (const k of keys) {
            if (row[k] !== undefined && row[k] !== null && row[k] !== '') return row[k];
          }
          return null;
        };

        // Parse all rows
        let invoiceRows: any[] = [];
        for (const row of rows) {
          const id = getVal(row, ['id', 'ID', 'invoice_id', 'Invoice ID']);
          if (!id) continue;

          const rent = Number(getVal(row, ['rent_amount', 'Rent', 'rent']) ?? 0);
          const eb = Number(getVal(row, ['electricity_amount', 'Estimated EB', 'EB', 'electricity', 'eb']) ?? 0);
          const other = Number(getVal(row, ['other_charges', 'Other Charges', 'other']) ?? 0);
          const lateFee = Number(getVal(row, ['late_fee', 'Late Fee', 'late_fee_amount']) ?? 0);
          const totalFromExcel = Number(getVal(row, ['total_amount', 'Total', 'total']) ?? 0);
          const total = totalFromExcel > 0 ? totalFromExcel : (rent + eb + other + lateFee);
          const amountPaid = Number(getVal(row, ['amount_paid', 'Paid', 'paid', 'amount paid']) ?? 0);
          const balanceFromExcel = Number(getVal(row, ['balance', 'Balance', 'balance_due']) ?? 0);
          const balance = balanceFromExcel > 0 ? balanceFromExcel : Math.max(0, total - amountPaid);
          const status = getVal(row, ['status', 'Status']) || (balance <= 0 ? 'paid' : amountPaid > 0 ? 'partial' : 'pending');
          const locked = getVal(row, ['locked', 'Locked']);
          const isLocked = locked === true || locked === 'Yes' || locked === 'TRUE' || locked === 1;

          const invoiceData: any = {
            id,
            organization_id: getVal(row, ['organization_id', 'org_id']) || undefined,
            tenant_id: getVal(row, ['tenant_id', 'Tenant ID']) || undefined,
            property_id: getVal(row, ['property_id', 'Property ID']) || undefined,
            apartment_id: getVal(row, ['apartment_id', 'Apartment ID']) || undefined,
            bed_id: getVal(row, ['bed_id', 'Bed ID']) || undefined,
            allotment_id: getVal(row, ['allotment_id', 'Allotment ID']) || undefined,
            invoice_number: getVal(row, ['invoice_number', 'Invoice #', 'Invoice Number']) || undefined,
            invoice_date: parseExcelDateUTC(getVal(row, ['invoice_date', 'Invoice Date'])) || undefined,
            due_date: parseExcelDateUTC(getVal(row, ['due_date', 'Due Date', 'Due'])) || undefined,
            billing_month: getVal(row, ['billing_month', 'Month', 'Billing Month']) || undefined,
            rent_amount: rent,
            electricity_amount: eb,
            other_charges: other,
            late_fee: lateFee,
            total_amount: total,
            amount_paid: amountPaid,
            balance,
            status,
            locked: isLocked,
          };

          Object.keys(invoiceData).forEach(k => {
            if (invoiceData[k] === undefined) delete invoiceData[k];
          });
          invoiceRows.push(invoiceData);
        }

        const totalSteps = invoiceRows.length;
        setImportTotal(totalSteps);

        // OVERWRITE mode: delete existing invoices (and their line items) first — skip locked invoices
        if (importMode === 'overwrite') {
          setImportStatus('Checking for locked invoices…');
          const invoiceIds = invoiceRows.map(r => r.id);

          // Fetch locked invoice IDs so we can skip them
          const { data: lockedRows } = await supabase
            .from('invoices')
            .select('id')
            .in('id', invoiceIds)
            .eq('locked', true);
          const lockedIds = new Set((lockedRows || []).map((r: any) => r.id));

          if (lockedIds.size > 0) {
            toast({ title: `${lockedIds.size} locked invoice(s) will be skipped`, description: 'Unlock them first if you want to overwrite.', variant: 'destructive' });
          }

          // Remove locked invoices from the rows to import
          invoiceRows = invoiceRows.filter(r => !lockedIds.has(r.id));
          const deletableIds = invoiceIds.filter(id => !lockedIds.has(id));

          setImportStatus('Deleting existing data for matching IDs…');
          const DEL_BATCH = 200;
          for (let i = 0; i < deletableIds.length; i += DEL_BATCH) {
            const batchIds = deletableIds.slice(i, i + DEL_BATCH);
            await Promise.all([
              supabase.from('eb_tenant_shares' as any).delete().in('invoice_id', batchIds),
              supabase.from('invoice_line_items').delete().in('invoice_id', batchIds),
            ]);
            await supabase.from('invoices').delete().in('id', batchIds);
            setImportProgress(Math.round(((i + batchIds.length) / deletableIds.length) * 20));
          }
        }

        // Insert/Upsert invoices in batches
        setImportStatus('Importing invoices…');
        let upserted = 0;
        const BATCH = 200;
        const insertPromises: Array<Promise<any>> = [];
        for (let i = 0; i < invoiceRows.length; i += BATCH) {
          const batch = invoiceRows.slice(i, i + BATCH);
          const batchIdx = i;
          const op = importMode === 'overwrite'
            ? supabase.from('invoices').insert(batch as any)
            : supabase.from('invoices').upsert(batch as any, { onConflict: 'id' });
          insertPromises.push(
            Promise.resolve(op).then(({ error }) => {
              if (error) {
                console.error('Batch error:', error);
                toast({ title: 'Error importing batch', description: error.message, variant: 'destructive' });
              } else {
                upserted += batch.length;
              }
              setImportProgress(20 + Math.round(((batchIdx + batch.length) / totalSteps) * 50));
            })
          );
        }
        await Promise.all(insertPromises);

        // Generate line items
        setImportStatus('Generating line items…');
        if (importMode === 'append') {
          const invoiceIds = invoiceRows.map(r => r.id);
          const delPromises: Array<Promise<any>> = [];
          for (let i = 0; i < invoiceIds.length; i += BATCH) {
            delPromises.push(Promise.resolve(supabase.from('invoice_line_items').delete().in('invoice_id', invoiceIds.slice(i, i + BATCH))));
          }
          await Promise.all(delPromises);
        }

        const allLineItems: any[] = [];
        for (const inv of invoiceRows) {
          const rent = Number(inv.rent_amount || 0);
          const eb = Number(inv.electricity_amount || 0);
          const other = Number(inv.other_charges || 0);
          const lateFee = Number(inv.late_fee || 0);

          // Build metadata from extended columns
          const row = rows.find((r: any) => (getVal(r, ['id', 'ID', 'invoice_id', 'Invoice ID'])) === inv.id);
          const rentMeta: any = {};
          const ebMeta: any = {};
          if (row) {
            const bedRate = getVal(row, ['Bed Rate', 'bed_rate']);
            if (bedRate !== null) rentMeta.bed_rate = Number(bedRate);
            const discount = getVal(row, ['Discount', 'discount']);
            if (discount !== null) rentMeta.discount = Number(discount);
            const premium = getVal(row, ['Premium', 'premium']);
            if (premium !== null) rentMeta.premium = Number(premium);
            const stayDays = getVal(row, ['Stay Days', 'stay_days']);
            if (stayDays !== null) rentMeta.stay_days = Number(stayDays);
            const totalDays = getVal(row, ['Total Days in Month', 'total_days_in_month']);
            if (totalDays !== null) rentMeta.total_days_in_month = Number(totalDays);
            const perDayRent = getVal(row, ['Per Day Rent', 'per_day_rent']);
            if (perDayRent !== null) rentMeta.per_day_rent = Number(perDayRent);
            if (rentMeta.bed_rate !== undefined && rentMeta.discount !== undefined && rentMeta.premium !== undefined) {
              rentMeta.effective_rate = Math.max(0, rentMeta.bed_rate - (rentMeta.discount || 0) + (rentMeta.premium || 0));
            }

            const ebUnits = getVal(row, ['EB Units Consumed', 'eb_units', 'total_units']);
            if (ebUnits !== null) ebMeta.total_units = Number(ebUnits);
            const ebUnitCost = getVal(row, ['EB Unit Cost', 'eb_unit_cost', 'unit_cost']);
            if (ebUnitCost !== null) ebMeta.unit_cost = Number(ebUnitCost);
            const ebAptBill = getVal(row, ['EB Apt Total Bill', 'eb_apt_total', 'total_apartment_bill']);
            if (ebAptBill !== null) ebMeta.total_apartment_bill = Number(ebAptBill);
            const ebTotalDays = getVal(row, ['EB Total Tenant Days', 'eb_total_tenant_days', 'total_tenant_days']);
            if (ebTotalDays !== null) ebMeta.total_tenant_days = Number(ebTotalDays);
            const ebPerDay = getVal(row, ['EB Per Day Rate', 'eb_per_day_rate', 'per_day_rate']);
            if (ebPerDay !== null) ebMeta.per_day_rate = Number(ebPerDay);
            const ebTenantDays = getVal(row, ['EB Tenant Stay Days', 'eb_tenant_stay_days', 'tenant_stay_days']);
            if (ebTenantDays !== null) ebMeta.tenant_stay_days = Number(ebTenantDays);
            const ebTenantCharge = getVal(row, ['EB Tenant Charge', 'eb_tenant_charge', 'tenant_eb_charge']);
            if (ebTenantCharge !== null) ebMeta.tenant_eb_charge = Number(ebTenantCharge);
          }

          const hasRentMeta = Object.keys(rentMeta).length > 0;
          const hasEbMeta = Object.keys(ebMeta).length > 0;

          if (rent > 0) allLineItems.push({ invoice_id: inv.id, line_type: 'rent', amount: rent, description: 'Rent', metadata: hasRentMeta ? rentMeta : {} });
          if (eb > 0) allLineItems.push({ invoice_id: inv.id, line_type: 'estimated_eb', amount: eb, description: 'Estimated EB', metadata: hasEbMeta ? ebMeta : {} });
          if (other > 0) allLineItems.push({ invoice_id: inv.id, line_type: 'exit_charges', amount: other, description: 'Exit Charges', metadata: {} });
          if (lateFee > 0) allLineItems.push({ invoice_id: inv.id, line_type: 'late_fee', amount: lateFee, description: 'Late Fee', metadata: {} });
        }

        let lineItemsCreated = 0;
        const linePromises: Array<Promise<any>> = [];
        for (let i = 0; i < allLineItems.length; i += BATCH) {
          const batch = allLineItems.slice(i, i + BATCH);
          const batchIdx = i;
          linePromises.push(
            Promise.resolve(supabase.from('invoice_line_items').insert(batch as any)).then(({ error }) => {
              if (!error) lineItemsCreated += batch.length;
              setImportProgress(70 + Math.round(((batchIdx + batch.length) / Math.max(allLineItems.length, 1)) * 30));
            })
          );
        }
        await Promise.all(linePromises);

        setImportProgress(100);
        setImportStatus(`Done! ${upserted} invoices imported, ${lineItemsCreated} line items created.`);
        qc.invalidateQueries({ queryKey: ['acc-invoices'] });
        toast({ title: `${upserted} invoice(s) ${importMode === 'overwrite' ? 'replaced' : 'added/updated'}, ${lineItemsCreated} line items created` });

        setTimeout(() => {
          setImportDialogOpen(false);
          setImportRunning(false);
          setImportFile(null);
        }, 1500);
      } catch (err: any) {
        toast({ title: 'Import error', description: err.message, variant: 'destructive' });
        setImportRunning(false);
        setImportStatus('Error: ' + err.message);
      }
    };
    reader.readAsBinaryString(importFile);
  };
  // Stats
  const totalRent = sorted.reduce((s: number, inv: any) => s + Number(inv.rent_amount || 0), 0);
  const totalActualEB = sorted.reduce((s: number, inv: any) => s + Number(inv.electricity_amount || 0), 0);
  const totalEstEB = sorted.reduce((s: number, inv: any) => s + Number(inv.estimated_eb || 0), 0);
  const totalEB = totalActualEB + totalEstEB;
  const totalOther = sorted.reduce((s: number, inv: any) => s + Number(inv.other_charges || 0), 0);
  const totalDue = sorted.reduce((s: number, inv: any) => s + Number(inv.total_amount || 0), 0);

  // EB Prev month — total EB billed in the month before the selected monthFilter
  const prevMonthEB = useMemo(() => {
    if (!monthFilter || monthFilter === 'all') return totalActualEB;
    const [y, m] = monthFilter.split('-').map(Number);
    const prevDate = new Date(y, m - 2, 1); // month is 0-indexed so m-2
    const prevKey = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
    return invoices
      .filter((inv: any) => inv.billing_month === prevKey)
      .reduce((s: number, inv: any) => s + Number(inv.electricity_amount || 0) + Number(inv.estimated_eb || 0), 0);
  }, [invoices, monthFilter, totalActualEB]);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <Select value={propertyFilter} onValueChange={setPropertyFilter}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Property" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Properties</SelectItem>
            {properties.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.property_name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={monthFilter} onValueChange={setMonthFilter}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Month" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Months</SelectItem>
            {availableMonths.map(m => <SelectItem key={m} value={m}>{fmtMonth(m)}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-32"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="excess">Excess</SelectItem>
            <SelectItem value="overdue">Overdue</SelectItem>
          </SelectContent>
        </Select>
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search invoice, tenant, unit…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-8 h-9" />
        </div>
        {!isTenantView && (
          <div className="ml-auto flex gap-2">
            {selectedIds.size > 0 && (
              <>
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => handleBulkLock(true)}>
                  <Lock className="h-3.5 w-3.5" /> Lock ({selectedIds.size})
                </Button>
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => handleBulkLock(false)}>
                  <Unlock className="h-3.5 w-3.5" /> Unlock ({selectedIds.size})
                </Button>
              </>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5"><Download className="h-3.5 w-3.5" /> Export</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={handleExportPDF}><FileText className="h-3.5 w-3.5 mr-2" /> PDF {selectedIds.size > 0 ? `(${selectedIds.size})` : '(all)'}</DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportExcel}><Download className="h-3.5 w-3.5 mr-2" /> Excel {selectedIds.size > 0 ? `(${selectedIds.size})` : '(all)'}</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5"><Upload className="h-3.5 w-3.5" /> Import</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={handleDownloadTemplate}><Download className="h-3.5 w-3.5 mr-2" /> Download Template</DropdownMenuItem>
                <DropdownMenuItem onClick={() => fileInputRef.current?.click()}><Upload className="h-3.5 w-3.5 mr-2" /> Upload Excel</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileSelected} />
          </div>
        )}
      </div>

      {/* Summary Dashboard */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-3">
          <p className="text-[11px] text-muted-foreground">Rental</p>
          <p className="text-sm font-bold">{fmtAmt(totalRent)}</p>
        </Card>
        <Card className="p-3">
          <p className="text-[11px] text-muted-foreground">Electricity (EB)</p>
          <p className="text-sm font-bold">{fmtAmt(totalEB)}</p>
          <div className="flex justify-between mt-1 text-[10px] text-muted-foreground">
            <span>Prev: {fmtAmt(prevMonthEB)}</span>
            <span>Est: {fmtAmt(totalEstEB)}</span>
          </div>
        </Card>
        <Card className="p-3">
          <p className="text-[11px] text-muted-foreground">Other Charges</p>
          <p className="text-sm font-bold">{fmtAmt(totalOther)}</p>
        </Card>
        <Card className="p-3">
          <p className="text-[11px] text-muted-foreground">Total Revenue</p>
          <p className="text-sm font-bold text-primary">{fmtAmt(totalDue)}</p>
        </Card>
      </div>
      <p className="text-xs text-muted-foreground">{sorted.length} invoice(s)</p>

      {/* Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8"><Checkbox checked={selectedIds.size === sorted.length && sorted.length > 0} onCheckedChange={toggleAll} /></TableHead>
              <TableHead className="cursor-pointer select-none whitespace-nowrap" onClick={() => handleSort('location')}>Apt-Bed<SortIcon col="location" /></TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => handleSort('tenant')}>Tenant<SortIcon col="tenant" /></TableHead>
              <TableHead className="cursor-pointer select-none text-right" onClick={() => handleSort('rent')}>Rent<SortIcon col="rent" /></TableHead>
              <TableHead className="cursor-pointer select-none text-right" onClick={() => handleSort('actual_eb')}>Actual EB<SortIcon col="actual_eb" /></TableHead>
              <TableHead className="cursor-pointer select-none text-right" onClick={() => handleSort('est_eb')}>Est. EB<SortIcon col="est_eb" /></TableHead>
              <TableHead className="cursor-pointer select-none text-right" onClick={() => handleSort('other')}>Others<SortIcon col="other" /></TableHead>
              <TableHead className="cursor-pointer select-none text-right" onClick={() => handleSort('total')}>Total<SortIcon col="total" /></TableHead>
              <TableHead className="cursor-pointer select-none" onClick={() => handleSort('status_badge')}>Status<SortIcon col="status_badge" /></TableHead>
              {!isTenantView && <TableHead className="w-8">Lock</TableHead>}
              {!isTenantView && <TableHead className="w-20">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.length === 0 ? (
              <TableRow><TableCell colSpan={11} className="text-center text-muted-foreground py-8">No invoices found</TableCell></TableRow>
            ) : sorted.map((inv: any) => {
              const tenantStatus = getTenantStatus(inv);
              const aptBed = `${inv.apartments?.apartment_code || ''}-${inv.beds?.bed_code || ''}`;
              const computedStatus = getComputedStatus(inv);
              const statusColors: Record<string, string> = {
                Paid: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
                Pending: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
                Overdue: 'bg-destructive/10 text-destructive',
                Excess: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
              };
              return (
                <TableRow key={inv.id} className={`cursor-pointer hover:bg-muted/50 ${inv.locked ? 'bg-muted/30' : ''}`} onClick={() => openDetail(inv)}>
                  <TableCell onClick={e => e.stopPropagation()}><Checkbox checked={selectedIds.has(inv.id)} onCheckedChange={() => toggleOne(inv.id)} /></TableCell>
                  <TableCell className="whitespace-nowrap">
                    <Badge className={`text-[10px] font-semibold ${tenantStatus.color}`}>
                      {aptBed} · {tenantStatus.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">{inv.tenants?.full_name}</TableCell>
                  <TableCell className="text-right text-sm">{fmtAmt(Number(inv.rent_amount || 0))}</TableCell>
                  <TableCell className="text-right text-sm">{fmtAmt(Number(inv.electricity_amount || 0))}</TableCell>
                  <TableCell className="text-right text-sm">{fmtAmt(Number(inv.estimated_eb || 0))}</TableCell>
                  <TableCell className="text-right text-sm">{fmtAmt(Number(inv.other_charges || 0))}</TableCell>
                  <TableCell className="text-right font-semibold text-sm">{fmtAmt(Number(inv.total_amount || 0))}</TableCell>
                  <TableCell>
                    <Badge className={`text-[10px] ${statusColors[computedStatus] || 'bg-secondary text-secondary-foreground'}`}>{computedStatus}</Badge>
                  </TableCell>
                  <TableCell>
                    {inv.locked && <Lock className="h-3 w-3 text-muted-foreground" />}
                  </TableCell>
                  {!isTenantView && (
                    <TableCell onClick={e => e.stopPropagation()}>
                      <div className="flex gap-1">
                        {canPerform('invoice.lock') && (
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleLock(inv)} title={inv.locked ? 'Unlock' : 'Lock'}>
                            {inv.locked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
                          </Button>
                        )}
                        {canPerform('invoice.delete') && !inv.locked && (
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(inv)} title="Delete">
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
            {sorted.length > 0 && (
              <TableRow className="bg-muted/50 font-semibold border-t-2">
                <TableCell colSpan={3} className="text-sm">Totals ({sorted.length})</TableCell>
                <TableCell className="text-right text-sm">{fmtAmt(totalRent)}</TableCell>
                <TableCell className="text-right text-sm">{fmtAmt(totalActualEB)}</TableCell>
                <TableCell className="text-right text-sm">{fmtAmt(totalEstEB)}</TableCell>
                <TableCell className="text-right text-sm">{fmtAmt(totalOther)}</TableCell>
                <TableCell className="text-right text-sm text-primary">{fmtAmt(totalDue)}</TableCell>
                <TableCell colSpan={3}></TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Detail Sheet */}
      <Sheet open={!!detailInvoice} onOpenChange={(open) => { if (!open) setDetailInvoice(null); }}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          {detailInvoice && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center justify-between">
                  <span>Invoice {detailInvoice.invoice_number}</span>
                  <div className="flex gap-2">
                    {detailInvoice.locked && <Badge variant="outline" className="text-[10px]"><Lock className="h-3 w-3 mr-1" />Locked</Badge>}
                    {!isTenantView && !editMode && !detailInvoice.locked && (
                      <Button variant="outline" size="sm" onClick={() => setEditMode(true)} className="gap-1"><Pencil className="h-3 w-3" /> Edit</Button>
                    )}
                    <Badge variant={detailInvoice.status === 'paid' ? 'default' : 'secondary'} className="capitalize">{detailInvoice.status}</Badge>
                  </div>
                </SheetTitle>
              </SheetHeader>

              <div className="space-y-5 mt-4">
                {/* Tenant status badge */}
                {(() => {
                  const ts = getTenantStatus(detailInvoice);
                  return (
                    <Badge className={`text-xs ${ts.color}`}>
                      {detailInvoice.apartments?.apartment_code}-{detailInvoice.beds?.bed_code} · {ts.label}
                    </Badge>
                  );
                })()}

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-muted-foreground">Tenant:</span> <strong>{detailInvoice.tenants?.full_name}</strong></div>
                  <div><span className="text-muted-foreground">Unit:</span> <strong>{detailInvoice.apartments?.apartment_code}-{detailInvoice.beds?.bed_code}</strong></div>
                  <div><span className="text-muted-foreground">Month:</span> <strong>{fmtMonth(detailInvoice.billing_month)}</strong></div>
                  <div><span className="text-muted-foreground">Due:</span> <strong>{fmtDate(detailInvoice.due_date)}</strong></div>
                  <div><span className="text-muted-foreground">Property:</span> <strong>{detailInvoice.properties?.property_name}</strong></div>
                </div>

                <Separator />

                {editMode ? (
                  <div className="space-y-3">
                    <h4 className="font-semibold text-sm">Edit Invoice</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div><Label className="text-xs">Rent</Label><Input type="number" value={editForm.rent_amount} onChange={e => setEditForm({ ...editForm, rent_amount: Number(e.target.value) })} /></div>
                      <div><Label className="text-xs">Estimated EB</Label><Input type="number" value={editForm.electricity_amount} onChange={e => setEditForm({ ...editForm, electricity_amount: Number(e.target.value) })} /></div>
                      <div><Label className="text-xs">Late Fee</Label><Input type="number" value={editForm.late_fee} onChange={e => setEditForm({ ...editForm, late_fee: Number(e.target.value) })} /></div>
                      <div><Label className="text-xs">Other Charges</Label><Input type="number" value={editForm.other_charges} onChange={e => setEditForm({ ...editForm, other_charges: Number(e.target.value) })} /></div>
                    </div>
                    <div className="flex gap-2 items-center">
                      <span className="text-sm font-semibold">New Total: {fmtAmt(editForm.rent_amount + editForm.electricity_amount + editForm.late_fee + editForm.other_charges)}</span>
                      <div className="ml-auto flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => setEditMode(false)}>Cancel</Button>
                        <Button size="sm" onClick={handleSaveEdit}>Save</Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Detailed line items if available */}
                    {detailLoading ? (
                      <p className="text-sm text-muted-foreground">Loading…</p>
                    ) : detailLineItems.length > 0 && (
                      <div>
                        <h4 className="font-semibold text-sm mb-2">Detailed Line Items</h4>
                        <Table>
                          <TableHeader><TableRow>
                            <TableHead className="text-xs">Type</TableHead>
                            <TableHead className="text-xs">Description</TableHead>
                            <TableHead className="text-xs text-right">Amount</TableHead>
                          </TableRow></TableHeader>
                          <TableBody>
                            {detailLineItems.map((li: any) => (
                              <TableRow key={li.id}>
                                <TableCell className="text-xs capitalize">{li.line_type?.replace(/_/g, ' ')}</TableCell>
                                <TableCell className="text-xs">{li.description || '—'}</TableCell>
                                <TableCell className="text-xs text-right font-medium">{fmtAmt(Number(li.amount || 0))}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}

                    {/* Billing-preview-style metadata grids */}
                    {(() => {
                      const rentItem = detailLineItems.find((li: any) => li.line_type === 'rent');
                      const ebItem = detailLineItems.find((li: any) => li.line_type === 'electricity');
                      const estEbItem = detailLineItems.find((li: any) => li.line_type === 'estimated_eb');
                      const exitItem = detailLineItems.find((li: any) => li.line_type === 'exit_charges');
                      const rentMeta = rentItem?.metadata && Object.keys(rentItem.metadata).length > 0 ? rentItem.metadata : null;
                      const ebMeta = ebItem?.metadata && Object.keys(ebItem.metadata).length > 0 ? ebItem.metadata : null;
                      const estEbMeta = estEbItem?.metadata && Object.keys(estEbItem.metadata).length > 0 ? estEbItem.metadata : null;
                      const exitMeta = exitItem?.metadata && Object.keys(exitItem.metadata).length > 0 ? exitItem.metadata : null;

                      return (
                        <>
                          {rentMeta && (
                            <div>
                              <h4 className="font-semibold text-sm mb-2">Rental Computation</h4>
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm bg-muted/30 rounded p-3">
                                <div><span className="text-muted-foreground">Bed Rate:</span> <strong>{fmtAmt(rentMeta.bed_rate)}/month</strong></div>
                                <div><span className="text-muted-foreground">Discount:</span> <strong>{fmtAmt(rentMeta.discount || 0)}</strong></div>
                                <div><span className="text-muted-foreground">Premium:</span> <strong>{fmtAmt(rentMeta.premium || 0)}</strong></div>
                                <div><span className="text-muted-foreground">Effective Rate:</span> <strong>{fmtAmt(rentMeta.effective_rate || rentMeta.bed_rate)}/month</strong></div>
                                <div><span className="text-muted-foreground">Days in Month:</span> <strong>{rentMeta.total_days_in_month}</strong></div>
                                <div><span className="text-muted-foreground">Stay Days:</span> <strong>{rentMeta.stay_days}</strong></div>
                                <div><span className="text-muted-foreground">Per Day Rent:</span> <strong>₹{Number(rentMeta.per_day_rent || 0).toFixed(2)}</strong></div>
                                <div><span className="text-muted-foreground">Total Rent:</span> <strong className="text-primary">{fmtAmt(Number(rentItem.amount || 0))}</strong></div>
                              </div>
                            </div>
                          )}

                          {ebMeta && (
                            <div>
                              <h4 className="font-semibold text-sm mb-2">EB Computation</h4>
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm bg-muted/30 rounded p-3 mb-3">
                                <div><span className="text-muted-foreground">Total Units:</span> <strong>{Number(ebMeta.total_units || 0).toFixed(2)}/-</strong></div>
                                <div><span className="text-muted-foreground">Unit Cost:</span> <strong>₹{ebMeta.unit_cost}</strong></div>
                                <div><span className="text-muted-foreground">Total Apt EB:</span> <strong>{fmtAmt(Number(ebMeta.total_apartment_bill || 0))}</strong></div>
                                <div><span className="text-muted-foreground">Total Tenant Days:</span> <strong>{ebMeta.total_tenant_days}</strong></div>
                                <div><span className="text-muted-foreground">Per Day EB Rate:</span> <strong>₹{Number(ebMeta.per_day_rate || 0).toFixed(2)}</strong></div>
                                <div><span className="text-muted-foreground">Tenant's Days:</span> <strong>{ebMeta.tenant_stay_days}</strong></div>
                                <div><span className="text-muted-foreground">Tenant's EB:</span> <strong className="text-primary">{fmtAmt(Number(ebMeta.tenant_eb_charge || 0))}</strong></div>
                              </div>

                              {ebMeta.all_tenants && ebMeta.all_tenants.length > 0 && (
                                <div>
                                  <h5 className="text-xs font-semibold text-muted-foreground mb-1">All Tenants in Apartment</h5>
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead className="text-xs">Tenant</TableHead>
                                        <TableHead className="text-xs text-right">Stay Days</TableHead>
                                        <TableHead className="text-xs text-right">EB Share</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {ebMeta.all_tenants.map((t: any, ti: number) => (
                                        <TableRow key={ti}>
                                          <TableCell className="text-xs">{t.tenant_name || t.name}</TableCell>
                                          <TableCell className="text-xs text-right">{t.stay_days}</TableCell>
                                          <TableCell className="text-xs text-right">{fmtAmt(Math.ceil(Number(ebMeta.per_day_rate || 0) * t.stay_days))}</TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </div>
                              )}
                            </div>
                          )}

                          {estEbMeta && (
                            <div className="p-3 bg-orange-50 dark:bg-orange-950/20 rounded text-sm">
                              <strong>Estimated EB:</strong> {fmtAmt(Number(estEbItem.amount || 0))} ({estEbMeta.stay_days} days × ₹{Number(estEbMeta.per_day_rate || 0).toFixed(2)}/day)
                            </div>
                          )}

                          {exitMeta && (
                            <div className="p-3 bg-red-50 dark:bg-red-950/20 rounded text-sm">
                              <strong>Exit Charges:</strong> {fmtAmt(Number(exitItem.amount || 0))} (total stay: {exitMeta.total_stay_days} days, &lt; 1 year)
                            </div>
                          )}
                        </>
                      );
                    })()}

                    <Separator />

                    {/* Invoice Summary */}
                    <div>
                      <h4 className="font-semibold text-sm mb-3">Invoice Summary</h4>
                      {(() => {
                        const rent = Number(detailInvoice.rent_amount || 0);
                        const ebActual = Number(detailInvoice.electricity_amount || 0);
                        const estimatedEbStored = Number(detailInvoice.estimated_eb || 0);
                        const lateFee = Number(detailInvoice.late_fee || 0);
                        const totalAmount = Number(detailInvoice.total_amount || 0);
                        const paid = Number(detailInvoice.amount_paid || 0);
                        const balance = Number(detailInvoice.balance || 0);
                        const exitChargesItem = detailLineItems.find((li: any) => li.line_type === 'exit_charges');
                        const exitCharges = exitChargesItem ? Number(exitChargesItem.amount || 0) : 0;
                        const remainingOther = Number(detailInvoice.other_charges || 0);

                        return (
                          <div className="border rounded-lg overflow-hidden">
                            <Table>
                              <TableBody>
                                {rent > 0 && (
                                  <TableRow>
                                    <TableCell className="text-sm">Rental Due</TableCell>
                                    <TableCell className="text-sm text-right font-medium">{fmtAmt(rent)}</TableCell>
                                  </TableRow>
                                )}
                                {ebActual > 0 && (
                                  <TableRow>
                                    <TableCell className="text-sm">Actual EB</TableCell>
                                    <TableCell className="text-sm text-right font-medium">{fmtAmt(ebActual)}</TableCell>
                                  </TableRow>
                                )}
                                {estimatedEbStored > 0 && (
                                  <TableRow>
                                    <TableCell className="text-sm">Estimated EB</TableCell>
                                    <TableCell className="text-sm text-right font-medium">{fmtAmt(estimatedEbStored)}</TableCell>
                                  </TableRow>
                                )}
                                {lateFee > 0 && (
                                  <TableRow>
                                    <TableCell className="text-sm">Late Fee</TableCell>
                                    <TableCell className="text-sm text-right font-medium">{fmtAmt(lateFee)}</TableCell>
                                  </TableRow>
                                )}
                                {exitCharges > 0 && (
                                  <TableRow>
                                    <TableCell className="text-sm">Exit Charges (stay &lt; 1 year)</TableCell>
                                    <TableCell className="text-sm text-right font-medium">{fmtAmt(exitCharges)}</TableCell>
                                  </TableRow>
                                )}
                                {remainingOther > 0 && (
                                  <TableRow>
                                    <TableCell className="text-sm">Other Charges</TableCell>
                                    <TableCell className="text-sm text-right font-medium">{fmtAmt(remainingOther)}</TableCell>
                                  </TableRow>
                                )}
                                <TableRow className="bg-muted/50">
                                  <TableCell className="text-sm font-bold">Total Amount Due</TableCell>
                                  <TableCell className="text-sm text-right font-bold">{fmtAmt(totalAmount)}</TableCell>
                                </TableRow>
                                {paid > 0 && (
                                  <TableRow>
                                    <TableCell className="text-sm text-green-600">Amount Paid</TableCell>
                                    <TableCell className="text-sm text-right font-medium text-green-600">{fmtAmt(paid)}</TableCell>
                                  </TableRow>
                                )}
                                <TableRow className="border-t-2 border-primary">
                                  <TableCell className="text-sm font-bold text-destructive">Balance Due</TableCell>
                                  <TableCell className="text-sm text-right font-bold text-destructive">{fmtAmt(balance)}</TableCell>
                                </TableRow>
                              </TableBody>
                            </Table>
                          </div>
                        );
                      })()}
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Import Dialog */}
      <Dialog open={importDialogOpen} onOpenChange={(open) => { if (!importRunning) setImportDialogOpen(open); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Import Invoices from Excel</DialogTitle>
            <DialogDescription>
              {importFile ? `File: ${importFile.name}` : 'Select how to handle the imported data.'}
            </DialogDescription>
          </DialogHeader>

          {!importRunning ? (
            <div className="space-y-4 py-2">
              <RadioGroup value={importMode} onValueChange={(v) => setImportMode(v as 'overwrite' | 'append')}>
                <div className="flex items-start gap-3 p-3 rounded-md border cursor-pointer hover:bg-accent" onClick={() => setImportMode('overwrite')}>
                  <RadioGroupItem value="overwrite" id="overwrite" className="mt-0.5" />
                  <div>
                    <Label htmlFor="overwrite" className="font-medium cursor-pointer">Overwrite existing data</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">Deletes matching invoices and replaces them with the Excel data.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-md border cursor-pointer hover:bg-accent" onClick={() => setImportMode('append')}>
                  <RadioGroupItem value="append" id="append" className="mt-0.5" />
                  <div>
                    <Label htmlFor="append" className="font-medium cursor-pointer">Add / Update (Append)</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">Inserts new invoices and updates existing ones by ID without deleting.</p>
                  </div>
                </div>
              </RadioGroup>
            </div>
          ) : (
            <div className="space-y-3 py-4">
              <Progress value={importProgress} className="h-3" />
              <p className="text-sm text-muted-foreground text-center">{importStatus}</p>
              <p className="text-xs text-center text-muted-foreground">{importProgress}%{importTotal > 0 ? ` — ${importTotal} records` : ''}</p>
            </div>
          )}

          <DialogFooter>
            {!importRunning && (
              <>
                <Button variant="outline" onClick={() => { setImportDialogOpen(false); setImportFile(null); }}>Cancel</Button>
                <Button onClick={executeImport}>Start Import</Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
