import { useState, useMemo, useEffect } from 'react';
import { fetchAllRows } from '@/lib/supabase-utils';
import { Zap, Plus, ChevronDown, ChevronRight, Pencil, Trash2, Camera, X, Settings, CalendarIcon, Lock, Unlock, TrendingUp, TrendingDown, Minus, Upload } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import { FileUploadField } from '@/components/shared/FileUploadField';
import { format, subMonths, parse, parseISO } from 'date-fns';
import { SortableTableHead, useSort } from '@/components/shared/SortableTableHead';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

// Format ISO date string to dd-MMM-yy display
function formatDateDisplay(dateStr: string | null): string {
  if (!dateStr) return '';
  try {
    return format(parseISO(dateStr), 'dd-MMM-yy');
  } catch {
    return dateStr;
  }
}

// Generate last 12 months as "MMM-yy" e.g. "Mar-26"
function getLast12Months(): { value: string; label: string }[] {
  const months: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = subMonths(now, i);
    const val = format(d, 'MMM-yy');
    months.push({ value: val, label: val });
  }
  return months;
}

// Parse "MMM-yy" to a sortable date
function parseMonth(m: string): Date {
  try {
    return parse(m, 'MMM-yy', new Date());
  } catch {
    return new Date(0);
  }
}

// Get previous month string from a "MMM-yy" string
function getPreviousMonth(m: string): string {
  const d = parseMonth(m);
  const prev = subMonths(d, 1);
  return format(prev, 'MMM-yy');
}

// Trend indicator component
function TrendIndicator({ current, previous }: { current: number; previous: number | null }) {
  if (previous === null || previous === 0) return null;
  const diff = current - previous;
  const pct = Math.round((diff / previous) * 100);
  if (diff === 0) return <Minus className="h-3 w-3 text-muted-foreground inline ml-1" />;
  if (diff > 0) {
    return (
      <span className="inline-flex items-center ml-1 text-xs text-red-500">
        <TrendingUp className="h-3 w-3 mr-0.5" />
        +{pct}%
      </span>
    );
  }
  return (
    <span className="inline-flex items-center ml-1 text-xs text-green-500">
      <TrendingDown className="h-3 w-3 mr-0.5" />
      {pct}%
    </span>
  );
}

interface BulkRow {
  id?: string; // existing reading id if editing
  apartment_id: string;
  apartment_code: string;
  eb_meter_number: string;
  previous_reading: number;
  reading_end: number | string;
  meter_photo_url: string | null;
}

