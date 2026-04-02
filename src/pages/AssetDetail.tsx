import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { format, differenceInMonths } from 'date-fns';
import { Package, Wrench, ShieldCheck, Calendar, IndianRupee, Building2, BedDouble, DoorOpen } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const fmtDate = (d: string | null) => {
  if (!d) return '—';
  try { return format(new Date(d), 'dd-MMM-yy'); } catch { return d; }
};

export default function AssetDetail() {
  const { id } = useParams<{ id: string }>();
  const [asset, setAsset] = useState<any>(null);
  const [allocation, setAllocation] = useState<any>(null);
  const [maintenance, setMaintenance] = useState<any[]>([]);
  const [depreciation, setDepreciation] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      const [assetRes, allocRes, maintRes, depRes] = await Promise.all([
        supabase.from('assets').select('*, asset_types(name, asset_categories(name), expected_life_months), vendors(vendor_name, phone, email)').eq('id', id).single(),
        supabase.from('asset_allocations').select('*, properties(property_name), apartments(apartment_code), beds(bed_code)').eq('asset_id', id).order('created_at', { ascending: false }).limit(1),
        supabase.from('asset_maintenance_logs').select('*').eq('asset_id', id).order('maintenance_date', { ascending: false }),
        supabase.from('asset_depreciation').select('*').eq('asset_id', id).limit(1),
      ]);
      setAsset(assetRes.data);
      setAllocation(allocRes.data?.[0] || null);
      setMaintenance(maintRes.data || []);
      setDepreciation(depRes.data?.[0] || null);
      setLoading(false);
    };
    load();
  }, [id]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!asset) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Card className="p-8 text-center"><Package className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" /><p className="text-muted-foreground">Asset not found</p></Card>
    </div>
  );

  const warrantyExpiry = asset.purchase_date && asset.warranty_months
    ? new Date(new Date(asset.purchase_date).setMonth(new Date(asset.purchase_date).getMonth() + asset.warranty_months))
    : null;
  const warrantyActive = warrantyExpiry ? warrantyExpiry > new Date() : false;
  const warrantyMonthsLeft = warrantyExpiry ? Math.max(0, differenceInMonths(warrantyExpiry, new Date())) : 0;

  const expectedLife = asset.asset_types?.expected_life_months;
  const ageMonths = asset.purchase_date ? differenceInMonths(new Date(), new Date(asset.purchase_date)) : 0;
  const lifetimePercent = expectedLife ? Math.min(100, Math.round((ageMonths / expectedLife) * 100)) : null;

  const totalMaintenanceCost = maintenance.reduce((s, m) => s + (parseFloat(m.repair_cost) || 0), 0);

  return (
    <div className="min-h-screen bg-background p-4 md:p-8 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="h-14 w-14 rounded-xl bg-primary/10 flex items-center justify-center">
          <Package className="h-7 w-7 text-primary" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{asset.asset_code}</h1>
          <p className="text-sm text-muted-foreground">{asset.asset_types?.asset_categories?.name} → {asset.asset_types?.name}</p>
        </div>
        <StatusBadge status={asset.status} type="asset" />
      </div>

      {/* Key Info Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-4 text-center">
          <IndianRupee className="h-5 w-5 mx-auto text-primary mb-1" />
          <p className="text-xl font-bold">₹{(asset.purchase_price || 0).toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">Purchase Price</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <ShieldCheck className={`h-5 w-5 mx-auto mb-1 ${warrantyActive ? 'text-emerald-600' : 'text-destructive'}`} />
          <p className="text-xl font-bold">{warrantyActive ? `${warrantyMonthsLeft}m` : 'Expired'}</p>
          <p className="text-xs text-muted-foreground">Warranty</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <Wrench className="h-5 w-5 mx-auto text-amber-600 mb-1" />
          <p className="text-xl font-bold">{maintenance.length}</p>
          <p className="text-xs text-muted-foreground">Maintenance Records</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <Calendar className="h-5 w-5 mx-auto text-primary mb-1" />
          <p className="text-xl font-bold">{ageMonths}m</p>
          <p className="text-xs text-muted-foreground">Age</p>
        </CardContent></Card>
      </div>

      {/* Purchase & Asset Details */}
      <Card>
        <CardHeader><CardTitle className="text-base">Asset Details</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <div><span className="text-muted-foreground">Brand:</span> <span className="font-medium">{asset.brand || '—'}</span></div>
            <div><span className="text-muted-foreground">Model:</span> <span className="font-medium">{asset.model || '—'}</span></div>
            <div><span className="text-muted-foreground">Serial #:</span> <span className="font-medium font-mono">{asset.serial_number || '—'}</span></div>
            <div><span className="text-muted-foreground">Purchase Date:</span> <span className="font-medium">{fmtDate(asset.purchase_date)}</span></div>
            <div><span className="text-muted-foreground">Invoice #:</span> <span className="font-medium">{asset.invoice_number || '—'}</span></div>
            <div><span className="text-muted-foreground">Invoice Date:</span> <span className="font-medium">{fmtDate(asset.invoice_date)}</span></div>
            <div><span className="text-muted-foreground">Condition:</span> <span className="font-medium capitalize">{asset.condition || '—'}</span></div>
            <div><span className="text-muted-foreground">Warranty:</span> <span className="font-medium">{asset.warranty_months ? `${asset.warranty_months} months` : '—'}</span></div>
            {warrantyExpiry && <div><span className="text-muted-foreground">Warranty Expires:</span> <span className="font-medium">{fmtDate(warrantyExpiry.toISOString())}</span></div>}
          </div>
          {asset.notes && <div className="border-t pt-3 mt-3"><span className="text-muted-foreground text-sm">Notes:</span> <p className="text-sm mt-1">{asset.notes}</p></div>}
        </CardContent>
      </Card>

      {/* Vendor Details */}
      <Card>
        <CardHeader><CardTitle className="text-base">Vendor</CardTitle></CardHeader>
        <CardContent>
          {asset.vendors ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              <div><span className="text-muted-foreground">Name:</span> <span className="font-medium">{asset.vendors.vendor_name}</span></div>
              <div><span className="text-muted-foreground">Phone:</span> <span className="font-medium">{asset.vendors.phone || '—'}</span></div>
              <div><span className="text-muted-foreground">Email:</span> <span className="font-medium">{asset.vendors.email || '—'}</span></div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{asset.vendor_name_manual || 'General Vendor'}</p>
          )}
        </CardContent>
      </Card>

      {/* Lifetime Progress */}
      {lifetimePercent !== null && (
        <Card>
          <CardHeader><CardTitle className="text-base">Lifetime Usage</CardTitle></CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="h-3 bg-muted rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${lifetimePercent > 80 ? 'bg-destructive' : lifetimePercent > 50 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${lifetimePercent}%` }} />
                </div>
              </div>
              <span className="text-sm font-medium">{lifetimePercent}%</span>
            </div>
            <p className="text-xs text-muted-foreground mt-2">{ageMonths} of {expectedLife} months used</p>
          </CardContent>
        </Card>
      )}

      {/* Allocation */}
      {allocation && (
        <Card>
          <CardHeader><CardTitle className="text-base">Current Allocation</CardTitle></CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 text-sm">
              {allocation.properties?.property_name && <div className="flex items-center gap-1"><Building2 className="h-4 w-4 text-muted-foreground" />{allocation.properties.property_name}</div>}
              {allocation.apartments?.apartment_code && <div className="flex items-center gap-1"><DoorOpen className="h-4 w-4 text-muted-foreground" />{allocation.apartments.apartment_code}</div>}
              {allocation.beds?.bed_code && <div className="flex items-center gap-1"><BedDouble className="h-4 w-4 text-muted-foreground" />{allocation.beds.bed_code}</div>}
              <span className="text-muted-foreground">since {fmtDate(allocation.allocated_date)}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Depreciation */}
      {depreciation && (
        <Card>
          <CardHeader><CardTitle className="text-base">Depreciation</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div><span className="text-muted-foreground">Purchase Price:</span> <span className="font-medium">₹{(depreciation.purchase_price || 0).toLocaleString()}</span></div>
              <div><span className="text-muted-foreground">Current Book Value:</span> <span className="font-medium">₹{(depreciation.current_book_value || 0).toLocaleString()}</span></div>
              <div><span className="text-muted-foreground">Yearly Depreciation:</span> <span className="font-medium">₹{(depreciation.yearly_depreciation || 0).toLocaleString()}</span></div>
              <div><span className="text-muted-foreground">Useful Life:</span> <span className="font-medium">{depreciation.useful_life_years || '—'} years</span></div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Maintenance History */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Maintenance History</CardTitle>
            <Badge variant="secondary">Total Cost: ₹{totalMaintenanceCost.toLocaleString()}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          {maintenance.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No maintenance records</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Issue</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Cost</TableHead>
                  <TableHead>Next Due</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {maintenance.map((m: any) => (
                  <TableRow key={m.id}>
                    <TableCell>{fmtDate(m.maintenance_date)}</TableCell>
                    <TableCell className="capitalize">{m.maintenance_type}</TableCell>
                    <TableCell>{m.issue || '—'}</TableCell>
                    <TableCell>{m.vendor || '—'}</TableCell>
                    <TableCell>₹{m.repair_cost || 0}</TableCell>
                    <TableCell>{fmtDate(m.next_service_due)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
