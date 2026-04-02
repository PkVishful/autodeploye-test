import { useState, useMemo } from 'react';
import { Package, Plus, Search, QrCode, Pencil, Trash2, MoreHorizontal, MapPin, Eye, ScanLine, Loader2, Camera } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllRows } from '@/lib/supabase-utils';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import { motion } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { SortableTableHead, useSort } from '@/components/shared/SortableTableHead';
import { searchAllFields } from '@/lib/search-utils';
import { DrawerForm } from '@/components/shared/DrawerForm';
import { DatePickerField } from '@/components/shared/DatePickerField';
import { format } from 'date-fns';
import { useAuditLog } from '@/hooks/useAuditLog';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { QRCodeSVG } from 'qrcode.react';
import { FileUploadField } from '@/components/shared/FileUploadField';

const assetStatuses = ['inventory', 'allocated', 'maintenance', 'retired', 'disposed'];
const assetConditions = ['new', 'good', 'fair', 'poor'];

const fmtDate = (d: string | null) => {
  if (!d) return '—';
  try { return format(new Date(d), 'dd-MMM-yy'); } catch { return d; }
};

export default function Assets() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const orgId = profile?.organization_id;
  const { log: auditLog } = useAuditLog();
  const [search, setSearch] = useState('');
  const [vendorSearch, setVendorSearch] = useState('');
  const { sortConfig, handleSort, sortData } = useSort();
  const { sortConfig: vendorSortConfig, handleSort: vendorHandleSort, sortData: vendorSortData } = useSort();
  const { sortConfig: allocSortConfig, handleSort: allocHandleSort, sortData: allocSortData } = useSort();
  const { sortConfig: forecastSortConfig, handleSort: forecastHandleSort, sortData: forecastSortData } = useSort();

  // Drawers & dialogs
  const [assetOpen, setAssetOpen] = useState(false);
  const [editAssetOpen, setEditAssetOpen] = useState(false);
  const [vendorOpen, setVendorOpen] = useState(false);
  const [editVendorOpen, setEditVendorOpen] = useState(false);
  const [allocOpen, setAllocOpen] = useState(false);
  const [allocAssetId, setAllocAssetId] = useState<string | null>(null);
  const [editAllocId, setEditAllocId] = useState<string | null>(null);
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [qrAsset, setQrAsset] = useState<any>(null);
  const [catOpen, setCatOpen] = useState(false);
  const [typeOpen, setTypeOpen] = useState(false);
  const [brandOpen, setBrandOpen] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newTypeName, setNewTypeName] = useState('');
  const [newTypeCatId, setNewTypeCatId] = useState('');
  const [newTypeLifeMonths, setNewTypeLifeMonths] = useState('');
  const [newBrandName, setNewBrandName] = useState('');

  // Forms
  const [scanning, setScanning] = useState(false);

  const emptyAssetForm: any = {
    asset_type_id: '', brand: '', model: '', serial_number: '',
    purchase_price: '', purchase_date: '', warranty_expiry: '',
    invoice_number: '', invoice_date: '', invoice_url: '',
    condition: 'new', status: 'inventory', notes: '',
    supplier_id: '', vendor_name_manual: '', is_general_vendor: false,
    capacity_value: '', capacity_unit: '',
    product_photo_url: '',
  };
  const [assetForm, setAssetForm] = useState(emptyAssetForm);
  const [editAssetForm, setEditAssetForm] = useState<any>({});

  const emptyVendorForm: any = {
    vendor_name: '', contact_person: '', phone: '', email: '', address: '',
    gst_number: '', pan_number: '', bank_name: '', bank_account_number: '', bank_ifsc: '',
    notes: '', status: 'active',
  };
  const [vendorForm, setVendorForm] = useState(emptyVendorForm);
  const [editVendorForm, setEditVendorForm] = useState<any>({});

  const emptyAllocForm: any = { allocation_type: 'property', property_id: '', apartment_id: '', bed_ids: [] as string[] };
  const [allocForm, setAllocForm] = useState(emptyAllocForm);

  // Queries
  const { data: assets = [] } = useQuery({
    queryKey: ['assets'],
    queryFn: () => fetchAllRows((from, to) => supabase.from('assets').select('*, asset_types(name, asset_categories(name)), vendors(vendor_name)').order('created_at', { ascending: false }).range(from, to)),
    enabled: !!orgId,
  });

  const { data: assetTypes = [] } = useQuery({
    queryKey: ['asset_types'],
    queryFn: () => fetchAllRows((from, to) => supabase.from('asset_types').select('*, asset_categories(name)').order('name').range(from, to)),
    enabled: !!orgId,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['asset_categories'],
    queryFn: () => fetchAllRows((from, to) => supabase.from('asset_categories').select('*').order('name').range(from, to)),
    enabled: !!orgId,
  });

  const { data: brands = [] } = useQuery({
    queryKey: ['asset_brands'],
    queryFn: () => fetchAllRows((from, to) => supabase.from('asset_brands').select('*').order('name').range(from, to)),
    enabled: !!orgId,
  });

  const { data: vendors = [] } = useQuery({
    queryKey: ['vendors'],
    queryFn: () => fetchAllRows((from, to) => supabase.from('vendors').select('*').order('vendor_name').range(from, to)),
    enabled: !!orgId,
  });

  const { data: allocations = [] } = useQuery({
    queryKey: ['asset_allocations'],
    queryFn: () => fetchAllRows((from, to) => supabase.from('asset_allocations').select('*, assets(asset_code, brand, model, purchase_price, asset_types(name, asset_categories(name))), properties(property_name), apartments(apartment_code), beds(bed_code)').order('created_at', { ascending: false }).range(from, to)),
    enabled: !!orgId,
  });

  const { data: properties = [] } = useQuery({
    queryKey: ['properties-list'],
    queryFn: () => fetchAllRows((from, to) => supabase.from('properties').select('id, property_name').order('property_name').range(from, to)),
    enabled: !!orgId,
  });

  const { data: apartments = [] } = useQuery({
    queryKey: ['apartments-list'],
    queryFn: () => fetchAllRows((from, to) => supabase.from('apartments').select('id, apartment_code, property_id').order('apartment_code').range(from, to)),
    enabled: !!orgId,
  });

  const { data: beds = [] } = useQuery({
    queryKey: ['beds-list'],
    queryFn: () => fetchAllRows((from, to) => supabase.from('beds').select('id, bed_code, apartment_id').order('bed_code').range(from, to)),
    enabled: !!orgId,
  });

  const { data: forecasts = [] } = useQuery({
    queryKey: ['replacement_forecasts'],
    queryFn: () => fetchAllRows((from, to) => supabase.from('replacement_forecasts').select('*, assets(asset_code, asset_types(name))').range(from, to)),
    enabled: !!orgId,
  });

  // Auto-generate asset code
  const nextAssetCode = useMemo(() => {
    const existing = assets.map((a: any) => a.asset_code).filter((c: string) => /^AST-\d+$/.test(c));
    const maxNum = existing.reduce((max: number, c: string) => {
      const n = parseInt(c.replace('AST-', ''));
      return n > max ? n : max;
    }, 0);
    return `AST-${String(maxNum + 1).padStart(4, '0')}`;
  }, [assets]);

  // Stats
  const totalInvestment = assets.reduce((sum: number, a: any) => sum + (parseFloat(a.purchase_price) || 0), 0);
  const categoryData = categories.map((c: any) => ({
    name: c.name,
    count: assets.filter((a: any) => a.asset_types?.asset_categories?.name === c.name).length,
  }));

  const filteredAllocApts = apartments.filter((a: any) => !allocForm.property_id || a.property_id === allocForm.property_id)
    .sort((a: any, b: any) => a.apartment_code.localeCompare(b.apartment_code));
  const filteredAllocBeds = beds.filter((b: any) => !allocForm.apartment_id || b.apartment_id === allocForm.apartment_id)
    .sort((a: any, b: any) => a.bed_code.localeCompare(b.bed_code));

  // Count how many beds share a given asset (for cost splitting display)
  const getAssetShareCount = (assetId: string) => {
    return allocations.filter((a: any) => a.asset_id === assetId && a.allocation_type === 'bed').length || 1;
  };

  // Check if asset is allocated
  const isAssetAllocated = (assetId: string) => {
    return allocations.some((a: any) => a.asset_id === assetId);
  };

  // QR URL builder
  const getAssetUrl = (assetId: string) => `${window.location.origin}/asset/${assetId}`;

  // Mutations
  const createAsset = useMutation({
    mutationFn: async () => {
      const { is_general_vendor, product_photo_url, ...rest } = assetForm;
      const payload: any = {
        asset_code: nextAssetCode,
        asset_type_id: rest.asset_type_id,
        brand: rest.brand || null,
        model: rest.model || null,
        serial_number: rest.serial_number || null,
        purchase_price: rest.purchase_price ? parseFloat(rest.purchase_price) : null,
        purchase_date: rest.purchase_date || null,
        warranty_expiry: rest.warranty_expiry || null,
        invoice_number: rest.invoice_number || null,
        invoice_date: rest.invoice_date || null,
        invoice_url: rest.invoice_url || null,
        capacity_value: rest.capacity_value ? parseFloat(rest.capacity_value) : null,
        capacity_unit: rest.capacity_unit || null,
        condition: rest.condition,
        status: rest.status,
        notes: rest.notes || null,
        organization_id: orgId,
        product_photo_url: product_photo_url || null,
      };
      if (is_general_vendor) {
        payload.vendor_name_manual = rest.vendor_name_manual || 'General Vendor';
        payload.supplier_id = null;
      } else {
        payload.supplier_id = rest.supplier_id || null;
        payload.vendor_name_manual = null;
      }
      const { data, error } = await supabase.from('assets').insert(payload).select('id').single();
      if (error) throw error;
      await supabase.from('assets').update({ qr_code: getAssetUrl(data.id) }).eq('id', data.id);
      auditLog('assets', data.id, 'created', payload);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['assets'] }); setAssetOpen(false); setAssetForm(emptyAssetForm); toast({ title: 'Asset created' }); },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const updateAsset = useMutation({
    mutationFn: async () => {
      const { id, created_at, organization_id, asset_types, vendors: _v, is_general_vendor, product_photo_url, ...rest } = editAssetForm;
      const payload: any = {
        asset_code: rest.asset_code,
        asset_type_id: rest.asset_type_id,
        brand: rest.brand || null,
        model: rest.model || null,
        serial_number: rest.serial_number || null,
        purchase_price: rest.purchase_price ? parseFloat(rest.purchase_price) : null,
        purchase_date: rest.purchase_date || null,
        warranty_expiry: rest.warranty_expiry || null,
        invoice_number: rest.invoice_number || null,
        invoice_date: rest.invoice_date || null,
        invoice_url: rest.invoice_url || null,
        capacity_value: rest.capacity_value ? parseFloat(rest.capacity_value) : null,
        capacity_unit: rest.capacity_unit || null,
        condition: rest.condition,
        status: rest.status,
        notes: rest.notes || null,
        product_photo_url: product_photo_url || null,
      };
      if (is_general_vendor) {
        payload.vendor_name_manual = rest.vendor_name_manual || 'General Vendor';
        payload.supplier_id = null;
      } else {
        payload.supplier_id = rest.supplier_id || null;
        payload.vendor_name_manual = null;
      }
      const { error } = await supabase.from('assets').update(payload).eq('id', id);
      if (error) throw error;
      auditLog('assets', id, 'updated', payload);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['assets'] }); setEditAssetOpen(false); toast({ title: 'Asset updated' }); },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const deleteAsset = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('assets').delete().eq('id', id);
      if (error) throw error;
      auditLog('assets', id, 'deleted');
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['assets'] }); toast({ title: 'Asset deleted' }); },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const createVendor = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('vendors').insert({ ...vendorForm, organization_id: orgId } as any);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['vendors'] }); setVendorOpen(false); setVendorForm(emptyVendorForm); toast({ title: 'Vendor created' }); },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const updateVendor = useMutation({
    mutationFn: async () => {
      const { id, created_at, organization_id, ...rest } = editVendorForm;
      const { error } = await supabase.from('vendors').update(rest as any).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['vendors'] }); setEditVendorOpen(false); toast({ title: 'Vendor updated' }); },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const deleteVendor = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('vendors').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['vendors'] }); toast({ title: 'Vendor deleted' }); },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const createAllocation = useMutation({
    mutationFn: async () => {
      if (allocForm.allocation_type === 'bed' && allocForm.bed_ids.length > 0) {
        const rows = allocForm.bed_ids.map((bedId: string) => ({
          asset_id: allocAssetId,
          allocation_type: 'bed',
          property_id: allocForm.property_id || null,
          apartment_id: allocForm.apartment_id || null,
          bed_id: bedId,
          organization_id: orgId,
        }));
        const { error } = await supabase.from('asset_allocations').insert(rows);
        if (error) throw error;
      } else {
        const payload: any = {
          asset_id: allocAssetId,
          allocation_type: allocForm.allocation_type,
          property_id: allocForm.property_id || null,
          apartment_id: allocForm.apartment_id || null,
          bed_id: null,
          organization_id: orgId,
        };
        const { error } = await supabase.from('asset_allocations').insert(payload);
        if (error) throw error;
      }
      await supabase.from('assets').update({ status: 'allocated' }).eq('id', allocAssetId!);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['asset_allocations'] });
      qc.invalidateQueries({ queryKey: ['assets'] });
      setAllocOpen(false); setAllocForm(emptyAllocForm); setAllocAssetId(null); setEditAllocId(null);
      toast({ title: 'Asset allocated' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const updateAllocation = useMutation({
    mutationFn: async () => {
      if (!allocAssetId) throw new Error('No asset to update allocation for');
      // Delete ALL existing allocations for this asset, then re-create
      await supabase.from('asset_allocations').delete().eq('asset_id', allocAssetId);
      
      if (allocForm.allocation_type === 'bed' && allocForm.bed_ids.length > 0) {
        const rows = allocForm.bed_ids.map((bedId: string) => ({
          asset_id: allocAssetId,
          allocation_type: 'bed',
          property_id: allocForm.property_id || null,
          apartment_id: allocForm.apartment_id || null,
          bed_id: bedId,
          organization_id: orgId,
        }));
        const { error } = await supabase.from('asset_allocations').insert(rows);
        if (error) throw error;
      } else {
        const payload: any = {
          asset_id: allocAssetId,
          allocation_type: allocForm.allocation_type,
          property_id: allocForm.property_id || null,
          apartment_id: allocForm.apartment_id || null,
          bed_id: null,
          organization_id: orgId,
        };
        const { error } = await supabase.from('asset_allocations').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['asset_allocations'] });
      qc.invalidateQueries({ queryKey: ['assets'] });
      setAllocOpen(false); setAllocForm(emptyAllocForm); setAllocAssetId(null); setEditAllocId(null);
      toast({ title: 'Allocation updated' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const deleteAllocation = useMutation({
    mutationFn: async (id: string) => {
      const alloc = allocations.find((a: any) => a.id === id);
      const { error } = await supabase.from('asset_allocations').delete().eq('id', id);
      if (error) throw error;
      if (alloc) {
        const remaining = allocations.filter((a: any) => a.asset_id === alloc.asset_id && a.id !== id);
        if (remaining.length === 0) {
          await supabase.from('assets').update({ status: 'inventory' }).eq('id', alloc.asset_id);
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['asset_allocations'] });
      qc.invalidateQueries({ queryKey: ['assets'] });
      toast({ title: 'Allocation deleted' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const createCategory = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('asset_categories').insert({ name: newCatName, organization_id: orgId } as any);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['asset_categories'] }); setCatOpen(false); setNewCatName(''); toast({ title: 'Category created' }); },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const createAssetType = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('asset_types').insert({
        name: newTypeName,
        category_id: newTypeCatId,
        expected_life_months: newTypeLifeMonths ? parseInt(newTypeLifeMonths) : null,
        organization_id: orgId,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['asset_types'] }); setTypeOpen(false); setNewTypeName(''); setNewTypeCatId(''); setNewTypeLifeMonths(''); toast({ title: 'Asset Type created' }); },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const createBrand = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('asset_brands').insert({ name: newBrandName, organization_id: orgId } as any);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['asset_brands'] }); setBrandOpen(false); setNewBrandName(''); toast({ title: 'Brand created' }); },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  // Filtered & sorted
  const filtered = assets.filter((a: any) => searchAllFields(a, search));
  const sorted = sortData(filtered, (item, key) => {
    if (key === 'type') return item.asset_types?.name;
    if (key === 'vendor') return item.vendors?.vendor_name || item.vendor_name_manual;
    return item[key];
  });

  const filteredVendors = vendors.filter((v: any) => searchAllFields(v, vendorSearch));
  const sortedVendors = vendorSortData(filteredVendors);

  const sortedAllocations = allocSortData(allocations, (item, key) => {
    if (key === 'asset') return item.assets?.asset_types?.name;
    if (key === 'price') return item.assets?.purchase_price;
    if (key === 'property') return item.properties?.property_name;
    if (key === 'apartment') return item.apartments?.apartment_code;
    if (key === 'bed') return item.beds?.bed_code;
    return item[key];
  });

  const sortedForecasts = forecastSortData(forecasts, (item, key) => {
    if (key === 'asset') return item.assets?.asset_code;
    if (key === 'type') return item.assets?.asset_types?.name;
    return item[key];
  });

  // Open add asset
  const openAddAsset = () => {
    setAssetForm({ ...emptyAssetForm });
    setAssetOpen(true);
  };

  // Validation for required fields
  const isAssetFormValid = (f: any) => {
    if (!f.asset_type_id) return false;
    if (!f.brand) return false;
    if (!f.purchase_price) return false;
    if (!f.purchase_date) return false;
    if (!f.is_general_vendor && !f.supplier_id) return false;
    if (f.is_general_vendor && !f.vendor_name_manual) return false;
    return true;
  };

  // Asset form renderer
  const renderAssetFormFields = (f: any, setF: (v: any) => void, isEdit = false) => (
    <>
      <div>
        <div className="flex items-center justify-between">
          <Label>Asset Type *</Label>
          <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => setTypeOpen(true)}>+ New Type</Button>
        </div>
        <Select value={f.asset_type_id} onValueChange={(v) => setF({ ...f, asset_type_id: v })}>
          <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
          <SelectContent>
            {assetTypes.length === 0 ? (
              <div className="p-3 text-center text-sm text-muted-foreground">No types yet. Create a category first, then add a type.</div>
            ) : (
              assetTypes.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.asset_categories?.name} → {t.name}</SelectItem>)
            )}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="flex items-center justify-between">
            <Label>Brand *</Label>
            <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => setBrandOpen(true)}>+ New Brand</Button>
          </div>
          <Select value={f.brand || ''} onValueChange={(v) => setF({ ...f, brand: v })}>
            <SelectTrigger><SelectValue placeholder="Select brand" /></SelectTrigger>
            <SelectContent>
              {brands.length === 0 ? (
                <div className="p-3 text-center text-sm text-muted-foreground">No brands yet. Add one.</div>
              ) : (
                brands.map((b: any) => <SelectItem key={b.id} value={b.name}>{b.name}</SelectItem>)
              )}
            </SelectContent>
          </Select>
        </div>
        <div><Label>Model</Label><Input value={f.model || ''} onChange={(e) => setF({ ...f, model: e.target.value })} /></div>
      </div>
      <div><Label>Serial Number</Label><Input value={f.serial_number || ''} onChange={(e) => setF({ ...f, serial_number: e.target.value })} /></div>

      {/* Capacity */}
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Capacity</Label><Input type="number" value={f.capacity_value || ''} onChange={(e) => setF({ ...f, capacity_value: e.target.value })} placeholder="e.g. 1.5" /></div>
        <div>
          <Label>Unit</Label>
          <Select value={f.capacity_unit || ''} onValueChange={(v) => setF({ ...f, capacity_unit: v })}>
            <SelectTrigger><SelectValue placeholder="Select unit" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="tons">Tons (AC)</SelectItem>
              <SelectItem value="litres">Litres (Fridge)</SelectItem>
              <SelectItem value="kgs">Kgs (Washing Machine)</SelectItem>
              <SelectItem value="watts">Watts (Induction)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="border-t pt-3 mt-1">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium">Purchase & Bill Details</p>
          {f.invoice_url && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs"
              disabled={scanning}
              onClick={async () => {
                setScanning(true);
                try {
                  const { data, error } = await supabase.functions.invoke('scan-invoice', {
                    body: { image_url: f.invoice_url },
                  });
                  if (error) throw error;
                  if (data?.error) throw new Error(data.error);
                  setF({
                    ...f,
                    brand: data.brand || f.brand,
                    model: data.model || f.model,
                    serial_number: data.serial_number || f.serial_number,
                    purchase_price: data.purchase_price?.toString() || f.purchase_price,
                    invoice_number: data.invoice_number || f.invoice_number,
                    invoice_date: data.invoice_date || f.invoice_date,
                    warranty_expiry: data.warranty_expiry || f.warranty_expiry,
                    vendor_name_manual: data.vendor_name || f.vendor_name_manual,
                    is_general_vendor: data.vendor_name ? true : f.is_general_vendor,
                    capacity_value: data.capacity_value?.toString() || f.capacity_value,
                    capacity_unit: data.capacity_unit || f.capacity_unit,
                  });
                  toast({ title: 'Invoice scanned', description: 'Fields updated from invoice data' });
                } catch (err: any) {
                  toast({ title: 'Scan failed', description: err.message, variant: 'destructive' });
                } finally {
                  setScanning(false);
                }
              }}
            >
              {scanning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ScanLine className="h-3.5 w-3.5" />}
              {scanning ? 'Scanning...' : 'Scan Invoice'}
            </Button>
          )}
        </div>
        <div className="mb-3">
          <FileUploadField label="Invoice Photo" value={f.invoice_url || null} onChange={(url) => setF({ ...f, invoice_url: url })} folder="invoices" accept="image/*,.pdf" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Purchase Price (₹) *</Label><Input type="number" value={f.purchase_price || ''} onChange={(e) => setF({ ...f, purchase_price: e.target.value })} /></div>
          <DatePickerField label="Purchase Date *" value={f.purchase_date || ''} onChange={(v) => setF({ ...f, purchase_date: v, invoice_date: f.invoice_date || v })} />
        </div>
        <div className="grid grid-cols-2 gap-3 mt-2">
          <div><Label>Invoice Number</Label><Input value={f.invoice_number || ''} onChange={(e) => setF({ ...f, invoice_number: e.target.value })} /></div>
          <DatePickerField label="Invoice Date" value={f.invoice_date || ''} onChange={(v) => setF({ ...f, invoice_date: v })} />
        </div>
        <div className="mt-2">
          <DatePickerField label="Warranty Expiry" value={f.warranty_expiry || ''} onChange={(v) => setF({ ...f, warranty_expiry: v })} />
        </div>
      </div>

      <div className="border-t pt-3 mt-1">
        <p className="text-sm font-medium mb-2">Vendor Details *</p>
        <div className="flex items-center gap-2 mb-3">
          <Checkbox checked={f.is_general_vendor} onCheckedChange={(v) => setF({ ...f, is_general_vendor: !!v, supplier_id: '', vendor_name_manual: '' })} id={`general-vendor-${isEdit ? 'edit' : 'new'}`} />
          <label htmlFor={`general-vendor-${isEdit ? 'edit' : 'new'}`} className="text-sm">General / One-time Vendor</label>
        </div>
        {f.is_general_vendor ? (
          <div><Label>Vendor Name *</Label><Input value={f.vendor_name_manual || ''} onChange={(e) => setF({ ...f, vendor_name_manual: e.target.value })} placeholder="Enter vendor name" /></div>
        ) : (
          <div>
            <Label>Select Vendor *</Label>
            <Select value={f.supplier_id || ''} onValueChange={(v) => setF({ ...f, supplier_id: v })}>
              <SelectTrigger><SelectValue placeholder="Choose a vendor" /></SelectTrigger>
              <SelectContent>{vendors.map((v: any) => <SelectItem key={v.id} value={v.id}>{v.vendor_name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Product Photo */}
      <div className="border-t pt-3 mt-1">
        <FileUploadField label="Product Photo" value={f.product_photo_url || null} onChange={(url) => setF({ ...f, product_photo_url: url })} folder="product-photos" accept="image/*" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Condition</Label>
          <Select value={f.condition || 'new'} onValueChange={(v) => setF({ ...f, condition: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{assetConditions.map(c => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <Label>Status</Label>
          <Select value={f.status || 'inventory'} onValueChange={(v) => setF({ ...f, status: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{assetStatuses.map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      <div><Label>Notes</Label><Textarea value={f.notes || ''} onChange={(e) => setF({ ...f, notes: e.target.value })} rows={2} /></div>
    </>
  );

  const renderVendorFormFields = (f: any, setF: (v: any) => void) => (
    <>
      <div><Label>Vendor Name *</Label><Input value={f.vendor_name} onChange={(e) => setF({ ...f, vendor_name: e.target.value })} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Contact Person</Label><Input value={f.contact_person || ''} onChange={(e) => setF({ ...f, contact_person: e.target.value })} /></div>
        <div><Label>Phone</Label><Input value={f.phone || ''} onChange={(e) => setF({ ...f, phone: e.target.value })} /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Email</Label><Input type="email" value={f.email || ''} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
        <div><Label>Address</Label><Input value={f.address || ''} onChange={(e) => setF({ ...f, address: e.target.value })} /></div>
      </div>
      <div className="border-t pt-3 mt-1">
        <p className="text-sm font-medium mb-2">KYC Details</p>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>GST Number</Label><Input value={f.gst_number || ''} onChange={(e) => setF({ ...f, gst_number: e.target.value })} /></div>
          <div><Label>PAN Number</Label><Input value={f.pan_number || ''} onChange={(e) => setF({ ...f, pan_number: e.target.value })} /></div>
        </div>
      </div>
      <div className="border-t pt-3 mt-1">
        <p className="text-sm font-medium mb-2">Bank Details</p>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Bank Name</Label><Input value={f.bank_name || ''} onChange={(e) => setF({ ...f, bank_name: e.target.value })} /></div>
          <div><Label>Account Number</Label><Input value={f.bank_account_number || ''} onChange={(e) => setF({ ...f, bank_account_number: e.target.value })} /></div>
        </div>
        <div className="mt-2"><Label>IFSC Code</Label><Input value={f.bank_ifsc || ''} onChange={(e) => setF({ ...f, bank_ifsc: e.target.value })} /></div>
      </div>
      <div><Label>Notes</Label><Textarea value={f.notes || ''} onChange={(e) => setF({ ...f, notes: e.target.value })} rows={2} /></div>
    </>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold tracking-tight">Asset Management</h1><p className="text-sm text-muted-foreground mt-1">Track assets, vendors, allocations and analytics</p></div>
        <Button className="gap-2" onClick={openAddAsset}><Plus className="h-4 w-4" /> Add Asset</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-4"><p className="text-2xl font-bold">{assets.length}</p><p className="text-xs text-muted-foreground">Total Assets</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-2xl font-bold">₹{totalInvestment.toLocaleString()}</p><p className="text-xs text-muted-foreground">Total Investment</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-2xl font-bold">{assets.filter((a: any) => a.status === 'allocated').length}</p><p className="text-xs text-muted-foreground">Allocated</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-2xl font-bold">{assets.filter((a: any) => a.status === 'maintenance').length}</p><p className="text-xs text-muted-foreground">Under Maintenance</p></CardContent></Card>
      </div>

      <Tabs defaultValue="inventory">
        <TabsList className="flex-wrap">
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
          <TabsTrigger value="vendors">Vendors ({vendors.length})</TabsTrigger>
          <TabsTrigger value="allocations">Allocations ({allocations.length})</TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="forecasts">Forecasts</TabsTrigger>
        </TabsList>

        {/* INVENTORY TAB */}
        <TabsContent value="inventory" className="space-y-4 mt-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search assets..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Card className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableTableHead label="Type" sortKey="type" sortConfig={sortConfig} onSort={handleSort} />
                  <SortableTableHead label="Brand / Model" sortKey="brand" sortConfig={sortConfig} onSort={handleSort} />
                  <SortableTableHead label="Vendor" sortKey="vendor" sortConfig={sortConfig} onSort={handleSort} />
                  <SortableTableHead label="Price" sortKey="purchase_price" sortConfig={sortConfig} onSort={handleSort} />
                  <SortableTableHead label="Condition" sortKey="condition" sortConfig={sortConfig} onSort={handleSort} />
                  <SortableTableHead label="Status" sortKey="status" sortConfig={sortConfig} onSort={handleSort} />
                  <TableHead>Allocation</TableHead>
                  <TableHead>QR</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.length === 0 ? <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">No assets yet</TableCell></TableRow> :
                  sorted.map((a: any) => {
                    const assetAllocs = allocations.filter((al: any) => al.asset_id === a.id);
                    const allocated = assetAllocs.length > 0;
                    const allocSummary = allocated
                      ? assetAllocs.map((al: any) => {
                          if (al.allocation_type === 'bed') {
                            const aptCode = al.apartments?.apartment_code || '';
                            const bedCode = al.beds?.bed_code || '';
                            return aptCode && bedCode ? `${aptCode}-${bedCode}` : bedCode || aptCode;
                          }
                          if (al.allocation_type === 'apartment') return al.apartments?.apartment_code;
                          return al.properties?.property_name;
                        }).filter(Boolean).join(', ')
                      : null;
                    return (
                    <TableRow key={a.id}>
                      <TableCell>{a.asset_types?.name || '—'}</TableCell>
                      <TableCell>{[a.brand, a.model].filter(Boolean).join(' ') || '—'}</TableCell>
                      <TableCell>{a.vendors?.vendor_name || a.vendor_name_manual || '—'}</TableCell>
                      <TableCell>₹{a.purchase_price || 0}</TableCell>
                      <TableCell className="capitalize">{a.condition || '—'}</TableCell>
                      <TableCell><StatusBadge status={a.status} type="asset" /></TableCell>
                      <TableCell>
                        {allocSummary ? (
                          <Badge variant="outline" className="text-[10px]">{allocSummary}</Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setQrAsset(a); setQrDialogOpen(true); }}>
                          <QrCode className="h-4 w-4 text-muted-foreground hover:text-primary" />
                        </Button>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="h-3.5 w-3.5" /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => window.open(`/asset/${a.id}`, '_blank')}><Eye className="h-4 w-4 mr-2" /> View Details</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => {
                              setEditAssetForm({
                                ...a,
                                purchase_price: a.purchase_price?.toString() || '',
                                warranty_expiry: a.warranty_expiry || '',
                                capacity_value: a.capacity_value?.toString() || '',
                                capacity_unit: a.capacity_unit || '',
                                supplier_id: a.supplier_id || '',
                                is_general_vendor: !!a.vendor_name_manual,
                                vendor_name_manual: a.vendor_name_manual || '',
                                product_photo_url: a.product_photo_url || '',
                              });
                              setEditAssetOpen(true);
                            }}><Pencil className="h-4 w-4 mr-2" /> Edit</DropdownMenuItem>
                            {!allocated && (
                              <DropdownMenuItem onClick={() => {
                                setAllocAssetId(a.id);
                                setEditAllocId(null);
                                setAllocForm(emptyAllocForm);
                                setAllocOpen(true);
                              }}><MapPin className="h-4 w-4 mr-2" /> Allocate</DropdownMenuItem>
                            )}
                            <DropdownMenuItem className="text-destructive" onClick={() => { if (confirm('Delete this asset?')) deleteAsset.mutate(a.id); }}><Trash2 className="h-4 w-4 mr-2" /> Delete</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                    );
                  })
                }
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* VENDORS TAB */}
        <TabsContent value="vendors" className="space-y-4 mt-4">
          <div className="flex items-center gap-3">
            <div className="relative max-w-sm flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search vendors..." value={vendorSearch} onChange={(e) => setVendorSearch(e.target.value)} className="pl-9" />
            </div>
            <Button className="gap-2" onClick={() => setVendorOpen(true)}><Plus className="h-4 w-4" /> Add Vendor</Button>
          </div>
          <Card className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableTableHead label="Name" sortKey="vendor_name" sortConfig={vendorSortConfig} onSort={vendorHandleSort} />
                  <SortableTableHead label="Contact" sortKey="contact_person" sortConfig={vendorSortConfig} onSort={vendorHandleSort} />
                  <SortableTableHead label="Phone" sortKey="phone" sortConfig={vendorSortConfig} onSort={vendorHandleSort} />
                  <SortableTableHead label="Email" sortKey="email" sortConfig={vendorSortConfig} onSort={vendorHandleSort} />
                  <SortableTableHead label="GST" sortKey="gst_number" sortConfig={vendorSortConfig} onSort={vendorHandleSort} />
                  <SortableTableHead label="PAN" sortKey="pan_number" sortConfig={vendorSortConfig} onSort={vendorHandleSort} />
                  <SortableTableHead label="Status" sortKey="status" sortConfig={vendorSortConfig} onSort={vendorHandleSort} />
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedVendors.length === 0 ? <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No vendors</TableCell></TableRow> :
                  sortedVendors.map((v: any) => (
                    <TableRow key={v.id}>
                      <TableCell className="font-medium">{v.vendor_name}</TableCell>
                      <TableCell>{v.contact_person || '—'}</TableCell>
                      <TableCell>{v.phone || '—'}</TableCell>
                      <TableCell>{v.email || '—'}</TableCell>
                      <TableCell className="text-xs">{v.gst_number || '—'}</TableCell>
                      <TableCell className="text-xs">{v.pan_number || '—'}</TableCell>
                      <TableCell><StatusBadge status={v.status || 'active'} type="entity" /></TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="h-3.5 w-3.5" /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => { setEditVendorForm({ ...v }); setEditVendorOpen(true); }}><Pencil className="h-4 w-4 mr-2" /> Edit</DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive" onClick={() => { if (confirm('Delete vendor?')) deleteVendor.mutate(v.id); }}><Trash2 className="h-4 w-4 mr-2" /> Delete</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                }
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* ALLOCATIONS TAB */}
        <TabsContent value="allocations" className="space-y-4 mt-4">
          <Card className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableTableHead label="Asset Type" sortKey="asset" sortConfig={allocSortConfig} onSort={allocHandleSort} />
                  <TableHead>Brand / Model</TableHead>
                  <SortableTableHead label="Price" sortKey="price" sortConfig={allocSortConfig} onSort={allocHandleSort} />
                  <SortableTableHead label="Level" sortKey="allocation_type" sortConfig={allocSortConfig} onSort={allocHandleSort} />
                  <SortableTableHead label="Property" sortKey="property" sortConfig={allocSortConfig} onSort={allocHandleSort} />
                  <SortableTableHead label="Apartment" sortKey="apartment" sortConfig={allocSortConfig} onSort={allocHandleSort} />
                  <SortableTableHead label="Bed" sortKey="bed" sortConfig={allocSortConfig} onSort={allocHandleSort} />
                   <SortableTableHead label="Date" sortKey="allocated_date" sortConfig={allocSortConfig} onSort={allocHandleSort} />
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(() => {
                  // Group allocations by asset_id
                  const grouped = new Map<string, any[]>();
                  sortedAllocations.forEach((a: any) => {
                    const existing = grouped.get(a.asset_id) || [];
                    existing.push(a);
                    grouped.set(a.asset_id, existing);
                  });
                  const groups = Array.from(grouped.values());
                  if (groups.length === 0) return <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">No allocations</TableCell></TableRow>;
                  return groups.map((allocs) => {
                    const first = allocs[0];
                    const allocSummary = allocs.map((al: any) => {
                      if (al.allocation_type === 'bed') {
                        const aptCode = al.apartments?.apartment_code || '';
                        const bedCode = al.beds?.bed_code || '';
                        return aptCode && bedCode ? `${aptCode}-${bedCode}` : bedCode || aptCode;
                      }
                      if (al.allocation_type === 'apartment') return al.apartments?.apartment_code;
                      return al.properties?.property_name;
                    }).filter(Boolean).join(', ');
                    return (
                    <TableRow key={first.asset_id}>
                      <TableCell className="font-medium">{first.assets?.asset_types?.name || '—'}</TableCell>
                      <TableCell>{[first.assets?.brand, first.assets?.model].filter(Boolean).join(' ') || '—'}</TableCell>
                      <TableCell>₹{first.assets?.purchase_price || 0}{first.allocation_type === 'bed' && allocs.length > 1 && <span className="text-muted-foreground text-[10px] ml-1">÷{allocs.length}</span>}</TableCell>
                      <TableCell className="capitalize">{first.allocation_type}</TableCell>
                      <TableCell>{first.properties?.property_name || '—'}</TableCell>
                      <TableCell colSpan={2}>
                        <Badge variant="outline" className="text-[10px]">{allocSummary}</Badge>
                      </TableCell>
                      <TableCell>{fmtDate(first.allocated_date)}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="h-3.5 w-3.5" /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => {
                              setAllocAssetId(first.asset_id);
                              setEditAllocId(first.id);
                              setAllocForm({
                                allocation_type: first.allocation_type,
                                property_id: first.property_id || '',
                                apartment_id: first.apartment_id || '',
                                bed_ids: allocs.filter((al: any) => al.bed_id).map((al: any) => al.bed_id),
                              });
                              setAllocOpen(true);
                            }}><Pencil className="h-4 w-4 mr-2" /> Edit</DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive" onClick={() => {
                              if (confirm('Delete all allocations for this asset?')) {
                                allocs.forEach((al: any) => deleteAllocation.mutate(al.id));
                              }
                            }}><Trash2 className="h-4 w-4 mr-2" /> Delete</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                    );
                  });
                })()}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* CATEGORIES TAB */}
        <TabsContent value="categories" className="space-y-4 mt-4">
          <div className="flex items-center gap-3">
            <Button variant="outline" className="gap-2" onClick={() => setCatOpen(true)}><Plus className="h-4 w-4" /> Add Category</Button>
            <Button variant="outline" className="gap-2" onClick={() => setTypeOpen(true)}><Plus className="h-4 w-4" /> Add Asset Type</Button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {categories.length === 0 ? <Card className="col-span-full p-8 text-center text-muted-foreground">No categories yet. Create one to get started.</Card> :
              categories.map((c: any) => {
                const catTypes = assetTypes.filter((t: any) => t.category_id === c.id);
                return (
                  <Card key={c.id} className="hover:shadow-md transition-all">
                    <CardContent className="p-5">
                      <Package className="h-6 w-6 text-primary mb-2" />
                      <h3 className="font-semibold">{c.name}</h3>
                      <p className="text-xs text-muted-foreground mb-2">{assets.filter((a: any) => a.asset_types?.asset_categories?.name === c.name).length} assets</p>
                      {catTypes.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {catTypes.map((t: any) => <Badge key={t.id} variant="secondary" className="text-[10px]">{t.name}</Badge>)}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })
            }
          </div>
        </TabsContent>

        {/* ANALYTICS TAB */}
        <TabsContent value="analytics" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Assets by Category</CardTitle></CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={categoryData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                    <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* FORECASTS TAB */}
        <TabsContent value="forecasts" className="mt-4">
          <Card className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableTableHead label="Asset" sortKey="asset" sortConfig={forecastSortConfig} onSort={forecastHandleSort} />
                  <SortableTableHead label="Type" sortKey="type" sortConfig={forecastSortConfig} onSort={forecastHandleSort} />
                  <SortableTableHead label="Expected Date" sortKey="expected_replacement_date" sortConfig={forecastSortConfig} onSort={forecastHandleSort} />
                  <SortableTableHead label="Cost" sortKey="replacement_cost" sortConfig={forecastSortConfig} onSort={forecastHandleSort} />
                  <SortableTableHead label="Urgency" sortKey="urgency_level" sortConfig={forecastSortConfig} onSort={forecastHandleSort} />
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedForecasts.length === 0 ? <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No forecasts</TableCell></TableRow> :
                  sortedForecasts.map((f: any) => (
                    <TableRow key={f.id}>
                      <TableCell className="font-mono text-xs">{f.assets?.asset_code}</TableCell>
                      <TableCell>{f.assets?.asset_types?.name}</TableCell>
                      <TableCell>{fmtDate(f.expected_replacement_date)}</TableCell>
                      <TableCell>₹{f.replacement_cost || 0}</TableCell>
                      <TableCell><StatusBadge status={f.urgency_level} type="priority" /></TableCell>
                    </TableRow>
                  ))
                }
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>

      {/* DRAWERS */}
      <DrawerForm open={assetOpen} onOpenChange={setAssetOpen} title="Add New Asset">
        {renderAssetFormFields(assetForm, setAssetForm, false)}
        <Button className="w-full" onClick={() => createAsset.mutate()} disabled={createAsset.isPending || !isAssetFormValid(assetForm)}>Create Asset</Button>
      </DrawerForm>

      <DrawerForm open={editAssetOpen} onOpenChange={setEditAssetOpen} title="Edit Asset">
        {renderAssetFormFields(editAssetForm, setEditAssetForm, true)}
        <Button className="w-full" onClick={() => updateAsset.mutate()} disabled={updateAsset.isPending || !isAssetFormValid(editAssetForm)}>Update Asset</Button>
      </DrawerForm>

      <DrawerForm open={vendorOpen} onOpenChange={setVendorOpen} title="Add Vendor">
        {renderVendorFormFields(vendorForm, setVendorForm)}
        <Button className="w-full" onClick={() => createVendor.mutate()} disabled={createVendor.isPending || !vendorForm.vendor_name}>Create Vendor</Button>
      </DrawerForm>

      <DrawerForm open={editVendorOpen} onOpenChange={setEditVendorOpen} title="Edit Vendor">
        {renderVendorFormFields(editVendorForm, setEditVendorForm)}
        <Button className="w-full" onClick={() => updateVendor.mutate()} disabled={updateVendor.isPending}>Update Vendor</Button>
      </DrawerForm>

      {/* QR CODE DIALOG */}
      <Dialog open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>QR Code — {qrAsset?.asset_code}</DialogTitle></DialogHeader>
          {qrAsset && (
            <div className="flex flex-col items-center gap-4 py-4">
              <div className="bg-white p-4 rounded-lg">
                <QRCodeSVG value={getAssetUrl(qrAsset.id)} size={200} level="H" includeMargin />
              </div>
              <div className="text-center">
                <p className="font-mono text-sm font-semibold">{qrAsset.asset_code}</p>
                <p className="text-xs text-muted-foreground">{qrAsset.asset_types?.name}</p>
                <p className="text-xs text-muted-foreground mt-1">{qrAsset.brand} {qrAsset.model}</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => {
                  const svg = document.querySelector('.qr-print-area svg');
                  if (!svg) return;
                  const svgData = new XMLSerializer().serializeToString(svg);
                  const blob = new Blob([svgData], { type: 'image/svg+xml' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url; a.download = `${qrAsset.asset_code}-qr.svg`;
                  a.click(); URL.revokeObjectURL(url);
                }}>Download SVG</Button>
                <Button variant="outline" size="sm" onClick={() => window.open(`/asset/${qrAsset.id}`, '_blank')}>
                  <Eye className="h-4 w-4 mr-1" /> View Page
                </Button>
              </div>
              <div className="qr-print-area hidden">
                <QRCodeSVG value={getAssetUrl(qrAsset.id)} size={400} level="H" includeMargin />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ALLOCATION DIALOG */}
      <Dialog open={allocOpen} onOpenChange={(v) => { setAllocOpen(v); if (!v) { setEditAllocId(null); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editAllocId ? 'Edit Allocation' : 'Allocate Asset'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Allocate To</Label>
              <Select value={allocForm.allocation_type} onValueChange={(v) => setAllocForm({ ...emptyAllocForm, allocation_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="property">Property</SelectItem>
                  <SelectItem value="apartment">Apartment</SelectItem>
                  <SelectItem value="bed">Bed (supports sharing across multiple beds)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Property *</Label>
              <Select value={allocForm.property_id} onValueChange={(v) => setAllocForm({ ...allocForm, property_id: v, apartment_id: '', bed_ids: [] })}>
                <SelectTrigger><SelectValue placeholder="Select property" /></SelectTrigger>
                <SelectContent>{properties.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.property_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {(allocForm.allocation_type === 'apartment' || allocForm.allocation_type === 'bed') && (
              <div>
                <Label>Apartment</Label>
                <Select value={allocForm.apartment_id} onValueChange={(v) => setAllocForm({ ...allocForm, apartment_id: v, bed_ids: [] })}>
                  <SelectTrigger><SelectValue placeholder="Select apartment" /></SelectTrigger>
                  <SelectContent>{filteredAllocApts.map((a: any) => <SelectItem key={a.id} value={a.id}>{a.apartment_code}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            {allocForm.allocation_type === 'bed' && (
              <div>
                <Label>Select Beds (cost will be shared equally)</Label>
                {allocForm.bed_ids.length > 0 && (() => {
                  const price = parseFloat(String(assets.find((a: any) => a.id === allocAssetId)?.purchase_price ?? '0'));
                  const perBed = Math.round(price / allocForm.bed_ids.length);
                  return <p className="text-xs text-muted-foreground mb-2">{allocForm.bed_ids.length} bed(s) selected — cost per bed: ₹{perBed.toLocaleString('en-IN')}</p>;
                })()}
                <div className="border rounded-md p-3 max-h-40 overflow-y-auto space-y-2">
                  {filteredAllocBeds.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No beds in selected apartment</p>
                  ) : filteredAllocBeds.map((b: any) => (
                    <div key={b.id} className="flex items-center gap-2">
                      <Checkbox
                        id={`bed-alloc-${b.id}`}
                        checked={allocForm.bed_ids.includes(b.id)}
                        onCheckedChange={(checked) => {
                          const newIds = checked
                            ? [...allocForm.bed_ids, b.id]
                            : allocForm.bed_ids.filter((id: string) => id !== b.id);
                          setAllocForm({ ...allocForm, bed_ids: newIds });
                        }}
                      />
                      <label htmlFor={`bed-alloc-${b.id}`} className="text-sm">{b.bed_code}</label>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <Button className="w-full" onClick={() => editAllocId ? updateAllocation.mutate() : createAllocation.mutate()} disabled={(createAllocation.isPending || updateAllocation.isPending) || !allocForm.property_id || (allocForm.allocation_type === 'bed' && allocForm.bed_ids.length === 0)}>{editAllocId ? 'Update Allocation' : 'Allocate Asset'}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ADD CATEGORY DIALOG */}
      <Dialog open={catOpen} onOpenChange={setCatOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Add Asset Category</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Category Name *</Label><Input value={newCatName} onChange={(e) => setNewCatName(e.target.value)} placeholder="e.g. Furniture, Electronics" /></div>
            <Button className="w-full" onClick={() => createCategory.mutate()} disabled={createCategory.isPending || !newCatName}>Create Category</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ADD ASSET TYPE DIALOG */}
      <Dialog open={typeOpen} onOpenChange={setTypeOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Add Asset Type</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Category *</Label>
              {categories.length === 0 ? (
                <p className="text-sm text-muted-foreground mt-1">No categories yet. <Button variant="link" className="h-auto p-0 text-xs" onClick={() => { setTypeOpen(false); setCatOpen(true); }}>Create a category first</Button></p>
              ) : (
                <Select value={newTypeCatId} onValueChange={setNewTypeCatId}>
                  <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                  <SelectContent>{categories.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              )}
            </div>
            <div><Label>Type Name *</Label><Input value={newTypeName} onChange={(e) => setNewTypeName(e.target.value)} placeholder="e.g. Chair, Fan, AC" /></div>
            <div><Label>Expected Life (months)</Label><Input type="number" value={newTypeLifeMonths} onChange={(e) => setNewTypeLifeMonths(e.target.value)} placeholder="e.g. 60" /></div>
            <Button className="w-full" onClick={() => createAssetType.mutate()} disabled={createAssetType.isPending || !newTypeName || !newTypeCatId}>Create Asset Type</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ADD BRAND DIALOG */}
      <Dialog open={brandOpen} onOpenChange={setBrandOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Add Brand</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Brand Name *</Label><Input value={newBrandName} onChange={(e) => setNewBrandName(e.target.value)} placeholder="e.g. Samsung, LG, Voltas" /></div>
            <Button className="w-full" onClick={() => createBrand.mutate()} disabled={createBrand.isPending || !newBrandName}>Create Brand</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
