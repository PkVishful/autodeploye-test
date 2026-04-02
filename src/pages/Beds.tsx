import { useState, useMemo } from 'react';
import { BedDouble, Plus, Search, AlertTriangle } from 'lucide-react';
import { BedHistoryDialog, computeBedOccupancy, getOccupancyColor, findBedDiscrepancies, findTenantDiscrepancies } from '@/components/properties/BedHistoryDialog';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllRows } from '@/lib/supabase-utils';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import { motion } from 'framer-motion';
import { DatePickerField } from '@/components/shared/DatePickerField';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { SortableTableHead, useSort } from '@/components/shared/SortableTableHead';
import { ViewToggle } from '@/components/shared/ViewToggle';
import { searchAllFields } from '@/lib/search-utils';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { CardGridSkeleton } from '@/components/shared/SkeletonLoaders';

const toiletTypeLabels: Record<string, string> = { Common: 'Common', Attached: 'Attached' };
const defaultBedTypes = ['Executive', 'Single', 'Double', 'Triple', 'Quad'];
const statusOptions = [
  { value: 'Live', label: 'Live' },
  { value: 'In-Progress', label: 'In-Progress' },
  { value: 'Not-Active', label: 'Not-Active' },
  { value: 'Exited', label: 'Exited' },
  { value: 'Signed', label: 'Signed' },
];
const formatLabel = (map: Record<string, string>, val: string) => map[val] || val;

const PIE_COLORS = ['hsl(142, 71%, 45%)', 'hsl(220, 70%, 55%)', 'hsl(45, 93%, 47%)', 'hsl(0, 72%, 51%)', 'hsl(25, 95%, 53%)'];

const statusColorMap: Record<string, string> = {
  'Live': PIE_COLORS[0],
  'In-Progress': PIE_COLORS[2],
  'Not-Active': PIE_COLORS[3],
  'Exited': PIE_COLORS[4],
  'Signed': PIE_COLORS[1],
};

const statusBorderMap: Record<string, string> = {
  'Live': 'border-l-emerald-500',
  'In-Progress': 'border-l-yellow-500',
  'Not-Active': 'border-l-red-500',
  'Exited': 'border-l-orange-500',
  'Signed': 'border-l-blue-500',
};

