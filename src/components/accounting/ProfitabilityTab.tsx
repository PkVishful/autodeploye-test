import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download, TrendingUp, TrendingDown, Building2, ArrowLeft, Search, Gift } from 'lucide-react';
import { computeBedOccupancy } from '@/components/properties/BedHistoryDialog';
import { fmtMonthLabel } from '@/lib/date-utils';
import { format } from 'date-fns';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

const fmtAmt = (v: number) => `₹${new Intl.NumberFormat('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Math.round(v))}`;

interface Props {
  invoices: any[];
  receipts: any[];
  expenses: any[];
  adjustments: any[];
  ownerPayments: any[];
  properties: any[];
  apartments: any[];
  beds: any[];
  allotments: any[];
  ownerContracts?: any[];
  lifecyclePayments?: any[];
  bedRates?: any[];
}

type DrillLevel = 'property' | 'apartment' | 'bed' | 'bedDetail';

/** Look up the current applicable bed rate */
function getBedRate(bed: any, bedRates: any[], propertyId: string | null): number {
  const today = format(new Date(), 'yyyy-MM-dd');
  const match = bedRates.find((r: any) =>
    r.bed_type === bed.bed_type &&
    r.toilet_type === bed.toilet_type &&
    r.property_id === propertyId &&
    r.from_date <= today &&
    (!r.to_date || r.to_date >= today)
  );
  if (match) return Number(match.monthly_rate || 0);
  const fallback = bedRates.find((r: any) =>
    r.bed_type === bed.bed_type &&
    r.toilet_type === bed.toilet_type &&
    !r.property_id &&
    r.from_date <= today &&
    (!r.to_date || r.to_date >= today)
  );
  return fallback ? Number(fallback.monthly_rate || 0) : 0;
}

