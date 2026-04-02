import { useState } from 'react';
import { DoorOpen, Plus, Search } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllRows } from '@/lib/supabase-utils';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import { motion } from 'framer-motion';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { SortableTableHead, useSort } from '@/components/shared/SortableTableHead';
import { ViewToggle } from '@/components/shared/ViewToggle';
import { searchAllFields } from '@/lib/search-utils';
import { CardGridSkeleton } from '@/components/shared/SkeletonLoaders';

const statusOptions = [
  { value: 'Live', label: 'Live' },
  { value: 'In-Progress', label: 'In-Progress' },
  { value: 'Not-Active', label: 'Not-Active' },
  { value: 'Exited', label: 'Exited' },
  { value: 'Signed', label: 'Signed' },
];
const genderOptions = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
];

export default function Apartments() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [listView, setListView] = useState<'grid' | 'list'>('grid');
  const [form, setForm] = useState({ apartment_code: '', property_id: '', floor_number: '', status: 'In-Progress', eb_meter_number: '', owner_id: '', gender_allowed: '' });
  const { sortConfig, handleSort, sortData } = useSort();

  const { data: properties = [] } = useQuery({
    queryKey: ['properties'],
    queryFn: () => fetchAllRows((from, to) => supabase.from('properties').select('id, property_name').range(from, to)),
    enabled: !!profile?.organization_id,
  });

  const { data: owners = [] } = useQuery({
    queryKey: ['owners'],
    queryFn: () => fetchAllRows((from, to) => supabase.from('owners').select('id, full_name').eq('status', 'active').range(from, to)),
    enabled: !!profile?.organization_id,
  });

  const { data: apartments = [], isLoading } = useQuery({
    queryKey: ['apartments'],
    queryFn: () => fetchAllRows((from, to) => supabase.from('apartments').select('*, properties(property_name)').order('created_at', { ascending: false }).range(from, to)),
    enabled: !!profile?.organization_id,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('apartments').insert({
        apartment_code: form.apartment_code,
        property_id: form.property_id,
        floor_number: form.floor_number ? parseInt(form.floor_number) : null,
        status: form.status,
        eb_meter_number: form.eb_meter_number || null,
        owner_id: form.owner_id || null,
        gender_allowed: form.gender_allowed || null,
        organization_id: profile.organization_id,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['apartments'] });
      setOpen(false);
      setForm({ apartment_code: '', property_id: '', floor_number: '', status: 'In-Progress', eb_meter_number: '', owner_id: '', gender_allowed: '' });
      toast({ title: 'Apartment created' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const filtered = apartments.filter((a: any) => searchAllFields(a, search));

  const sorted = sortData(filtered, (item, key) => {
    if (key === 'property') return (item as any).properties?.property_name;
    return item[key];
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Apartments</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage apartments across properties</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button className="gap-2"><Plus className="h-4 w-4" /> Add Apartment</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add New Apartment</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-4">
              <div>
                <Label>Property</Label>
                <Select value={form.property_id} onValueChange={(v) => setForm({...form, property_id: v})}>
                  <SelectTrigger><SelectValue placeholder="Select property" /></SelectTrigger>
                  <SelectContent>{properties.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.property_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Apartment Code</Label><Input placeholder="e.g. A-101" value={form.apartment_code} onChange={(e) => setForm({...form, apartment_code: e.target.value})} /></div>
              <div><Label>Floor Number</Label><Input type="number" value={form.floor_number} onChange={(e) => setForm({...form, floor_number: e.target.value})} /></div>
              <div><Label>EB Meter Number</Label><Input placeholder="e.g. MR-12345" value={form.eb_meter_number} onChange={(e) => setForm({...form, eb_meter_number: e.target.value})} /></div>
              <div>
                <Label>Owner</Label>
                <Select value={form.owner_id} onValueChange={(v) => setForm({...form, owner_id: v})}>
                  <SelectTrigger><SelectValue placeholder="Select owner" /></SelectTrigger>
                  <SelectContent>{owners.map((o: any) => <SelectItem key={o.id} value={o.id}>{o.full_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Gender Allowed</Label>
                <Select value={form.gender_allowed} onValueChange={(v) => setForm({...form, gender_allowed: v})}>
                  <SelectTrigger><SelectValue placeholder="Select gender" /></SelectTrigger>
                  <SelectContent>{genderOptions.map(g => <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({...form, status: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{statusOptions.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <Button className="w-full" onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>Create Apartment</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search apartments..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <ViewToggle view={listView} onChange={setListView} />
      </div>

      {isLoading ? <CardGridSkeleton count={6} /> : filtered.length === 0 ? (
        <Card className="p-12 text-center"><DoorOpen className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" /><p className="text-muted-foreground">No apartments yet.</p></Card>
      ) : listView === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sorted.map((a: any, i: number) => (
            <motion.div key={a.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Card className="hover:shadow-md transition-all">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold">{a.apartment_code}</h3>
                      <p className="text-xs text-muted-foreground mt-1">{(a as any).properties?.property_name}</p>
                      {a.floor_number && <p className="text-xs text-muted-foreground">Floor {a.floor_number}</p>}
                      {a.eb_meter_number && <p className="text-xs text-muted-foreground">Meter: {a.eb_meter_number}</p>}
                    </div>
                    <StatusBadge status={a.status} type="entity" />
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <SortableTableHead label="Apartment" sortKey="apartment_code" sortConfig={sortConfig} onSort={handleSort} />
                <SortableTableHead label="Property" sortKey="property" sortConfig={sortConfig} onSort={handleSort} />
                <SortableTableHead label="Floor" sortKey="floor_number" sortConfig={sortConfig} onSort={handleSort} />
                <SortableTableHead label="EB Meter" sortKey="eb_meter_number" sortConfig={sortConfig} onSort={handleSort} />
                <SortableTableHead label="Status" sortKey="status" sortConfig={sortConfig} onSort={handleSort} />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((a: any) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">{a.apartment_code}</TableCell>
                  <TableCell>{(a as any).properties?.property_name}</TableCell>
                  <TableCell>{a.floor_number || '—'}</TableCell>
                  <TableCell>{a.eb_meter_number || '—'}</TableCell>
                  <TableCell><StatusBadge status={a.status} type="entity" /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
