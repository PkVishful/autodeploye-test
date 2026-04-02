import { useState, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { Upload, FileSpreadsheet, CheckCircle2, XCircle, AlertTriangle, Download, Loader2, Plus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface ExcelUploadProps {
  orgId: string;
  tenants: any[];
  beds: any[];
  apartments: any[];
  properties: any[];
  allotments: any[];
  bedRates: any[];
  lifecycleConfig: any[];
  onComplete: () => void;
}

type RowAction = 'booking' | 'onboarding' | 'notice' | 'exit' | 'skip';

interface ParsedRow {
  rowNum: number;
  allotmentId: string | null;
  tenantName: string;
  tenantId: string | null;
  bedCode: string;
  bedId: string | null;
  apartmentId: string | null;
  propertyId: string | null;
  onboardingDate: string | null;
  noticeDate: string | null;
  exitDate: string | null;
  estimatedExitDate: string | null;
  advance: number | null;
  discount: number | null;
  premium: number | null;
  onboardingCharges: number | null;
  action: RowAction;
  status: 'ready' | 'error' | 'done' | 'skipped';
  error?: string;
  processed?: boolean;
}

function excelDateToISO(val: any): string | null {
  if (!val) return null;
  if (typeof val === 'number') {
    const d = XLSX.SSF.parse_date_code(val);
    if (d) return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
  }
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed) return null;
    // Try ISO
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10);
    // Try DD/MM/YYYY or DD-MM-YYYY
    const m = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    // Try MM/DD/YYYY
    const m2 = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (m2) return `${m2[3]}-${m2[1].padStart(2, '0')}-${m2[2].padStart(2, '0')}`;
  }
  if (val instanceof Date) {
    return val.toISOString().split('T')[0];
  }
  return null;
}

function deriveAction(row: { onboardingDate: string | null; noticeDate: string | null; exitDate: string | null }): RowAction {
  if (row.exitDate) return 'exit';
  if (row.noticeDate) return 'notice';
  if (row.onboardingDate) return 'onboarding';
  return 'booking';
}

