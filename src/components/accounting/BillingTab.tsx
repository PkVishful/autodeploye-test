import { useState, useMemo, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { AlertCircle, FileCheck, Loader2, Eye, ChevronDown, ChevronRight, Pencil, ArrowUpDown, ArrowUp, ArrowDown, Download, Upload, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { useAuditLog } from '@/hooks/useAuditLog';
import { generateInvoicePreviews, InvoicePreview } from '@/lib/billing-engine';
import { generateInvoiceNumbers } from '@/lib/document-number-utils';
import { toast } from '@/hooks/use-toast';
import { format, subMonths, parse } from 'date-fns';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

const fmtAmt = (v: number) => `₹${new Intl.NumberFormat('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Math.ceil(v))}`;

interface Props {
  properties: any[];
  apartments: any[];
  allotments: any[];
  electricityReadings: any[];
  tenants: any[];
  invoices: any[];
  beds: any[];
  bedRates: any[];
  orgId: string;
}

/** Batch-save invoices, line items, and EB shares in bulk DB calls instead of one-by-one */
async function saveInvoicesBatch(previews: InvoicePreview[], month: string, orgId: string, properties: any[]) {
  const [y, m] = month.split('-');
  const dueDate = `${y}-${m}-07`;
  const BATCH_SIZE = 50;

  // Build property map for invoice number generation
  const propertyMap = new Map<string, string>(properties.map((p: any) => [p.id, p.property_name]));
  const invoiceNumbers = generateInvoiceNumbers(previews, month, propertyMap);

  // Step 1: Batch insert all invoices — now with allotment_id
  const invoiceRows = previews.map((p, idx) => ({
    organization_id: orgId,
    tenant_id: p.tenant_id,
    property_id: p.property_id,
    apartment_id: p.apartment_id,
    bed_id: p.bed_id,
    allotment_id: p.allotment_id,
    invoice_number: invoiceNumbers[idx],
    billing_month: month,
    rent_amount: p.rent_amount,
    electricity_amount: p.eb_amount,
    estimated_eb: p.estimated_eb_amount || 0,
    late_fee: p.late_fee,
    other_charges: (p.exit_charges || 0),
    total_amount: p.total,
    due_date: dueDate,
    status: 'pending',
    balance: p.total,
    amount_paid: 0,
  }));

  // Insert invoices in batches and collect returned IDs
  const allInsertedInvoices: any[] = [];
  for (let i = 0; i < invoiceRows.length; i += BATCH_SIZE) {
    const batch = invoiceRows.slice(i, i + BATCH_SIZE);
    const { data, error } = await supabase.from('invoices').insert(batch as any).select('id');
    if (error) throw error;
    allInsertedInvoices.push(...(data || []));
  }

  // Step 2: Build all line items and EB shares using returned invoice IDs
  const allLineItems: any[] = [];
  const allEbShares: any[] = [];

  previews.forEach((p, idx) => {
    const invId = allInsertedInvoices[idx]?.id;
    if (!invId) return;

    if (p.rent_amount > 0) {
      const discountNote = p.discount > 0 ? ` (discount ₹${p.discount})` : '';
      const premiumNote = p.premium > 0 ? ` (premium ₹${p.premium})` : '';
      allLineItems.push({
        invoice_id: invId, line_type: 'rent',
        description: `Rent: ${p.stay_days}/${p.total_days_in_month} days @ ₹${Math.round(p.per_day_rent)}/day${discountNote}${premiumNote}`,
        amount: p.rent_amount,
        metadata: {
          bed_rate: p.bed_rate,
          discount: p.discount,
          premium: p.premium,
          effective_rate: Math.max(0, p.bed_rate - p.discount + p.premium),
          stay_days: p.stay_days,
          total_days_in_month: p.total_days_in_month,
          per_day_rent: p.per_day_rent,
        },
      });
    }
    if (p.eb_amount > 0) allLineItems.push({
      invoice_id: invId, line_type: 'electricity', description: `EB: ${p.eb_details}`, amount: p.eb_amount,
      metadata: p.eb_breakdown ? {
        total_units: p.eb_breakdown.total_units,
        unit_cost: p.eb_breakdown.unit_cost,
        total_apartment_bill: p.eb_breakdown.total_apartment_bill,
        total_tenant_days: p.eb_breakdown.total_tenant_days,
        per_day_rate: p.eb_breakdown.per_day_rate,
        tenant_stay_days: p.eb_breakdown.tenant_stay_days,
        tenant_eb_charge: p.eb_breakdown.tenant_eb_charge,
        all_tenants: p.eb_breakdown.all_tenants || [],
      } : {},
    });
    if ((p.estimated_eb_amount || 0) > 0) allLineItems.push({
      invoice_id: invId, line_type: 'estimated_eb',
      description: `Estimated EB (${p.stay_days} days × prev month per-day rate)`,
      amount: p.estimated_eb_amount,
      metadata: { stay_days: p.stay_days, per_day_rate: p.eb_breakdown?.per_day_rate || 0 },
    });
    if ((p.exit_charges || 0) > 0) allLineItems.push({
      invoice_id: invId, line_type: 'exit_charges', description: `Exit charges (stay < 1 year)`, amount: p.exit_charges,
      metadata: { total_stay_days: p.stay_days },
    });

    if (p.eb_breakdown) {
      allEbShares.push({
        invoice_id: invId,
        apartment_id: p.eb_breakdown.apartment_id,
        billing_month: p.eb_breakdown.billing_month,
        total_apartment_bill: p.eb_breakdown.total_apartment_bill,
        total_tenant_days: p.eb_breakdown.total_tenant_days,
        per_day_rate: p.eb_breakdown.per_day_rate,
        tenant_stay_days: p.eb_breakdown.tenant_stay_days,
        tenant_eb_charge: p.eb_breakdown.tenant_eb_charge,
        total_units: p.eb_breakdown.total_units,
        unit_cost: p.eb_breakdown.unit_cost,
      });
    }
  });

  // Step 3: Batch insert line items
  for (let i = 0; i < allLineItems.length; i += BATCH_SIZE) {
    const batch = allLineItems.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from('invoice_line_items' as any).insert(batch);
    if (error) throw error;
  }

  // Step 4: Batch insert EB shares
  for (let i = 0; i < allEbShares.length; i += BATCH_SIZE) {
    const batch = allEbShares.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from('eb_tenant_shares' as any).insert(batch);
    if (error) throw error;
  }

  return allInsertedInvoices.length;
}

/** Batch delete existing invoices and related records for a month */
async function deleteInvoicesForMonth(existingInvoices: any[]) {
  if (existingInvoices.length === 0) return;
  const ids = existingInvoices.map((inv: any) => inv.id);
  await Promise.all([
    supabase.from('eb_tenant_shares' as any).delete().in('invoice_id', ids),
    supabase.from('invoice_line_items' as any).delete().in('invoice_id', ids),
  ]);
  const { error } = await supabase.from('invoices').delete().in('id', ids);
  if (error) throw error;
}

export function BillingTab({ properties, apartments, allotments, electricityReadings, tenants, invoices, beds, bedRates, orgId }: Props) {
  const qc = useQueryClient();
  const { log: auditLog } = useAuditLog();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const now = new Date();
  const [billingMonth, setBillingMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
  const [propertyFilter, setPropertyFilter] = useState<string>('all');
  const [previews, setPreviews] = useState<InvoicePreview[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showPreview, setShowPreview] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [bulkGenerating, setBulkGenerating] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0, currentMonth: '' });
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [editingRow, setEditingRow] = useState<number | null>(null);
  const [sortKey, setSortKey] = useState<'location' | 'tenant_name' | null>('location');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [searchQuery, setSearchQuery] = useState('');
  const [monthMode, setMonthMode] = useState<'recent' | 'last12' | 'all'>('recent');
  // Round EB is always enabled now
  const roundEB = true;

  // Fetch absence records for EB exemption
  const [absenceRecords, setAbsenceRecords] = useState<any[]>([]);
  useEffect(() => {
    if (!orgId) return;
    supabase.from('tenant_absence_records').select('tenant_id, allotment_id, from_date, to_date').eq('organization_id', orgId)
      .then(({ data }) => setAbsenceRecords(data || []));
  }, [orgId]);

  // Build months list based on mode
  const months: string[] = useMemo(() => {
    const result: string[] = [];
    if (monthMode === 'recent') {
      for (let i = -3; i <= 1; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
        result.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
      }
    } else if (monthMode === 'last12') {
      for (let i = 0; i < 12; i++) {
        const d = subMonths(now, i);
        result.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
      }
    } else {
      const start = new Date(2022, 10, 1);
      let d = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      while (d >= start) {
        result.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
        d = new Date(d.getFullYear(), d.getMonth() - 1, 1);
      }
    }
    return result;
  }, [monthMode]);

  const tenantNames = new Map(tenants.map((t: any) => [t.id, t.full_name]));
  const existingInvoices = invoices.filter((inv: any) => inv.billing_month === billingMonth);

  const prevMonthLabel = useMemo(() => {
    const bm = new Date(billingMonth + '-01');
    const prev = subMonths(bm, 1);
    return format(prev, 'MMM-yy');
  }, [billingMonth]);

  const handlePreview = () => {
    const results = generateInvoicePreviews(
      billingMonth, allotments, electricityReadings, tenantNames, beds, bedRates,
      propertyFilter === 'all' ? undefined : propertyFilter,
      apartments,
      absenceRecords
    );
    // Always apply EB rounding
    const processed = results.map(p => {
      if (p.eb_breakdown) {
        const roundedRate = Math.round(p.eb_breakdown.per_day_rate);
        const newCharge = Math.ceil(roundedRate * p.eb_breakdown.tenant_stay_days);
        return {
          ...p,
          eb_amount: newCharge,
          eb_breakdown: { ...p.eb_breakdown, per_day_rate: roundedRate, tenant_eb_charge: newCharge },
          total: Math.ceil(p.rent_amount + newCharge + p.late_fee + p.other_charges + (p.estimated_eb_amount || 0) + (p.exit_charges || 0)),
        };
      }
      return p;
    });
    setPreviews(processed);
    setSelectedIds(new Set(processed.map((_, i) => String(i))));
    setShowPreview(true);
    setExpandedRows(new Set());
    setEditingRow(null);
    setSearchQuery('');
  };

  const handleSortToggle = (key: 'location' | 'tenant_name') => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const filteredPreviews = useMemo(() => {
    if (!searchQuery.trim()) return previews;
    const q = searchQuery.toLowerCase();
    return previews.filter(p =>
      p.tenant_name.toLowerCase().includes(q) ||
      `${p.apartment_code}-${p.bed_code}`.toLowerCase().includes(q)
    );
  }, [previews, searchQuery]);

  const sortedPreviews = useMemo(() => {
    return [...filteredPreviews].sort((a, b) => {
      if (!sortKey) return 0;
      let valA: string, valB: string;
      if (sortKey === 'location') {
        valA = `${a.apartment_code}-${a.bed_code}`;
        valB = `${b.apartment_code}-${b.bed_code}`;
      } else {
        valA = a.tenant_name.toLowerCase();
        valB = b.tenant_name.toLowerCase();
      }
      const cmp = valA.localeCompare(valB, undefined, { numeric: true });
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [filteredPreviews, sortKey, sortDir]);

  const originalIndices = sortedPreviews.map(sp => previews.indexOf(sp));

  const SortIcon = ({ col }: { col: 'location' | 'tenant_name' }) => {
    if (sortKey !== col) return <ArrowUpDown className="h-3.5 w-3.5 opacity-30 inline ml-1" />;
    return sortDir === 'asc'
      ? <ArrowUp className="h-3.5 w-3.5 text-primary inline ml-1" />
      : <ArrowDown className="h-3.5 w-3.5 text-primary inline ml-1" />;
  };

  const handleGenerate = async () => {
    const selected = previews.filter((_, i) => selectedIds.has(String(i)));
    if (selected.length === 0) {
      toast({ title: 'No invoices selected', variant: 'destructive' });
      return;
    }
    setGenerating(true);
    try {
      // Delete existing invoices for the billing month before saving new ones
      const { data: existingInvoices } = await supabase
        .from('invoices')
        .select('id')
        .eq('organization_id', orgId)
        .eq('billing_month', billingMonth);
      await deleteInvoicesForMonth(existingInvoices || []);

      await saveInvoicesBatch(selected, billingMonth, orgId, properties);
      toast({ title: `${selected.length} invoices generated successfully` });
      setShowPreview(false);
      setPreviews([]);
      qc.invalidateQueries({ queryKey: ['acc-invoices'] });
    } catch (err: any) {
      toast({ title: 'Error generating invoices', description: err.message, variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  const handleBulkGenerateAll = async () => {
    const allMonths: string[] = [];
    const start = new Date(2022, 10, 1);
    let d = new Date(start);
    while (d <= now) {
      allMonths.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
      d = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    }

    const confirmed = window.confirm(
      `This will regenerate ALL invoices for ${allMonths.length} month(s) from Nov 2022 to now, overwriting any existing invoices. Continue?`
    );
    if (!confirmed) return;

    setBulkGenerating(true);
    setBulkProgress({ current: 0, total: allMonths.length, currentMonth: '' });
    let totalGenerated = 0;

    try {
      for (let mi = 0; mi < allMonths.length; mi++) {
        const month = allMonths[mi];
        setBulkProgress({ current: mi + 1, total: allMonths.length, currentMonth: month });
        await new Promise(r => setTimeout(r, 0));

        const { data: existingForMonth } = await supabase
          .from('invoices')
          .select('id')
          .eq('organization_id', orgId)
          .eq('billing_month', month);
        await deleteInvoicesForMonth(existingForMonth || []);

        const results = generateInvoicePreviews(
          month, allotments, electricityReadings, tenantNames, beds, bedRates,
          propertyFilter === 'all' ? undefined : propertyFilter,
          apartments,
          absenceRecords
        );

        // Always round EB
        const processed = results.map(p => {
          if (p.eb_breakdown) {
            const roundedRate = Math.round(p.eb_breakdown.per_day_rate);
            const newCharge = Math.ceil(roundedRate * p.eb_breakdown.tenant_stay_days);
            return {
              ...p,
              eb_amount: newCharge,
              eb_breakdown: { ...p.eb_breakdown, per_day_rate: roundedRate, tenant_eb_charge: newCharge },
              total: Math.ceil(p.rent_amount + newCharge + p.late_fee + p.other_charges + (p.estimated_eb_amount || 0) + (p.exit_charges || 0)),
            };
          }
          return p;
        });

        if (processed.length === 0) continue;

        const count = await saveInvoicesBatch(processed, month, orgId, properties);
        totalGenerated += count;
      }

      toast({ title: `Bulk generation complete: ${totalGenerated} invoices generated across ${allMonths.length} months` });
      qc.invalidateQueries({ queryKey: ['acc-invoices'] });
    } catch (err: any) {
      toast({ title: 'Error during bulk generation', description: err.message, variant: 'destructive' });
    } finally {
      setBulkGenerating(false);
      setBulkProgress({ current: 0, total: 0, currentMonth: '' });
    }
  };

  const toggleAll = () => {
    if (selectedIds.size === previews.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(previews.map((_, i) => String(i))));
  };

  const toggleOne = (i: string) => {
    const s = new Set(selectedIds);
    s.has(i) ? s.delete(i) : s.add(i);
    setSelectedIds(s);
  };

  const toggleExpand = (i: number) => {
    const s = new Set(expandedRows);
    s.has(i) ? s.delete(i) : s.add(i);
    setExpandedRows(s);
  };

  const updatePreview = (index: number, field: keyof InvoicePreview, value: number) => {
    setPreviews(prev => {
      const updated = [...prev];
      const p = { ...updated[index], [field]: value };
      p.total = Math.ceil(p.rent_amount + p.eb_amount + p.late_fee + p.other_charges + (p.estimated_eb_amount || 0) + (p.exit_charges || 0));
      updated[index] = p;
      return updated;
    });
  };

  const sortForExport = (items: InvoicePreview[]) =>
    [...items].sort((a, b) => {
      const aptCmp = `${a.apartment_code}-${a.bed_code}`.localeCompare(`${b.apartment_code}-${b.bed_code}`, undefined, { numeric: true });
      if (aptCmp !== 0) return aptCmp;
      return a.tenant_name.localeCompare(b.tenant_name);
    });

  const handleDownloadExcel = () => {
    const selected = sortForExport(previews.filter((_, i) => selectedIds.has(String(i))));
    if (selected.length === 0) {
      toast({ title: 'No invoices selected', variant: 'destructive' });
      return;
    }

    const rows = selected.map(p => ({
      'Apt-Bed': `${p.apartment_code}-${p.bed_code}`,
      'Tenant Name': p.tenant_name,
      'Tenant ID': p.tenant_id,
      'Allotment ID': p.allotment_id,
      
      'Bed Rate': p.bed_rate,
      'Discount': p.discount,
      'Premium': p.premium,
      'Stay Days': p.stay_days,
      'Days in Month': p.total_days_in_month,
      'Rent': p.rent_amount,
      'EB Consumed': p.eb_amount,
      'Estimated EB': p.estimated_eb_amount || 0,
      'Late Fee': p.late_fee,
      'Other Charges': (p.exit_charges || 0),
      'Total': p.total,
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Invoice Preview');
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    saveAs(blob, `invoice-preview-${billingMonth}.xlsx`);
    toast({ title: 'Excel file downloaded' });
  };

  const handleDownloadPDF = () => {
    const selected = sortForExport(previews.filter((_, i) => selectedIds.has(String(i))));
    if (selected.length === 0) { toast({ title: 'No invoices selected', variant: 'destructive' }); return; }
    const nowStr = format(new Date(), 'dd-MMM-yyyy HH:mm');
    const html = `<!DOCTYPE html><html><head><title>Invoice Preview — ${billingMonth}</title>
    <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:30px;color:#1a1a1a}
    .header{display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;padding-bottom:12px;border-bottom:2px solid #e5e7eb}
    .header h1{font-size:18px;font-weight:700}.header .meta{font-size:11px;color:#6b7280;text-align:right}
    table{width:100%;border-collapse:collapse;font-size:12px}th{background:#f3f4f6;padding:8px 10px;text-align:left;font-weight:600;border-bottom:2px solid #d1d5db}
    td{padding:6px 10px;border-bottom:1px solid #e5e7eb}tr:nth-child(even){background:#fafafa}
    .eb-only{color:#7c3aed;font-style:italic}
    .footer{margin-top:20px;font-size:10px;color:#9ca3af;text-align:center}
    @media print{body{padding:15px}}</style></head><body>
    <div class="header"><h1>Invoice Preview — ${format(new Date(billingMonth + '-01'), 'MMM yyyy')}</h1>
    <div class="meta">Generated: ${nowStr}<br/>Records: ${selected.length}</div></div>
    <table><thead><tr><th>Apt-Bed</th><th>Tenant</th><th>Type</th><th>Bed Rate</th><th>Disc/Prem</th><th>Rent</th><th>EB Consumed</th><th>Est. EB</th><th>Total</th></tr></thead>
    <tbody>${selected.map(p => `<tr${p.is_eb_only ? ' class="eb-only"' : ''}><td>${p.apartment_code}-${p.bed_code}</td><td>${p.tenant_name}</td>
    <td>${p.is_eb_only ? 'EB Only' : 'Full'}</td>
    <td>₹${p.bed_rate.toLocaleString()}</td><td>${p.discount > 0 ? `-₹${p.discount}` : ''}${p.premium > 0 ? `+₹${p.premium}` : ''}${p.discount === 0 && p.premium === 0 ? '—' : ''}</td>
    <td>₹${p.rent_amount.toLocaleString()}</td><td>₹${p.eb_amount.toLocaleString()}</td><td>₹${(p.estimated_eb_amount || 0).toLocaleString()}</td><td>₹${p.total.toLocaleString()}</td></tr>`).join('')}
    </tbody></table><div class="footer">Vishful OS — Invoice Preview</div></body></html>`;
    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); setTimeout(() => w.print(), 500); }
  };

  const handleUploadExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target?.result, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: any[] = XLSX.utils.sheet_to_json(ws);
        let updatedCount = 0;
        setPreviews(prev => {
          const updated = [...prev];
          for (const row of rows) {
            const allotmentId = row['Allotment ID'];
            const tenantId = row['Tenant ID'];
            const idx = allotmentId
              ? updated.findIndex(p => p.allotment_id === allotmentId)
              : updated.findIndex(p => p.tenant_id === tenantId);
            if (idx === -1) continue;
            const p = { ...updated[idx] };
            if (row['Rent'] !== undefined) p.rent_amount = Number(row['Rent']);
            if (row['EB'] !== undefined) p.eb_amount = Number(row['EB']);
            if (row['Late Fee'] !== undefined) p.late_fee = Number(row['Late Fee']);
            if (row['Other Charges'] !== undefined) p.other_charges = Number(row['Other Charges']);
            p.total = Math.ceil(p.rent_amount + p.eb_amount + p.late_fee + p.other_charges + (p.estimated_eb_amount || 0) + (p.exit_charges || 0));
            updated[idx] = p;
            updatedCount++;
          }
          return updated;
        });
        toast({ title: `Updated ${updatedCount} invoice(s) from Excel` });
      } catch (err: any) {
        toast({ title: 'Error reading file', description: err.message, variant: 'destructive' });
      }
    };
    reader.readAsBinaryString(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const selectedPreviews = previews.filter((_, i) => selectedIds.has(String(i)));
  const totalRent = selectedPreviews.reduce((s, p) => s + p.rent_amount, 0);
  const totalActualEB = selectedPreviews.reduce((s, p) => s + p.eb_amount, 0);
  const totalEstEB = selectedPreviews.reduce((s, p) => s + (p.estimated_eb_amount || 0), 0);
  const grandTotal = selectedPreviews.reduce((s, p) => s + p.total, 0);

  const formatUnits = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Generate Invoices</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Month Range</p>
              <Select value={monthMode} onValueChange={(v: any) => setMonthMode(v)}>
                <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="recent">Recent</SelectItem>
                  <SelectItem value="last12">Last 12 Months</SelectItem>
                  <SelectItem value="all">All (from Nov 2022)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Billing Month</p>
              <Select value={billingMonth} onValueChange={setBillingMonth}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {months.map(m => (
                    <SelectItem key={m} value={m}>{format(new Date(m + '-01'), 'MMM yyyy')}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Property</p>
              <Select value={propertyFilter} onValueChange={setPropertyFilter}>
                <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Properties</SelectItem>
                  {properties.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>{p.property_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="outline" className="text-[10px]">EB Rounding: ON</Badge>
            </div>
            <Button onClick={handlePreview} className="gap-2">
              <Eye className="h-4 w-4" /> Preview
            </Button>
            <Button variant="outline" onClick={handleBulkGenerateAll} disabled={bulkGenerating} className="gap-2">
              {bulkGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileCheck className="h-4 w-4" />}
              {bulkGenerating ? `Generating ${bulkProgress.current}/${bulkProgress.total}…` : 'Generate All (since Nov 2022)'}
            </Button>
          </div>
          {bulkGenerating && (
            <div className="mt-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Processing {format(new Date(bulkProgress.currentMonth + '-01'), 'MMM yyyy')} ({bulkProgress.current}/{bulkProgress.total})
              </div>
              <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                <div className="h-full bg-primary transition-all" style={{ width: `${(bulkProgress.current / bulkProgress.total) * 100}%` }} />
              </div>
            </div>
          )}
          {existingInvoices.length > 0 && (
            <div className="mt-3 flex items-center gap-2 text-sm text-orange-600">
              <AlertCircle className="h-4 w-4" />
              {existingInvoices.length} invoices already exist for {format(new Date(billingMonth + '-01'), 'MMM yyyy')}
            </div>
          )}
        </CardContent>
      </Card>

      {showPreview && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-base">
                Invoice Preview — {format(new Date(billingMonth + '-01'), 'MMM yyyy')}
                <span className="text-xs text-muted-foreground ml-2">(EB for {prevMonthLabel} month)</span>
              </CardTitle>
              <div className="flex items-center gap-4 text-sm">
                <span>Rent: <strong>₹{totalRent.toLocaleString()}</strong></span>
                <span>Actual EB: <strong>₹{totalActualEB.toLocaleString()}</strong></span>
                <span>Est. EB: <strong>₹{totalEstEB.toLocaleString()}</strong></span>
                <span>Total: <strong className="text-primary">₹{grandTotal.toLocaleString()}</strong></span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 items-center mt-3">
              <div className="relative flex-1 min-w-[200px] max-w-xs">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search tenant or apt-bed…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-8 h-9" />
              </div>
              <Button variant="outline" size="sm" onClick={handleDownloadExcel} className="gap-1.5">
                <Download className="h-3.5 w-3.5" /> Excel
              </Button>
              <Button variant="outline" size="sm" onClick={handleDownloadPDF} className="gap-1.5">
                <Download className="h-3.5 w-3.5" /> PDF
              </Button>
              <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="gap-1.5">
                <Upload className="h-3.5 w-3.5" /> Upload Revised
              </Button>
              <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleUploadExcel} />
            </div>
          </CardHeader>
          <CardContent>
            {filteredPreviews.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                {previews.length === 0 ? 'No active tenants (Staying/On-Notice) found for this period' : 'No results matching your search'}
              </p>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8">
                        <Checkbox checked={selectedIds.size === previews.length} onCheckedChange={toggleAll} />
                      </TableHead>
                      <TableHead className="w-8"></TableHead>
                      <TableHead className="cursor-pointer select-none" onClick={() => handleSortToggle('location')}>
                        Apt-Bed <SortIcon col="location" />
                      </TableHead>
                      <TableHead className="cursor-pointer select-none" onClick={() => handleSortToggle('tenant_name')}>
                        Tenant <SortIcon col="tenant_name" />
                      </TableHead>
                      <TableHead>Bed Rate</TableHead>
                      <TableHead>Rent</TableHead>
                      <TableHead>Actual EB</TableHead>
                      <TableHead>Est. EB</TableHead>
                      <TableHead>Other</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead className="w-8"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedPreviews.map((p, si) => {
                      const i = originalIndices[si];
                      const allotment = allotments.find((a: any) => a.id === p.allotment_id);
                      const status = allotment?.staying_status || '';
                      const statusBadge = status === 'On-Notice'
                        ? { label: 'On Notice', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300' }
                        : status === 'Exited' || status === 'Vacated'
                        ? { label: 'Vacated', color: 'bg-destructive/10 text-destructive' }
                        : { label: 'Staying', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' };
                      const otherCharges = (p.exit_charges || 0);
                      return (
                      <>
                        <TableRow key={`row-${i}`} className="cursor-pointer">
                          <TableCell>
                            <Checkbox checked={selectedIds.has(String(i))} onCheckedChange={() => toggleOne(String(i))} />
                          </TableCell>
                          <TableCell onClick={() => toggleExpand(i)}>
                            {expandedRows.has(i) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </TableCell>
                          <TableCell className="font-medium whitespace-nowrap" onClick={() => toggleExpand(i)}>
                            <Badge className={`text-[10px] font-semibold ${statusBadge.color}`}>
                              {p.apartment_code}-{p.bed_code} · {statusBadge.label}
                            </Badge>
                          </TableCell>
                          <TableCell onClick={() => toggleExpand(i)}>{p.tenant_name}</TableCell>
                          <TableCell>₹{p.bed_rate.toLocaleString()}</TableCell>
                          <TableCell>₹{p.rent_amount.toLocaleString()}</TableCell>
                          <TableCell>
                            <span title={p.eb_details}>{p.eb_amount > 0 ? `₹${p.eb_amount.toLocaleString()}` : '—'}</span>
                          </TableCell>
                          <TableCell>
                            {(p.estimated_eb_amount || 0) > 0 ? `₹${(p.estimated_eb_amount || 0).toLocaleString()}` : '—'}
                          </TableCell>
                          <TableCell>{otherCharges > 0 ? `₹${otherCharges.toLocaleString()}` : '—'}</TableCell>
                          <TableCell className="font-semibold">₹{p.total.toLocaleString()}</TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-primary hover:text-primary" onClick={() => setEditingRow(editingRow === i ? null : i)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>

                        {expandedRows.has(i) && (
                          <TableRow key={`detail-${i}`}>
                            <TableCell colSpan={11} className="bg-muted/30 p-0">
                              <div className="p-4 space-y-4">
                                <div>
                                  <h4 className="text-sm font-semibold mb-2">Rental Computation</h4>
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                                    <div><span className="text-muted-foreground">Bed Rate:</span> <strong>₹{p.bed_rate.toLocaleString()}/month</strong></div>
                                    <div><span className="text-muted-foreground">Discount:</span> <strong>₹{p.discount.toLocaleString()}</strong></div>
                                    <div><span className="text-muted-foreground">Premium:</span> <strong>₹{p.premium.toLocaleString()}</strong></div>
                                    <div><span className="text-muted-foreground">Effective Rate:</span> <strong>₹{Math.max(0, p.bed_rate - p.discount + p.premium).toLocaleString()}/month</strong></div>
                                    <div><span className="text-muted-foreground">Days in Month:</span> <strong>{p.total_days_in_month}</strong></div>
                                    <div><span className="text-muted-foreground">Stay Days:</span> <strong>{p.stay_days}</strong></div>
                                    <div><span className="text-muted-foreground">Per Day Rent:</span> <strong>₹{p.per_day_rent.toFixed(2)}</strong></div>
                                    <div><span className="text-muted-foreground">Total Rent:</span> <strong className="text-primary">₹{p.rent_amount.toLocaleString()}</strong></div>
                                  </div>
                                </div>

                                {p.eb_breakdown && (
                                  <div>
                                    <h4 className="text-sm font-semibold mb-2">EB Computation (EB for {prevMonthLabel})</h4>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mb-3">
                                      <div><span className="text-muted-foreground">Total Units:</span> <strong>{formatUnits(p.eb_breakdown.total_units)}/-</strong></div>
                                      <div><span className="text-muted-foreground">Unit Cost:</span> <strong>₹{p.eb_breakdown.unit_cost}</strong></div>
                                      <div><span className="text-muted-foreground">Total Apt EB:</span> <strong>₹{p.eb_breakdown.total_apartment_bill.toLocaleString()}</strong></div>
                                      <div><span className="text-muted-foreground">Total Tenant Days:</span> <strong>{p.eb_breakdown.total_tenant_days}</strong></div>
                                      <div><span className="text-muted-foreground">Per Day EB Rate:</span> <strong>₹{p.eb_breakdown.per_day_rate}</strong></div>
                                      <div><span className="text-muted-foreground">This Tenant's Days:</span> <strong>{p.eb_breakdown.tenant_stay_days}</strong></div>
                                      <div><span className="text-muted-foreground">This Tenant's EB:</span> <strong className="text-primary">₹{p.eb_breakdown.tenant_eb_charge.toLocaleString()}</strong></div>
                                    </div>

                                    {p.eb_breakdown.all_tenants && p.eb_breakdown.all_tenants.length > 0 && (
                                      <div>
                                        <h5 className="text-xs font-semibold text-muted-foreground mb-1">All Tenants in Apartment ({prevMonthLabel})</h5>
                                        <Table>
                                          <TableHeader>
                                            <TableRow>
                                              <TableHead className="text-xs">Tenant</TableHead>
                                              <TableHead className="text-xs text-right">Stay Days</TableHead>
                                              <TableHead className="text-xs text-right">EB Share</TableHead>
                                            </TableRow>
                                          </TableHeader>
                                          <TableBody>
                                            {p.eb_breakdown.all_tenants.map((t, ti) => (
                                              <TableRow key={ti}>
                                                <TableCell className="text-xs">{t.tenant_name}</TableCell>
                                                <TableCell className="text-xs text-right">{t.stay_days}</TableCell>
                                                <TableCell className="text-xs text-right">₹{Math.ceil(p.eb_breakdown!.per_day_rate * t.stay_days).toLocaleString()}</TableCell>
                                              </TableRow>
                                            ))}
                                          </TableBody>
                                        </Table>
                                      </div>
                                    )}
                                  </div>
                                )}

                                {(p.estimated_eb_amount || 0) > 0 && (
                                  <div className="p-3 bg-orange-50 dark:bg-orange-950/20 rounded text-sm">
                                    <strong>Estimated EB:</strong> ₹{(p.estimated_eb_amount || 0).toLocaleString()} ({p.stay_days} days × prev month per-day rate)
                                  </div>
                                )}
                                {(p.exit_charges || 0) > 0 && (
                                  <div className="p-3 bg-red-50 dark:bg-red-950/20 rounded text-sm">
                                    <strong>Exit Charges:</strong> ₹{(p.exit_charges || 0).toLocaleString()} (stay &lt; 1 year)
                                  </div>
                                )}

                                {/* Invoice Summary */}
                                <Separator />
                                <div>
                                  <h4 className="text-sm font-semibold mb-2">Invoice Summary</h4>
                                  <div className="border rounded-lg overflow-hidden">
                                    <Table>
                                      <TableBody>
                                        {p.rent_amount > 0 && (
                                          <TableRow>
                                            <TableCell className="text-sm">Rental Due</TableCell>
                                            <TableCell className="text-sm text-right font-medium">{fmtAmt(p.rent_amount)}</TableCell>
                                          </TableRow>
                                        )}
                                         {p.eb_amount > 0 && (
                                          <TableRow>
                                            <TableCell className="text-sm">Actual EB ({prevMonthLabel})</TableCell>
                                            <TableCell className="text-sm text-right font-medium">{fmtAmt(p.eb_amount)}</TableCell>
                                          </TableRow>
                                        )}
                                        {(p.estimated_eb_amount || 0) > 0 && (
                                          <TableRow>
                                            <TableCell className="text-sm">Estimated EB (Pro-rated)</TableCell>
                                            <TableCell className="text-sm text-right font-medium">{fmtAmt(p.estimated_eb_amount || 0)}</TableCell>
                                          </TableRow>
                                        )}
                                        {p.late_fee > 0 && (
                                          <TableRow>
                                            <TableCell className="text-sm">Late Fee</TableCell>
                                            <TableCell className="text-sm text-right font-medium">{fmtAmt(p.late_fee)}</TableCell>
                                          </TableRow>
                                        )}
                                        {(p.exit_charges || 0) > 0 && (
                                          <TableRow>
                                            <TableCell className="text-sm">Exit Charges (stay &lt; 1 year)</TableCell>
                                            <TableCell className="text-sm text-right font-medium">{fmtAmt(p.exit_charges || 0)}</TableCell>
                                          </TableRow>
                                        )}
                                        {p.other_charges > 0 && (
                                          <TableRow>
                                            <TableCell className="text-sm">Other Charges</TableCell>
                                            <TableCell className="text-sm text-right font-medium">{fmtAmt(p.other_charges)}</TableCell>
                                          </TableRow>
                                        )}
                                        <TableRow className="bg-muted/50">
                                          <TableCell className="text-sm font-bold">Total Amount Due</TableCell>
                                          <TableCell className="text-sm text-right font-bold">{fmtAmt(p.total)}</TableCell>
                                        </TableRow>
                                      </TableBody>
                                    </Table>
                                  </div>
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}

                        {editingRow === i && (
                          <TableRow key={`edit-${i}`}>
                            <TableCell colSpan={10} className="bg-blue-50/50 dark:bg-blue-950/20 p-4">
                              <div className="flex flex-wrap gap-3 items-end">
                                <div>
                                  <Label className="text-xs">Rent</Label>
                                  <Input type="number" className="w-28 h-8" value={p.rent_amount} onChange={e => updatePreview(i, 'rent_amount', Number(e.target.value))} />
                                </div>
                                 <div>
                                   <Label className="text-xs">Estimated EB</Label>
                                  <Input type="number" className="w-28 h-8" value={p.eb_amount} onChange={e => updatePreview(i, 'eb_amount', Number(e.target.value))} />
                                </div>
                                <div>
                                  <Label className="text-xs">Late Fee</Label>
                                  <Input type="number" className="w-28 h-8" value={p.late_fee} onChange={e => updatePreview(i, 'late_fee', Number(e.target.value))} />
                                </div>
                                <div>
                                  <Label className="text-xs">Other</Label>
                                  <Input type="number" className="w-28 h-8" value={p.other_charges} onChange={e => updatePreview(i, 'other_charges', Number(e.target.value))} />
                                </div>
                                <Button size="sm" variant="outline" onClick={() => setEditingRow(null)}>Done</Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                      );
                    })}
                  </TableBody>
                </Table>

                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <span className="text-sm text-muted-foreground">{selectedIds.size} of {previews.length} selected</span>
                  <Button onClick={handleGenerate} disabled={generating || selectedIds.size === 0} className="gap-2">
                    {generating && <Loader2 className="h-4 w-4 animate-spin" />}
                    Generate {selectedIds.size} Invoice{selectedIds.size !== 1 ? 's' : ''}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
