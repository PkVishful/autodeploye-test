import { useState, useMemo, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download, Search, FileText, ChevronRight, CalendarDays, Building2, Users } from 'lucide-react';
import { fmtMonthLabel } from '@/lib/date-utils';
import { exportToPDF } from '@/lib/export-utils';
import { TablePagination } from '@/components/shared/TablePagination';
import { format } from 'date-fns';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import vishfulLogo from '@/assets/vishful-logo.png';

const fmtDate = (d: string | null) => {
  if (!d) return '—';
  try { return format(new Date(d), 'dd-MMM-yy'); } catch { return d; }
};
const fmtAmt = (v: number) => `₹${new Intl.NumberFormat('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Math.round(v))}`;

interface Props {
  invoices: any[];
  receipts: any[];
  adjustments: any[];
  settlements: any[];
  tenants: any[];
  allotments: any[];
  properties: any[];
  apartments: any[];
  beds: any[];
  lifecyclePayments?: any[];
  isTenantView?: boolean;
  tenantId?: string;
}

interface LedgerEntry {
  id: string;
  date: string;
  type: 'invoice' | 'receipt' | 'adjustment' | 'settlement' | 'lifecycle' | 'onboarding' | 'deposit';
  description: string;
  debit: number;
  credit: number;
  reference: string;
  source: any;
}

function buildLedgerEntries(
  tenantId: string,
  invoices: any[],
  receipts: any[],
  adjustments: any[],
  settlements: any[],
  lifecyclePayments: any[],
  allotments: any[],
): LedgerEntry[] {
  const entries: LedgerEntry[] = [];

  invoices.filter((i: any) => i.tenant_id === tenantId).forEach((inv: any) => {
    entries.push({
      id: inv.id, date: inv.invoice_date || inv.created_at || '',
      type: 'invoice', description: `Invoice ${inv.invoice_number || ''} — ${fmtMonthLabel(inv.billing_month)}`,
      debit: Number(inv.total_amount || 0), credit: 0,
      reference: inv.invoice_number || '', source: inv,
    });
  });

  receipts.filter((r: any) => r.tenant_id === tenantId).forEach((r: any) => {
    entries.push({
      id: r.id, date: r.payment_date || r.created_at || '',
      type: 'receipt', description: `Payment — ${(r.payment_mode || 'Unknown').toUpperCase()}${r.receipt_number ? ` #${r.receipt_number}` : ''}`,
      debit: 0, credit: Number(r.amount_paid || 0),
      reference: r.receipt_number || r.reference_number || '', source: r,
    });
  });

  adjustments.filter((a: any) => a.tenant_id === tenantId).forEach((a: any) => {
    const isCredit = a.adjustment_type === 'credit_note';
    entries.push({
      id: a.id, date: a.adjustment_date || a.created_at || '',
      type: 'adjustment', description: `${isCredit ? 'Credit Note' : 'Debit Note'} — ${a.reason || 'Adjustment'}`,
      debit: isCredit ? 0 : Number(a.amount || 0), credit: isCredit ? Number(a.amount || 0) : 0,
      reference: a.reference_number || '', source: a,
    });
  });

  // Lifecycle payments: booking/onboarding are CREDITS (money received), exit charges are DEBITS
  lifecyclePayments.filter((lp: any) => lp.tenant_id === tenantId).forEach((lp: any) => {
    const isExitCharge = lp.payment_type === 'exit_charge';
    const typeLabel = lp.payment_type === 'onboarding' ? 'Onboarding Payment' : lp.payment_type === 'exit_charge' ? 'Exit Charge' : lp.payment_type === 'booking' ? 'Booking Payment' : lp.payment_type;
    entries.push({
      id: lp.id, date: lp.payment_date || lp.created_at || '',
      type: 'lifecycle', description: typeLabel,
      debit: isExitCharge ? Number(lp.amount || 0) : 0,
      credit: isExitCharge ? 0 : Number(lp.amount || 0),
      reference: lp.reference_number || '', source: lp,
    });
  });

  // Allotment-based debit entries: onboarding charges and refundable security deposit
  allotments.filter((a: any) => a.tenant_id === tenantId).forEach((a: any) => {
    const onboardingCharges = Number(a.onboarding_charges || 0);
    if (onboardingCharges > 0) {
      entries.push({
        id: `onboarding-${a.id}`, date: a.onboarding_date || a.created_at || '',
        type: 'onboarding', description: 'Lifecycle – Onboarding Charges',
        debit: onboardingCharges, credit: 0,
        reference: '', source: a,
      });
    }
    const depositPaid = Number(a.deposit_paid || 0);
    if (depositPaid > 0) {
      entries.push({
        id: `deposit-${a.id}`, date: a.onboarding_date || a.created_at || '',
        type: 'deposit', description: 'Lifecycle – Refundable Security Deposit',
        debit: depositPaid, credit: 0,
        reference: '', source: a,
      });
    }
  });

  settlements.filter((s: any) => s.tenant_id === tenantId).forEach((s: any) => {
    const refund = Number(s.refund_amount || 0);
    entries.push({
      id: s.id, date: s.settlement_date || s.created_at || '',
      type: 'settlement', description: `Deposit Settlement${refund >= 0 ? ' (Refund)' : ' (Payable)'}`,
      debit: refund < 0 ? Math.abs(refund) : 0, credit: refund >= 0 ? refund : 0,
      reference: '', source: s,
    });
  });

  return entries.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
}

