import React, { useState, useMemo } from 'react';
import {
  Building2, Plus, Search, MapPin, DoorOpen, BedDouble, ChevronRight, ChevronDown,
  ArrowLeft, Pencil, Trash2, Eye, MoreHorizontal, TrendingUp, Users, IndianRupee, Package, MapPinned, Camera, Filter, AlertTriangle,
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { BedHistoryDialog, computeBedOccupancy, getOccupancyColor, findBedDiscrepancies, findTenantDiscrepancies } from '@/components/properties/BedHistoryDialog';
import { FileUploadField } from '@/components/shared/FileUploadField';
import { Separator } from '@/components/ui/separator';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { SortableTableHead, useSort } from '@/components/shared/SortableTableHead';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllRows } from '@/lib/supabase-utils';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import { motion } from 'framer-motion';
import { DrawerForm } from '@/components/shared/DrawerForm';
import { StateSelect } from '@/components/shared/StateSelect';
import { CitySelect } from '@/components/shared/CitySelect';
import { DatePickerField } from '@/components/shared/DatePickerField';
import { ViewToggle } from '@/components/shared/ViewToggle';
import { format } from 'date-fns';
import { useAuditLog } from '@/hooks/useAuditLog';
import { searchAllFields } from '@/lib/search-utils';
import { CardGridSkeleton } from '@/components/shared/SkeletonLoaders';

const statusColors: Record<string, string> = {
  live: 'bg-success/10 text-success', in_progress: 'bg-warning/10 text-warning',
  inactive: 'bg-muted text-muted-foreground', exited: 'bg-destructive/10 text-destructive', signed: 'bg-info/10 text-info',
};
const statuses = ['Live', 'In-Progress', 'Not-Active', 'Exited', 'Signed'];
const defaultBedTypes = ['Executive', 'Single', 'Double', 'Triple', 'Quad'];
const toiletTypes = ['Common', 'Attached'];
const apartmentTypes = ['Studio', '1BHK', '2BHK', '3BHK', '4BHK'];
const genderOptions = ['male', 'female'];

const PIE_COLORS = ['hsl(142, 71%, 45%)', 'hsl(220, 70%, 55%)', 'hsl(45, 93%, 47%)', 'hsl(0, 72%, 51%)', 'hsl(25, 95%, 53%)'];
const statusColorMap: Record<string, string> = {
  'Live': PIE_COLORS[0], 'In-Progress': PIE_COLORS[2], 'Not-Active': PIE_COLORS[3], 'Exited': PIE_COLORS[4], 'Signed': PIE_COLORS[1],
};
const statusBorderMap: Record<string, string> = {
  'Live': 'border-l-emerald-500', 'In-Progress': 'border-l-yellow-500', 'Not-Active': 'border-l-red-500', 'Exited': 'border-l-orange-500', 'Signed': 'border-l-blue-500',
};

const toiletTypeLabels: Record<string, string> = { Common: 'Common', Attached: 'Attached' };
const statusLabels: Record<string, string> = { 'Live': 'Live', 'In-Active': 'In-Active', 'Exited': 'Exited', 'Signed': 'Signed', 'In-Progress': 'In-Progress', 'Not-Active': 'Not-Active', 'Not-Ready': 'Not-Ready' };
const fl = (map: Record<string, string>, val: string) => map[val] || val;

type View = 'list' | 'property' | 'detail';

const fmtDate = (d: string | null) => {
  if (!d) return '—';
  try { return format(new Date(d), 'dd-MMM-yy'); } catch { return d; }
};