export default function Beds() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [rateOpen, setRateOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [listView, setListView] = useState<'grid' | 'list'>('grid');
  const [showLiveOnly, setShowLiveOnly] = useState(false);
  const [form, setForm] = useState({ bed_code: '', apartment_id: '', bed_type: 'Single', toilet_type: 'Common', status: 'In-Progress' });
  const [rateForm, setRateForm] = useState({ bed_type: 'Single', toilet_type: 'Common', monthly_rate: '', from_date: '', to_date: '', property_id: '' });
  const [editingRateId, setEditingRateId] = useState<string | null>(null);
  const { sortConfig, handleSort, sortData } = useSort();
  const { sortConfig: rateSortConfig, handleSort: rateHandleSort, sortData: rateSortData } = useSort();
  const [bedHistoryOpen, setBedHistoryOpen] = useState(false);
  const [selectedBedForHistory, setSelectedBedForHistory] = useState<any>(null);

  const openBedHistory = (bed: any) => {
    const contractStart = getContractStartDate(bed.apartment_id);
    const propStart = bed.apartments?.properties?.start_date || null;
    setSelectedBedForHistory({ ...bed, contractStartDate: contractStart, propertyStartDate: propStart });
    setBedHistoryOpen(true);
  };

  const { data: bedTypeConfig = [] } = useQuery({
    queryKey: ['bed_type_config'],
    queryFn: () => fetchAllRows((from, to) => supabase.from('bed_type_config' as any).select('*').order('sort_order').range(from, to)),
    enabled: !!profile?.organization_id,
  });
  const bedTypes = bedTypeConfig.length > 0 ? bedTypeConfig.map((bt: any) => bt.name) : defaultBedTypes;

  const { data: apartments = [] } = useQuery({
    queryKey: ['apartments'],
    queryFn: () => fetchAllRows((from, to) => supabase.from('apartments').select('id, apartment_code, property_id, status').range(from, to)),
    enabled: !!profile?.organization_id,
  });

  const { data: properties = [] } = useQuery({
    queryKey: ['properties'],
    queryFn: () => fetchAllRows((from, to) => supabase.from('properties').select('id, property_name, start_date').range(from, to)),
    enabled: !!profile?.organization_id,
  });

  const { data: beds = [], isLoading } = useQuery({
    queryKey: ['beds'],
    queryFn: () => fetchAllRows((from, to) => supabase.from('beds').select('*, apartments(apartment_code, start_date, property_id, properties(property_name, start_date))').order('created_at', { ascending: false }).range(from, to)),
    enabled: !!profile?.organization_id,
  });

  const { data: ownerContracts = [] } = useQuery({
    queryKey: ['owner_contracts_for_beds'],
    queryFn: () => fetchAllRows((from, to) => supabase.from('owner_contracts').select('apartment_id, start_date, status').range(from, to)),
    enabled: !!profile?.organization_id,
  });

  const { data: allBedAllotments = [] } = useQuery({
    queryKey: ['bed-allotments-all'],
    queryFn: () => fetchAllRows((from, to) => supabase.from('tenant_allotments').select('bed_id, tenant_id, onboarding_date, actual_exit_date, staying_status, tenants(full_name, phone), beds(bed_code, apartments(apartment_code))').range(from, to)),
    enabled: !!profile?.organization_id,
  });

  const { data: bedRates = [] } = useQuery({
    queryKey: ['bed_rates'],
    queryFn: () => fetchAllRows((from, to) => supabase.from('bed_rates').select('*, properties(property_name)').order('from_date', { ascending: false }).range(from, to)),
    enabled: !!profile?.organization_id,
  });

  // Helper: get contract start_date for an apartment
  const getContractStartDate = (apartmentId: string | null) => {
    if (!apartmentId) return null;
    const contract = ownerContracts.find((c: any) => c.apartment_id === apartmentId && c.status === 'active');
    return contract?.start_date || null;
  };

  const getOccupancyForBed = (b: any) => {
    const contractStart = getContractStartDate(b.apartment_id);
    const propStart = b.apartments?.properties?.start_date || null;
    return computeBedOccupancy(b.id, allBedAllotments, contractStart, propStart);
  };

  const bedDiscrepancies = useMemo(() => findBedDiscrepancies(beds, allBedAllotments), [beds, allBedAllotments]);
  const tenantDiscrepancies = useMemo(() => findTenantDiscrepancies(allBedAllotments), [allBedAllotments]);
  const totalDiscrepancies = bedDiscrepancies.length + tenantDiscrepancies.length;

  const createBed = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('beds').insert({
        ...form, organization_id: profile.organization_id,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['beds'] }); setOpen(false); toast({ title: 'Bed created' }); },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const rateOverlapCheck = async (excludeId?: string) => {
    const toDateVal = rateForm.to_date || '9999-12-31';
    const { data: existing } = await supabase.from('bed_rates').select('id, from_date, to_date, property_id')
      .eq('bed_type', rateForm.bed_type as any)
      .eq('toilet_type', rateForm.toilet_type as any);
    const overlapping = (existing || []).find((r: any) => {
      if (excludeId && r.id === excludeId) return false;
      if (rateForm.property_id && r.property_id && rateForm.property_id !== r.property_id) return false;
      const rTo = r.to_date || '9999-12-31';
      return r.from_date <= toDateVal && rTo >= rateForm.from_date;
    });
    return overlapping;
  };

  const createRate = useMutation({
    mutationFn: async () => {
      const overlapping = await rateOverlapCheck();
      if (overlapping) {
        const msg = `Overlaps with existing rate (${overlapping.from_date} to ${overlapping.to_date || 'ongoing'})`;
        toast({ title: 'Date overlap', description: msg, variant: 'destructive' });
        throw new Error('Overlap');
      }
      const { error } = await supabase.from('bed_rates').insert({
        ...rateForm, monthly_rate: parseFloat(rateForm.monthly_rate), organization_id: profile.organization_id,
        to_date: rateForm.to_date || null,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['bed_rates'] }); setRateOpen(false); toast({ title: 'Rate added' }); },
    onError: (e: any) => { if (e.message !== 'Overlap') toast({ title: 'Error', description: e.message, variant: 'destructive' }); },
  });

  const updateRate = useMutation({
    mutationFn: async () => {
      if (!editingRateId) throw new Error('No rate selected');
      const overlapping = await rateOverlapCheck(editingRateId);
      if (overlapping) {
        const msg = `Overlaps with existing rate (${overlapping.from_date} to ${overlapping.to_date || 'ongoing'})`;
        toast({ title: 'Date overlap', description: msg, variant: 'destructive' });
        throw new Error('Overlap');
      }
      const { error } = await supabase.from('bed_rates').update({
        bed_type: rateForm.bed_type,
        toilet_type: rateForm.toilet_type,
        monthly_rate: parseFloat(rateForm.monthly_rate),
        from_date: rateForm.from_date,
        to_date: rateForm.to_date || null,
        property_id: rateForm.property_id || null,
      } as any).eq('id', editingRateId);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['bed_rates'] }); setRateOpen(false); setEditingRateId(null); toast({ title: 'Rate updated' }); },
    onError: (e: any) => { if (e.message !== 'Overlap') toast({ title: 'Error', description: e.message, variant: 'destructive' }); },
  });

  const liveAptCount = apartments.filter((a: any) => a.status === 'Live').length;
  const liveBedCount = beds.filter((b: any) => b.status === 'Live').length;

  const aptPieData = useMemo(() => {
    const statusCounts: Record<string, number> = {};
    apartments.forEach((a: any) => { const s = a.status || 'In-Progress'; statusCounts[s] = (statusCounts[s] || 0) + 1; });
    return Object.entries(statusCounts).map(([name, value]) => ({ name, value }));
  }, [apartments]);

  const bedPieData = useMemo(() => {
    const statusCounts: Record<string, number> = {};
    beds.forEach((b: any) => { const s = b.status || 'In-Progress'; statusCounts[s] = (statusCounts[s] || 0) + 1; });
    return Object.entries(statusCounts).map(([name, value]) => ({ name, value }));
  }, [beds]);

  let filtered = beds.filter((b: any) => {
    if (!search) return true;
    const q = search.toLowerCase();
    const occ = getOccupancyForBed(b);
    const searchVals = [
      b.bed_code, b.apartments?.apartment_code, b.apartments?.properties?.property_name,
      b.bed_type, b.toilet_type, b.status, `${occ}%`,
    ].filter(Boolean).map(String);
    return searchVals.some(v => v.toLowerCase().includes(q));
  });
  if (showLiveOnly) filtered = filtered.filter((b: any) => b.status === 'Live');

  // Default sort: apartment_code then bed_code
  const defaultSorted = [...filtered].sort((a: any, b: any) => {
    const aptA = (a.apartments?.apartment_code || '').toLowerCase();
    const aptB = (b.apartments?.apartment_code || '').toLowerCase();
    if (aptA < aptB) return -1;
    if (aptA > aptB) return 1;
    const bedA = (a.bed_code || '').toLowerCase();
    const bedB = (b.bed_code || '').toLowerCase();
    return bedA < bedB ? -1 : bedA > bedB ? 1 : 0;
  });

  const sorted = sortConfig.key ? sortData(defaultSorted, (item, key) => {
    if (key === 'apartment') return (item as any).apartments?.apartment_code;
    if (key === 'occupancy') return getOccupancyForBed(item);
    return item[key];
  }) : defaultSorted;

  const sortedRates = rateSortData(bedRates, (item, key) => {
    if (key === 'property') return (item as any).properties?.property_name;
    return item[key];
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Beds</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage beds and rates</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card className="overflow-hidden border-0 shadow-md bg-gradient-to-br from-card to-muted/30">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-20 h-20 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={aptPieData} dataKey="value" cx="50%" cy="50%" innerRadius={18} outerRadius={35} strokeWidth={2} stroke="hsl(var(--card))">
                    {aptPieData.map((entry, idx) => (
                      <Cell key={idx} fill={statusColorMap[entry.name] || PIE_COLORS[idx % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number, name: string) => [value, name]} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div>
              <p className="text-2xl font-bold">{liveAptCount}<span className="text-base font-normal text-muted-foreground">/{apartments.length}</span></p>
              <p className="text-xs text-muted-foreground font-medium">Live / Total Apartments</p>
              <div className="flex gap-2 mt-1 flex-wrap">
                {aptPieData.map(d => (
                  <span key={d.name} className="text-[9px] flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: statusColorMap[d.name] || '#888' }} />
                    {d.name} ({d.value})
                  </span>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="overflow-hidden border-0 shadow-md bg-gradient-to-br from-card to-muted/30">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-20 h-20 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={bedPieData} dataKey="value" cx="50%" cy="50%" innerRadius={18} outerRadius={35} strokeWidth={2} stroke="hsl(var(--card))">
                    {bedPieData.map((entry, idx) => (
                      <Cell key={idx} fill={statusColorMap[entry.name] || PIE_COLORS[idx % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number, name: string) => [value, name]} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div>
              <p className="text-2xl font-bold">{liveBedCount}<span className="text-base font-normal text-muted-foreground">/{beds.length}</span></p>
              <p className="text-xs text-muted-foreground font-medium">Live / Total Beds</p>
              <div className="flex gap-2 mt-1 flex-wrap">
                {bedPieData.map(d => (
                  <span key={d.name} className="text-[9px] flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: statusColorMap[d.name] || '#888' }} />
                    {d.name} ({d.value})
                  </span>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="beds">
        <TabsList>
          <TabsTrigger value="beds">Beds</TabsTrigger>
          <TabsTrigger value="rates">Bed Rates</TabsTrigger>
          <TabsTrigger value="discrepancies" className="gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5" />
            Discrepancies
            {totalDiscrepancies > 0 && (
              <Badge variant="destructive" className="ml-1 h-5 min-w-5 text-[10px] px-1.5">{totalDiscrepancies}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="beds" className="space-y-4 mt-4">
          <div className="flex items-center gap-3">
            <div className="relative max-w-sm flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search beds..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
            <div className="flex items-center gap-2">
              <Switch id="live-only-beds" checked={showLiveOnly} onCheckedChange={setShowLiveOnly} />
              <Label htmlFor="live-only-beds" className="text-xs cursor-pointer">Live Only</Label>
            </div>
            <ViewToggle view={listView} onChange={setListView} />
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild><Button className="gap-2"><Plus className="h-4 w-4" /> Add Bed</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Add New Bed</DialogTitle></DialogHeader>
                <div className="space-y-4 pt-4">
                  <div>
                    <Label>Apartment</Label>
                    <Select value={form.apartment_id} onValueChange={(v) => setForm({...form, apartment_id: v})}>
                      <SelectTrigger><SelectValue placeholder="Select apartment" /></SelectTrigger>
                      <SelectContent>{apartments.map((a: any) => <SelectItem key={a.id} value={a.id}>{a.apartment_code}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>Unit No</Label><Input placeholder="e.g. B1" value={form.bed_code} onChange={(e) => setForm({...form, bed_code: e.target.value})} /></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Bed Type</Label>
                      <Select value={form.bed_type} onValueChange={(v) => setForm({...form, bed_type: v})}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{bedTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Toilet Type</Label>
                      <Select value={form.toilet_type} onValueChange={(v) => setForm({...form, toilet_type: v})}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{['Common','Attached'].map(t => <SelectItem key={t} value={t}>{toiletTypeLabels[t]}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label>Status</Label>
                    <Select value={form.status} onValueChange={(v) => setForm({...form, status: v})}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{statusOptions.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <Button className="w-full" onClick={() => createBed.mutate()} disabled={createBed.isPending}>Create Bed</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {isLoading ? (
            <CardGridSkeleton count={10} cols="grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10" />
          ) : filtered.length === 0 ? (
            <Card className="p-12 text-center"><BedDouble className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" /><p className="text-muted-foreground">No beds yet.</p></Card>
          ) : listView === 'grid' ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-2">
              {sorted.map((b: any, i: number) => {
                const occ = getOccupancyForBed(b);
                return (
                  <motion.div key={b.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.01 }}>
                    <Card className={`hover:shadow-md transition-all cursor-pointer border-l-2 ${statusBorderMap[b.status] || 'border-l-muted'}`} onClick={() => openBedHistory(b)}>
                      <CardContent className="p-1.5 space-y-0.5">
                        <p className="text-[9px] text-muted-foreground font-medium truncate">{(b as any).apartments?.apartment_code}</p>
                        <p className="font-semibold text-xs leading-tight">{b.bed_code}</p>
                        <div className="flex items-center justify-between">
                          <div className="w-full bg-muted rounded-full h-1">
                            <div className="h-1 rounded-full" style={{ width: `${occ}%`, backgroundColor: getOccupancyColor(occ) }} />
                          </div>
                          <span className="text-[9px] font-semibold ml-1 shrink-0" style={{ color: getOccupancyColor(occ) }}>{occ}%</span>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                     <SortableTableHead label="Apartment" sortKey="apartment" sortConfig={sortConfig} onSort={handleSort} />
                     <SortableTableHead label="Unit No" sortKey="bed_code" sortConfig={sortConfig} onSort={handleSort} />
                     <SortableTableHead label="Bed Type" sortKey="bed_type" sortConfig={sortConfig} onSort={handleSort} />
                     <SortableTableHead label="Toilet" sortKey="toilet_type" sortConfig={sortConfig} onSort={handleSort} />
                     <SortableTableHead label="Status" sortKey="status" sortConfig={sortConfig} onSort={handleSort} />
                     <SortableTableHead label="Occupancy" sortKey="occupancy" sortConfig={sortConfig} onSort={handleSort} />
                   </TableRow>
                 </TableHeader>
                 <TableBody>
                   {sorted.map((b: any) => {
                     const occ = getOccupancyForBed(b);
                     return (
                     <TableRow key={b.id} className="hover:bg-muted/30 cursor-pointer" onClick={() => openBedHistory(b)}>
                       <TableCell className="font-medium">{(b as any).apartments?.apartment_code}</TableCell>
                       <TableCell>{b.bed_code}</TableCell>
                       <TableCell>{b.bed_type}</TableCell>
                       <TableCell>{formatLabel(toiletTypeLabels, b.toilet_type)}</TableCell>
                       <TableCell><StatusBadge status={b.status} type="entity" /></TableCell>
                       <TableCell>
                         <div className="flex items-center gap-2">
                           <div className="w-16 bg-muted rounded-full h-1.5">
                             <div className="h-1.5 rounded-full" style={{ width: `${occ}%`, backgroundColor: getOccupancyColor(occ) }} />
                           </div>
                           <span className="text-xs font-medium" style={{ color: getOccupancyColor(occ) }}>{occ}%</span>
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

        <TabsContent value="rates" className="space-y-4 mt-4">
          <div className="flex justify-end">
            <Dialog open={rateOpen} onOpenChange={(v) => { setRateOpen(v); if (!v) { setEditingRateId(null); setRateForm({ bed_type: 'Single', toilet_type: 'Common', monthly_rate: '', from_date: '', to_date: '', property_id: '' }); } }}>
              <DialogTrigger asChild><Button className="gap-2"><Plus className="h-4 w-4" /> Add Rate</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>{editingRateId ? 'Edit Bed Rate' : 'Add Bed Rate'}</DialogTitle></DialogHeader>
                <div className="space-y-4 pt-4">
                  <div>
                    <Label>Property (optional)</Label>
                    <Select value={rateForm.property_id} onValueChange={(v) => setRateForm({...rateForm, property_id: v})}>
                      <SelectTrigger><SelectValue placeholder="All properties" /></SelectTrigger>
                      <SelectContent>{properties.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.property_name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><Label>Bed Type</Label><Select value={rateForm.bed_type} onValueChange={(v) => setRateForm({...rateForm, bed_type: v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{bedTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select></div>
                    <div><Label>Toilet Type</Label><Select value={rateForm.toilet_type} onValueChange={(v) => setRateForm({...rateForm, toilet_type: v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{['Common','Attached'].map(t => <SelectItem key={t} value={t}>{toiletTypeLabels[t]}</SelectItem>)}</SelectContent></Select></div>
                  </div>
                  <div><Label>Monthly Rate (₹)</Label><Input type="number" value={rateForm.monthly_rate} onChange={(e) => setRateForm({...rateForm, monthly_rate: e.target.value})} /></div>
                  <div className="grid grid-cols-2 gap-4">
                    <DatePickerField label="From Date" value={rateForm.from_date} onChange={(v) => setRateForm({...rateForm, from_date: v})} />
                    <DatePickerField label="To Date" value={rateForm.to_date} onChange={(v) => setRateForm({...rateForm, to_date: v})} />
                  </div>
                  <Button className="w-full" onClick={() => editingRateId ? updateRate.mutate() : createRate.mutate()} disabled={createRate.isPending || updateRate.isPending}>
                    {editingRateId ? 'Update Rate' : 'Add Rate'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <SortableTableHead label="Property" sortKey="property" sortConfig={rateSortConfig} onSort={rateHandleSort} />
                  <SortableTableHead label="Bed Type" sortKey="bed_type" sortConfig={rateSortConfig} onSort={rateHandleSort} />
                  <SortableTableHead label="Toilet" sortKey="toilet_type" sortConfig={rateSortConfig} onSort={rateHandleSort} />
                  <SortableTableHead label="Rate (₹)" sortKey="monthly_rate" sortConfig={rateSortConfig} onSort={rateHandleSort} />
                  <SortableTableHead label="From" sortKey="from_date" sortConfig={rateSortConfig} onSort={rateHandleSort} />
                  <SortableTableHead label="To" sortKey="to_date" sortConfig={rateSortConfig} onSort={rateHandleSort} />
                  <TableHead className="text-xs w-16">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedRates.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No rates configured</TableCell></TableRow>
                ) : sortedRates.map((r: any) => (
                  <TableRow key={r.id} className="hover:bg-muted/30">
                    <TableCell>{(r as any).properties?.property_name || 'All'}</TableCell>
                    <TableCell>{r.bed_type}</TableCell>
                    <TableCell>{formatLabel(toiletTypeLabels, r.toilet_type)}</TableCell>
                    <TableCell>₹{r.monthly_rate}</TableCell>
                    <TableCell>{r.from_date}</TableCell>
                    <TableCell>{r.to_date || '—'}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => {
                        setEditingRateId(r.id);
                        setRateForm({
                          bed_type: r.bed_type,
                          toilet_type: r.toilet_type,
                          monthly_rate: String(r.monthly_rate),
                          from_date: r.from_date,
                          to_date: r.to_date || '',
                          property_id: r.property_id || '',
                        });
                        setRateOpen(true);
                      }}>Edit</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="discrepancies" className="space-y-6 mt-4">
          {/* Rule 1: Beds with multiple active tenants */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              Beds with Multiple Active Tenants ({bedDiscrepancies.length})
            </h3>
            <p className="text-xs text-muted-foreground">These beds have 2 or more tenants marked as Staying, On-Notice, or Booked simultaneously.</p>
          </div>

          {bedDiscrepancies.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground text-sm">No bed-level discrepancies found.</p>
            </Card>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="text-xs">Apartment</TableHead>
                    <TableHead className="text-xs">Unit No</TableHead>
                    <TableHead className="text-xs">Active Tenants</TableHead>
                    <TableHead className="text-xs">Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bedDiscrepancies.map(({ bed, activeAllotments }) => (
                    <TableRow key={bed.id} className="hover:bg-destructive/5">
                      <TableCell className="font-medium text-sm">{bed.apartments?.apartment_code}</TableCell>
                      <TableCell className="text-sm">{bed.bed_code}</TableCell>
                      <TableCell>
                        <Badge variant="destructive" className="text-[10px]">{activeAllotments.length} active</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {activeAllotments.map((a: any, idx: number) => (
                            <div key={idx} className="text-xs flex items-center gap-2">
                              <span className="font-medium">{a.tenants?.full_name || 'Unknown'}</span>
                              <span className="text-muted-foreground">({a.staying_status})</span>
                              <span className="text-muted-foreground">from {a.onboarding_date || '—'}</span>
                            </div>
                          ))}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}

          {/* Rule 2: Tenants with multiple active beds */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              Tenants with Multiple Active Beds ({tenantDiscrepancies.length})
            </h3>
            <p className="text-xs text-muted-foreground">These tenants have 2 or more beds marked as Staying, On-Notice, or Booked simultaneously.</p>
          </div>

          {tenantDiscrepancies.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground text-sm">No tenant-level discrepancies found.</p>
            </Card>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="text-xs">Tenant</TableHead>
                    <TableHead className="text-xs">Phone</TableHead>
                    <TableHead className="text-xs">Active Beds</TableHead>
                    <TableHead className="text-xs">Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tenantDiscrepancies.map(({ tenantId, tenantName, tenantPhone, activeAllotments }) => (
                    <TableRow key={tenantId} className="hover:bg-destructive/5">
                      <TableCell className="font-medium text-sm">{tenantName}</TableCell>
                      <TableCell className="text-sm">{tenantPhone || '—'}</TableCell>
                      <TableCell>
                        <Badge variant="destructive" className="text-[10px]">{activeAllotments.length} beds</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {activeAllotments.map((a: any, idx: number) => (
                            <div key={idx} className="text-xs flex items-center gap-2">
                              <span className="font-medium">{a.beds?.apartments?.apartment_code || '?'}-{a.beds?.bed_code || '?'}</span>
                              <span className="text-muted-foreground">({a.staying_status})</span>
                              <span className="text-muted-foreground">from {a.onboarding_date || '—'}</span>
                            </div>
                          ))}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>
      </Tabs>
      <BedHistoryDialog
        open={bedHistoryOpen}
        onOpenChange={setBedHistoryOpen}
        bed={selectedBedForHistory}
      />
    </div>
  );
}