export default function ExcelUpload({ orgId, tenants, beds, apartments, properties, allotments, bedRates, lifecycleConfig, onComplete }: ExcelUploadProps) {
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [processing, setProcessing] = useState(false);
  const [processedCount, setProcessedCount] = useState(0);
  const [fileName, setFileName] = useState('');
  const [uploadMode, setUploadMode] = useState<'append' | 'replace'>('append');
  const fileRef = useRef<HTMLInputElement>(null);

  const findTenant = useCallback((name: string) => {
    if (!name) return null;
    const lower = name.toLowerCase().trim();
    // Try exact match first
    let match = tenants.find((t: any) => t.full_name?.toLowerCase().trim() === lower);
    if (match) return match;
    // Try partial match
    match = tenants.find((t: any) => t.full_name?.toLowerCase().includes(lower) || lower.includes(t.full_name?.toLowerCase()));
    return match || null;
  }, [tenants]);

  const findBed = useCallback((code: string) => {
    if (!code) return null;
    const lower = code.toLowerCase().trim();
    // Match bed_code directly or apt_code-bed_code
    for (const bed of beds) {
      const apt = apartments.find((a: any) => a.id === bed.apartment_id);
      const fullCode = `${apt?.apartment_code || ''}-${bed.bed_code}`.toLowerCase();
      if (bed.bed_code.toLowerCase() === lower || fullCode === lower || bed.id === lower) {
        return { bed, apartment: apt };
      }
    }
    return null;
  }, [beds, apartments]);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target?.result, { type: 'binary', cellDates: false });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rawData = XLSX.utils.sheet_to_json(ws, { defval: '' });

        const rows: ParsedRow[] = rawData.map((raw: any, i: number) => {
          // Normalize keys to handle whitespace/case variations
          const normalizedRaw: Record<string, any> = {};
          Object.keys(raw).forEach(key => {
            normalizedRaw[key] = raw[key];
            normalizedRaw[key.trim().toLowerCase().replace(/[\s_]+/g, '')] = raw[key];
          });

          // Flexible column matching - support AllotmentID, direct IDs or name/code lookup
          const directAllotmentId = String(normalizedRaw['allotmentid'] || normalizedRaw['tenantallotmentid'] || raw['AllotmentID'] || raw['Allotment ID'] || raw['allotment_id'] || raw['TenantAllotmentID'] || '').trim();
          const tenantName = normalizedRaw['tenantname'] || normalizedRaw['name'] || normalizedRaw['cleanname'] || raw['TenantName'] || raw['Tenant Name'] || raw['tenant_name'] || raw['Name'] || raw['clean_name'] || '';
          const directTenantId = normalizedRaw['tenantid'] || raw['tenantid'] || raw['TenantId'] || raw['tenant_id'] || '';
          const directBedId = normalizedRaw['bedid'] || raw['bedid'] || raw['BedId'] || raw['bed_id'] || '';
          const directAptId = normalizedRaw['aptid'] || raw['aptid'] || raw['AptId'] || raw['apt_id'] || '';
          const bedCode = String(normalizedRaw['bedno'] || normalizedRaw['bed'] || normalizedRaw['aptno'] || raw['BedNo'] || raw['Bed No'] || raw['aptno'] || raw['Bed'] || '');
          const onboardingDate = excelDateToISO(normalizedRaw['onboardingdate'] || raw['OnboardingDate'] || raw['Onboarding Date'] || raw['onboarding_date'] || '');
          const noticeDate = excelDateToISO(normalizedRaw['noticedate'] || raw['NoticeDate'] || raw['Notice Date'] || raw['notice_date'] || '');
          const exitDate = excelDateToISO(normalizedRaw['exitdate'] || raw['ExitDate'] || raw['Exit Date'] || raw['exit_date'] || '');
          const estimatedExitDate = excelDateToISO(normalizedRaw['estimatedexitdate'] || raw['EstimatedExitDate'] || raw['Estimated Exit Date'] || raw['estimated_exit_date'] || '');
          
          const getNumericValue = (keys: string[]): number | null => {
            for (const key of keys) {
              const val = normalizedRaw[key] ?? raw[key];
              if (val !== null && val !== undefined && val !== '') {
                const num = parseFloat(String(val));
                if (!isNaN(num)) return num;
              }
            }
            return null;
          };
          
          const advance = getNumericValue(['advance', 'amount', 'Advance', 'Amount']);
          const discount = getNumericValue(['discount', 'Discount']);
          const premium = getNumericValue(['premium', 'Premium']);
          const onboardingCharges = getNumericValue(['onboardingcharges', 'onboarding_charges', 'OnboardingCharges', 'Onboarding Charges']);

          // Resolve tenant, bed, apartment, property
          let tenantId: string | null = null;
          let bedId: string | null = null;
          let apartmentId: string | null = null;
          let propertyId: string | null = null;
          let resolvedTenantName = tenantName;

          // Helper: derive apartment & property from a bed
          const deriveBedHierarchy = (bed: any) => {
            bedId = bed.id;
            const apt = apartments.find((a: any) => a.id === bed.apartment_id);
            apartmentId = apt?.id || null;
            propertyId = apt?.property_id || null;
          };

          // 1. TenantID from Excel
          if (directTenantId) {
            const tid = String(directTenantId).trim();
            const found = tenants.find((t: any) => t.id === tid);
            if (found) {
              tenantId = tid;
              resolvedTenantName = found.full_name || resolvedTenantName;
            }
          }

          // 2. BedID from Excel — try as UUID first, then as bed_code / apt-bed code
          const rawBedVal = String(directBedId || bedCode || '').trim();
          if (!bedId && rawBedVal) {
            const byId = beds.find((b: any) => b.id === rawBedVal);
            if (byId) {
              deriveBedHierarchy(byId);
            } else {
              const bedMatch = findBed(rawBedVal);
              if (bedMatch) {
                deriveBedHierarchy(bedMatch.bed);
              }
            }
          }

          // 3. AllotmentID lookup to fill any remaining gaps
          if (directAllotmentId) {
            const allotment = allotments.find((a: any) => a.id === directAllotmentId);
            if (allotment) {
              tenantId = tenantId || allotment.tenant_id;
              if (!bedId && allotment.bed_id) {
                const bed = beds.find((b: any) => b.id === allotment.bed_id);
                if (bed) deriveBedHierarchy(bed);
              }
              apartmentId = apartmentId || allotment.apartment_id;
              propertyId = propertyId || allotment.property_id;
              if (!resolvedTenantName && tenantId) {
                const t = tenants.find((t: any) => t.id === tenantId);
                if (t) resolvedTenantName = t.full_name;
              }
            }
          }

          // 4. Fallback: TenantName lookup
          if (!tenantId && resolvedTenantName) {
            const tenant = findTenant(resolvedTenantName);
            tenantId = tenant?.id || null;
          }

          const errors: string[] = [];
          if (!tenantId) errors.push(`Tenant "${resolvedTenantName || directTenantId || directAllotmentId}" not found`);
          if (!bedId) errors.push(`Bed "${rawBedVal || directAllotmentId}" not found`);

          const row: ParsedRow = {
            rowNum: i + 2,
            allotmentId: directAllotmentId || null,
            tenantName: resolvedTenantName || String(directTenantId || directAllotmentId),
            tenantId,
            bedCode: bedCode || String(directBedId),
            bedId,
            apartmentId,
            propertyId,
            onboardingDate,
            noticeDate,
            exitDate,
            estimatedExitDate,
            advance,
            discount,
            premium,
            onboardingCharges,
            action: 'skip',
            status: errors.length ? 'error' : 'ready',
            error: errors.join('; '),
          };
          row.action = deriveAction(row);
          return row;
        });

        setParsedRows(rows);
        setProcessedCount(0);
        toast({ title: `Parsed ${rows.length} rows from "${file.name}"` });
      } catch (err: any) {
        toast({ title: 'Failed to parse file', description: err.message, variant: 'destructive' });
      }
    };
    reader.readAsBinaryString(file);
    // Reset input
    e.target.value = '';
  };

  const getConfig = () => {
    const today = new Date().toISOString().split('T')[0];
    return lifecycleConfig.find((c: any) => c.from_date <= today && (!c.to_date || c.to_date >= today)) || {
      booking_fee: 1000, onboarding_fee: 1000, advance_ratio: 1.5,
      exit_fee_under_1yr: 2250, key_loss_fee: 500, notice_period_days: 30, refund_deadline_days: 5,
    };
  };

  const getBedRate = (bedId: string, date?: string) => {
    const bed = beds.find((b: any) => b.id === bedId);
    if (!bed) return 0;
    const apt = apartments.find((a: any) => a.id === bed.apartment_id);
    const propertyId = apt?.property_id || null;
    const targetDate = date || new Date().toISOString().split('T')[0];
    const matching = bedRates.filter((r: any) =>
      r.bed_type === bed.bed_type && r.toilet_type === bed.toilet_type &&
      r.from_date <= targetDate && (!r.to_date || r.to_date >= targetDate)
    );
    if (matching.length === 0) return 0;
    if (propertyId) {
      const propSpecific = matching
        .filter((r: any) => r.property_id === propertyId)
        .sort((a: any, b: any) => b.from_date.localeCompare(a.from_date));
      if (propSpecific.length > 0) return propSpecific[0].monthly_rate;
    }
    const sorted = matching.sort((a: any, b: any) => b.from_date.localeCompare(a.from_date));
    return sorted[0].monthly_rate;
  };

  const processAll = async () => {
    setProcessing(true);
    setProcessedCount(0);
    const updated = [...parsedRows];
    const config = getConfig();

    try {
      // Always reset all bed statuses to vacant and tenant statuses to new before processing
      // This ensures the final statuses are derived purely from the uploaded data
      await supabase.from('beds').update({ bed_lifecycle_status: 'vacant' } as any).eq('organization_id', orgId);
      await supabase.from('tenants').update({ staying_status: 'new' } as any).eq('organization_id', orgId);

      // If replace mode, also delete all existing lifecycle records
      if (uploadMode === 'replace') {
        // lifecycle_payments table removed — receipts are the single source of truth
        await supabase.from('tenant_notices').delete().eq('organization_id', orgId);
        await supabase.from('tenant_exits').delete().eq('organization_id', orgId);
        await supabase.from('tenant_allotments').delete().eq('organization_id', orgId);
      }
    } catch (err: any) {
      toast({ title: 'Failed to reset statuses', description: err.message, variant: 'destructive' });
      setProcessing(false);
      return;
    }

    // Prepare all valid rows for bulk processing
    const validRows: { idx: number; row: ParsedRow; allotmentData: any; noticeData?: any; exitData?: any; bedStatus: string; tenantStatus: string }[] = [];

    for (let i = 0; i < updated.length; i++) {
      const row = updated[i];
      if (row.status === 'error' || row.action === 'skip' || row.status === 'done') {
        if (row.action === 'skip') updated[i] = { ...row, status: 'skipped' };
        continue;
      }
      if (!row.tenantId || !row.bedId || !row.apartmentId || !row.propertyId) {
        updated[i] = { ...row, status: 'error', error: row.error || 'Missing tenant or bed' };
        continue;
      }

      const monthlyRent = getBedRate(row.bedId, row.onboardingDate || undefined);
      const advance = monthlyRent * (config.advance_ratio || 1.5);
      const amt = row.advance || (row.action === 'booking' ? config.booking_fee : advance);
      const today = new Date().toISOString().split('T')[0];

      let stayingStatus = 'Booked';
      let bedStatus = 'booked';
      let tenantStatus = 'booked';
      let noticeData: any = null;
      let exitData: any = null;

      if (row.action === 'onboarding') {
        stayingStatus = 'Staying'; bedStatus = 'occupied'; tenantStatus = 'staying';
      } else if (row.action === 'notice') {
        stayingStatus = 'On-Notice'; bedStatus = 'notice'; tenantStatus = 'on-notice';
      } else if (row.action === 'exit') {
        stayingStatus = 'Exited'; bedStatus = 'vacant'; tenantStatus = 'exited';
      }

      const exitDate = row.exitDate || (row.noticeDate && row.action === 'notice' ? (() => {
        const d = new Date(row.noticeDate!);
        d.setDate(d.getDate() + (config.notice_period_days || 30));
        return d.toISOString().split('T')[0];
      })() : null);

      const estimatedExit = row.estimatedExitDate || exitDate;

      const allotmentData: any = {
        tenant_id: row.tenantId,
        property_id: row.propertyId,
        apartment_id: row.apartmentId,
        bed_id: row.bedId,
        booking_date: row.onboardingDate || today,
        staying_status: stayingStatus,
        deposit_paid: amt,
        paid_amount: amt,
        payment_status: 'partial',
        organization_id: orgId,
        discount: row.discount || 0,
        premium: row.premium || 0,
        onboarding_charges: row.onboardingCharges || 0,
      };
      // Use the AllotmentID from Excel instead of auto-generating
      if (row.allotmentId) {
        allotmentData.id = row.allotmentId;
      }
      if (row.action !== 'booking') {
        allotmentData.onboarding_date = row.onboardingDate;
        allotmentData.deposit_paid = row.advance ? Math.ceil(row.advance) : Math.ceil(advance);
        allotmentData.monthly_rental = Math.ceil(monthlyRent);
      }
      if (row.action === 'notice') {
        allotmentData.notice_date = row.noticeDate;
        allotmentData.estimated_exit_date = estimatedExit;
      }
      if (row.action === 'exit') {
        allotmentData.actual_exit_date = row.exitDate;
        allotmentData.notice_date = row.noticeDate || null;
        allotmentData.estimated_exit_date = estimatedExit;
      }

      if ((row.action === 'notice' || row.action === 'exit') && row.noticeDate) {
        noticeData = {
          organization_id: orgId, tenant_id: row.tenantId, bed_id: row.bedId,
          notice_date: row.noticeDate, exit_date: exitDate || row.exitDate,
          ...(row.action === 'exit' ? { status: 'completed' } : {}),
        };
      }

      if (row.action === 'exit') {
        exitData = {
          organization_id: orgId, tenant_id: row.tenantId, bed_id: row.bedId,
          exit_date: row.exitDate, has_notice: !!row.noticeDate,
          advance_held: Math.ceil(advance), refund_status: 'none',
        };
      }

      validRows.push({
        idx: i, row, allotmentData,
        noticeData, exitData, bedStatus, tenantStatus,
      });
    }

    // Process in chunks of 50 for bulk insert
    const CHUNK = 50;
    let processed = updated.filter(r => r.status === 'error' || r.status === 'skipped' || r.status === 'done').length;

    // Track FINAL status per bed/tenant (last row wins since rows are in chronological order)
    const finalBedStatus = new Map<string, string>();
    const finalTenantStatus = new Map<string, string>();

    for (let c = 0; c < validRows.length; c += CHUNK) {
      const chunk = validRows.slice(c, c + CHUNK);

      // 1. Bulk insert allotments
      const allotmentPayloads = chunk.map(v => v.allotmentData);
      const { data: insertedAllotments, error: allotErr } = await supabase
        .from('tenant_allotments')
        .insert(allotmentPayloads as any)
        .select('id');

      if (allotErr || !insertedAllotments) {
        chunk.forEach(v => { updated[v.idx] = { ...v.row, status: 'error', error: allotErr?.message || 'Allotment insert failed' }; });
        processed += chunk.length;
        setProcessedCount(processed);
        setParsedRows([...updated]);
        continue;
      }

      // 2. Bulk insert notices

      // 3. Bulk insert notices
      const notices = chunk
        .map((v, j) => v.noticeData ? { ...v.noticeData, allotment_id: insertedAllotments[j]?.id } : null)
        .filter(Boolean);
      if (notices.length > 0) {
        await supabase.from('tenant_notices').insert(notices as any);
      }

      // 4. Bulk insert exits
      const exits = chunk
        .map((v, j) => v.exitData ? { ...v.exitData, allotment_id: insertedAllotments[j]?.id } : null)
        .filter(Boolean);
      if (exits.length > 0) {
        await supabase.from('tenant_exits').insert(exits as any);
      }

      // Track final status per bed/tenant (last row overwrites previous)
      chunk.forEach(v => {
        if (v.row.bedId) finalBedStatus.set(v.row.bedId, v.bedStatus);
        if (v.row.tenantId) finalTenantStatus.set(v.row.tenantId, v.tenantStatus);
      });

      // Mark all chunk rows as done
      chunk.forEach(v => { updated[v.idx] = { ...v.row, status: 'done' }; });
      processed += chunk.length;
      setProcessedCount(processed);
      setParsedRows([...updated]);
    }

    // Apply FINAL bed/tenant statuses after all rows processed (last lifecycle row wins)
    const bedsByFinalStatus = new Map<string, string[]>();
    for (const [bedId, status] of finalBedStatus) {
      const arr = bedsByFinalStatus.get(status) || [];
      arr.push(bedId);
      bedsByFinalStatus.set(status, arr);
    }
    for (const [status, ids] of bedsByFinalStatus) {
      // Batch in groups of 100 to avoid URL length limits
      for (let i = 0; i < ids.length; i += 100) {
        await supabase.from('beds').update({ bed_lifecycle_status: status } as any).in('id', ids.slice(i, i + 100));
      }
    }

    const tenantsByFinalStatus = new Map<string, string[]>();
    for (const [tenantId, status] of finalTenantStatus) {
      const arr = tenantsByFinalStatus.get(status) || [];
      arr.push(tenantId);
      tenantsByFinalStatus.set(status, arr);
    }
    for (const [status, ids] of tenantsByFinalStatus) {
      for (let i = 0; i < ids.length; i += 100) {
        await supabase.from('tenants').update({ staying_status: status } as any).in('id', ids.slice(i, i + 100));
      }
    }

    setParsedRows(updated);
    setProcessing(false);

    const successCount = updated.filter(r => r.status === 'done').length;
    const errorCount = updated.filter(r => r.status === 'error').length;
    toast({
      title: 'Import Complete',
      description: `${successCount} processed, ${errorCount} errors`,
      variant: errorCount > 0 ? 'destructive' : 'default',
    });
    onComplete();
  };

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['AllotmentID', 'TenantID', 'BedID', 'OnboardingDate', 'NoticeDate', 'ExitDate', 'EstimatedExitDate', 'Advance', 'Discount', 'Premium', 'OnboardingCharges'],
      ['(optional-uuid)', 'tenant-uuid-here', 'bed-uuid-here', '2025-01-15', '', '', '', '15000', '0', '0', '1000'],
      ['', 'tenant-uuid-2', 'bed-uuid-2', '2024-06-01', '2025-02-01', '', '2025-03-01', '12000', '500', '0', '1000'],
      ['', 'tenant-uuid-3', 'bed-uuid-3', '2024-01-10', '2024-11-01', '2024-12-01', '2024-12-01', '10000', '0', '200', '0'],
    ]);
    ws['!cols'] = [{ wch: 38 }, { wch: 38 }, { wch: 38 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 18 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 18 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Lifecycle');
    XLSX.writeFile(wb, 'tenant_lifecycle_template.xlsx');
  };

  const readyRows = parsedRows.filter(r => r.status === 'ready');
  const errorRows = parsedRows.filter(r => r.status === 'error');
  const doneRows = parsedRows.filter(r => r.status === 'done');

  const ACTION_COLORS: Record<RowAction, string> = {
    booking: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    onboarding: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    notice: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
    exit: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    skip: 'bg-muted text-muted-foreground',
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-lg font-semibold">Excel Upload</h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={downloadTemplate}>
            <Download className="h-3.5 w-3.5" /> Download Template
          </Button>
          <Button size="sm" className="gap-1.5" onClick={() => fileRef.current?.click()}>
            <Upload className="h-3.5 w-3.5" /> Upload File
          </Button>
        </div>
      </div>

      {/* Upload Mode Toggle */}
      <Card className="border-primary/20">
        <CardContent className="p-4">
          <p className="text-sm font-semibold mb-2">Upload Mode</p>
          <div className="flex gap-3">
            <label className={`flex items-center gap-2 cursor-pointer border rounded-lg px-4 py-2 transition-colors ${uploadMode === 'append' ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border hover:bg-muted/50'}`}>
              <input type="radio" name="uploadMode" value="append" checked={uploadMode === 'append'} onChange={() => setUploadMode('append')} className="sr-only" />
              <Plus className="h-4 w-4 text-primary" />
              <div>
                <p className="text-sm font-medium">Add to Existing</p>
                <p className="text-[10px] text-muted-foreground">Append new records to existing allotments</p>
              </div>
            </label>
            <label className={`flex items-center gap-2 cursor-pointer border rounded-lg px-4 py-2 transition-colors ${uploadMode === 'replace' ? 'border-destructive bg-destructive/5 ring-1 ring-destructive' : 'border-border hover:bg-muted/50'}`}>
              <input type="radio" name="uploadMode" value="replace" checked={uploadMode === 'replace'} onChange={() => setUploadMode('replace')} className="sr-only" />
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <div>
                <p className="text-sm font-medium">Replace All</p>
                <p className="text-[10px] text-muted-foreground">Erase all existing allotments & re-import</p>
              </div>
            </label>
          </div>
          {uploadMode === 'replace' && (
            <div className="mt-2 p-2 bg-destructive/10 border border-destructive/20 rounded text-xs text-destructive font-medium">
              ⚠️ This will delete ALL existing tenant allotments, notices, exits, and lifecycle payments before importing.
            </div>
          )}
        </CardContent>
      </Card>

      <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} className="hidden" />

      {!parsedRows.length && (
        <Card
          className="border-2 border-dashed cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors"
          onClick={() => fileRef.current?.click()}
        >
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <FileSpreadsheet className="h-12 w-12 text-muted-foreground mb-3" />
            <p className="text-sm font-medium mb-1">Drop your Excel file here or click to upload</p>
            <p className="text-xs text-muted-foreground mb-3">
              Supports .xlsx, .xls, .csv files
            </p>
              <div className="text-xs text-muted-foreground space-y-0.5 max-w-md">
                <p className="font-medium mb-1">Expected columns:</p>
                <p><code className="bg-muted px-1 rounded">AllotmentID</code> — existing allotment UUID (optional, auto-generated if blank)</p>
                <p><code className="bg-muted px-1 rounded">TenantID</code> — tenant UUID (required)</p>
                <p><code className="bg-muted px-1 rounded">BedID</code> — bed UUID or bed code (derives apartment &amp; property automatically)</p>
                <p><code className="bg-muted px-1 rounded">OnboardingDate</code> — onboarding date</p>
                <p><code className="bg-muted px-1 rounded">NoticeDate</code> — notice date (optional)</p>
                <p><code className="bg-muted px-1 rounded">ExitDate</code> — exit date (optional)</p>
                <p><code className="bg-muted px-1 rounded">EstimatedExitDate</code> — estimated exit date (optional)</p>
                <p><code className="bg-muted px-1 rounded">Advance</code> — advance/deposit amount</p>
                <p><code className="bg-muted px-1 rounded">Discount</code> — monthly discount (optional)</p>
                <p><code className="bg-muted px-1 rounded">Premium</code> — monthly premium (optional)</p>
                <p><code className="bg-muted px-1 rounded">OnboardingCharges</code> — onboarding charges (optional)</p>
              </div>
          </CardContent>
        </Card>
      )}

      {parsedRows.length > 0 && (
        <>
          {/* Summary Bar */}
          <Card>
            <CardContent className="p-4 flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3 flex-wrap">
                <Badge variant="outline" className="gap-1">
                  <FileSpreadsheet className="h-3 w-3" /> {fileName}
                </Badge>
                <Badge variant="secondary">{parsedRows.length} rows</Badge>
                <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">{readyRows.length} ready</Badge>
                {errorRows.length > 0 && <Badge variant="destructive">{errorRows.length} errors</Badge>}
                {doneRows.length > 0 && <Badge className="bg-emerald-100 text-emerald-800">{doneRows.length} done</Badge>}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => { setParsedRows([]); setFileName(''); }}>Clear</Button>
                <Button
                  size="sm"
                  disabled={processing || readyRows.length === 0}
                  onClick={processAll}
                  className="gap-1.5"
                >
                  {processing ? (
                    <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Processing {processedCount}/{parsedRows.length}</>
                  ) : (
                    <><CheckCircle2 className="h-3.5 w-3.5" /> Process {readyRows.length} Rows</>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Error rows collapsible */}
          {errorRows.length > 0 && (
            <Collapsible>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-1.5 text-destructive w-full justify-start">
                  <AlertTriangle className="h-3.5 w-3.5" /> {errorRows.length} rows with errors — click to expand
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <Card className="border-destructive/30 mt-1">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">Row</TableHead>
                        <TableHead>Tenant</TableHead>
                        <TableHead>Bed</TableHead>
                        <TableHead>Error</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {errorRows.map(r => (
                        <TableRow key={r.rowNum} className="bg-destructive/5">
                          <TableCell className="font-mono text-xs">{r.rowNum}</TableCell>
                          <TableCell className="text-sm">{r.tenantName}</TableCell>
                          <TableCell className="text-sm">{r.bedCode}</TableCell>
                          <TableCell className="text-xs text-destructive">{r.error}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Card>
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Main data table */}
          <Card className="overflow-x-auto">
            <Table>
              <TableHeader>
              <TableRow>
                  <TableHead className="w-12">Row</TableHead>
                  <TableHead>Tenant</TableHead>
                  <TableHead>Bed</TableHead>
                  <TableHead>Onboarding</TableHead>
                  <TableHead>Notice</TableHead>
                  <TableHead>Exit</TableHead>
                  <TableHead>Est. Exit</TableHead>
                  <TableHead className="text-right">Advance</TableHead>
                  <TableHead className="text-right">Discount</TableHead>
                  <TableHead className="text-right">Premium</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {parsedRows.map((r, i) => (
                  <TableRow key={r.rowNum} className={r.status === 'done' ? 'bg-green-50/50 dark:bg-green-950/10' : r.status === 'error' ? 'bg-destructive/5' : ''}>
                    <TableCell className="font-mono text-xs">{r.rowNum}</TableCell>
                    <TableCell className="text-sm">
                      <div className="flex items-center gap-1.5">
                        {r.tenantId ? <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" /> : <XCircle className="h-3 w-3 text-destructive shrink-0" />}
                        <span className="truncate max-w-[120px]">{r.tenantName}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      <div className="flex items-center gap-1.5">
                        {r.bedId ? <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" /> : <XCircle className="h-3 w-3 text-destructive shrink-0" />}
                        {r.bedCode}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">{r.onboardingDate || '—'}</TableCell>
                    <TableCell className="text-xs">{r.noticeDate || '—'}</TableCell>
                    <TableCell className="text-xs">{r.exitDate || '—'}</TableCell>
                    <TableCell className="text-xs">{r.estimatedExitDate || '—'}</TableCell>
                    <TableCell className="text-right text-sm font-medium">{r.advance ? `₹${r.advance.toLocaleString('en-IN')}` : '—'}</TableCell>
                    <TableCell className="text-right text-sm">{r.discount ? `₹${r.discount.toLocaleString('en-IN')}` : '—'}</TableCell>
                    <TableCell className="text-right text-sm">{r.premium ? `₹${r.premium.toLocaleString('en-IN')}` : '—'}</TableCell>
                    <TableCell>
                      {r.status !== 'done' && r.status !== 'error' ? (
                        <Select
                          value={r.action}
                          onValueChange={(v) => {
                            const updated = [...parsedRows];
                            updated[i] = { ...r, action: v as RowAction };
                            setParsedRows(updated);
                          }}
                        >
                          <SelectTrigger className="h-7 text-xs w-[100px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="booking">Booking</SelectItem>
                            <SelectItem value="onboarding">Onboarding</SelectItem>
                            <SelectItem value="notice">Notice</SelectItem>
                            <SelectItem value="exit">Exit</SelectItem>
                            <SelectItem value="skip">Skip</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge className={`text-[10px] ${ACTION_COLORS[r.action]}`}>{r.action}</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {r.status === 'done' && <Badge className="bg-emerald-100 text-emerald-800 text-[10px]">✓ Done</Badge>}
                      {r.status === 'error' && <Badge variant="destructive" className="text-[10px]">Error</Badge>}
                      {r.status === 'ready' && <Badge variant="outline" className="text-[10px]">Ready</Badge>}
                      {r.status === 'skipped' && <Badge variant="secondary" className="text-[10px]">Skipped</Badge>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </>
      )}
    </div>
  );
}