/** Compute monthly breakdown for a single bed */
function computeBedMonthlyData(
  bed: any, apt: any, propertyId: string | null,
  invoices: any[], expenses: any[], ownerPayments: any[],
  beds: any[], bedRates: any[], ownerContracts: any[]
) {
  // Collect all months from invoices, expenses, owner payments for this apartment
  const months = new Set<string>();
  invoices.filter((i: any) => i.bed_id === bed.id).forEach((i: any) => { if (i.billing_month) months.add(i.billing_month); });
  expenses.filter((e: any) => e.bed_id === bed.id || (e.apartment_id === apt?.id && !e.bed_id)).forEach((e: any) => { if (e.billing_month) months.add(e.billing_month); });
  ownerPayments.filter((p: any) => p.apartment_id === apt?.id).forEach((p: any) => { if (p.payment_month) months.add(p.payment_month); });

  // Also consider apartment live date
  const contract = ownerContracts.find((c: any) => c.apartment_id === apt?.id && c.status === 'active');
  const startDate = contract?.start_date || apt?.start_date;
  if (startDate) {
    const startMonth = startDate.slice(0, 7);
    const now = format(new Date(), 'yyyy-MM');
    let m = startMonth;
    while (m <= now) {
      months.add(m);
      const [y, mo] = m.split('-').map(Number);
      const next = mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, '0')}`;
      m = next;
    }
  }

  const sortedMonths = Array.from(months).sort();
  const aptBeds = beds.filter((b: any) => b.apartment_id === apt?.id);
  const bedRateMap = aptBeds.map((b: any) => ({ bed: b, rate: getBedRate(b, bedRates, propertyId) }));
  const totalApartmentRate = bedRateMap.reduce((s, br) => s + br.rate, 0);
  const bedRate = getBedRate(bed, bedRates, propertyId);
  const weight = totalApartmentRate > 0 ? bedRate / totalApartmentRate : (1 / Math.max(aptBeds.length, 1));

  return sortedMonths.map(month => {
    const bedInvoices = invoices.filter((i: any) => i.bed_id === bed.id && i.billing_month === month);
    const revenue = bedInvoices.reduce((s: number, i: any) => s + Number(i.rent_amount || 0), 0);

    const directBedExp = expenses.filter((e: any) => e.bed_id === bed.id && e.billing_month === month);
    const directExpense = directBedExp.reduce((s: number, e: any) => s + Number(e.amount || 0), 0);

    const sharedAptExp = expenses.filter((e: any) => e.apartment_id === apt?.id && !e.bed_id && e.billing_month === month);
    const totalSharedExpense = sharedAptExp.reduce((s: number, e: any) => s + Number(e.amount || 0), 0);
    const sharedExpenseShare = Math.round(totalSharedExpense * weight);

    const aptRentals = ownerPayments.filter((p: any) => p.apartment_id === apt?.id && p.payment_month === month);
    const totalAptRental = aptRentals.reduce((s: number, p: any) => s + Number(p.escalated_amount || 0), 0);
    const rentalShare = Math.round(totalAptRental * weight);

    const totalExpense = directExpense + sharedExpenseShare;
    const profit = revenue - totalExpense - rentalShare;
    const margin = revenue > 0 ? Math.round((profit / revenue) * 100) : 0;

    return { month, revenue, directExpense, sharedExpenseShare, totalExpense, rentalShare, profit, margin };
  });
}

export function ProfitabilityTab({ invoices, expenses, adjustments, ownerPayments, properties, apartments, beds, allotments, ownerContracts = [], lifecyclePayments = [], bedRates = [] }: Props) {

  const getContractStart = (apartmentId: string) => {
    const c = ownerContracts.find((c: any) => c.apartment_id === apartmentId && c.status === 'active');
    return c?.start_date || null;
  };
  const [drillLevel, setDrillLevel] = useState<DrillLevel>('property');
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  const [selectedApartmentId, setSelectedApartmentId] = useState<string | null>(null);
  const [selectedBedId, setSelectedBedId] = useState<string | null>(null);
  const [monthFilter, setMonthFilter] = useState(format(new Date(), 'yyyy-MM'));
  const [searchQuery, setSearchQuery] = useState('');

  const uniqueMonths = useMemo(() => {
    const months = new Set<string>();
    invoices.forEach((i: any) => { if (i.billing_month) months.add(i.billing_month); });
    return Array.from(months).sort().reverse();
  }, [invoices]);

  const lifecycleByProperty = useMemo(() => {
    const map = new Map<string, number>();
    lifecyclePayments.forEach((lp: any) => {
      if (lp.payment_type === 'advance') return;
      const allotment = allotments.find((a: any) => a.id === lp.allotment_id);
      const propId = allotment?.property_id;
      if (!propId) return;
      if (monthFilter !== 'all') {
        const lpMonth = lp.payment_date?.slice(0, 7);
        if (lpMonth !== monthFilter) return;
      }
      map.set(propId, (map.get(propId) || 0) + Number(lp.amount || 0));
    });
    return map;
  }, [lifecyclePayments, allotments, monthFilter]);

  const totalLifecycleRevenue = useMemo(() => {
    return lifecyclePayments
      .filter((lp: any) => lp.payment_type !== 'advance')
      .filter((lp: any) => monthFilter === 'all' || lp.payment_date?.slice(0, 7) === monthFilter)
      .reduce((s: number, lp: any) => s + Number(lp.amount || 0), 0);
  }, [lifecyclePayments, monthFilter]);

  // Property-level profitability
  const propertyData = useMemo(() => {
    return properties.map((prop: any) => {
      const propInvoices = invoices.filter((i: any) => i.property_id === prop.id && (monthFilter === 'all' || i.billing_month === monthFilter));
      const invoiceRevenue = propInvoices.reduce((s: number, i: any) => s + Number(i.rent_amount || 0), 0);
      const lifecycleRev = lifecycleByProperty.get(prop.id) || 0;
      const revenue = invoiceRevenue + lifecycleRev;

      const propExpenses = expenses.filter((e: any) => e.property_id === prop.id && (monthFilter === 'all' || e.billing_month === monthFilter));
      const totalExpense = propExpenses.reduce((s: number, e: any) => s + Number(e.amount || 0), 0);

      const propRentals = ownerPayments.filter((p: any) => {
        const apt = apartments.find((a: any) => a.id === p.apartment_id);
        return apt?.property_id === prop.id && (monthFilter === 'all' || p.payment_month === monthFilter);
      });
      const rentalCost = propRentals.reduce((s: number, p: any) => s + Number(p.escalated_amount || 0), 0);

      const propAdjCredits = adjustments.filter((a: any) => a.property_id === prop.id && a.adjustment_type === 'credit_note' && (monthFilter === 'all' || a.billing_month === monthFilter)).reduce((s: number, a: any) => s + Number(a.amount || 0), 0);
      const propAdjDebits = adjustments.filter((a: any) => a.property_id === prop.id && a.adjustment_type === 'debit_note' && (monthFilter === 'all' || a.billing_month === monthFilter)).reduce((s: number, a: any) => s + Number(a.amount || 0), 0);

      const propApts = apartments.filter((a: any) => a.property_id === prop.id);
      const propBeds = beds.filter((b: any) => propApts.some((a: any) => a.id === b.apartment_id));
      const totalBeds = propBeds.length;
      const bedOccupancies = propBeds.map((b: any) => {
        const apt = propApts.find((a: any) => a.id === b.apartment_id);
        const contractStart = apt ? getContractStart(apt.id) : null;
        const propStart = prop.start_date || null;
        return computeBedOccupancy(b.id, allotments, contractStart, propStart);
      });
      const occupancy = totalBeds > 0 ? Math.round(bedOccupancies.reduce((s, v) => s + v, 0) / totalBeds) : 0;

      const netRevenue = revenue + propAdjDebits - propAdjCredits;
      const totalCost = totalExpense + rentalCost;
      const profit = netRevenue - totalCost;
      const margin = netRevenue > 0 ? Math.round((profit / netRevenue) * 100) : 0;

      return {
        id: prop.id, name: prop.property_name, revenue, netRevenue, lifecycleRev,
        totalExpense, rentalCost, totalCost, profit, margin,
        totalBeds, occupancy,
        revPerBed: totalBeds > 0 ? Math.round(revenue / totalBeds) : 0,
      };
    });
  }, [properties, invoices, expenses, ownerPayments, adjustments, apartments, beds, allotments, monthFilter, lifecycleByProperty]);

  // Apartment-level profitability
  const apartmentData = useMemo(() => {
    if (!selectedPropertyId) return [];
    const propApts = apartments.filter((a: any) => a.property_id === selectedPropertyId);
    return propApts.map((apt: any) => {
      const aptInvoices = invoices.filter((i: any) => i.apartment_id === apt.id && (monthFilter === 'all' || i.billing_month === monthFilter));
      const revenue = aptInvoices.reduce((s: number, i: any) => s + Number(i.rent_amount || 0), 0);

      const aptExpenses = expenses.filter((e: any) => e.apartment_id === apt.id && (monthFilter === 'all' || e.billing_month === monthFilter));
      const totalExpense = aptExpenses.reduce((s: number, e: any) => s + Number(e.amount || 0), 0);

      const aptRentals = ownerPayments.filter((p: any) => p.apartment_id === apt.id && (monthFilter === 'all' || p.payment_month === monthFilter));
      const rentalCost = aptRentals.reduce((s: number, p: any) => s + Number(p.escalated_amount || 0), 0);

      const aptBeds = beds.filter((b: any) => b.apartment_id === apt.id);
      const totalBedCount = aptBeds.length;
      const bedOccupancies = aptBeds.map((b: any) => {
        const contractStart = getContractStart(apt.id);
        const prop = properties.find((p: any) => p.id === apt.property_id);
        return computeBedOccupancy(b.id, allotments, contractStart, prop?.start_date || null);
      });
      const occupancy = totalBedCount > 0 ? Math.round(bedOccupancies.reduce((s, v) => s + v, 0) / totalBedCount) : 0;

      const totalCost = totalExpense + rentalCost;
      const profit = revenue - totalCost;
      const margin = revenue > 0 ? Math.round((profit / revenue) * 100) : 0;

      return {
        id: apt.id, name: apt.apartment_code, revenue, totalExpense, rentalCost,
        totalCost, profit, margin, totalBeds: totalBedCount, occupancy,
      };
    });
  }, [selectedPropertyId, apartments, invoices, expenses, ownerPayments, beds, allotments, monthFilter]);

  // Bed-level profitability with proportional rental & expense allocation
  const bedData = useMemo(() => {
    if (!selectedApartmentId) return [];
    const aptBeds = beds.filter((b: any) => b.apartment_id === selectedApartmentId);
    const apt = apartments.find((a: any) => a.id === selectedApartmentId);
    const propertyId = apt?.property_id || null;

    const bedRateMap = aptBeds.map((bed: any) => ({ bed, rate: getBedRate(bed, bedRates, propertyId) }));
    const totalApartmentRate = bedRateMap.reduce((s, br) => s + br.rate, 0);

    const aptRentals = ownerPayments.filter((p: any) => p.apartment_id === selectedApartmentId && (monthFilter === 'all' || p.payment_month === monthFilter));
    const totalAptRental = aptRentals.reduce((s: number, p: any) => s + Number(p.escalated_amount || 0), 0);

    const sharedAptExpenses = expenses.filter((e: any) => e.apartment_id === selectedApartmentId && !e.bed_id && (monthFilter === 'all' || e.billing_month === monthFilter));
    const totalSharedExpense = sharedAptExpenses.reduce((s: number, e: any) => s + Number(e.amount || 0), 0);

    return bedRateMap.map(({ bed, rate }) => {
      const weight = totalApartmentRate > 0 ? rate / totalApartmentRate : (1 / aptBeds.length);

      const bedInvoices = invoices.filter((i: any) => i.bed_id === bed.id && (monthFilter === 'all' || i.billing_month === monthFilter));
      const revenue = bedInvoices.reduce((s: number, i: any) => s + Number(i.rent_amount || 0), 0);

      const directBedExpenses = expenses.filter((e: any) => e.bed_id === bed.id && (monthFilter === 'all' || e.billing_month === monthFilter));
      const directExpense = directBedExpenses.reduce((s: number, e: any) => s + Number(e.amount || 0), 0);

      const sharedExpenseShare = Math.round(totalSharedExpense * weight);
      const rentalShare = Math.round(totalAptRental * weight);

      const totalExpense = directExpense + sharedExpenseShare;

      const contractStart = apt ? getContractStart(apt.id) : null;
      const prop = properties.find((p: any) => p.id === apt?.property_id);
      const occupancy = computeBedOccupancy(bed.id, allotments, contractStart, prop?.start_date || null);
      const isOccupied = occupancy > 0;

      const profit = revenue - totalExpense - rentalShare;
      const margin = revenue > 0 ? Math.round((profit / revenue) * 100) : 0;

      return {
        id: bed.id, name: bed.bed_code, revenue, directExpense, sharedExpenseShare, totalExpense,
        rentalShare, profit, margin, isOccupied, occupancy,
        bedType: bed.bed_type, toiletType: bed.toilet_type, bedRate: rate, weight,
      };
    });
  }, [selectedApartmentId, beds, invoices, expenses, apartments, allotments, monthFilter, ownerPayments, bedRates]);

  // Bed detail: month-by-month breakdown for selected bed
  const bedDetailData = useMemo(() => {
    if (!selectedBedId || !selectedApartmentId) return [];
    const bed = beds.find((b: any) => b.id === selectedBedId);
    const apt = apartments.find((a: any) => a.id === selectedApartmentId);
    if (!bed || !apt) return [];
    const propertyId = apt.property_id || null;
    return computeBedMonthlyData(bed, apt, propertyId, invoices, expenses, ownerPayments, beds, bedRates, ownerContracts);
  }, [selectedBedId, selectedApartmentId, beds, apartments, invoices, expenses, ownerPayments, bedRates, ownerContracts]);

  // Summary totals
  const currentData = drillLevel === 'property' ? propertyData : drillLevel === 'apartment' ? apartmentData : drillLevel === 'bed' ? bedData : bedDetailData;
  const totalRevenue = currentData.reduce((s: number, d: any) => s + Number(d.revenue || 0), 0);
  const totalExpensesSum = currentData.reduce((s: number, d: any) => s + Number(d.totalExpense || d.directExpense || 0), 0);
  const totalRental = currentData.reduce((s: number, d: any) => s + Number(d.rentalCost || d.rentalShare || 0), 0);
  const totalCost = totalExpensesSum + totalRental;
  const totalProfit = totalRevenue - totalCost;

  const handleDrillDown = (item: any) => {
    if (drillLevel === 'property') {
      setSelectedPropertyId(item.id);
      setDrillLevel('apartment');
    } else if (drillLevel === 'apartment') {
      setSelectedApartmentId(item.id);
      setDrillLevel('bed');
    } else if (drillLevel === 'bed') {
      setSelectedBedId(item.id);
      setDrillLevel('bedDetail');
    }
  };

  const handleBack = () => {
    if (drillLevel === 'bedDetail') { setDrillLevel('bed'); setSelectedBedId(null); }
    else if (drillLevel === 'bed') { setDrillLevel('apartment'); setSelectedApartmentId(null); }
    else if (drillLevel === 'apartment') { setDrillLevel('property'); setSelectedPropertyId(null); }
  };

  const handleExport = () => {
    const wb = XLSX.utils.book_new();

    if (drillLevel === 'bedDetail') {
      // Export current bed monthly detail
      const selectedBed = beds.find((b: any) => b.id === selectedBedId);
      const data = bedDetailData.map((d: any) => ({
        'Month': fmtMonthLabel(d.month), 'Revenue': d.revenue, 'Direct Expense': d.directExpense,
        'Shared Expense': d.sharedExpenseShare, 'Total Expense': d.totalExpense,
        'Rental Share': d.rentalShare, 'Profit': d.profit, 'Margin %': d.margin,
      }));
      const ws = XLSX.utils.json_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, selectedBed?.bed_code || 'BedDetail');
    } else if (drillLevel === 'bed') {
      // Full report: each bed summary + monthly drill-down
      const apt = apartments.find((a: any) => a.id === selectedApartmentId);
      const propertyId = apt?.property_id || null;

      // Summary sheet
      const summaryData = bedData.map((d: any) => ({
        'Bed': d.name, 'Bed Type': `${d.bedType}/${d.toiletType}`, 'Rate': d.bedRate,
        'Revenue': d.revenue, 'Expenses': d.totalExpense, 'Rental Share': d.rentalShare,
        'Profit': d.profit, 'Margin %': d.margin, 'Occupancy %': d.occupancy,
      }));
      const summaryWs = XLSX.utils.json_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary');

      // Monthly sheet per bed
      const aptBeds = beds.filter((b: any) => b.apartment_id === selectedApartmentId);
      aptBeds.forEach((bed: any) => {
        const monthlyData = computeBedMonthlyData(bed, apt, propertyId, invoices, expenses, ownerPayments, beds, bedRates, ownerContracts);
        const sheetData = monthlyData.map((d: any) => ({
          'Month': fmtMonthLabel(d.month), 'Revenue': d.revenue, 'Direct Expense': d.directExpense,
          'Shared Expense': d.sharedExpenseShare, 'Total Expense': d.totalExpense,
          'Rental Share': d.rentalShare, 'Profit': d.profit, 'Margin %': d.margin,
        }));
        // Add totals row
        const totals = monthlyData.reduce((t: any, d: any) => ({
          revenue: t.revenue + d.revenue, directExpense: t.directExpense + d.directExpense,
          sharedExpenseShare: t.sharedExpenseShare + d.sharedExpenseShare, totalExpense: t.totalExpense + d.totalExpense,
          rentalShare: t.rentalShare + d.rentalShare, profit: t.profit + d.profit,
        }), { revenue: 0, directExpense: 0, sharedExpenseShare: 0, totalExpense: 0, rentalShare: 0, profit: 0 });
        sheetData.push({
          'Month': 'TOTAL', 'Revenue': totals.revenue, 'Direct Expense': totals.directExpense,
          'Shared Expense': totals.sharedExpenseShare, 'Total Expense': totals.totalExpense,
          'Rental Share': totals.rentalShare, 'Profit': totals.profit,
          'Margin %': totals.revenue > 0 ? Math.round((totals.profit / totals.revenue) * 100) : 0,
        });
        const ws = XLSX.utils.json_to_sheet(sheetData);
        const sheetName = (bed.bed_code || bed.id).slice(0, 31);
        XLSX.utils.book_append_sheet(wb, ws, sheetName);
      });
    } else {
      const data = currentData.map((d: any) => ({
        'Name': d.name, 'Revenue': d.revenue, 'Expenses': d.totalExpense || d.directExpense || 0,
        'Rental Cost': d.rentalCost || 0, 'Profit': d.profit, 'Margin %': d.margin,
        ...(d.occupancy !== undefined ? { 'Occupancy %': d.occupancy } : {}),
      }));
      const ws = XLSX.utils.json_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, 'Profitability');
    }

    saveAs(new Blob([XLSX.write(wb, { bookType: 'xlsx', type: 'array' })]), `profitability-${drillLevel}-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  const breadcrumb = useMemo(() => {
    const parts = ['Properties'];
    if (selectedPropertyId) parts.push(properties.find((p: any) => p.id === selectedPropertyId)?.property_name || '');
    if (selectedApartmentId) parts.push(apartments.find((a: any) => a.id === selectedApartmentId)?.apartment_code || '');
    if (selectedBedId) parts.push(beds.find((b: any) => b.id === selectedBedId)?.bed_code || '');
    return parts;
  }, [selectedPropertyId, selectedApartmentId, selectedBedId, properties, apartments, beds]);

  const filteredData = useMemo(() => {
    if (!searchQuery.trim()) return currentData;
    const q = searchQuery.toLowerCase();
    return currentData.filter((d: any) => (d.name || d.month || '').toLowerCase().includes(q));
  }, [currentData, searchQuery]);

  const selectedBedInfo = useMemo(() => {
    if (!selectedBedId) return null;
    const bed = beds.find((b: any) => b.id === selectedBedId);
    const apt = apartments.find((a: any) => a.id === selectedApartmentId);
    if (!bed) return null;
    const rate = getBedRate(bed, bedRates, apt?.property_id || null);
    return { ...bed, rate };
  }, [selectedBedId, beds, apartments, selectedApartmentId, bedRates]);

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card><CardContent className="p-4">
          <div className="flex items-center gap-2 mb-1"><TrendingUp className="h-4 w-4 text-primary" /><span className="text-xs text-muted-foreground">Revenue</span></div>
          <p className="text-xl font-bold">{fmtAmt(totalRevenue)}</p>
        </CardContent></Card>
        {totalLifecycleRevenue > 0 && (
          <Card><CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1"><Gift className="h-4 w-4 text-emerald-500" /><span className="text-xs text-muted-foreground">Lifecycle Revenue</span></div>
            <p className="text-xl font-bold text-emerald-600">{fmtAmt(totalLifecycleRevenue)}</p>
            <p className="text-[10px] text-muted-foreground">Onboarding + Exit fees</p>
          </CardContent></Card>
        )}
        <Card><CardContent className="p-4">
          <div className="flex items-center gap-2 mb-1"><TrendingDown className="h-4 w-4 text-destructive" /><span className="text-xs text-muted-foreground">Total Costs</span></div>
          <p className="text-xl font-bold text-destructive">{fmtAmt(totalCost)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="flex items-center gap-2 mb-1"><Building2 className="h-4 w-4 text-primary" /><span className="text-xs text-muted-foreground">Net Profit</span></div>
          <p className={`text-xl font-bold ${totalProfit >= 0 ? 'text-green-600' : 'text-destructive'}`}>{fmtAmt(totalProfit)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="flex items-center gap-2 mb-1"><span className="text-xs text-muted-foreground">Margin</span></div>
          <p className={`text-xl font-bold ${totalProfit >= 0 ? 'text-green-600' : 'text-destructive'}`}>{totalRevenue > 0 ? Math.round((totalProfit / totalRevenue) * 100) : 0}%</p>
        </CardContent></Card>
      </div>

      {/* Filters & breadcrumb */}
      <div className="flex flex-wrap gap-3 items-center bg-info-panel rounded-lg p-3">
        {drillLevel !== 'property' && (
          <Button variant="ghost" size="sm" className="gap-1" onClick={handleBack}><ArrowLeft className="h-4 w-4" /> Back</Button>
        )}
        <div className="text-sm font-medium text-muted-foreground">{breadcrumb.join(' › ')}</div>
        {drillLevel !== 'bedDetail' && (
          <Select value={monthFilter} onValueChange={setMonthFilter}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Month" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Months</SelectItem>
              {uniqueMonths.map(m => <SelectItem key={m} value={m}>{fmtMonthLabel(m)}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        {drillLevel === 'bedDetail' && selectedBedInfo && (
          <div className="text-xs text-muted-foreground">
            {selectedBedInfo.bed_type} / {selectedBedInfo.toilet_type} — Rate: {fmtAmt(selectedBedInfo.rate)}/mo
          </div>
        )}
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-8 h-9" />
        </div>
        <div className="ml-auto">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={handleExport}><Download className="h-3.5 w-3.5" /> Export</Button>
        </div>
      </div>

      {/* Data Table */}
      <Card>
        <Table>
          <TableHeader className="bg-table-header">
            <TableRow>
              {drillLevel === 'bedDetail' ? (
                <>
                  <TableHead>Month</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-right">Direct Expense</TableHead>
                  <TableHead className="text-right">Shared Expense</TableHead>
                  <TableHead className="text-right">Total Expense</TableHead>
                  <TableHead className="text-right">Rental Share</TableHead>
                  <TableHead className="text-right">Profit</TableHead>
                  <TableHead className="text-right">Margin</TableHead>
                </>
              ) : (
                <>
                  <TableHead>{drillLevel === 'property' ? 'Property' : drillLevel === 'apartment' ? 'Apartment' : 'Bed'}</TableHead>
                  {drillLevel === 'bed' && <TableHead>Bed Type</TableHead>}
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-right">Expenses</TableHead>
                  <TableHead className="text-right">Rental Cost</TableHead>
                  <TableHead className="text-right">Profit</TableHead>
                  <TableHead className="text-right">Margin</TableHead>
                  {drillLevel !== 'bed' && <TableHead className="text-right">Occupancy</TableHead>}
                  {drillLevel !== 'bed' && <TableHead className="text-right">Rev/Bed</TableHead>}
                  {drillLevel === 'bed' && <TableHead className="text-right">Occupancy</TableHead>}
                  {drillLevel === 'bed' && <TableHead>Status</TableHead>}
                </>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredData.length === 0 ? (
              <TableRow><TableCell colSpan={drillLevel === 'bedDetail' ? 8 : drillLevel === 'bed' ? 10 : 8} className="text-center text-muted-foreground py-8">No data</TableCell></TableRow>
            ) : (
              <>
                {filteredData.map((d: any, idx: number) => (
                  drillLevel === 'bedDetail' ? (
                    <TableRow key={d.month} className="even:bg-muted/30">
                      <TableCell className="font-medium">{fmtMonthLabel(d.month)}</TableCell>
                      <TableCell className="text-right">{fmtAmt(d.revenue)}</TableCell>
                      <TableCell className="text-right text-destructive">{fmtAmt(d.directExpense)}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{fmtAmt(d.sharedExpenseShare)}</TableCell>
                      <TableCell className="text-right text-destructive">{fmtAmt(d.totalExpense)}</TableCell>
                      <TableCell className="text-right text-orange-500">{fmtAmt(d.rentalShare)}</TableCell>
                      <TableCell className={`text-right font-semibold ${d.profit >= 0 ? 'text-green-600' : 'text-destructive'}`}>{fmtAmt(d.profit)}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant={d.margin >= 20 ? 'default' : d.margin >= 0 ? 'secondary' : 'destructive'}>{d.margin}%</Badge>
                      </TableCell>
                    </TableRow>
                  ) : (
                    <TableRow key={d.id} className="cursor-pointer hover:bg-muted/50" onClick={() => handleDrillDown(d)}>
                      <TableCell className="font-medium">{d.name}</TableCell>
                      {drillLevel === 'bed' && (
                        <TableCell className="text-xs text-muted-foreground">
                          {d.bedType}{d.toiletType ? ` / ${d.toiletType}` : ''}
                          {d.bedRate > 0 && <span className="ml-1 text-[10px]">({fmtAmt(d.bedRate)})</span>}
                        </TableCell>
                      )}
                      <TableCell className="text-right">{fmtAmt(d.revenue)}</TableCell>
                      <TableCell className="text-right text-destructive">
                        {fmtAmt(d.totalExpense || d.directExpense || 0)}
                        {drillLevel === 'bed' && d.sharedExpenseShare > 0 && (
                          <span className="block text-[10px] text-muted-foreground">
                            (Direct: {fmtAmt(d.directExpense)} + Shared: {fmtAmt(d.sharedExpenseShare)})
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-orange-500">{fmtAmt(d.rentalCost || d.rentalShare || 0)}</TableCell>
                      <TableCell className={`text-right font-semibold ${d.profit >= 0 ? 'text-green-600' : 'text-destructive'}`}>{fmtAmt(d.profit)}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant={d.margin >= 20 ? 'default' : d.margin >= 0 ? 'secondary' : 'destructive'}>{d.margin}%</Badge>
                      </TableCell>
                      {drillLevel !== 'bed' && <TableCell className="text-right">{d.occupancy}%</TableCell>}
                      {drillLevel !== 'bed' && <TableCell className="text-right">{fmtAmt(d.revPerBed || 0)}</TableCell>}
                      {drillLevel === 'bed' && <TableCell className="text-right">{d.occupancy}%</TableCell>}
                      {drillLevel === 'bed' && (
                        <TableCell>
                          <Badge variant={d.isOccupied ? 'default' : 'secondary'}>{d.isOccupied ? 'Occupied' : 'Vacant'}</Badge>
                        </TableCell>
                      )}
                    </TableRow>
                  )
                ))}
                {/* Totals Row */}
                <TableRow className="bg-muted/50 font-bold">
                  <TableCell>Totals</TableCell>
                  {drillLevel === 'bed' && <TableCell />}
                  <TableCell className="text-right">{fmtAmt(totalRevenue)}</TableCell>
                  <TableCell className="text-right text-destructive">
                    {fmtAmt(filteredData.reduce((s: number, d: any) => s + Number(d.totalExpense || d.directExpense || 0), 0))}
                  </TableCell>
                  {drillLevel === 'bedDetail' && (
                    <TableCell className="text-right text-muted-foreground">
                      {fmtAmt(filteredData.reduce((s: number, d: any) => s + Number(d.sharedExpenseShare || 0), 0))}
                    </TableCell>
                  )}
                  {drillLevel === 'bedDetail' && (
                    <TableCell className="text-right text-destructive">
                      {fmtAmt(filteredData.reduce((s: number, d: any) => s + Number(d.totalExpense || 0), 0))}
                    </TableCell>
                  )}
                  <TableCell className="text-right text-orange-500">{fmtAmt(filteredData.reduce((s: number, d: any) => s + Number(d.rentalCost || d.rentalShare || 0), 0))}</TableCell>
                  <TableCell className={`text-right ${totalProfit >= 0 ? 'text-green-600' : 'text-destructive'}`}>{fmtAmt(totalProfit)}</TableCell>
                  <TableCell className="text-right">{totalRevenue > 0 ? Math.round((totalProfit / totalRevenue) * 100) : 0}%</TableCell>
                  {drillLevel !== 'bed' && drillLevel !== 'bedDetail' && <TableCell className="text-right">—</TableCell>}
                  {drillLevel !== 'bed' && drillLevel !== 'bedDetail' && <TableCell className="text-right">—</TableCell>}
                  {drillLevel === 'bed' && <TableCell className="text-right">—</TableCell>}
                  {drillLevel === 'bed' && <TableCell>—</TableCell>}
                </TableRow>
              </>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