const statusBadge = (status: string) => {
  if (status === 'Staying') return <Badge className="bg-green-100 text-green-800 border-green-200 text-[10px] ml-2">Staying</Badge>;
  if (status === 'On-Notice') return <Badge className="bg-orange-100 text-orange-800 border-orange-200 text-[10px] ml-2">On-Notice</Badge>;
  return null;
};

export function LedgerTab({ invoices, receipts, adjustments, settlements, tenants, allotments, properties, apartments, beds, lifecyclePayments = [], isTenantView, tenantId }: Props) {
  const currentMonth = format(new Date(), 'yyyy-MM');
  const [viewMode, setViewMode] = useState<'current' | 'beginning'>('current');
  const [groupBy, setGroupBy] = useState<'tenant' | 'apartment'>('tenant');
  const [balanceFilter, setBalanceFilter] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedTenant, setExpandedTenant] = useState<string | null>(null);
  const [expandedApartment, setExpandedApartment] = useState<string | null>(null);
  const [detailEntry, setDetailEntry] = useState<LedgerEntry | null>(null);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);

  // Reset page when filters/search change
  useEffect(() => { setPage(0); }, [searchQuery, balanceFilter, groupBy, viewMode]);

  // Get all staying/on-notice tenants enriched with apartment code and status
  const activeTenantList = useMemo(() => {
    const seen = new Set<string>();
    const result: { tenantId: string; name: string; allotmentId: string; apartmentCode: string; bedCode: string; apartmentId: string; stayingStatus: string }[] = [];
    allotments
      .filter((a: any) => ['Staying', 'On-Notice'].includes(a.staying_status || ''))
      .forEach((a: any) => {
        if (seen.has(a.tenant_id)) return;
        seen.add(a.tenant_id);
        const t = tenants.find((t: any) => t.id === a.tenant_id);
        const apt = apartments.find((ap: any) => ap.id === a.apartment_id);
        const bed = beds.find((b: any) => b.id === a.bed_id);
        result.push({
          tenantId: a.tenant_id,
          name: (t?.full_name || 'Unknown').trim(),
          allotmentId: a.id,
          apartmentCode: apt?.apartment_code || 'Unknown',
          bedCode: bed?.bed_code || '',
          apartmentId: a.apartment_id || '',
          stayingStatus: a.staying_status || '',
        });
      });
    if (isTenantView && tenantId) {
      const t = tenants.find((t: any) => t.id === tenantId);
      if (!seen.has(tenantId)) {
        const allot = allotments.find((a: any) => a.tenant_id === tenantId);
        const apt = allot ? apartments.find((ap: any) => ap.id === allot.apartment_id) : null;
        const bed = allot ? beds.find((b: any) => b.id === allot.bed_id) : null;
        result.push({
          tenantId,
          name: (t?.full_name || 'Unknown').trim(),
          allotmentId: allot?.id || '',
          apartmentCode: apt?.apartment_code || 'Unknown',
          bedCode: bed?.bed_code || '',
          apartmentId: allot?.apartment_id || '',
          stayingStatus: allot?.staying_status || '',
        });
      }
    }
    return result.sort((a, b) => a.name.localeCompare(b.name));
  }, [allotments, tenants, apartments, beds, isTenantView, tenantId]);

  // Build full ledger for each active tenant
  const tenantLedgers = useMemo(() => {
    const map = new Map<string, LedgerEntry[]>();
    for (const t of activeTenantList) {
      map.set(t.tenantId, buildLedgerEntries(t.tenantId, invoices, receipts, adjustments, settlements, lifecyclePayments, allotments));
    }
    return map;
  }, [activeTenantList, invoices, receipts, adjustments, settlements, lifecyclePayments, allotments]);

  // Compute summaries per tenant
  const tenantSummaries = useMemo(() => {
    return activeTenantList.map(t => {
      const allEntries = tenantLedgers.get(t.tenantId) || [];
      const filtered = viewMode === 'current'
        ? allEntries.filter(e => e.date?.slice(0, 7) === currentMonth)
        : allEntries;
      const totalDebit = filtered.reduce((s, e) => s + e.debit, 0);
      const totalCredit = filtered.reduce((s, e) => s + e.credit, 0);
      const balance = totalDebit - totalCredit;
      return { ...t, entries: filtered, totalDebit, totalCredit, balance };
    });
  }, [activeTenantList, tenantLedgers, viewMode, currentMonth]);

  // Filter by search + balance
  const filteredSummaries = useMemo(() => {
    let result = tenantSummaries;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(t => t.name.toLowerCase().includes(q) || t.apartmentCode.toLowerCase().includes(q));
    }
    if (balanceFilter) {
      result = result.filter(t => t.balance > 0);
    }
    return result;
  }, [tenantSummaries, searchQuery, balanceFilter]);

  // Paginated slice of filteredSummaries
  const totalCount = filteredSummaries.length;
  const totalPages = Math.ceil(totalCount / pageSize);
  const paginatedSummaries = useMemo(() => {
    const start = page * pageSize;
    return filteredSummaries.slice(start, start + pageSize);
  }, [filteredSummaries, page, pageSize]);

  // Apartment-grouped data
  const apartmentGroups = useMemo(() => {
    if (groupBy !== 'apartment') return [];
    const map = new Map<string, typeof filteredSummaries>();
    for (const t of filteredSummaries) {
      const key = t.apartmentCode;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    }
    return Array.from(map.entries())
      .map(([code, tenantList]) => ({
        code,
        tenants: tenantList,
        totalDebit: tenantList.reduce((s, t) => s + t.totalDebit, 0),
        totalCredit: tenantList.reduce((s, t) => s + t.totalCredit, 0),
        balance: tenantList.reduce((s, t) => s + t.balance, 0),
      }))
      .sort((a, b) => a.code.localeCompare(b.code));
  }, [groupBy, filteredSummaries]);

  // Grand totals
  const grandDebit = filteredSummaries.reduce((s, t) => s + t.totalDebit, 0);
  const grandCredit = filteredSummaries.reduce((s, t) => s + t.totalCredit, 0);
  const grandBalance = grandDebit - grandCredit;

  const handleExportExcel = (tenantIdToExport: string) => {
    const entries = tenantLedgers.get(tenantIdToExport) || [];
    const filtered = viewMode === 'current' ? entries.filter(e => e.date?.slice(0, 7) === currentMonth) : entries;
    let bal = 0;
    const data = filtered.map(e => {
      bal += e.debit - e.credit;
      return { Date: e.date, Type: e.type, Description: e.description, Reference: e.reference, Debit: e.debit || '', Credit: e.credit || '', Balance: bal };
    });
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Ledger');
    const name = activeTenantList.find(t => t.tenantId === tenantIdToExport)?.name || 'Tenant';
    saveAs(new Blob([XLSX.write(wb, { bookType: 'xlsx', type: 'array' })]), `ledger-${name}-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  const handleExportPDF = (tenantIdToExport: string) => {
    const entries = tenantLedgers.get(tenantIdToExport) || [];
    const filtered = viewMode === 'current' ? entries.filter(e => e.date?.slice(0, 7) === currentMonth) : entries;
    let bal = 0;
    const totalDebit = filtered.reduce((s, e) => s + e.debit, 0);
    const totalCredit = filtered.reduce((s, e) => s + e.credit, 0);
    const name = activeTenantList.find(t => t.tenantId === tenantIdToExport)?.name || 'Tenant';
    const cols = [
      { key: 'date', label: 'Date' }, { key: 'description', label: 'Description' },
      { key: 'debit', label: 'Debit (₹)' }, { key: 'credit', label: 'Credit (₹)' }, { key: 'balance', label: 'Balance (₹)' },
    ];
    const pdfData = filtered.map(e => {
      bal += e.debit - e.credit;
      return { date: fmtDate(e.date), description: e.description, debit: e.debit ? fmtAmt(e.debit) : '—', credit: e.credit ? fmtAmt(e.credit) : '—', balance: fmtAmt(bal) };
    });
    exportToPDF(`Account Statement — ${name}`, pdfData, cols, {
      'Total Debits': fmtAmt(totalDebit), 'Total Credits': fmtAmt(totalCredit), 'Net Balance Due': fmtAmt(totalDebit - totalCredit),
    }, vishfulLogo);
  };

  // Listing-level exports
  const getListingExportData = () => filteredSummaries.map(t => ({
    'Apartment-Bed': `${t.apartmentCode}${t.bedCode ? '-' + t.bedCode : ''}`,
    'Tenant Name': t.name,
    'Status': t.stayingStatus,
    'Total Debit': Math.round(t.totalDebit),
    'Total Credit': Math.round(t.totalCredit),
    'Balance Due': Math.round(t.balance),
  }));

  const handleListingExportExcel = () => {
    const data = getListingExportData();
    const ws = XLSX.utils.json_to_sheet([]);
    XLSX.utils.sheet_add_aoa(ws, [['Tenant Ledgers']], { origin: 'A1' });
    XLSX.utils.sheet_add_json(ws, data, { origin: 'A3' });
    ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 5 } }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Tenant Ledgers');
    saveAs(new Blob([XLSX.write(wb, { bookType: 'xlsx', type: 'array' })]), `tenant-ledgers-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  const handleListingExportPDF = () => {
    const data = getListingExportData();
    const cols = [
      { key: 'Apartment-Bed', label: 'Apartment-Bed' },
      { key: 'Tenant Name', label: 'Tenant Name' },
      { key: 'Status', label: 'Status' },
      { key: 'Total Debit', label: 'Total Debit (₹)' },
      { key: 'Total Credit', label: 'Total Credit (₹)' },
      { key: 'Balance Due', label: 'Balance Due (₹)' },
    ];
    const pdfData = data.map(d => ({
      ...d,
      'Total Debit': fmtAmt(d['Total Debit']),
      'Total Credit': fmtAmt(d['Total Credit']),
      'Balance Due': fmtAmt(d['Balance Due']),
    }));
    exportToPDF('Tenant Ledgers', pdfData, cols, {
      'Total Tenants': String(data.length),
      'Total Debits': fmtAmt(grandDebit),
      'Total Credits': fmtAmt(grandCredit),
      'Net Balance': fmtAmt(grandBalance),
    }, vishfulLogo);
  };

  const typeBadge = (type: string) => {
    const map: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; className?: string }> = {
      invoice: { label: 'Invoice', variant: 'destructive' },
      receipt: { label: 'Receipt', variant: 'default' },
      adjustment: { label: 'Adjustment', variant: 'secondary' },
      settlement: { label: 'Settlement', variant: 'outline' },
      lifecycle: { label: 'Lifecycle', variant: 'outline', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
      onboarding: { label: 'Onboarding', variant: 'outline', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
      deposit: { label: 'Deposit', variant: 'outline', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
    };
    const cfg = map[type] || { label: type, variant: 'outline' as const };
    return <Badge variant={cfg.variant} className={cn("capitalize text-[10px]", cfg.className)}>{cfg.label}</Badge>;
  };

  // Render ledger entry rows for a tenant (reused in both modes)
  const renderLedgerEntries = (t: typeof filteredSummaries[0]) => {
    if (t.entries.length === 0) {
      return (
        <TableRow>
          <TableCell></TableCell>
          <TableCell colSpan={4} className="text-center text-muted-foreground py-4 text-sm">
            No entries for {viewMode === 'current' ? 'this month' : 'this tenant'}
          </TableCell>
        </TableRow>
      );
    }
    // Compute running balance from oldest first, then display in desc order
    const sortedAsc = [...t.entries].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    const balanceMap = new Map<string, number>();
    let runningBal = 0;
    for (const e of sortedAsc) {
      runningBal += e.debit - e.credit;
      balanceMap.set(`${e.type}-${e.id}`, runningBal);
    }
    return (
      <>
        {t.entries.map(e => {
          const bal = balanceMap.get(`${e.type}-${e.id}`) || 0;
          return (
            <TableRow
              key={`${e.type}-${e.id}`}
              className="bg-muted/20 hover:bg-muted/40 cursor-pointer border-l-4 border-l-primary/20"
              onClick={() => setDetailEntry(e)}
            >
              <TableCell></TableCell>
              <TableCell className="text-xs">
                <span className="text-muted-foreground mr-2">{fmtDate(e.date)}</span>
                {typeBadge(e.type)}
                <span className="ml-2 truncate">{e.description}</span>
              </TableCell>
              <TableCell className="text-right text-xs text-destructive">{e.debit > 0 ? fmtAmt(e.debit) : '—'}</TableCell>
              <TableCell className="text-right text-xs text-green-600">{e.credit > 0 ? fmtAmt(e.credit) : '—'}</TableCell>
              <TableCell className={`text-right text-xs font-medium ${bal >= 0 ? 'text-destructive' : 'text-green-600'}`}>{fmtAmt(Math.abs(bal))}</TableCell>
            </TableRow>
          );
        })}
        <TableRow className="bg-muted/10">
          <TableCell></TableCell>
          <TableCell colSpan={4} className="py-1">
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" className="gap-1 text-xs h-7" onClick={(ev) => { ev.stopPropagation(); handleExportPDF(t.tenantId); }}>
                <FileText className="h-3 w-3" /> PDF
              </Button>
              <Button variant="ghost" size="sm" className="gap-1 text-xs h-7" onClick={(ev) => { ev.stopPropagation(); handleExportExcel(t.tenantId); }}>
                <Download className="h-3 w-3" /> Excel
              </Button>
            </div>
          </TableCell>
        </TableRow>
      </>
    );
  };

  // Render a single tenant row with collapsible ledger (reused in both modes)
  const renderTenantRow = (t: typeof filteredSummaries[0], showAptCode = false) => {
    const isOpen = expandedTenant === t.tenantId;
    return (
      <Collapsible key={t.tenantId} asChild open={isOpen} onOpenChange={(open) => setExpandedTenant(open ? t.tenantId : null)}>
        <>
          <CollapsibleTrigger asChild>
            <TableRow className="cursor-pointer hover:bg-muted/50">
              <TableCell className="px-2">
                <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-90' : ''}`} />
              </TableCell>
              <TableCell className="font-medium">
                {showAptCode && <span className="text-muted-foreground text-xs mr-2">{t.apartmentCode}{t.bedCode ? `-${t.bedCode}` : ''}</span>}
                {t.name}
                {statusBadge(t.stayingStatus)}
              </TableCell>
              <TableCell className="text-right text-sm text-destructive">{t.totalDebit > 0 ? fmtAmt(t.totalDebit) : '—'}</TableCell>
              <TableCell className="text-right text-sm text-green-600">{t.totalCredit > 0 ? fmtAmt(t.totalCredit) : '—'}</TableCell>
              <TableCell className={`text-right text-sm font-bold ${t.balance >= 0 ? 'text-destructive' : 'text-green-600'}`}>
                {fmtAmt(Math.abs(t.balance))}{t.balance >= 0 ? '' : ' Adv'}
              </TableCell>
            </TableRow>
          </CollapsibleTrigger>
          <CollapsibleContent asChild>
            <>{renderLedgerEntries(t)}</>
          </CollapsibleContent>
        </>
      </Collapsible>
    );
  };

  return (
    <div className="space-y-4">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total Debits</p><p className="text-xl font-bold text-destructive">{fmtAmt(grandDebit)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total Credits</p><p className="text-xl font-bold text-green-600">{fmtAmt(grandCredit)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Net Balance Due</p><p className={`text-xl font-bold ${grandBalance >= 0 ? 'text-destructive' : 'text-green-600'}`}>{fmtAmt(Math.abs(grandBalance))}{grandBalance >= 0 ? ' Due' : ' Advance'}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Active Tenants</p><p className="text-xl font-bold">{filteredSummaries.length}</p></CardContent></Card>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap gap-3 items-center bg-muted/30 rounded-lg p-3">
        {/* View mode toggle */}
        <div className="flex gap-1 bg-muted rounded-md p-0.5">
          <Button
            variant={viewMode === 'current' ? 'default' : 'ghost'}
            size="sm"
            className="gap-1.5 text-xs"
            onClick={() => setViewMode('current')}
          >
            <CalendarDays className="h-3.5 w-3.5" />
            {fmtMonthLabel(currentMonth)}
          </Button>
          <Button
            variant={viewMode === 'beginning' ? 'default' : 'ghost'}
            size="sm"
            className="text-xs"
            onClick={() => setViewMode('beginning')}
          >
            Since Beginning
          </Button>
        </div>

        {/* Group-by toggle */}
        <div className="flex gap-1 bg-muted rounded-md p-0.5">
          <Button
            variant={groupBy === 'tenant' ? 'default' : 'ghost'}
            size="sm"
            className="gap-1.5 text-xs"
            onClick={() => { setGroupBy('tenant'); setExpandedApartment(null); }}
          >
            <Users className="h-3.5 w-3.5" />
            By Tenant
          </Button>
          <Button
            variant={groupBy === 'apartment' ? 'default' : 'ghost'}
            size="sm"
            className="gap-1.5 text-xs"
            onClick={() => { setGroupBy('apartment'); setExpandedTenant(null); }}
          >
            <Building2 className="h-3.5 w-3.5" />
            By Apartment
          </Button>
        </div>

        {/* Balance filter */}
        <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
          <Checkbox checked={balanceFilter} onCheckedChange={(v) => setBalanceFilter(!!v)} />
          Pending Dues Only
        </label>

        {/* Search */}
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search tenant or apartment…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-8 h-9" />
        </div>

        {/* Page size selector */}
        <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPage(0); }}>
          <SelectTrigger className="w-[90px] h-9 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="25">25 / page</SelectItem>
            <SelectItem value="50">50 / page</SelectItem>
            <SelectItem value="100">100 / page</SelectItem>
          </SelectContent>
        </Select>

        {/* Listing export buttons */}
        <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={handleListingExportPDF}>
          <FileText className="h-3.5 w-3.5" /> Export PDF
        </Button>
        <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={handleListingExportExcel}>
          <Download className="h-3.5 w-3.5" /> Export Excel
        </Button>
      </div>

      {/* Table */}
      <Card>
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="w-8"></TableHead>
              <TableHead>{groupBy === 'apartment' ? 'Apartment / Tenant' : 'Tenant Name'}</TableHead>
              <TableHead className="text-right">Total Debit</TableHead>
              <TableHead className="text-right">Total Credit</TableHead>
              <TableHead className="text-right">Balance Due</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {groupBy === 'tenant' ? (
              /* ===== TENANT MODE ===== */
              paginatedSummaries.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No active tenants found</TableCell></TableRow>
              ) : (
                <>
                  {paginatedSummaries.map(t => renderTenantRow(t, true))}
                </>
              )
            ) : (
              /* ===== APARTMENT MODE ===== */
              apartmentGroups.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No apartments found</TableCell></TableRow>
              ) : (
                <>
                  {apartmentGroups.map(apt => {
                    const isAptOpen = expandedApartment === apt.code;
                    return (
                      <Collapsible key={apt.code} asChild open={isAptOpen} onOpenChange={(open) => setExpandedApartment(open ? apt.code : null)}>
                        <>
                          <CollapsibleTrigger asChild>
                            <TableRow className="cursor-pointer hover:bg-muted/50 bg-accent/30">
                              <TableCell className="px-2">
                                <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${isAptOpen ? 'rotate-90' : ''}`} />
                              </TableCell>
                              <TableCell className="font-semibold">
                                <Building2 className="h-4 w-4 inline mr-2 text-muted-foreground" />
                                {apt.code}
                                <span className="text-muted-foreground text-xs ml-2">({apt.tenants.length} tenant{apt.tenants.length !== 1 ? 's' : ''})</span>
                              </TableCell>
                              <TableCell className="text-right text-sm text-destructive font-semibold">{apt.totalDebit > 0 ? fmtAmt(apt.totalDebit) : '—'}</TableCell>
                              <TableCell className="text-right text-sm text-green-600 font-semibold">{apt.totalCredit > 0 ? fmtAmt(apt.totalCredit) : '—'}</TableCell>
                              <TableCell className={`text-right text-sm font-bold ${apt.balance >= 0 ? 'text-destructive' : 'text-green-600'}`}>
                                {fmtAmt(Math.abs(apt.balance))}{apt.balance >= 0 ? '' : ' Adv'}
                              </TableCell>
                            </TableRow>
                          </CollapsibleTrigger>
                          <CollapsibleContent asChild>
                            <>{apt.tenants.map(t => renderTenantRow(t, false))}</>
                          </CollapsibleContent>
                        </>
                      </Collapsible>
                    );
                  })}
                </>
              )
            )}
            {/* Grand totals row */}
            {filteredSummaries.length > 0 && (
              <TableRow className="bg-muted/50 font-bold">
                <TableCell></TableCell>
                <TableCell className="text-right text-sm">Totals</TableCell>
                <TableCell className="text-right text-sm text-destructive">{fmtAmt(grandDebit)}</TableCell>
                <TableCell className="text-right text-sm text-green-600">{fmtAmt(grandCredit)}</TableCell>
                <TableCell className={`text-right text-sm ${grandBalance >= 0 ? 'text-destructive' : 'text-green-600'}`}>
                  {fmtAmt(Math.abs(grandBalance))}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        {groupBy === 'tenant' && (
          <TablePagination page={page} totalPages={totalPages} totalCount={totalCount} pageSize={pageSize} setPage={setPage} />
        )}
      </Card>

      {/* Detail Sheet */}
      <Sheet open={!!detailEntry} onOpenChange={(open) => { if (!open) setDetailEntry(null); }}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          {detailEntry && (
            <>
              <SheetHeader><SheetTitle>{detailEntry.type === 'invoice' ? 'Invoice Detail' : detailEntry.type === 'receipt' ? 'Receipt Detail' : detailEntry.type === 'adjustment' ? 'Adjustment Detail' : detailEntry.type === 'lifecycle' ? 'Lifecycle Payment Detail' : detailEntry.type === 'onboarding' ? 'Onboarding Charges Detail' : detailEntry.type === 'deposit' ? 'Security Deposit Detail' : 'Settlement Detail'}</SheetTitle></SheetHeader>
              <div className="space-y-3 mt-4 text-sm">
                <div className="grid grid-cols-2 gap-2">
                  <div><span className="text-muted-foreground">Date:</span> <strong>{fmtDate(detailEntry.date)}</strong></div>
                  <div><span className="text-muted-foreground">Type:</span> {typeBadge(detailEntry.type)}</div>
                  {detailEntry.debit > 0 && <div><span className="text-muted-foreground">Debit:</span> <strong className="text-destructive">{fmtAmt(detailEntry.debit)}</strong></div>}
                  {detailEntry.credit > 0 && <div><span className="text-muted-foreground">Credit:</span> <strong className="text-green-600">{fmtAmt(detailEntry.credit)}</strong></div>}
                  {detailEntry.reference && <div><span className="text-muted-foreground">Reference:</span> <strong>{detailEntry.reference}</strong></div>}
                </div>
                <p className="text-muted-foreground">{detailEntry.description}</p>
                {detailEntry.type === 'invoice' && detailEntry.source && (
                  <div className="space-y-1 border-t pt-2">
                    <div>Rent: <strong>{fmtAmt(Number(detailEntry.source.rent_amount || 0))}</strong></div>
                    <div>EB: <strong>{fmtAmt(Number(detailEntry.source.electricity_amount || 0))}</strong></div>
                    <div>Late Fee: <strong>{fmtAmt(Number(detailEntry.source.late_fee || 0))}</strong></div>
                    <div>Other: <strong>{fmtAmt(Number(detailEntry.source.other_charges || 0))}</strong></div>
                  </div>
                )}
                {detailEntry.type === 'settlement' && detailEntry.source && (
                  <div className="space-y-1 border-t pt-2">
                    <div>Deposit: <strong>{fmtAmt(Number(detailEntry.source.deposit_amount || 0))}</strong></div>
                    <div>Deductions: <strong className="text-destructive">{fmtAmt(Number(detailEntry.source.total_deductions || 0))}</strong></div>
                    <div>Refund: <strong className="text-green-600">{fmtAmt(Number(detailEntry.source.refund_amount || 0))}</strong></div>
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