export default function Electricity() {
  const { profile, roles, user } = useAuth();
  const queryClient = useQueryClient();
  const monthOptions = useMemo(() => getLast12Months(), []);

  const isAdmin = roles.includes('super_admin') || roles.includes('org_admin');

  // Bulk add/edit state
  const [addOpen, setAddOpen] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState('');
  const [billingMonth, setBillingMonth] = useState('');
  const [unitCost, setUnitCost] = useState('');
  const [bulkRows, setBulkRows] = useState<BulkRow[]>([]);
  const [isEditMode, setIsEditMode] = useState(false);

  // Detail view state
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);

  // EB Rate CRUD state
  const [rateOpen, setRateOpen] = useState(false);
  const [rateForm, setRateForm] = useState({ id: '', property_id: '', unit_cost: '', from_date: '', to_date: '' });

  // Bulk upload state
  const [bulkUploadOpen, setBulkUploadOpen] = useState(false);
  const [bulkUploadFiles, setBulkUploadFiles] = useState<File[]>([]);
  const [bulkUploadResults, setBulkUploadResults] = useState<any[]>([]);
  const [bulkUploading, setBulkUploading] = useState(false);

  const { sortConfig, handleSort, sortData } = useSort();

  const { data: properties = [] } = useQuery({
    queryKey: ['properties'],
    queryFn: async () => {
      const { data } = await supabase.from('properties').select('id, property_name');
      return data || [];
    },
    enabled: !!profile?.organization_id,
  });

  const { data: allApartments = [] } = useQuery({
    queryKey: ['apartments_all'],
    queryFn: () => fetchAllRows((from, to) => supabase.from('apartments').select('id, apartment_code, property_id, eb_meter_number, status, start_date, end_date').range(from, to)),
    enabled: !!profile?.organization_id,
  });

  const { data: readings = [] } = useQuery({
    queryKey: ['electricity_readings'],
    queryFn: () => fetchAllRows((from, to) =>
      supabase.from('electricity_readings')
        .select('*, properties(property_name), apartments(apartment_code, eb_meter_number)')
        .order('created_at', { ascending: false })
        .range(from, to)
    ),
    enabled: !!profile?.organization_id,
  });

  const { data: ebRates = [] } = useQuery({
    queryKey: ['eb_rates'],
    queryFn: () => fetchAllRows((from, to) => supabase.from('eb_rates').select('*, properties(property_name)').order('from_date', { ascending: false }).range(from, to)),
    enabled: !!profile?.organization_id,
  });

  // Auto-fill unit cost when property or billing month changes
  useEffect(() => {
    if (!selectedProperty || !billingMonth) return;
    try {
      const parsed = parse(billingMonth, 'MMM-yy', new Date());
      if (isNaN(parsed.getTime())) return;
      const dateStr = format(parsed, 'yyyy-MM-dd');

      const propertyRates = ebRates.filter((r: any) =>
        r.property_id === selectedProperty &&
        r.from_date <= dateStr &&
        (!r.to_date || r.to_date >= dateStr)
      );
      const globalRates = ebRates.filter((r: any) =>
        !r.property_id &&
        r.from_date <= dateStr &&
        (!r.to_date || r.to_date >= dateStr)
      );

      const matchedRate = propertyRates[0] || globalRates[0];
      if (matchedRate) {
        setUnitCost(String(matchedRate.unit_cost));
      }
    } catch {}
  }, [selectedProperty, billingMonth, ebRates]);

  // Check if apartment was live during a given billing month
  const isApartmentLiveDuring = (apt: any, month: string): boolean => {
    if (apt.status !== 'Live') return false;
    if (!month) return true;
    
    const monthDate = parseMonth(month);
    const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);

    if (apt.start_date) {
      const start = new Date(apt.start_date);
      if (start > monthEnd) return false;
    }

    return true;
  };

  // Group readings by billing_month + property_id
  const grouped = useMemo(() => {
    const map: Record<string, { billing_month: string; property_id: string; property_name: string; total_units: number; unit_cost: number; total_amount: number; is_locked: boolean; readings: any[] }> = {};
    readings.forEach((r: any) => {
      const key = `${r.billing_month}__${r.property_id}`;
      if (!map[key]) {
        map[key] = {
          billing_month: r.billing_month,
          property_id: r.property_id,
          property_name: (r as any).properties?.property_name || '',
          total_units: 0,
          unit_cost: parseFloat(r.unit_cost || 0),
          total_amount: 0,
          is_locked: false,
          readings: [],
        };
      }
      const units = parseFloat(r.units_consumed || 0);
      map[key].total_units += units;
      map[key].total_amount += units * parseFloat(r.unit_cost || 0);
      if (r.is_locked) map[key].is_locked = true;
      map[key].readings.push(r);
    });
    const entries = Object.entries(map);
    entries.sort(([, a], [, b]) => {
      const da = parseMonth(a.billing_month);
      const db = parseMonth(b.billing_month);
      return db.getTime() - da.getTime();
    });
    return entries;
  }, [readings]);

  // Build a lookup for previous month data (for trend arrows)
  const prevMonthLookup = useMemo(() => {
    const groupMap: Record<string, { total_units: number; apartmentUnits: Record<string, number> }> = {};
    grouped.forEach(([, g]) => {
      const key = `${g.billing_month}__${g.property_id}`;
      const apartmentUnits: Record<string, number> = {};
      g.readings.forEach((r: any) => {
        apartmentUnits[r.apartment_id] = parseFloat(r.units_consumed || 0);
      });
      groupMap[key] = { total_units: g.total_units, apartmentUnits };
    });
    return groupMap;
  }, [grouped]);

  const getPrevGroupData = (billingMonth: string, propertyId: string) => {
    const prevMonth = getPreviousMonth(billingMonth);
    const key = `${prevMonth}__${propertyId}`;
    return prevMonthLookup[key] || null;
  };

  // Apply sorting to grouped data
  const sortedGrouped = useMemo(() => {
    if (!sortConfig.key || !sortConfig.direction) return grouped;
    return [...grouped].sort(([, a], [, b]) => {
      let valA: any, valB: any;
      switch (sortConfig.key) {
        case 'billing_month':
          valA = parseMonth(a.billing_month).getTime();
          valB = parseMonth(b.billing_month).getTime();
          break;
        case 'property_name':
          valA = a.property_name.toLowerCase();
          valB = b.property_name.toLowerCase();
          break;
        case 'total_units':
          valA = a.total_units;
          valB = b.total_units;
          break;
        case 'unit_cost':
          valA = a.unit_cost;
          valB = b.unit_cost;
          break;
        case 'total_amount':
          valA = a.total_amount;
          valB = b.total_amount;
          break;
        default:
          return 0;
      }
      if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [grouped, sortConfig]);

  const totalUnits = readings.reduce((s: number, r: any) => s + parseFloat(r.units_consumed || 0), 0);
  const totalCost = readings.reduce((s: number, r: any) => s + (parseFloat(r.units_consumed || 0) * parseFloat(r.unit_cost || 0)), 0);

  // Load apartments for bulk add
  const loadBulkRows = (propertyId: string, month: string) => {
    const liveApts = allApartments.filter((a: any) => a.property_id === propertyId && isApartmentLiveDuring(a, month));
    const existingReadings = readings.filter((r: any) => r.property_id === propertyId && r.billing_month === month);

    const rows: BulkRow[] = liveApts.map((apt: any) => {
      const existing = existingReadings.find((r: any) => r.apartment_id === apt.id);
      if (existing) {
        return {
          id: existing.id,
          apartment_id: apt.id,
          apartment_code: apt.apartment_code,
          eb_meter_number: apt.eb_meter_number || '',
          previous_reading: Number(existing.reading_start),
          reading_end: Number(existing.reading_end),
          meter_photo_url: existing.meter_photo_url || null,
        };
      }
      const selectedDate = parseMonth(month);
      const prevReadings = readings
        .filter((r: any) => r.apartment_id === apt.id && r.billing_month !== month)
        .filter((r: any) => parseMonth(r.billing_month).getTime() < selectedDate.getTime())
        .sort((a: any, b: any) => parseMonth(b.billing_month).getTime() - parseMonth(a.billing_month).getTime());
      const latest = prevReadings.length > 0 ? prevReadings[0] : null;
      return {
        apartment_id: apt.id,
        apartment_code: apt.apartment_code,
        eb_meter_number: apt.eb_meter_number || '',
        previous_reading: latest ? Number(latest.reading_end) : 0,
        reading_end: '',
        meter_photo_url: null,
      };
    });

    rows.sort((a, b) => a.apartment_code.localeCompare(b.apartment_code, undefined, { numeric: true }));
    const hasExisting = rows.some(r => r.id);
    setIsEditMode(hasExisting);
    setBulkRows(rows);
  };

  const handlePropertySelect = (propertyId: string) => {
    setSelectedProperty(propertyId);
    if (billingMonth) {
      loadBulkRows(propertyId, billingMonth);
    } else {
      const liveApts = allApartments
        .filter((a: any) => a.property_id === propertyId && a.status === 'Live')
        .sort((a: any, b: any) => a.apartment_code.localeCompare(b.apartment_code, undefined, { numeric: true }));
      setBulkRows(liveApts.map((apt: any) => ({
        apartment_id: apt.id,
        apartment_code: apt.apartment_code,
        eb_meter_number: apt.eb_meter_number || '',
        previous_reading: 0,
        reading_end: '',
        meter_photo_url: null,
      })));
    }
  };

  useEffect(() => {
    if (addOpen && selectedProperty && billingMonth) {
      loadBulkRows(selectedProperty, billingMonth);
    }
  }, [billingMonth]);

  const updateBulkRow = (idx: number, field: keyof BulkRow, value: any) => {
    setBulkRows(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));
  };

  const openEditMonth = (group: any) => {
    if (group.is_locked) {
      toast({ title: 'Locked', description: 'These readings are locked and cannot be edited.', variant: 'destructive' });
      return;
    }
    setSelectedProperty(group.property_id);
    setBillingMonth(group.billing_month);
    setUnitCost(String(group.unit_cost));
    
    const liveApts = allApartments.filter((a: any) => a.property_id === group.property_id);
    const rows: BulkRow[] = group.readings.map((r: any) => {
      const apt = liveApts.find((a: any) => a.id === r.apartment_id);
      return {
        id: r.id,
        apartment_id: r.apartment_id,
        apartment_code: apt?.apartment_code || (r as any).apartments?.apartment_code || '',
        eb_meter_number: apt?.eb_meter_number || (r as any).apartments?.eb_meter_number || '',
        previous_reading: parseFloat(r.reading_start),
        reading_end: parseFloat(r.reading_end),
        meter_photo_url: r.meter_photo_url || null,
      };
    });
    rows.sort((a, b) => a.apartment_code.localeCompare(b.apartment_code, undefined, { numeric: true }));
    
    setIsEditMode(true);
    setBulkRows(rows);
    setAddOpen(true);
  };

  // Lock/Unlock mutations
  const lockMutation = useMutation({
    mutationFn: async ({ groupKey, lock }: { groupKey: string; lock: boolean }) => {
      const group = grouped.find(([k]) => k === groupKey);
      if (!group) throw new Error('Group not found');
      const readingIds = group[1].readings.map((r: any) => r.id);
      
      for (const id of readingIds) {
        const { error } = await supabase.from('electricity_readings').update({
          is_locked: lock,
          locked_by: lock ? user?.id : null,
        } as any).eq('id', id);
        if (error) throw error;
      }
    },
    onSuccess: (_, { lock }) => {
      queryClient.invalidateQueries({ queryKey: ['electricity_readings'] });
      toast({ title: lock ? 'Readings locked' : 'Readings unlocked' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const handleLockToggle = (groupKey: string, currentlyLocked: boolean) => {
    if (currentlyLocked && !isAdmin) {
      toast({ title: 'Access denied', description: 'Only admins can unlock readings.', variant: 'destructive' });
      return;
    }
    const action = currentlyLocked ? 'unlock' : 'lock';
    if (confirm(`Are you sure you want to ${action} these readings?`)) {
      lockMutation.mutate({ groupKey, lock: !currentlyLocked });
    }
  };

  // Check if selected month+property is locked
  const isSelectedMonthLocked = useMemo(() => {
    if (!billingMonth || !selectedProperty) return false;
    const key = `${billingMonth}__${selectedProperty}`;
    const group = grouped.find(([k]) => k === key);
    return group ? group[1].is_locked : false;
  }, [billingMonth, selectedProperty, grouped]);

  const saveBulkMutation = useMutation({
    mutationFn: async () => {
      if (!billingMonth || !unitCost || !selectedProperty) throw new Error('Fill billing month, property and unit cost');
      if (isSelectedMonthLocked) throw new Error('This month is locked. Readings cannot be modified.');
      const validRows = bulkRows.filter(r => r.reading_end !== '' && r.reading_end !== null);
      if (validRows.length === 0) throw new Error('Enter at least one reading');

      const updates = validRows.filter(r => r.id);
      const inserts = validRows.filter(r => !r.id);

      for (const r of updates) {
        const { error } = await supabase.from('electricity_readings').update({
          reading_start: r.previous_reading,
          reading_end: parseFloat(String(r.reading_end)),
          units_consumed: parseFloat(String(r.reading_end)) - r.previous_reading,
          unit_cost: parseFloat(unitCost),
          meter_photo_url: r.meter_photo_url,
        } as any).eq('id', r.id!);
        if (error) throw error;
      }

      if (inserts.length > 0) {
        const insertData = inserts.map(r => ({
          property_id: selectedProperty,
          apartment_id: r.apartment_id,
          billing_month: billingMonth,
          reading_start: r.previous_reading,
          reading_end: parseFloat(String(r.reading_end)),
          units_consumed: parseFloat(String(r.reading_end)) - r.previous_reading,
          unit_cost: parseFloat(unitCost),
          meter_photo_url: r.meter_photo_url,
          organization_id: profile.organization_id,
        }));
        const { error } = await supabase.from('electricity_readings').insert(insertData as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['electricity_readings'] });
      setAddOpen(false);
      setBulkRows([]);
      setSelectedProperty('');
      setBillingMonth('');
      setUnitCost('');
      setIsEditMode(false);
      toast({ title: 'Readings saved successfully' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('electricity_readings').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['electricity_readings'] });
      toast({ title: 'Reading deleted' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  // EB Rate mutations
  const saveRateMutation = useMutation({
    mutationFn: async () => {
      if (!rateForm.unit_cost || !rateForm.from_date) throw new Error('Unit cost and from date are required');
      const payload = {
        property_id: rateForm.property_id || null,
        unit_cost: parseFloat(rateForm.unit_cost),
        from_date: rateForm.from_date,
        to_date: rateForm.to_date || null,
        organization_id: profile.organization_id,
      };
      if (rateForm.id) {
        const { error } = await supabase.from('eb_rates').update(payload as any).eq('id', rateForm.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('eb_rates').insert(payload as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['eb_rates'] });
      setRateOpen(false);
      setRateForm({ id: '', property_id: '', unit_cost: '', from_date: '', to_date: '' });
      toast({ title: rateForm.id ? 'Rate updated' : 'Rate created' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const deleteRateMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('eb_rates').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['eb_rates'] });
      toast({ title: 'Rate deleted' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const getPropertyName = (id: string | null) => {
    if (!id) return 'All Properties';
    return properties.find((p: any) => p.id === id)?.property_name || '—';
  };

  // Bulk upload handlers - accumulate files across multiple selections
  const handleBulkUploadFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFiles = Array.from(e.target.files || []);
    if (newFiles.length === 0) return;
    setBulkUploadFiles(prev => {
      const existing = new Set(prev.map(f => `${f.name}_${f.size}`));
      const unique = newFiles.filter(f => !existing.has(`${f.name}_${f.size}`));
      return [...prev, ...unique];
    });
    e.target.value = '';
  };

  const processBulkUpload = async () => {
    if (bulkUploadFiles.length === 0) return;
    setBulkUploading(true);
    const results: any[] = [];

    try {
      for (const file of bulkUploadFiles) {
        // Upload photo
        const ext = file.name.split('.').pop();
        const path = `meter-photos/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: uploadError } = await supabase.storage.from('documents').upload(path, file);
        if (uploadError) {
          results.push({ file: file.name, error: uploadError.message });
          continue;
        }
        const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(path);

        // Call OCR edge function
        try {
          const { data, error } = await supabase.functions.invoke('scan-meter-reading', {
            body: { imageUrl: publicUrl },
          });
          if (error) {
            results.push({ file: file.name, photoUrl: publicUrl, error: 'OCR failed' });
          } else {
            results.push({ file: file.name, photoUrl: publicUrl, ...data });
          }
        } catch {
          results.push({ file: file.name, photoUrl: publicUrl, error: 'OCR service unavailable' });
        }
      }
      setBulkUploadResults(prev => [...prev, ...results]);
      setBulkUploadFiles([]);
    } catch (err: any) {
      toast({ title: 'Upload error', description: err.message, variant: 'destructive' });
    } finally {
      setBulkUploading(false);
    }
  };

  const applyOcrResults = () => {
    if (!bulkUploadResults.length || !bulkRows.length) return;
    let matched = 0;
    const updatedRows = [...bulkRows];
    
    for (const result of bulkUploadResults) {
      if (result.error || !result.apartment_code) continue;
      const idx = updatedRows.findIndex(r => 
        r.apartment_code.toLowerCase().trim() === result.apartment_code.toLowerCase().trim()
      );
      if (idx !== -1) {
        if (result.reading_value) {
          updatedRows[idx] = { ...updatedRows[idx], reading_end: result.reading_value, meter_photo_url: result.photoUrl };
          matched++;
        } else {
          updatedRows[idx] = { ...updatedRows[idx], meter_photo_url: result.photoUrl };
        }
      }
    }
    
    setBulkRows(updatedRows);
    setBulkUploadOpen(false);
    setBulkUploadFiles([]);
    setBulkUploadResults([]);
    toast({ title: `${matched} reading(s) matched and auto-filled` });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Electricity Management</h1>
          <p className="text-sm text-muted-foreground mt-1">Meter readings, rates and cost sharing</p>
        </div>
        <Button className="gap-2" onClick={() => { setIsEditMode(false); setSelectedProperty(''); setBillingMonth(''); setUnitCost(''); setBulkRows([]); setAddOpen(true); }}>
          <Plus className="h-4 w-4" /> Add Reading
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardContent className="p-4"><p className="text-2xl font-bold">{Math.round(totalUnits).toLocaleString('en-IN')}</p><p className="text-xs text-muted-foreground">Total Units Consumed</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-2xl font-bold">₹{Math.round(totalCost).toLocaleString()}</p><p className="text-xs text-muted-foreground">Total Cost</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-2xl font-bold">{readings.length}</p><p className="text-xs text-muted-foreground">Readings Recorded</p></CardContent></Card>
      </div>

      <Tabs defaultValue="readings">
        <TabsList>
          <TabsTrigger value="readings">Meter Readings</TabsTrigger>
          <TabsTrigger value="rates">EB Rates</TabsTrigger>
        </TabsList>

        <TabsContent value="readings" className="mt-4">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <SortableTableHead label="Month" sortKey="billing_month" sortConfig={sortConfig} onSort={handleSort} />
                  <SortableTableHead label="Property" sortKey="property_name" sortConfig={sortConfig} onSort={handleSort} />
                  <SortableTableHead label="Total Units" sortKey="total_units" sortConfig={sortConfig} onSort={handleSort} className="text-right" />
                  <SortableTableHead label="Rate (₹/unit)" sortKey="unit_cost" sortConfig={sortConfig} onSort={handleSort} className="text-right" />
                  <SortableTableHead label="Total Amount" sortKey="total_amount" sortConfig={sortConfig} onSort={handleSort} className="text-right" />
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedGrouped.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">No readings recorded</TableCell>
                  </TableRow>
                ) : sortedGrouped.map(([key, group]) => {
                  const prevData = getPrevGroupData(group.billing_month, group.property_id);
                  return (
                    <>
                      <TableRow
                        key={key}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => setExpandedGroup(expandedGroup === key ? null : key)}
                      >
                        <TableCell>
                          {expandedGroup === key
                            ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                        </TableCell>
                        <TableCell className="font-semibold">{group.billing_month}</TableCell>
                        <TableCell>{group.property_name}</TableCell>
                        <TableCell className="text-right font-semibold">
                          {Math.round(group.total_units).toLocaleString('en-IN')}
                          <TrendIndicator current={group.total_units} previous={prevData?.total_units ?? null} />
                        </TableCell>
                        <TableCell className="text-right">₹{group.unit_cost.toFixed(2)}</TableCell>
                        <TableCell className="text-right font-semibold">₹{Math.round(group.total_amount).toLocaleString('en-IN')}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              title={group.is_locked ? 'Unlock readings' : 'Lock readings'}
                              onClick={(e) => { e.stopPropagation(); handleLockToggle(key, group.is_locked); }}
                            >
                              {group.is_locked
                                ? <Lock className="h-3.5 w-3.5 text-orange-500" />
                                : <Unlock className="h-3.5 w-3.5 text-muted-foreground" />}
                            </Button>
                            {!group.is_locked && (
                              <Button variant="ghost" size="icon" className="h-7 w-7"
                                onClick={(e) => { e.stopPropagation(); openEditMonth(group); }}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                      {expandedGroup === key && (
                        <TableRow key={`${key}_detail`}>
                          <TableCell colSpan={7} className="p-0">
                            <div className="bg-muted/30 p-4">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Apartment</TableHead>
                                    <TableHead>Meter No</TableHead>
                                    <TableHead className="text-right">Prev Reading</TableHead>
                                    <TableHead className="text-right">Current Reading</TableHead>
                                    <TableHead className="text-right">Units</TableHead>
                                    <TableHead className="text-right">Amount</TableHead>
                                    <TableHead>Photo</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {group.readings
                                    .slice()
                                    .sort((a: any, b: any) => {
                                      const aptA = (a as any).apartments?.apartment_code || '';
                                      const aptB = (b as any).apartments?.apartment_code || '';
                                      return aptA.localeCompare(aptB, undefined, { numeric: true });
                                    })
                                    .map((r: any) => {
                                      const units = parseFloat(r.units_consumed || 0);
                                      const prevAptUnits = prevData?.apartmentUnits?.[r.apartment_id] ?? null;
                                      return (
                                        <TableRow key={r.id}>
                                          <TableCell>{(r as any).apartments?.apartment_code}</TableCell>
                                          <TableCell className="text-muted-foreground text-xs">{(r as any).apartments?.eb_meter_number || '—'}</TableCell>
                                          <TableCell className="text-right">{Math.round(Number(r.reading_start)).toLocaleString('en-IN')}</TableCell>
                                          <TableCell className="text-right">{Math.round(Number(r.reading_end)).toLocaleString('en-IN')}</TableCell>
                                          <TableCell className="text-right font-semibold">
                                            {Math.round(units).toLocaleString('en-IN')}
                                            <TrendIndicator current={units} previous={prevAptUnits} />
                                          </TableCell>
                                          <TableCell className="text-right">₹{Math.round(units * parseFloat(r.unit_cost || 0)).toLocaleString('en-IN')}</TableCell>
                                          <TableCell>
                                            {r.meter_photo_url ? (
                                              <a href={r.meter_photo_url} target="_blank" rel="noopener noreferrer" className="text-primary underline text-xs">View</a>
                                            ) : '—'}
                                          </TableCell>
                                        </TableRow>
                                      );
                                    })}
                                </TableBody>
                              </Table>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="rates" className="mt-4">
          <div className="flex justify-end mb-4">
            <Button className="gap-2" onClick={() => { setRateForm({ id: '', property_id: '', unit_cost: '', from_date: '', to_date: '' }); setRateOpen(true); }}>
              <Plus className="h-4 w-4" /> Add EB Rate
            </Button>
          </div>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Property</TableHead>
                  <TableHead className="text-right">Unit Cost (₹)</TableHead>
                  <TableHead>From Date</TableHead>
                  <TableHead>To Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ebRates.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No EB rates configured</TableCell></TableRow>
                ) : ebRates.map((rate: any) => (
                  <TableRow key={rate.id}>
                    <TableCell>{getPropertyName(rate.property_id)}</TableCell>
                    <TableCell className="text-right font-semibold">₹{parseFloat(rate.unit_cost).toFixed(2)}</TableCell>
                    <TableCell>{formatDateDisplay(rate.from_date)}</TableCell>
                    <TableCell>{rate.to_date ? formatDateDisplay(rate.to_date) : 'Ongoing'}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7"
                          onClick={() => {
                            setRateForm({
                              id: rate.id,
                              property_id: rate.property_id || '',
                              unit_cost: String(rate.unit_cost),
                              from_date: rate.from_date,
                              to_date: rate.to_date || '',
                            });
                            setRateOpen(true);
                          }}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"
                          onClick={() => { if (confirm('Delete this rate?')) deleteRateMutation.mutate(rate.id); }}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Bulk Add/Edit Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{isEditMode ? 'Edit' : 'Add'} Meter Readings</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>Property *</Label>
                <Select value={selectedProperty} onValueChange={handlePropertySelect}>
                  <SelectTrigger><SelectValue placeholder="Select property" /></SelectTrigger>
                  <SelectContent>
                    {properties.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.property_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Billing Month *</Label>
                <Select value={billingMonth} onValueChange={setBillingMonth}>
                  <SelectTrigger><SelectValue placeholder="Select month" /></SelectTrigger>
                  <SelectContent>
                    {monthOptions.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Unit Cost (₹) *</Label>
                <Input type="number" step="0.01" placeholder="Auto-filled from EB rates" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} />
                {unitCost && <p className="text-xs text-muted-foreground mt-1">₹{parseFloat(unitCost).toFixed(2)}/unit</p>}
              </div>
            </div>

            {/* Bulk Upload Photos Button */}
            {bulkRows.length > 0 && selectedProperty && billingMonth && (
              <div className="flex justify-end">
                <Button variant="outline" className="gap-2" onClick={() => setBulkUploadOpen(true)}>
                  <Upload className="h-4 w-4" /> Bulk Upload Photos
                </Button>
              </div>
            )}

            {bulkRows.length > 0 && (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Apartment</TableHead>
                      <TableHead>Meter No</TableHead>
                      <TableHead className="text-right">Prev Reading</TableHead>
                      <TableHead className="text-right">Current Reading</TableHead>
                      <TableHead className="text-right">Consumption</TableHead>
                      <TableHead>Meter Photo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bulkRows.map((row, idx) => {
                      const consumption = row.reading_end !== '' ? parseFloat(String(row.reading_end)) - row.previous_reading : 0;
                      return (
                        <TableRow key={row.apartment_id}>
                          <TableCell className="font-medium">{row.apartment_code}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{row.eb_meter_number || '—'}</TableCell>
                          <TableCell className="text-right text-muted-foreground">{Math.round(row.previous_reading).toLocaleString('en-IN')}</TableCell>
                          <TableCell className="text-right">
                            <Input
                              type="number"
                              className="w-28 ml-auto text-right"
                              placeholder="Reading"
                              value={row.reading_end}
                              onChange={(e) => updateBulkRow(idx, 'reading_end', e.target.value)}
                              disabled={isSelectedMonthLocked}
                            />
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {row.reading_end !== '' ? (
                              <span className={consumption < 0 ? 'text-destructive' : ''}>{Math.round(consumption)}</span>
                            ) : '—'}
                          </TableCell>
                          <TableCell>
                            {row.meter_photo_url ? (
                              <div className="flex items-center gap-1">
                                <a href={row.meter_photo_url} target="_blank" rel="noopener noreferrer" className="text-primary underline text-xs">View</a>
                                <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => updateBulkRow(idx, 'meter_photo_url', null)}>
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                            ) : (
                              <MeterPhotoUpload onUpload={(url) => updateBulkRow(idx, 'meter_photo_url', url)} />
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}

            {bulkRows.length === 0 && selectedProperty && billingMonth && !isSelectedMonthLocked && (
              <p className="text-center text-muted-foreground py-8">No live apartments found for this property during {billingMonth}</p>
            )}

            {isSelectedMonthLocked && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                <Lock className="h-4 w-4" />
                This month's readings are locked and cannot be modified.
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
              <Button onClick={() => saveBulkMutation.mutate()} disabled={saveBulkMutation.isPending || bulkRows.length === 0 || isSelectedMonthLocked}>
                {isEditMode ? 'Update Readings' : 'Save All Readings'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk Upload Photos Dialog */}
      <Dialog open={bulkUploadOpen} onOpenChange={(open) => {
        setBulkUploadOpen(open);
        if (!open) {
          // Clean up object URLs on close
          bulkUploadFiles.forEach(f => URL.revokeObjectURL(URL.createObjectURL(f)));
          setBulkUploadFiles([]);
          setBulkUploadResults([]);
        }
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Bulk Upload Meter Photos</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-sm text-muted-foreground">
              Upload multiple meter photos. The system will attempt to read the kWh reading and apartment number from each photo using OCR.
            </p>

            {/* File selection buttons */}
            <div className="flex gap-2">
              <div className="relative">
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleBulkUploadFiles}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  id="bulk-file-picker"
                />
                <Button variant="outline" size="sm" asChild>
                  <label htmlFor="bulk-file-picker" className="cursor-pointer">
                    <Camera className="h-4 w-4 mr-1" /> Select Photos
                  </label>
                </Button>
              </div>
              <div className="relative">
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleBulkUploadFiles}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  id="bulk-camera-capture"
                />
                <Button variant="outline" size="sm" asChild>
                  <label htmlFor="bulk-camera-capture" className="cursor-pointer">
                    <Camera className="h-4 w-4 mr-1" /> Take Photo
                  </label>
                </Button>
              </div>
            </div>

            {/* File preview list */}
            {bulkUploadFiles.length > 0 && (
              <div className="border rounded-lg p-2 max-h-40 overflow-y-auto space-y-1">
                <p className="text-xs font-medium text-muted-foreground mb-1">{bulkUploadFiles.length} photo(s)</p>
                {bulkUploadFiles.map((file, i) => {
                  const previewUrl = URL.createObjectURL(file);
                  return (
                    <div key={`${file.name}_${file.size}_${i}`} className="flex items-center gap-2 p-1 rounded bg-muted/50">
                      <img src={previewUrl} alt={file.name} className="h-8 w-8 object-cover rounded" onLoad={() => URL.revokeObjectURL(previewUrl)} />
                      <span className="text-xs truncate flex-1">{file.name}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5"
                        onClick={() => setBulkUploadFiles(prev => prev.filter((_, idx) => idx !== i))}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}

            {bulkUploadResults.length > 0 && (
              <div className="border rounded-lg p-3 space-y-2 max-h-60 overflow-y-auto">
                <p className="text-sm font-medium">OCR Results:</p>
                {bulkUploadResults.map((r, i) => (
                  <div key={i} className={cn("text-xs p-2 rounded", r.error ? "bg-destructive/10" : "bg-green-50 dark:bg-green-900/20")}>
                    <span className="font-medium">{r.file}</span>
                    {r.error ? (
                      <span className="text-destructive ml-2">— {r.error}</span>
                    ) : (
                      <span className="ml-2">
                        → Apt: <strong>{r.apartment_code || '?'}</strong>, Reading: <strong>{r.reading_value || '?'}</strong> kWh
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setBulkUploadOpen(false)}>
                Cancel
              </Button>
              {bulkUploadResults.length > 0 && (
                <Button variant="outline" size="sm" onClick={() => {/* allow adding more after results */}}>
                  <label htmlFor="bulk-file-picker" className="cursor-pointer">Add More Photos</label>
                </Button>
              )}
              {bulkUploadFiles.length > 0 && (
                <Button onClick={processBulkUpload} disabled={bulkUploading}>
                  {bulkUploading ? 'Processing...' : 'Upload & Scan'}
                </Button>
              )}
              {bulkUploadResults.length > 0 && (
                <Button onClick={applyOcrResults}>
                  Apply Results
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* EB Rate Add/Edit Dialog */}
      <Dialog open={rateOpen} onOpenChange={setRateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{rateForm.id ? 'Edit' : 'Add'} EB Rate</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label>Property (leave empty for all properties)</Label>
              <Select value={rateForm.property_id || 'all'} onValueChange={(v) => setRateForm({ ...rateForm, property_id: v === 'all' ? '' : v })}>
                <SelectTrigger><SelectValue placeholder="All properties" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Properties</SelectItem>
                  {properties.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.property_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Unit Cost (₹) *</Label>
              <Input type="number" step="0.01" placeholder="e.g. 8.5" value={rateForm.unit_cost} onChange={(e) => setRateForm({ ...rateForm, unit_cost: e.target.value })} />
            </div>
            <div>
              <Label>From Date *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !rateForm.from_date && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {rateForm.from_date ? formatDateDisplay(rateForm.from_date) : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={rateForm.from_date ? parseISO(rateForm.from_date) : undefined}
                    onSelect={(date) => setRateForm({ ...rateForm, from_date: date ? format(date, 'yyyy-MM-dd') : '' })}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                    captionLayout="dropdown-buttons"
                    fromYear={2020}
                    toYear={2030}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label>To Date (leave empty for ongoing)</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !rateForm.to_date && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {rateForm.to_date ? formatDateDisplay(rateForm.to_date) : <span>Ongoing</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={rateForm.to_date ? parseISO(rateForm.to_date) : undefined}
                    onSelect={(date) => setRateForm({ ...rateForm, to_date: date ? format(date, 'yyyy-MM-dd') : '' })}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                    captionLayout="dropdown-buttons"
                    fromYear={2020}
                    toYear={2030}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setRateOpen(false)}>Cancel</Button>
              <Button onClick={() => saveRateMutation.mutate()} disabled={saveRateMutation.isPending}>
                {rateForm.id ? 'Update' : 'Create'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MeterPhotoUpload({ onUpload }: { onUpload: (url: string) => void }) {
  const [uploading, setUploading] = useState(false);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: 'File too large', description: 'Max 10MB', variant: 'destructive' });
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `meter-photos/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from('documents').upload(path, file);
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(path);
      onUpload(publicUrl);
    } catch (err: any) {
      toast({ title: 'Upload failed', description: err.message, variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  return (
    <label className="cursor-pointer inline-flex items-center gap-1 text-xs text-primary hover:underline">
      <Camera className="h-3.5 w-3.5" />
      {uploading ? 'Uploading...' : 'Photo'}
      <input type="file" accept="image/*" capture="environment" onChange={handleFile} className="hidden" />
    </label>
  );
}