export default function Properties() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const orgId = profile?.organization_id;

  const [view, setView] = useState<View>('list');
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [aptSearch, setAptSearch] = useState('');
  const [bedSearch, setBedSearch] = useState('');
  const [rateSearch, setRateSearch] = useState('');
  const [expandedApts, setExpandedApts] = useState<Set<string>>(new Set());
  const [listView, setListView] = useState<'grid' | 'list'>('grid');
  const [showLiveOnly, setShowLiveOnly] = useState(false);
  const { sortConfig, handleSort, sortData } = useSort();
  const { sortConfig: aptSortConfig, handleSort: aptHandleSort, sortData: aptSortData } = useSort();
  const { sortConfig: bedSortConfig, handleSort: bedHandleSort, sortData: bedSortData } = useSort();
  const { sortConfig: rateSortConfig, handleSort: rateHandleSort, sortData: rateSortData } = useSort();

  // Drawer states
  const [propOpen, setPropOpen] = useState(false);
  const [aptOpen, setAptOpen] = useState(false);
  const [bedOpen, setBedOpen] = useState(false);
  const [rateOpen, setRateOpen] = useState(false);
  const [editPropOpen, setEditPropOpen] = useState(false);
  const [editAptOpen, setEditAptOpen] = useState(false);
  const [editBedOpen, setEditBedOpen] = useState(false);
  const [editRateOpen, setEditRateOpen] = useState(false);
  const [editRateForm, setEditRateForm] = useState<any>({});
  const [bedHistoryOpen, setBedHistoryOpen] = useState(false);
  const [selectedBedForHistory, setSelectedBedForHistory] = useState<any>(null);

  const openBedHistory = (bed: any) => {
    const contractStart = getPropContractStart(bed.apartment_id);
    const propStart = selectedProperty?.start_date || null;
    setSelectedBedForHistory({ ...bed, contractStartDate: contractStart, propertyStartDate: propStart });
    setBedHistoryOpen(true);
  };

  const { log: auditLog } = useAuditLog();

  // Forms
  const emptyPropForm = { property_name: '', address: '', city: '', state: '', pincode: '', status: 'in_progress', gps_latitude: '', gps_longitude: '', photo_urls: [] as string[], start_date: '' };
  const [propForm, setPropForm] = useState(emptyPropForm);
  const [editPropForm, setEditPropForm] = useState<any>({});

  const emptyAptForm = { apartment_code: '', floor_number: '', status: 'In-Progress', apartment_type: '', size_sqft: '', owner_id: '', gender_allowed: '', signing_date: '', start_date: '', end_date: '', property_tax_id: '', property_tax_amount: '', property_tax_frequency: 'yearly', water_tax_id: '', water_tax_amount: '', water_tax_frequency: 'yearly', ownership_doc_url: '' };
  const [aptForm, setAptForm] = useState(emptyAptForm);
  const [editAptForm, setEditAptForm] = useState<any>({});

  const emptyBedForm = { bed_code: '', apartment_id: '', bed_type: 'Single', toilet_type: 'Common', status: 'In-Progress' };
  const [bedForm, setBedForm] = useState(emptyBedForm);
  const [editBedForm, setEditBedForm] = useState<any>({});

  const emptyRateForm = { bed_type: 'Single', toilet_type: 'Common', monthly_rate: '', from_date: '', to_date: '' };
  const [rateForm, setRateForm] = useState(emptyRateForm);

  // Bed type config query
  const { data: bedTypeConfig = [] } = useQuery({
    queryKey: ['bed_type_config'],
    queryFn: () => fetchAllRows((from, to) => supabase.from('bed_type_config' as any).select('*').order('sort_order').range(from, to)),
    enabled: !!orgId,
  });
  const bedTypes = bedTypeConfig.length > 0 ? bedTypeConfig.map((bt: any) => bt.name) : defaultBedTypes;

  // Queries
  const { data: properties = [], isLoading } = useQuery({
    queryKey: ['properties'],
    queryFn: () => fetchAllRows((from, to) => supabase.from('properties').select('*').order('created_at', { ascending: false }).range(from, to)),
    enabled: !!orgId,
  });

  const { data: allApartments = [] } = useQuery({
    queryKey: ['all_apartments'],
    queryFn: () => fetchAllRows((from, to) => supabase.from('apartments').select('id, property_id, status').range(from, to)),
    enabled: !!orgId,
  });

  const { data: allBeds = [] } = useQuery({
    queryKey: ['all_beds'],
    queryFn: () => fetchAllRows((from, to) => supabase.from('beds').select('id, apartment_id, status').range(from, to)),
    enabled: !!orgId,
  });

  const { data: apartments = [] } = useQuery({
    queryKey: ['apartments', selectedPropertyId],
    queryFn: () => fetchAllRows((from, to) => supabase.from('apartments').select('*, owners(full_name)').eq('property_id', selectedPropertyId!).order('apartment_code').range(from, to)),
    enabled: !!selectedPropertyId,
  });

  const { data: beds = [] } = useQuery({
    queryKey: ['beds', selectedPropertyId],
    queryFn: () => fetchAllRows((from, to) => supabase.from('beds').select('*, apartments!inner(apartment_code, property_id, start_date)').eq('apartments.property_id', selectedPropertyId!).order('bed_code').range(from, to)),
    enabled: !!selectedPropertyId,
  });

  const { data: allBedAllotments = [] } = useQuery({
    queryKey: ['bed-allotments-all', selectedPropertyId],
    queryFn: () => fetchAllRows((from, to) => supabase.from('tenant_allotments').select('bed_id, tenant_id, onboarding_date, actual_exit_date, staying_status, tenants(full_name, phone)').range(from, to)),
    enabled: !!selectedPropertyId,
  });

  const { data: bedRates = [] } = useQuery({
    queryKey: ['bed_rates', selectedPropertyId],
    queryFn: async () => {
      let q = supabase.from('bed_rates').select('*').order('from_date', { ascending: false });
      if (selectedPropertyId) q = q.or(`property_id.eq.${selectedPropertyId},property_id.is.null`);
      return fetchAllRows((from, to) => q.range(from, to));
    },
    enabled: !!selectedPropertyId,
  });

  const { data: owners = [] } = useQuery({
    queryKey: ['owners'],
    queryFn: () => fetchAllRows((from, to) => supabase.from('owners').select('id, full_name').range(from, to)),
    enabled: !!orgId,
  });

  const { data: propOwnerContracts = [] } = useQuery({
    queryKey: ['prop-owner-contracts', selectedPropertyId],
    queryFn: () => fetchAllRows((from, to) => supabase.from('owner_contracts').select('apartment_id, start_date, status').eq('property_id', selectedPropertyId!).range(from, to)),
    enabled: !!selectedPropertyId,
  });

  const { data: allotments = [] } = useQuery({
    queryKey: ['allotments', selectedPropertyId],
    queryFn: () => fetchAllRows((from, to) => supabase.from('tenant_allotments').select('*, tenants(full_name)').eq('property_id', selectedPropertyId!).range(from, to)),
    enabled: !!selectedPropertyId && view === 'detail',
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ['invoices', selectedPropertyId],
    queryFn: () => fetchAllRows((from, to) => supabase.from('invoices').select('total_amount, status, billing_month, apartment_id, bed_id').eq('property_id', selectedPropertyId!).range(from, to)),
    enabled: !!selectedPropertyId,
  });

  const { data: propAllocations = [] } = useQuery({
    queryKey: ['prop-asset-allocations', selectedPropertyId],
    queryFn: () => fetchAllRows((from, to) => supabase.from('asset_allocations').select('*, assets(purchase_price, asset_code)').eq('property_id', selectedPropertyId!).range(from, to)),
    enabled: !!selectedPropertyId,
  });

  // Fetch ALL allocations for assets in this property to calculate sharing
  const propAssetIds = [...new Set(propAllocations.map((a: any) => a.asset_id))];
  const { data: allAssetAllocations = [] } = useQuery({
    queryKey: ['all-asset-allocations-for-sharing', propAssetIds.join(',')],
    queryFn: async () => {
      if (propAssetIds.length === 0) return [];
      const { data } = await supabase.from('asset_allocations').select('asset_id, bed_id, allocation_type').in('asset_id', propAssetIds);
      return data || [];
    },
    enabled: propAssetIds.length > 0,
  });

  const selectedProperty = properties.find((p: any) => p.id === selectedPropertyId);

  const getPropContractStart = (apartmentId: string) => {
    const c = propOwnerContracts.find((c: any) => c.apartment_id === apartmentId && c.status === 'active');
    return c?.start_date || null;
  };

  const getPropOccupancy = (b: any) => {
    const contractStart = getPropContractStart(b.apartment_id);
    const propStart = selectedProperty?.start_date || null;
    return computeBedOccupancy(b.id, allBedAllotments, contractStart, propStart);
  };

  // Helper: count apartments/beds per property
  const getPropertyCounts = (propId: string) => {
    const propApts = allApartments.filter((a: any) => a.property_id === propId);
    const aptIds = new Set(propApts.map((a: any) => a.id));
    const propBeds = allBeds.filter((b: any) => aptIds.has(b.apartment_id));
    const liveBeds = propBeds.filter((b: any) => b.status === 'Live');
    return { apartments: propApts.length, beds: propBeds.length, liveBeds: liveBeds.length };
  };

  // Beds per apartment
  const getAptBedCount = (aptId: string) => beds.filter((b: any) => b.apartment_id === aptId).length;
  const getAptLiveBedCount = (aptId: string) => beds.filter((b: any) => b.apartment_id === aptId && b.status === 'Live').length;

  // Mutations
  const createProperty = useMutation({
    mutationFn: async () => {
      const { photo_urls, gps_latitude, gps_longitude, start_date, ...rest } = propForm;
      const payload = {
        ...rest,
        gps_latitude: gps_latitude ? parseFloat(gps_latitude) : null,
        gps_longitude: gps_longitude ? parseFloat(gps_longitude) : null,
        photo_urls: photo_urls.length > 0 ? photo_urls : null,
        start_date: start_date || null,
        organization_id: orgId,
      };
      const { data, error } = await supabase.from('properties').insert(payload as any).select('id').single();
      if (error) throw error;
      auditLog('properties', data.id, 'created', payload);
    },
    onSuccess: (_data, _vars, _ctx) => { qc.invalidateQueries({ queryKey: ['properties'] }); qc.invalidateQueries({ queryKey: ['all_apartments'] }); setPropOpen(false); setPropForm(emptyPropForm); toast({ title: 'Property created' }); },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const updateProperty = useMutation({
    mutationFn: async () => {
      const { id, created_at, organization_id, ...rest } = editPropForm;
      const updatePayload = {
        ...rest,
        gps_latitude: rest.gps_latitude ? parseFloat(rest.gps_latitude) : null,
        gps_longitude: rest.gps_longitude ? parseFloat(rest.gps_longitude) : null,
        photo_urls: rest.photo_urls?.length > 0 ? rest.photo_urls : null,
        start_date: rest.start_date || null,
      };
      const { error } = await supabase.from('properties').update(updatePayload).eq('id', id);
      if (error) throw error;
      auditLog('properties', id, 'updated', updatePayload);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['properties'] }); setEditPropOpen(false); toast({ title: 'Property updated' }); },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const deleteProperty = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('properties').delete().eq('id', id);
      if (error) throw error;
      auditLog('properties', id, 'deleted');
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['properties'] }); setView('list'); setSelectedPropertyId(null); toast({ title: 'Property deleted' }); },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const createApartment = useMutation({
    mutationFn: async () => {
      const payload = {
        apartment_code: aptForm.apartment_code,
        property_id: selectedPropertyId,
        floor_number: aptForm.floor_number ? parseInt(aptForm.floor_number) : null,
        status: aptForm.status,
        apartment_type: aptForm.apartment_type || null,
        size_sqft: aptForm.size_sqft ? parseFloat(aptForm.size_sqft) : null,
        owner_id: aptForm.owner_id || null,
        gender_allowed: aptForm.gender_allowed,
        signing_date: aptForm.signing_date || null,
        start_date: aptForm.start_date || null,
        end_date: aptForm.end_date || null,
        property_tax_id: aptForm.property_tax_id || null,
        property_tax_amount: aptForm.property_tax_amount ? parseFloat(aptForm.property_tax_amount) : 0,
        property_tax_frequency: aptForm.property_tax_frequency || 'yearly',
        water_tax_id: aptForm.water_tax_id || null,
        water_tax_amount: aptForm.water_tax_amount ? parseFloat(aptForm.water_tax_amount) : 0,
        water_tax_frequency: aptForm.water_tax_frequency || 'yearly',
        ownership_doc_url: aptForm.ownership_doc_url || null,
        organization_id: orgId,
      };
      const { data, error } = await supabase.from('apartments').insert(payload as any).select('id').single();
      if (error) throw error;
      auditLog('apartments', data.id, 'created', payload);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['apartments'] }); qc.invalidateQueries({ queryKey: ['all_apartments'] }); setAptOpen(false); setAptForm(emptyAptForm); toast({ title: 'Apartment created' }); },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const updateApartment = useMutation({
    mutationFn: async () => {
      const { id, created_at, organization_id, property_id, owners: _o, ...rest } = editAptForm;
      const { error } = await supabase.from('apartments').update({
        ...rest,
        floor_number: rest.floor_number ? parseInt(rest.floor_number) : null,
        size_sqft: rest.size_sqft ? parseFloat(rest.size_sqft) : null,
        owner_id: rest.owner_id || null,
        signing_date: rest.signing_date || null,
        start_date: rest.start_date || null,
        end_date: rest.end_date || null,
        property_tax_id: rest.property_tax_id || null,
        property_tax_amount: rest.property_tax_amount ? parseFloat(rest.property_tax_amount) : 0,
        property_tax_frequency: rest.property_tax_frequency || 'yearly',
        water_tax_id: rest.water_tax_id || null,
        water_tax_amount: rest.water_tax_amount ? parseFloat(rest.water_tax_amount) : 0,
        water_tax_frequency: rest.water_tax_frequency || 'yearly',
        ownership_doc_url: rest.ownership_doc_url || null,
      }).eq('id', id);
      if (error) throw error;
      auditLog('apartments', id, 'updated', rest);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['apartments'] }); setEditAptOpen(false); toast({ title: 'Apartment updated' }); },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const deleteApartment = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('apartments').delete().eq('id', id);
      if (error) throw error;
      auditLog('apartments', id, 'deleted');
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['apartments'] }); qc.invalidateQueries({ queryKey: ['all_apartments'] }); toast({ title: 'Apartment deleted' }); },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const createBed = useMutation({
    mutationFn: async () => {
      const payload = {
        bed_code: bedForm.bed_code,
        apartment_id: bedForm.apartment_id,
        bed_type: bedForm.bed_type,
        toilet_type: bedForm.toilet_type,
        status: bedForm.status,
        organization_id: orgId,
      };
      const { data, error } = await supabase.from('beds').insert(payload as any).select('id').single();
      if (error) throw error;
      auditLog('beds', data.id, 'created', payload);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['beds'] }); qc.invalidateQueries({ queryKey: ['all_beds'] }); setBedOpen(false); setBedForm(emptyBedForm); toast({ title: 'Bed created' }); },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const updateBed = useMutation({
    mutationFn: async () => {
      const { id, created_at, organization_id, apartments: _a, ...rest } = editBedForm;
      const { error } = await supabase.from('beds').update(rest).eq('id', id);
      if (error) throw error;
      auditLog('beds', id, 'updated', rest);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['beds'] }); setEditBedOpen(false); toast({ title: 'Bed updated' }); },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const deleteBed = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('beds').delete().eq('id', id);
      if (error) throw error;
      auditLog('beds', id, 'deleted');
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['beds'] }); qc.invalidateQueries({ queryKey: ['all_beds'] }); toast({ title: 'Bed deleted' }); },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const createRate = useMutation({
    mutationFn: async () => {
      // Check for overlapping rates
      const toDateVal = rateForm.to_date || '9999-12-31';
      let overlapQuery = supabase.from('bed_rates').select('id')
        .eq('bed_type', rateForm.bed_type as any)
        .eq('toilet_type', rateForm.toilet_type as any)
        .lte('from_date', toDateVal);
      if (selectedPropertyId) overlapQuery = overlapQuery.eq('property_id', selectedPropertyId);
      const { data: overlapping } = await overlapQuery;
      const filtered = (overlapping || []).filter(() => true);
      // Also check to_date >= from_date for overlap
      if (filtered.length > 0) {
        // Re-check with proper overlap logic
        const { data: exactOverlap } = await supabase.from('bed_rates').select('id, from_date, to_date')
          .eq('bed_type', rateForm.bed_type as any)
          .eq('toilet_type', rateForm.toilet_type as any)
          .eq('property_id', selectedPropertyId || '');
        const hasOverlap = (exactOverlap || []).some((r: any) => {
          const rTo = r.to_date || '9999-12-31';
          return r.from_date <= toDateVal && rTo >= rateForm.from_date;
        });
        if (hasOverlap) {
          toast({ title: 'Rate already exists for the specified date range', variant: 'destructive' });
          throw new Error('Overlap');
        }
      }
      const payload = {
        ...rateForm,
        monthly_rate: parseFloat(rateForm.monthly_rate),
        property_id: selectedPropertyId,
        to_date: rateForm.to_date || null,
        organization_id: orgId,
      };
      const { data, error } = await supabase.from('bed_rates').insert(payload as any).select('id').single();
      if (error) throw error;
      auditLog('bed_rates', data.id, 'created', payload);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['bed_rates'] }); setRateOpen(false); setRateForm(emptyRateForm); toast({ title: 'Rate added' }); },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const updateRate = useMutation({
    mutationFn: async () => {
      const { id, created_at, organization_id, property_id, ...rest } = editRateForm;
      // Check for overlapping rates (excluding current rate)
      const toDateVal = rest.to_date || '9999-12-31';
      const { data: existing } = await supabase.from('bed_rates').select('id, from_date, to_date, property_id')
        .eq('bed_type', rest.bed_type as any)
        .eq('toilet_type', rest.toilet_type as any);
      const overlapping = (existing || []).find((r: any) => {
        if (r.id === id) return false;
        if (property_id && r.property_id && property_id !== r.property_id) return false;
        const rTo = r.to_date || '9999-12-31';
        return r.from_date <= toDateVal && rTo >= rest.from_date;
      });
      if (overlapping) {
        const msg = `Overlaps with existing rate (${overlapping.from_date} to ${overlapping.to_date || 'ongoing'})`;
        toast({ title: 'Date overlap', description: msg, variant: 'destructive' });
        throw new Error('Overlap');
      }
      const { error } = await supabase.from('bed_rates').update({
        ...rest,
        monthly_rate: parseFloat(rest.monthly_rate),
        to_date: rest.to_date || null,
      }).eq('id', id);
      if (error) throw error;
      auditLog('bed_rates', id, 'updated', rest);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['bed_rates'] }); setEditRateOpen(false); toast({ title: 'Rate updated' }); },
    onError: (e: any) => { if (e.message !== 'Overlap') toast({ title: 'Error', description: e.message, variant: 'destructive' }); },
  });

  const deleteRate = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('bed_rates').delete().eq('id', id);
      if (error) throw error;
      auditLog('bed_rates', id, 'deleted');
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['bed_rates'] }); toast({ title: 'Rate deleted' }); },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const openProperty = (id: string) => { setSelectedPropertyId(id); setView('property'); };
  const openDetail = () => setView('detail');
  const goBack = () => {
    if (view === 'detail') setView('property');
    else { setView('list'); setSelectedPropertyId(null); }
  };

  const filtered = properties.filter((p: any) => searchAllFields(p, search));

  // Analytics
  const totalBeds = beds.length;
  const liveBeds = beds.filter((b: any) => b.status === 'Live').length;
  const occupiedBeds = allotments.filter((a: any) => a.staying_status === 'staying').length;
  const occupancyRate = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;
  const totalRevenue = invoices.reduce((s: number, i: any) => s + (i.total_amount || 0), 0);

  // Shared cost helper: for bed-level allocations, divide asset cost by number of beds sharing it
  const getAssetShareCount = (assetId: string) => {
    const bedAllocs = allAssetAllocations.filter((a: any) => a.asset_id === assetId && a.allocation_type === 'bed');
    return bedAllocs.length || 1;
  };

  const getSharedAssetCost = (alloc: any) => {
    const price = parseFloat(String(alloc.assets?.purchase_price ?? '0'));
    if (alloc.allocation_type === 'bed') return price / getAssetShareCount(alloc.asset_id);
    return price;
  };

  const totalAssetCost = propAllocations.reduce((s: number, a: any) => {
    return s + getSharedAssetCost(a);
  }, 0);

  // Revenue helpers
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const lastMonthRevenue = invoices.filter((i: any) => i.billing_month === currentMonth).reduce((s: number, i: any) => s + (i.total_amount || 0), 0);

  const getAptAssetCost = (aptId: string) => propAllocations.filter((a: any) => a.apartment_id === aptId).reduce((s: number, a: any) => s + getSharedAssetCost(a), 0);
  const getAptRevenue = (aptId: string) => invoices.filter((i: any) => i.apartment_id === aptId).reduce((s: number, i: any) => s + (i.total_amount || 0), 0);
  const getAptLastMonthRevenue = (aptId: string) => invoices.filter((i: any) => i.apartment_id === aptId && i.billing_month === currentMonth).reduce((s: number, i: any) => s + (i.total_amount || 0), 0);

  // Bed-level helpers
  const getBedAssetCost = (bedId: string) => propAllocations.filter((a: any) => a.bed_id === bedId).reduce((s: number, a: any) => s + getSharedAssetCost(a), 0);
  const getBedRevenue = (bedId: string) => invoices.filter((i: any) => i.bed_id === bedId).reduce((s: number, i: any) => s + (i.total_amount || 0), 0);
  const getBedLastMonthRevenue = (bedId: string) => invoices.filter((i: any) => i.bed_id === bedId && i.billing_month === currentMonth).reduce((s: number, i: any) => s + (i.total_amount || 0), 0);

  const toggleAptExpand = (aptId: string) => {
    setExpandedApts(prev => {
      const next = new Set(prev);
      if (next.has(aptId)) next.delete(aptId);
      else next.add(aptId);
      return next;
    });
  };

  // Gender badge
  const genderBadge = (g: string | null | undefined) => {
    const val = (g || '').toLowerCase();
    if (val === 'male') return <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 text-[10px]">♂ Male</Badge>;
    if (val === 'female') return <Badge variant="secondary" className="bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300 text-[10px]">♀ Female</Badge>;
    return null;
  };

  // ─── FORM FIELD RENDER HELPERS ───
  const renderPropertyFormFields = (f: any, setF: (v: any) => void) => (
    <>
      <div><Label>Property Name *</Label><Input value={f.property_name} onChange={(e) => setF({ ...f, property_name: e.target.value })} /></div>
      <div><Label>Address</Label><Input value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} /></div>
      <StateSelect value={f.state} onChange={(v) => setF({ ...f, state: v, city: '' })} />
      <CitySelect value={f.city} onChange={(v) => setF({ ...f, city: v })} state={f.state} />
      <div><Label>Pincode</Label><Input value={f.pincode} onChange={(e) => setF({ ...f, pincode: e.target.value })} /></div>
      <div>
        <Label>Status</Label>
        <Select value={f.status} onValueChange={(v) => setF({ ...f, status: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{statuses.map(s => <SelectItem key={s} value={s}>{fl(statusLabels, s)}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <DatePickerField label="Start Date (for occupancy calculation)" value={f.start_date || ''} onChange={(v) => setF({ ...f, start_date: v })} />
      <Separator />
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">GPS Location</p>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Latitude</Label><Input type="number" step="any" placeholder="e.g. 13.0827" value={f.gps_latitude || ''} onChange={(e) => setF({ ...f, gps_latitude: e.target.value })} /></div>
        <div><Label>Longitude</Label><Input type="number" step="any" placeholder="e.g. 80.2707" value={f.gps_longitude || ''} onChange={(e) => setF({ ...f, gps_longitude: e.target.value })} /></div>
      </div>
      <Separator />
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Property Photos</p>
      <div className="space-y-2">
        {(f.photo_urls || []).map((url: string, idx: number) => (
          <FileUploadField
            key={idx}
            label={`Photo ${idx + 1}`}
            value={url}
            onChange={(v) => {
              const urls = [...(f.photo_urls || [])];
              if (v) { urls[idx] = v; } else { urls.splice(idx, 1); }
              setF({ ...f, photo_urls: urls });
            }}
            folder="properties/photos"
            accept="image/*"
          />
        ))}
        <Button type="button" variant="outline" size="sm" className="gap-2" onClick={() => setF({ ...f, photo_urls: [...(f.photo_urls || []), ''] })}>
          <Camera className="h-4 w-4" /> Add Photo
        </Button>
      </div>
    </>
  );

  const renderAptFormFields = (f: any, setF: (v: any) => void) => (
    <>
      <div><Label>Apartment Number *</Label><Input placeholder="e.g. A-101" value={f.apartment_code} onChange={(e) => setF({ ...f, apartment_code: e.target.value })} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Floor Number</Label><Input type="number" value={f.floor_number} onChange={(e) => setF({ ...f, floor_number: e.target.value })} /></div>
        <div>
          <Label>Apartment Type</Label>
          <Select value={f.apartment_type} onValueChange={(v) => setF({ ...f, apartment_type: v })}>
            <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
            <SelectContent>{apartmentTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Size (sq.ft)</Label><Input type="number" value={f.size_sqft} onChange={(e) => setF({ ...f, size_sqft: e.target.value })} /></div>
        <div>
          <Label>Owner</Label>
          <Select value={f.owner_id} onValueChange={(v) => setF({ ...f, owner_id: v })}>
            <SelectTrigger><SelectValue placeholder="Select owner" /></SelectTrigger>
            <SelectContent>{owners.map((o: any) => <SelectItem key={o.id} value={o.id}>{o.full_name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Gender Allowed</Label>
          <Select value={f.gender_allowed || ''} onValueChange={(v) => setF({ ...f, gender_allowed: v })}>
            <SelectTrigger><SelectValue placeholder="Select gender" /></SelectTrigger>
            <SelectContent>{genderOptions.map(g => <SelectItem key={g} value={g} className="capitalize">{g}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <Label>Status</Label>
          <Select value={f.status} onValueChange={(v) => setF({ ...f, status: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
             <SelectContent>{statuses.map(s => <SelectItem key={s} value={s}>{fl(statusLabels, s)}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <DatePickerField label="Signing Date" value={f.signing_date} onChange={(v) => setF({ ...f, signing_date: v })} />
        <DatePickerField label="Active Date" value={f.start_date} onChange={(v) => setF({ ...f, start_date: v })} />
        <DatePickerField label="End Date" value={f.end_date} onChange={(v) => setF({ ...f, end_date: v })} />
      </div>
      <Separator />
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tax & Utilities</p>
      <div className="grid grid-cols-3 gap-3">
        <div><Label>Property Tax ID</Label><Input value={f.property_tax_id || ''} onChange={(e) => setF({ ...f, property_tax_id: e.target.value })} /></div>
        <div><Label>Tax Amount (₹)</Label><Input type="number" value={f.property_tax_amount || ''} onChange={(e) => setF({ ...f, property_tax_amount: e.target.value })} /></div>
        <div>
          <Label>Tax Frequency</Label>
          <Select value={f.property_tax_frequency || 'yearly'} onValueChange={(v) => setF({ ...f, property_tax_frequency: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="monthly">Monthly</SelectItem><SelectItem value="quarterly">Quarterly</SelectItem><SelectItem value="half_yearly">Half-Yearly</SelectItem><SelectItem value="yearly">Yearly</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div><Label>Water Tax ID</Label><Input value={f.water_tax_id || ''} onChange={(e) => setF({ ...f, water_tax_id: e.target.value })} /></div>
        <div><Label>Water Tax Amount (₹)</Label><Input type="number" value={f.water_tax_amount || ''} onChange={(e) => setF({ ...f, water_tax_amount: e.target.value })} /></div>
        <div>
          <Label>Water Tax Frequency</Label>
          <Select value={f.water_tax_frequency || 'yearly'} onValueChange={(v) => setF({ ...f, water_tax_frequency: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="monthly">Monthly</SelectItem><SelectItem value="quarterly">Quarterly</SelectItem><SelectItem value="half_yearly">Half-Yearly</SelectItem><SelectItem value="yearly">Yearly</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <Separator />
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Documents</p>
      <FileUploadField label="Property Ownership Document" value={f.ownership_doc_url || null} onChange={(v) => setF({ ...f, ownership_doc_url: v || '' })} folder="apartments/ownership-docs" />
    </>
  );

  const renderBedFormFields = (f: any, setF: (v: any) => void) => (
    <>
      <div>
        <Label>Apartment *</Label>
        <Select value={f.apartment_id} onValueChange={(v) => setF({ ...f, apartment_id: v })}>
          <SelectTrigger><SelectValue placeholder="Select apartment" /></SelectTrigger>
          <SelectContent>{apartments.map((a: any) => <SelectItem key={a.id} value={a.id}>{a.apartment_code}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div><Label>Unit No *</Label><Input placeholder="e.g. B1" value={f.bed_code} onChange={(e) => setF({ ...f, bed_code: e.target.value })} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Bed Type</Label>
          <Select value={f.bed_type} onValueChange={(v) => setF({ ...f, bed_type: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
             <SelectContent>{bedTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <Label>Toilet Type</Label>
          <Select value={f.toilet_type} onValueChange={(v) => setF({ ...f, toilet_type: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
             <SelectContent>{toiletTypes.map(t => <SelectItem key={t} value={t}>{fl(toiletTypeLabels, t)}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <Label>Status</Label>
        <Select value={f.status} onValueChange={(v) => setF({ ...f, status: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{statuses.map(s => <SelectItem key={s} value={s}>{fl(statusLabels, s)}</SelectItem>)}</SelectContent>
        </Select>
      </div>
    </>
  );

  // Live filter helper
  const liveFilterApts = (list: any[]) => showLiveOnly ? list.filter((a: any) => a.status === 'Live') : list;
  const liveFilterBeds = (list: any[]) => showLiveOnly ? list.filter((b: any) => b.status === 'Live') : list;

  // Pie chart data helpers
  const makePieData = (items: any[]) => {
    const counts: Record<string, number> = {};
    items.forEach((i: any) => { const s = i.status || 'In-Progress'; counts[s] = (counts[s] || 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  };

  const renderPieCard = (label: string, liveCount: number, totalCount: number, pieData: { name: string; value: number }[]) => (
    <Card className="overflow-hidden border-0 shadow-md bg-gradient-to-br from-card to-muted/30">
      <CardContent className="p-4 flex items-center gap-4">
        <div className="w-20 h-20 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={pieData} dataKey="value" cx="50%" cy="50%" innerRadius={18} outerRadius={35} strokeWidth={2} stroke="hsl(var(--card))">
                {pieData.map((entry, idx) => (
                  <Cell key={idx} fill={statusColorMap[entry.name] || PIE_COLORS[idx % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value: number, name: string) => [value, name]} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div>
          <p className="text-2xl font-bold">{liveCount}<span className="text-base font-normal text-muted-foreground">/{totalCount}</span></p>
          <p className="text-xs text-muted-foreground font-medium">{label}</p>
          <div className="flex gap-2 mt-1 flex-wrap">
            {pieData.map(d => (
              <span key={d.name} className="text-[9px] flex items-center gap-1">
                <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: statusColorMap[d.name] || '#888' }} />
                {d.name} ({d.value})
              </span>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  // ── LIST VIEW ──
  if (view === 'list') {
    const liveAptCount = allApartments.filter((a: any) => a.status === 'Live').length;
    const liveBedCount = allBeds.filter((b: any) => b.status === 'Live').length;
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Properties</h1>
            <p className="text-sm text-muted-foreground mt-1">Manage all your properties, apartments and beds</p>
          </div>
          <Button className="gap-2" onClick={() => setPropOpen(true)}><Plus className="h-4 w-4" /> Add Property</Button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {renderPieCard('Live / Total Apartments', liveAptCount, allApartments.length, makePieData(allApartments))}
          {renderPieCard('Live / Total Beds', liveBedCount, allBeds.length, makePieData(allBeds))}
        </div>

        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search properties..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <ViewToggle view={listView} onChange={setListView} />
        </div>

        {isLoading ? (
          <CardGridSkeleton count={6} />
        ) : filtered.length === 0 ? (
          <Card className="p-12 text-center">
            <Building2 className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground">No properties yet. Add your first property.</p>
          </Card>
        ) : listView === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((p: any, i: number) => {
              const counts = getPropertyCounts(p.id);
              return (
                <motion.div key={p.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                  <Card className="hover:shadow-md transition-all cursor-pointer group" onClick={() => openProperty(p.id)}>
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold group-hover:text-primary transition-colors">{p.property_name}</h3>
                          {p.address && <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1"><MapPin className="h-3 w-3 shrink-0" /> {p.address}</p>}
                        </div>
                        <StatusBadge status={p.status} type="entity" />
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><DoorOpen className="h-3.5 w-3.5" /> {counts.apartments} apts</span>
                        <span className="flex items-center gap-1"><BedDouble className="h-3.5 w-3.5" /> {counts.liveBeds}/{counts.beds} beds</span>
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
                <TableRow>
                  <SortableTableHead label="Property" sortKey="property_name" sortConfig={sortConfig} onSort={handleSort} />
                  <SortableTableHead label="Address" sortKey="address" sortConfig={sortConfig} onSort={handleSort} />
                  <SortableTableHead label="City" sortKey="city" sortConfig={sortConfig} onSort={handleSort} />
                  <TableHead>Apartments</TableHead>
                  <TableHead>Beds</TableHead>
                  <SortableTableHead label="Status" sortKey="status" sortConfig={sortConfig} onSort={handleSort} />
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortData(filtered).map((p: any) => {
                  const counts = getPropertyCounts(p.id);
                  return (
                    <TableRow key={p.id} className="cursor-pointer hover:bg-muted/50" onClick={() => openProperty(p.id)}>
                      <TableCell className="font-medium">{p.property_name}</TableCell>
                      <TableCell className="text-sm">{p.address || '—'}</TableCell>
                      <TableCell>{p.city || '—'}</TableCell>
                      <TableCell>{counts.apartments}</TableCell>
                      <TableCell>{counts.liveBeds}/{counts.beds}</TableCell>
                      <TableCell><StatusBadge status={p.status} type="entity" /></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        )}

        {/* Create Property Drawer */}
        <DrawerForm open={propOpen} onOpenChange={setPropOpen} title="Add New Property">
          {renderPropertyFormFields(propForm, setPropForm)}
          <Button className="w-full" onClick={() => createProperty.mutate()} disabled={createProperty.isPending}>Create Property</Button>
        </DrawerForm>
      </div>
    );
  }

  // ── PROPERTY VIEW ──
  if (view === 'property') {
    const liveAptCount = apartments.filter((a: any) => a.status === 'Live').length;
    const liveBedCount = beds.filter((b: any) => b.status === 'Live').length;
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={goBack}><ArrowLeft className="h-4 w-4" /></Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold tracking-tight">{selectedProperty?.property_name}</h1>
            <p className="text-sm text-muted-foreground">{[selectedProperty?.address, selectedProperty?.city].filter(Boolean).join(', ')}</p>
          </div>
          <Button variant="outline" size="sm" className="gap-2" onClick={openDetail}><Eye className="h-4 w-4" /> Analytics</Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="outline" size="icon"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => { setEditPropForm({ ...selectedProperty, start_date: selectedProperty?.start_date || '' }); setEditPropOpen(true); }}><Pencil className="h-4 w-4 mr-2" /> Edit Property</DropdownMenuItem>
              <DropdownMenuItem className="text-destructive" onClick={() => { if (confirm('Delete this property?')) deleteProperty.mutate(selectedPropertyId!); }}><Trash2 className="h-4 w-4 mr-2" /> Delete Property</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <Tabs defaultValue="apartments">
          <div className="flex items-center justify-between">
            <TabsList>
              <TabsTrigger value="apartments" className="gap-2"><DoorOpen className="h-4 w-4" /> Apartments ({apartments.length})</TabsTrigger>
              <TabsTrigger value="beds" className="gap-2"><BedDouble className="h-4 w-4" /> Beds ({beds.length})</TabsTrigger>
              <TabsTrigger value="rates">Bed Rates</TabsTrigger>
              <TabsTrigger value="discrepancies" className="gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5" />
                Discrepancies
                {(() => {
                  const bd = findBedDiscrepancies(beds, allBedAllotments);
                  const td = findTenantDiscrepancies(allBedAllotments);
                  const cd = apartments.filter((a: any) => a.status === 'Live' && a.end_date && new Date(a.end_date) < new Date());
                  const total = bd.length + td.length + cd.length;
                  return total > 0 ? <Badge variant="destructive" className="ml-1 h-5 min-w-5 text-[10px] px-1.5">{total}</Badge> : null;
                })()}
              </TabsTrigger>
            </TabsList>
            <ViewToggle view={listView} onChange={setListView} />
          </div>

          {/* APARTMENTS TAB */}
          <TabsContent value="apartments" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              {renderPieCard('Live / Total Apartments', liveAptCount, apartments.length, makePieData(apartments))}
              {renderPieCard('Live / Total Beds', liveBedCount, beds.length, makePieData(beds))}
            </div>
            <div className="flex items-center gap-3">
              <div className="relative max-w-sm flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search apartments..." value={aptSearch} onChange={(e) => setAptSearch(e.target.value)} className="pl-9" />
              </div>
              <div className="flex items-center gap-2">
                <Switch id="live-only-apt" checked={showLiveOnly} onCheckedChange={setShowLiveOnly} />
                <Label htmlFor="live-only-apt" className="text-xs cursor-pointer">Live Only</Label>
              </div>
              <Button className="gap-2" onClick={() => setAptOpen(true)}><Plus className="h-4 w-4" /> Add Apartment</Button>
            </div>

            {(() => {
              const filteredApts = liveFilterApts(apartments.filter((a: any) => searchAllFields(a, aptSearch)));
              const sortedApts = aptSortData(filteredApts, (item, key) => {
                if (key === 'owner') return (item as any).owners?.full_name;
                return item[key];
              });

              return filteredApts.length === 0 ? (
                <Card className="p-12 text-center"><DoorOpen className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" /><p className="text-muted-foreground">No apartments found.</p></Card>
              ) : listView === 'grid' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {sortedApts.map((a: any, i: number) => (
                    <motion.div key={a.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                      <Card className="hover:shadow-md transition-all">
                        <CardContent className="p-5">
                          <div className="flex items-start justify-between">
                            <div>
                              <h3 className="font-semibold">{a.apartment_code}</h3>
                              <p className="text-xs text-muted-foreground mt-1">
                                {[a.apartment_type, a.size_sqft ? `${a.size_sqft} sq.ft` : null, a.floor_number ? `Floor ${a.floor_number}` : null].filter(Boolean).join(' · ') || 'No details'}
                              </p>
                              {(a as any).owners?.full_name && <p className="text-xs text-muted-foreground">Owner: {(a as any).owners.full_name}</p>}
                              <div className="flex items-center gap-2 mt-2">
                                <span className="text-xs text-muted-foreground flex items-center gap-1"><BedDouble className="h-3 w-3" /> {getAptLiveBedCount(a.id)}/{getAptBedCount(a.id)} beds</span>
                                {genderBadge(a.gender_allowed)}
                              </div>
                              <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground">
                                <span><Package className="h-3 w-3 inline mr-0.5" />₹{getAptAssetCost(a.id).toLocaleString()}</span>
                                <span><IndianRupee className="h-3 w-3 inline mr-0.5" />₹{getAptRevenue(a.id).toLocaleString()}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <StatusBadge status={a.status} type="entity" />
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => { setEditAptForm({ ...a, floor_number: a.floor_number?.toString() || '', size_sqft: a.size_sqft?.toString() || '', owner_id: a.owner_id || '', gender_allowed: a.gender_allowed || '', signing_date: a.signing_date || '', start_date: a.start_date || '', end_date: a.end_date || '' }); setEditAptOpen(true); }}><Pencil className="h-4 w-4 mr-2" /> Edit</DropdownMenuItem>
                                  <DropdownMenuItem className="text-destructive" onClick={() => { if (confirm('Delete?')) deleteApartment.mutate(a.id); }}><Trash2 className="h-4 w-4 mr-2" /> Delete</DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
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
                        <TableHead className="w-8"></TableHead>
                        <SortableTableHead label="Apartment" sortKey="apartment_code" sortConfig={aptSortConfig} onSort={aptHandleSort} />
                        <SortableTableHead label="Type" sortKey="apartment_type" sortConfig={aptSortConfig} onSort={aptHandleSort} />
                        <SortableTableHead label="Floor" sortKey="floor_number" sortConfig={aptSortConfig} onSort={aptHandleSort} />
                        <SortableTableHead label="Owner" sortKey="owner" sortConfig={aptSortConfig} onSort={aptHandleSort} />
                        <TableHead>Beds</TableHead>
                        <TableHead>Asset Cost</TableHead>
                        <TableHead>Rev (Month)</TableHead>
                        <TableHead>Rev (Total)</TableHead>
                        <SortableTableHead label="Status" sortKey="status" sortConfig={aptSortConfig} onSort={aptHandleSort} />
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedApts.map((a: any) => {
                        const aptBeds = liveFilterBeds(beds.filter((b: any) => b.apartment_id === a.id));
                        const isExpanded = expandedApts.has(a.id);
                        return (
                          <React.Fragment key={a.id}>
                            <TableRow key={a.id} className="cursor-pointer" onClick={() => toggleAptExpand(a.id)}>
                              <TableCell className="w-8 px-2">
                                {aptBeds.length > 0 && (isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />)}
                              </TableCell>
                              <TableCell className="font-medium">{a.apartment_code}</TableCell>
                              <TableCell>{a.apartment_type || '—'}</TableCell>
                              <TableCell>{a.floor_number || '—'}</TableCell>
                              <TableCell>{(a as any).owners?.full_name || '—'}</TableCell>
                              <TableCell>{getAptLiveBedCount(a.id)}/{getAptBedCount(a.id)}</TableCell>
                              <TableCell>₹{getAptAssetCost(a.id).toLocaleString()}</TableCell>
                              <TableCell>₹{getAptLastMonthRevenue(a.id).toLocaleString()}</TableCell>
                              <TableCell>₹{getAptRevenue(a.id).toLocaleString()}</TableCell>
                              <TableCell><StatusBadge status={a.status} type="entity" /></TableCell>
                              <TableCell onClick={(e) => e.stopPropagation()}>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="h-3.5 w-3.5" /></Button></DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => { setEditAptForm({ ...a, floor_number: a.floor_number?.toString() || '', size_sqft: a.size_sqft?.toString() || '', owner_id: a.owner_id || '', gender_allowed: a.gender_allowed || '', signing_date: a.signing_date || '', start_date: a.start_date || '', end_date: a.end_date || '' }); setEditAptOpen(true); }}><Pencil className="h-4 w-4 mr-2" /> Edit</DropdownMenuItem>
                                    <DropdownMenuItem className="text-destructive" onClick={() => { if (confirm('Delete?')) deleteApartment.mutate(a.id); }}><Trash2 className="h-4 w-4 mr-2" /> Delete</DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </TableCell>
                            </TableRow>
                            {isExpanded && aptBeds.map((b: any) => (
                              <TableRow key={b.id} className="bg-muted/30 cursor-pointer" onClick={() => openBedHistory(b)}>
                                <TableCell></TableCell>
                                <TableCell className="pl-8 text-xs">
                                  <div className="flex items-center gap-1.5">
                                    <BedDouble className="h-3 w-3 text-muted-foreground" />
                                    {b.bed_code}
                                  </div>
                                </TableCell>
                                <TableCell className="text-xs">{b.bed_type} · {fl(toiletTypeLabels, b.toilet_type)}</TableCell>
                                <TableCell></TableCell>
                                <TableCell></TableCell>
                                <TableCell></TableCell>
                                <TableCell className="text-xs">₹{getBedAssetCost(b.id).toLocaleString()}</TableCell>
                                <TableCell className="text-xs">₹{getBedLastMonthRevenue(b.id).toLocaleString()}</TableCell>
                                <TableCell className="text-xs">₹{getBedRevenue(b.id).toLocaleString()}</TableCell>
                                <TableCell><StatusBadge status={b.status} type="entity" /></TableCell>
                                <TableCell onClick={(e) => e.stopPropagation()}>
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-6 w-6"><MoreHorizontal className="h-3 w-3" /></Button></DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openBedHistory(b); }}><Eye className="h-4 w-4 mr-2" /> View History</DropdownMenuItem>
                                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setEditBedForm({ ...b }); setEditBedOpen(true); }}><Pencil className="h-4 w-4 mr-2" /> Edit</DropdownMenuItem>
                                      <DropdownMenuItem className="text-destructive" onClick={(e) => { e.stopPropagation(); if (confirm('Delete?')) deleteBed.mutate(b.id); }}><Trash2 className="h-4 w-4 mr-2" /> Delete</DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </TableCell>
                              </TableRow>
                            ))}
                          </React.Fragment>
                        );
                      })}
                    </TableBody>
                  </Table>
                </Card>
              );
            })()}
          </TabsContent>

          {/* BEDS TAB */}
          <TabsContent value="beds" className="space-y-4 mt-4">
            <div className="flex items-center gap-3">
              <div className="relative max-w-sm flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search beds..." value={bedSearch} onChange={(e) => setBedSearch(e.target.value)} className="pl-9" />
              </div>
              <div className="flex items-center gap-2">
                <Switch id="live-only-bed" checked={showLiveOnly} onCheckedChange={setShowLiveOnly} />
                <Label htmlFor="live-only-bed" className="text-xs cursor-pointer">Live Only</Label>
              </div>
              <Button className="gap-2" onClick={() => setBedOpen(true)}><Plus className="h-4 w-4" /> Add Bed</Button>
            </div>

            {(() => {
              const filteredBeds = liveFilterBeds(beds.filter((b: any) => searchAllFields(b, bedSearch)));
              const sortedBeds = bedSortData(filteredBeds, (item, key) => {
                if (key === 'apartment') return (item as any).apartments?.apartment_code;
                return item[key];
              });

              return filteredBeds.length === 0 ? (
                <Card className="p-12 text-center"><BedDouble className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" /><p className="text-muted-foreground">No beds found.</p></Card>
              ) : listView === 'grid' ? (
                <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-2">
                  {sortedBeds.map((b: any, i: number) => (
                    <motion.div key={b.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.02 }}>
                      <Card className={`hover:shadow-md transition-all group relative border-l-[3px] cursor-pointer ${statusBorderMap[b.status] || 'border-l-muted'}`} onClick={() => openBedHistory(b)}>
                        <CardContent className="p-2.5 text-center">
                          <p className="text-[10px] text-muted-foreground font-medium">{(b as any).apartments?.apartment_code}</p>
                          <p className="font-semibold text-xs">{b.bed_code}</p>
                          <p className="text-[9px] text-muted-foreground">{b.bed_type} · {fl(toiletTypeLabels, b.toilet_type)}</p>
                          <div className="mt-1"><StatusBadge status={b.status} type="entity" /></div>
                          {(() => {
                            const occ = getPropOccupancy(b);
                            return (
                              <div className="mt-1.5">
                                <div className="w-full bg-muted rounded-full h-1.5">
                                  <div className="h-1.5 rounded-full transition-all" style={{ width: `${occ}%`, backgroundColor: getOccupancyColor(occ) }} />
                                </div>
                                <p className="text-[9px] font-medium mt-0.5" style={{ color: getOccupancyColor(occ) }}>{occ}%</p>
                              </div>
                            );
                          })()}
                          <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-5 w-5"><MoreHorizontal className="h-3 w-3" /></Button></DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openBedHistory(b); }}><Eye className="h-4 w-4 mr-2" /> View History</DropdownMenuItem>
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setEditBedForm({ ...b }); setEditBedOpen(true); }}><Pencil className="h-4 w-4 mr-2" /> Edit</DropdownMenuItem>
                                <DropdownMenuItem className="text-destructive" onClick={(e) => { e.stopPropagation(); if (confirm('Delete?')) deleteBed.mutate(b.id); }}><Trash2 className="h-4 w-4 mr-2" /> Delete</DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
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
                      <TableRow className="bg-muted/50">
                        <SortableTableHead label="Apartment" sortKey="apartment" sortConfig={bedSortConfig} onSort={bedHandleSort} />
                        <SortableTableHead label="Unit No" sortKey="bed_code" sortConfig={bedSortConfig} onSort={bedHandleSort} />
                        <SortableTableHead label="Bed Type" sortKey="bed_type" sortConfig={bedSortConfig} onSort={bedHandleSort} />
                        <SortableTableHead label="Toilet" sortKey="toilet_type" sortConfig={bedSortConfig} onSort={bedHandleSort} />
                        <SortableTableHead label="Status" sortKey="status" sortConfig={bedSortConfig} onSort={bedHandleSort} />
                        <TableHead className="text-xs">Occupancy</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedBeds.map((b: any) => {
                        const occ = getPropOccupancy(b);
                        return (
                        <TableRow key={b.id} className="hover:bg-muted/30 cursor-pointer" onClick={() => openBedHistory(b)}>
                          <TableCell className="font-medium">{(b as any).apartments?.apartment_code}</TableCell>
                          <TableCell>{b.bed_code}</TableCell>
                           <TableCell>{b.bed_type}</TableCell>
                           <TableCell>{fl(toiletTypeLabels, b.toilet_type)}</TableCell>
                           <TableCell><StatusBadge status={b.status} type="entity" /></TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="w-16 bg-muted rounded-full h-1.5">
                                <div className="h-1.5 rounded-full" style={{ width: `${occ}%`, backgroundColor: getOccupancyColor(occ) }} />
                              </div>
                              <span className="text-xs font-medium" style={{ color: getOccupancyColor(occ) }}>{occ}%</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="h-3.5 w-3.5" /></Button></DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openBedHistory(b); }}><Eye className="h-4 w-4 mr-2" /> View History</DropdownMenuItem>
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setEditBedForm({ ...b }); setEditBedOpen(true); }}><Pencil className="h-4 w-4 mr-2" /> Edit</DropdownMenuItem>
                                <DropdownMenuItem className="text-destructive" onClick={(e) => { e.stopPropagation(); if (confirm('Delete?')) deleteBed.mutate(b.id); }}><Trash2 className="h-4 w-4 mr-2" /> Delete</DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </Card>
              );
            })()}
          </TabsContent>

          {/* RATES TAB */}
          <TabsContent value="rates" className="space-y-4 mt-4">
            <div className="flex items-center gap-3">
              <div className="relative max-w-sm flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search rates..." value={rateSearch} onChange={(e) => setRateSearch(e.target.value)} className="pl-9" />
              </div>
              <Button className="gap-2" onClick={() => setRateOpen(true)}><Plus className="h-4 w-4" /> Add Rate</Button>
            </div>
            {(() => {
              const filteredRates = bedRates.filter((r: any) => searchAllFields(r, rateSearch));
              const sortedRates = rateSortData(filteredRates);

              return (
                <Card>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <SortableTableHead label="Bed Type" sortKey="bed_type" sortConfig={rateSortConfig} onSort={rateHandleSort} />
                        <SortableTableHead label="Toilet" sortKey="toilet_type" sortConfig={rateSortConfig} onSort={rateHandleSort} />
                        <SortableTableHead label="Rate (₹)" sortKey="monthly_rate" sortConfig={rateSortConfig} onSort={rateHandleSort} />
                        <SortableTableHead label="From" sortKey="from_date" sortConfig={rateSortConfig} onSort={rateHandleSort} />
                        <SortableTableHead label="To" sortKey="to_date" sortConfig={rateSortConfig} onSort={rateHandleSort} />
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedRates.length === 0 ? (
                        <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No rates configured</TableCell></TableRow>
                      ) : sortedRates.map((r: any) => (
                        <TableRow key={r.id}>
                           <TableCell>{r.bed_type}</TableCell>
                           <TableCell>{fl(toiletTypeLabels, r.toilet_type)}</TableCell>
                          <TableCell>₹{r.monthly_rate}</TableCell>
                          <TableCell>{fmtDate(r.from_date)}</TableCell>
                          <TableCell>{fmtDate(r.to_date)}</TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="h-3.5 w-3.5" /></Button></DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => { setEditRateForm({ ...r, monthly_rate: r.monthly_rate?.toString() || '', from_date: r.from_date || '', to_date: r.to_date || '' }); setEditRateOpen(true); }}><Pencil className="h-4 w-4 mr-2" /> Edit</DropdownMenuItem>
                                <DropdownMenuItem className="text-destructive" onClick={() => { if (confirm('Delete rate?')) deleteRate.mutate(r.id); }}><Trash2 className="h-4 w-4 mr-2" /> Delete</DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Card>
              );
            })()}
          </TabsContent>

          {/* DISCREPANCIES TAB */}
          <TabsContent value="discrepancies" className="space-y-6 mt-4">
            {(() => {
              const bedDisc = findBedDiscrepancies(beds, allBedAllotments);
              const tenantDisc = findTenantDiscrepancies(allBedAllotments);
              return (
                <>
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-destructive" />
                      Beds with Multiple Active Tenants ({bedDisc.length})
                    </h3>
                    <p className="text-xs text-muted-foreground">These beds have 2 or more tenants marked as Staying, On-Notice, or Booked simultaneously.</p>
                  </div>

                  {bedDisc.length === 0 ? (
                    <Card className="p-8 text-center">
                      <p className="text-muted-foreground text-sm">No bed-level discrepancies found.</p>
                    </Card>
                  ) : (
                    <Card>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Apartment</TableHead>
                            <TableHead>Bed</TableHead>
                            <TableHead>Tenant</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Onboarding</TableHead>
                            <TableHead>Exit Date</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {bedDisc.map(({ bed, activeAllotments }: any) =>
                            activeAllotments.map((a: any, i: number) => (
                              <TableRow key={`${bed.id}-${i}`} className="hover:bg-destructive/5">
                                {i === 0 && (
                                  <>
                                    <TableCell rowSpan={activeAllotments.length} className="font-medium">{bed.apartments?.apartment_code}</TableCell>
                                    <TableCell rowSpan={activeAllotments.length}>{bed.bed_code}</TableCell>
                                  </>
                                )}
                                <TableCell>{a.tenants?.full_name || '—'}</TableCell>
                                <TableCell><Badge variant="destructive">{a.staying_status}</Badge></TableCell>
                                <TableCell>{a.onboarding_date ? format(new Date(a.onboarding_date), 'dd-MMM-yy') : '—'}</TableCell>
                                <TableCell>{a.actual_exit_date ? format(new Date(a.actual_exit_date), 'dd-MMM-yy') : '—'}</TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </Card>
                  )}

                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-destructive" />
                      Tenants with Multiple Active Beds ({tenantDisc.length})
                    </h3>
                    <p className="text-xs text-muted-foreground">These tenants have 2 or more beds marked as Staying, On-Notice, or Booked simultaneously.</p>
                  </div>

                  {tenantDisc.length === 0 ? (
                    <Card className="p-8 text-center">
                      <p className="text-muted-foreground text-sm">No tenant-level discrepancies found.</p>
                    </Card>
                  ) : (
                    <Card>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Tenant</TableHead>
                            <TableHead>Phone</TableHead>
                            <TableHead>Active Beds</TableHead>
                            <TableHead>Details</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {tenantDisc.map(({ tenantId, tenantName, tenantPhone, activeAllotments }) => (
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
                  {/* CONTRACT EXPIRY DISCREPANCIES */}
                  {(() => {
                    const contractDisc = apartments.filter((a: any) => a.status === 'Live' && a.end_date && new Date(a.end_date) < new Date());
                    return (
                      <>
                        <div className="space-y-2 mt-4">
                          <h3 className="text-sm font-semibold flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-yellow-600" />
                            Contract Expired — Renewal Required ({contractDisc.length})
                          </h3>
                          <p className="text-xs text-muted-foreground">These apartments are marked as Live but their contract end date has passed. Please renew the contract.</p>
                        </div>
                        {contractDisc.length === 0 ? (
                          <Card className="p-8 text-center">
                            <p className="text-muted-foreground text-sm">No contract expiry issues found.</p>
                          </Card>
                        ) : (
                          <Card>
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Apartment</TableHead>
                                  <TableHead>Contract End Date</TableHead>
                                  <TableHead>Status</TableHead>
                                  <TableHead>Action Required</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {contractDisc.map((apt: any) => (
                                  <TableRow key={apt.id} className="hover:bg-yellow-50 dark:hover:bg-yellow-950/20">
                                    <TableCell className="font-medium">{apt.apartment_code}</TableCell>
                                    <TableCell>{format(new Date(apt.end_date), 'dd-MMM-yyyy')}</TableCell>
                                    <TableCell><Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">Expired</Badge></TableCell>
                                    <TableCell className="text-sm text-muted-foreground">Contract expired — please renew</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </Card>
                        )}
                      </>
                    );
                  })()}
                </>
              );
            })()}
          </TabsContent>
        </Tabs>

        {/* Drawers */}
        <DrawerForm open={editPropOpen} onOpenChange={setEditPropOpen} title="Edit Property">
          {renderPropertyFormFields(editPropForm, setEditPropForm)}
          <Button className="w-full" onClick={() => updateProperty.mutate()} disabled={updateProperty.isPending}>Update Property</Button>
        </DrawerForm>

        <DrawerForm open={aptOpen} onOpenChange={setAptOpen} title={`Add Apartment to ${selectedProperty?.property_name}`}>
          {renderAptFormFields(aptForm, setAptForm)}
          <Button className="w-full" onClick={() => createApartment.mutate()} disabled={createApartment.isPending}>Create Apartment</Button>
        </DrawerForm>

        <DrawerForm open={editAptOpen} onOpenChange={setEditAptOpen} title="Edit Apartment">
          {renderAptFormFields(editAptForm, setEditAptForm)}
          <Button className="w-full" onClick={() => updateApartment.mutate()} disabled={updateApartment.isPending}>Update Apartment</Button>
        </DrawerForm>

        <DrawerForm open={bedOpen} onOpenChange={setBedOpen} title="Add Bed">
          {renderBedFormFields(bedForm, setBedForm)}
          <Button className="w-full" onClick={() => createBed.mutate()} disabled={createBed.isPending}>Create Bed</Button>
        </DrawerForm>

        <DrawerForm open={editBedOpen} onOpenChange={setEditBedOpen} title="Edit Bed">
          {renderBedFormFields(editBedForm, setEditBedForm)}
          <Button className="w-full" onClick={() => updateBed.mutate()} disabled={updateBed.isPending}>Update Bed</Button>
        </DrawerForm>

        <DrawerForm open={rateOpen} onOpenChange={setRateOpen} title={`Add Bed Rate for ${selectedProperty?.property_name}`}>
          <div className="grid grid-cols-2 gap-3">
             <div><Label>Bed Type</Label><Select value={rateForm.bed_type} onValueChange={(v) => setRateForm({ ...rateForm, bed_type: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{bedTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select></div>
             <div><Label>Toilet Type</Label><Select value={rateForm.toilet_type} onValueChange={(v) => setRateForm({ ...rateForm, toilet_type: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{toiletTypes.map(t => <SelectItem key={t} value={t}>{fl(toiletTypeLabels, t)}</SelectItem>)}</SelectContent></Select></div>
          </div>
          <div><Label>Monthly Rate (₹)</Label><Input type="number" value={rateForm.monthly_rate} onChange={(e) => setRateForm({ ...rateForm, monthly_rate: e.target.value })} /></div>
          <DatePickerField label="From Date" value={rateForm.from_date} onChange={(v) => setRateForm({ ...rateForm, from_date: v })} required />
          <DatePickerField label="To Date" value={rateForm.to_date} onChange={(v) => setRateForm({ ...rateForm, to_date: v })} />
          <Button className="w-full" onClick={() => createRate.mutate()} disabled={createRate.isPending}>Add Rate</Button>
        </DrawerForm>

        <DrawerForm open={editRateOpen} onOpenChange={setEditRateOpen} title="Edit Bed Rate">
          <div className="grid grid-cols-2 gap-3">
             <div><Label>Bed Type</Label><Select value={editRateForm.bed_type || 'Single'} onValueChange={(v) => setEditRateForm({ ...editRateForm, bed_type: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{bedTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select></div>
             <div><Label>Toilet Type</Label><Select value={editRateForm.toilet_type || 'Common'} onValueChange={(v) => setEditRateForm({ ...editRateForm, toilet_type: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{toiletTypes.map(t => <SelectItem key={t} value={t}>{fl(toiletTypeLabels, t)}</SelectItem>)}</SelectContent></Select></div>
          </div>
          <div><Label>Monthly Rate (₹)</Label><Input type="number" value={editRateForm.monthly_rate || ''} onChange={(e) => setEditRateForm({ ...editRateForm, monthly_rate: e.target.value })} /></div>
          <DatePickerField label="From Date" value={editRateForm.from_date || ''} onChange={(v) => setEditRateForm({ ...editRateForm, from_date: v })} required />
          <DatePickerField label="To Date" value={editRateForm.to_date || ''} onChange={(v) => setEditRateForm({ ...editRateForm, to_date: v })} />
          <Button className="w-full" onClick={() => updateRate.mutate()} disabled={updateRate.isPending}>Update Rate</Button>
        </DrawerForm>
        <BedHistoryDialog
          open={bedHistoryOpen}
          onOpenChange={setBedHistoryOpen}
          bed={selectedBedForHistory}
        />
      </div>
    );
  }

  // ── DETAIL / ANALYTICS VIEW ──
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={goBack}><ArrowLeft className="h-4 w-4" /></Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{selectedProperty?.property_name} — Analytics</h1>
          <p className="text-sm text-muted-foreground">{[selectedProperty?.address, selectedProperty?.city, selectedProperty?.state].filter(Boolean).join(', ')}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card><CardContent className="p-4"><div className="flex items-center gap-3"><div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center"><DoorOpen className="h-5 w-5 text-primary" /></div><div><p className="text-2xl font-bold">{apartments.length}</p><p className="text-xs text-muted-foreground">Apartments</p></div></div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center gap-3"><div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center"><BedDouble className="h-5 w-5 text-primary" /></div><div><p className="text-2xl font-bold">{liveBeds}<span className="text-base font-normal text-muted-foreground">/{totalBeds}</span></p><p className="text-xs text-muted-foreground">Live / Total Beds</p></div></div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center gap-3"><div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center"><Users className="h-5 w-5 text-primary" /></div><div><p className="text-2xl font-bold">{occupancyRate}%</p><p className="text-xs text-muted-foreground">Occupancy Rate</p></div></div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center gap-3"><div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center"><IndianRupee className="h-5 w-5 text-primary" /></div><div><p className="text-2xl font-bold">₹{totalRevenue.toLocaleString()}</p><p className="text-xs text-muted-foreground">Total Revenue (Inception)</p></div></div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center gap-3"><div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center"><IndianRupee className="h-5 w-5 text-primary" /></div><div><p className="text-2xl font-bold">₹{lastMonthRevenue.toLocaleString()}</p><p className="text-xs text-muted-foreground">Revenue (Current Month)</p></div></div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="flex items-center gap-3"><div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center"><Package className="h-5 w-5 text-primary" /></div><div><p className="text-2xl font-bold">₹{totalAssetCost.toLocaleString()}</p><p className="text-xs text-muted-foreground">Asset Investment</p></div></div></CardContent></Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Apartments Summary</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Code</TableHead><TableHead>Type</TableHead><TableHead>Beds</TableHead><TableHead>Gender</TableHead><TableHead>Owner</TableHead><TableHead>Asset Cost</TableHead><TableHead>Revenue (Month)</TableHead><TableHead>Revenue (Total)</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
              <TableBody>
                {apartments.map((a: any) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.apartment_code}</TableCell>
                    <TableCell>{a.apartment_type || '—'}</TableCell>
                    <TableCell>{getAptLiveBedCount(a.id)}/{getAptBedCount(a.id)}</TableCell>
                    <TableCell>{genderBadge(a.gender_allowed)}</TableCell>
                    <TableCell>{(a as any).owners?.full_name || '—'}</TableCell>
                    <TableCell>₹{getAptAssetCost(a.id).toLocaleString()}</TableCell>
                    <TableCell>₹{getAptLastMonthRevenue(a.id).toLocaleString()}</TableCell>
                    <TableCell>₹{getAptRevenue(a.id).toLocaleString()}</TableCell>
                    <TableCell><StatusBadge status={a.status} type="entity" /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Current Tenants</CardTitle></CardHeader>
          <CardContent>
            {allotments.filter((a: any) => a.staying_status === 'staying').length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No active tenants</p>
            ) : (
              <Table>
                <TableHeader><TableRow><TableHead>Tenant</TableHead><TableHead>Rental</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>
                  {allotments.filter((a: any) => a.staying_status === 'staying').map((a: any) => (
                    <TableRow key={a.id}>
                      <TableCell>{(a as any).tenants?.full_name}</TableCell>
                      <TableCell>₹{a.monthly_rental || 0}</TableCell>
                      <TableCell><Badge variant="secondary">{a.staying_status}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
      <BedHistoryDialog
        open={bedHistoryOpen}
        onOpenChange={setBedHistoryOpen}
        bed={selectedBedForHistory}
      />
    </div>
  );
}
