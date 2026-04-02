import { Receipt, IndianRupee, TrendingUp, Wallet, BarChart3 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAccountingData } from '@/hooks/useAccountingData';
import { useRBAC } from '@/hooks/useRBAC';
import { useTabPermissions } from '@/hooks/useTabPermissions';
import { useTicketRole } from '@/hooks/useTicketRole';
import { BillingTab } from '@/components/accounting/BillingTab';
import { InvoicesTab } from '@/components/accounting/InvoicesTab';
import { CollectionsTab } from '@/components/accounting/CollectionsTab';
import { ExpensesTab } from '@/components/accounting/ExpensesTab';
import { SettlementsTab } from '@/components/accounting/SettlementsTab';
import { ReportsTab } from '@/components/accounting/ReportsTab';
import { RentalPaymentsTab } from '@/components/accounting/RentalPaymentsTab';
import { TenantAdjustmentsTab } from '@/components/accounting/TenantAdjustmentsTab';
import { LedgerTab } from '@/components/accounting/LedgerTab';
import { ProfitabilityTab } from '@/components/accounting/ProfitabilityTab';
import { useMemo, useState } from 'react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { formatCurrency } from '@/lib/format-utils';
import { format, subMonths, startOfMonth } from 'date-fns';

/** Format as ₹##,##,###/- */
const fmtINR = (v: number) => `₹${new Intl.NumberFormat('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Math.round(v))}/-`;

const TAB_LABELS: Record<string, string> = {
  billing: 'Generate Bills',
  invoices: 'Invoices',
  adjustments: 'Adjustments',
  collections: 'Collections',
  expenses: 'Expenses',
  rental_payments: 'Rental Payments',
  settlements: 'Settlements',
  ledger: 'Tenant Ledgers',
  profitability: 'Profitability',
  reports: 'Reports',
};

const PRIMARY_TABS = ['billing', 'invoices', 'adjustments', 'collections', 'expenses', 'rental_payments', 'settlements'];
const SECONDARY_TABS = ['ledger', 'profitability', 'reports'];

/** Get FY boundaries: April 1 – March 31 */
function getCurrentFY() {
  const now = new Date();
  const year = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return { start: `${year}-04-01`, end: `${year + 1}-03-31` };
}

export default function Accounting() {
  const data = useAccountingData();
  const { getAccessibleAccountingTabs, canPerform } = useRBAC();
  const { isTabVisible } = useTabPermissions('accounting');
  const { isTenantRole, tenantRecord } = useTicketRole();
  const rbackTabs = [...getAccessibleAccountingTabs(), 'adjustments', 'ledger', 'profitability'];
  const allAllowed = rbackTabs.filter(tab => isTabVisible(tab));

  const primaryVisible = PRIMARY_TABS.filter(t => allAllowed.includes(t));
  const secondaryVisible = SECONDARY_TABS.filter(t => allAllowed.includes(t));
  const accessibleTabs = [...primaryVisible, ...secondaryVisible];

  // --- Financial Year scope toggle ---
  const [scope, setScope] = useState<'fy' | 'all'>('fy');
  const fy = useMemo(() => getCurrentFY(), []);

  // For tenant role, filter invoices and receipts to tenant-specific data
  const tenantInvoices = useMemo(() => {
    if (!isTenantRole || !tenantRecord) return data.invoices;
    return data.invoices.filter((inv: any) => inv.tenant_id === tenantRecord.id);
  }, [data.invoices, isTenantRole, tenantRecord]);

  const tenantReceipts = useMemo(() => {
    if (!isTenantRole || !tenantRecord) return data.receipts;
    return data.receipts.filter((r: any) => {
      const rTenantId = r.tenant_id || r.invoices?.tenant_id;
      return rTenantId === tenantRecord?.id;
    });
  }, [data.receipts, isTenantRole, tenantRecord]);

  // --- Scoped data for KPI cards ---
  const scopedInvoices = useMemo(() => {
    if (scope === 'all') return tenantInvoices;
    return tenantInvoices.filter((inv: any) => {
      const bm = inv.billing_month || inv.invoice_date || inv.created_at;
      if (!bm) return false;
      return bm >= fy.start && bm <= fy.end;
    });
  }, [tenantInvoices, scope, fy]);

  const scopedReceipts = useMemo(() => {
    if (scope === 'all') return tenantReceipts;
    return tenantReceipts.filter((r: any) => {
      const dt = (r.payment_date || r.created_at || '').slice(0, 10);
      if (!dt) return false;
      return dt >= fy.start && dt <= fy.end;
    });
  }, [tenantReceipts, scope, fy]);

  const scopedExpenses = useMemo(() => {
    if (scope === 'all') return data.expenses;
    return data.expenses.filter((e: any) => {
      const dt = e.expense_date || e.created_at;
      if (!dt) return false;
      return dt >= fy.start && dt <= fy.end;
    });
  }, [data.expenses, scope, fy]);

  // KPIs — scoped data
  const rentalRevenue = scopedInvoices.reduce((s: number, i: any) => s + Number(i.rent_amount || 0), 0);
  const ebRevenue = scopedInvoices.reduce((s: number, i: any) => s + Number(i.electricity_amount || 0), 0);
  const totalRevenue = scopedInvoices.reduce((s: number, i: any) => s + Number(i.total_amount || 0), 0);
  const totalCollected = scopedReceipts.reduce((s: number, r: any) => s + Number(r.amount_paid || 0), 0);
  const totalOutstanding = totalRevenue - totalCollected;
  const totalExpenses = isTenantRole ? 0 : scopedExpenses.reduce((s: number, e: any) => s + Number(e.amount || 0), 0);
  const profit = totalRevenue - totalExpenses;

  // --- Revenue Trend Chart (last 12 months, independent of FY toggle) ---
  const trendData = useMemo(() => {
    const now = new Date();
    const months: string[] = [];
    for (let i = 11; i >= 0; i--) {
      months.push(format(startOfMonth(subMonths(now, i)), 'yyyy-MM'));
    }
    const map: Record<string, { month: string; label: string; rental: number; eb: number; total: number }> = {};
    months.forEach(m => {
      map[m] = { month: m, label: format(new Date(m + '-01'), 'MMM yy'), rental: 0, eb: 0, total: 0 };
    });
    tenantInvoices.forEach((inv: any) => {
      const bm = (inv.billing_month || '').slice(0, 7);
      if (map[bm]) {
        map[bm].rental += Number(inv.rent_amount || 0);
        map[bm].eb += Number(inv.electricity_amount || 0);
        map[bm].total += Number(inv.total_amount || 0);
      }
    });
    return months.map(m => map[m]);
  }, [tenantInvoices]);

  const defaultTab = accessibleTabs[0] || 'invoices';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Accounting</h1>
          <p className="text-sm text-muted-foreground mt-1">Billing, collections, expenses, and financial reports</p>
        </div>
        <ToggleGroup
          type="single"
          value={scope}
          onValueChange={(v) => { if (v) setScope(v as 'fy' | 'all'); }}
          className="border border-border rounded-lg p-1 bg-muted/50"
        >
          <ToggleGroupItem value="fy" className="text-xs px-3 py-1.5 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground rounded-md">
            Current FY
          </ToggleGroupItem>
          <ToggleGroupItem value="all" className="text-xs px-3 py-1.5 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground rounded-md">
            Since Beginning
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      <div className={`grid grid-cols-2 md:grid-cols-3 ${isTenantRole ? 'lg:grid-cols-3' : 'lg:grid-cols-5'} gap-4`}>
        {/* Revenue / Rental Card with split */}
        <Card><CardContent className="p-4">
          <div className="flex items-center gap-2 mb-1"><IndianRupee className="h-4 w-4 text-primary" /><span className="text-xs text-muted-foreground">{isTenantRole ? 'Rental' : 'Revenue'}</span></div>
          <p className="text-xl font-bold">{fmtINR(totalRevenue)}</p>
          <div className="mt-1 space-y-0.5">
            <p className="text-xs text-muted-foreground">Rental: <span className="font-medium text-foreground">{fmtINR(rentalRevenue)}</span></p>
            <p className="text-xs text-muted-foreground">EB: <span className="font-medium text-foreground">{fmtINR(ebRevenue)}</span></p>
          </div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="flex items-center gap-2 mb-1"><Wallet className="h-4 w-4 text-green-600" /><span className="text-xs text-muted-foreground">{isTenantRole ? 'Paid' : 'Collected'}</span></div>
          <p className="text-xl font-bold text-green-600">{fmtINR(totalCollected)}</p>
        </CardContent></Card>
        {!isTenantRole && (
          <Card><CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1"><Receipt className="h-4 w-4 text-orange-500" /><span className="text-xs text-muted-foreground">Outstanding</span></div>
            <p className="text-xl font-bold text-orange-500">{fmtINR(totalOutstanding)}</p>
          </CardContent></Card>
        )}
        {!isTenantRole && (
          <Card><CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1"><BarChart3 className="h-4 w-4 text-destructive" /><span className="text-xs text-muted-foreground">Expenses</span></div>
            <p className="text-xl font-bold">{fmtINR(totalExpenses)}</p>
          </CardContent></Card>
        )}
        {!isTenantRole && (
          <Card><CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1"><TrendingUp className="h-4 w-4 text-primary" /><span className="text-xs text-muted-foreground">Profit</span></div>
            <p className={`text-xl font-bold ${profit >= 0 ? 'text-green-600' : 'text-destructive'}`}>{fmtINR(profit)}</p>
          </CardContent></Card>
        )}
        {isTenantRole && (
          <Card><CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1"><Receipt className="h-4 w-4 text-orange-500" /><span className="text-xs text-muted-foreground">Balance</span></div>
            <p className="text-xl font-bold text-orange-500">{fmtINR(totalOutstanding)}</p>
          </CardContent></Card>
        )}
      </div>

      {/* Revenue Trend Chart — Last 12 Months */}
      <Card>
        <CardContent className="p-4">
          <h3 className="text-sm font-semibold mb-3">{isTenantRole ? 'Rental Trends — Last 12 Months' : 'Revenue Trend — Last 12 Months'}</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={trendData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} className="fill-muted-foreground" />
              <Tooltip formatter={(value: number) => formatCurrency(value)} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="rental" name="Rental" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
              <Bar dataKey="eb" name="EB" fill="hsl(var(--accent))" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Tabs defaultValue={defaultTab}>
        {/* Primary Operations Tabs */}
        {primaryVisible.length > 0 && (
          <TabsList className="flex-wrap h-auto gap-1">
            {primaryVisible.map(tab => (
              <TabsTrigger key={tab} value={tab}>{TAB_LABELS[tab] || tab}</TabsTrigger>
            ))}
          </TabsList>
        )}

        {/* Visual divider + Secondary Analysis Tabs */}
        {secondaryVisible.length > 0 && (
          <TabsList className="flex-wrap h-auto gap-1 mt-2 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
            {secondaryVisible.map(tab => (
              <TabsTrigger key={tab} value={tab}>{TAB_LABELS[tab] || tab}</TabsTrigger>
            ))}
          </TabsList>
        )}

        {accessibleTabs.includes('billing') && (
          <TabsContent value="billing" className="mt-4">
            <BillingTab properties={data.properties} apartments={data.apartments} allotments={data.allotments} electricityReadings={data.electricityReadings} tenants={data.tenants} invoices={data.invoices} beds={data.beds} bedRates={data.bedRates} orgId={data.orgId!} />
          </TabsContent>
        )}
        {accessibleTabs.includes('invoices') && (
          <TabsContent value="invoices" className="mt-4"><InvoicesTab invoices={tenantInvoices} receipts={tenantReceipts} properties={data.properties} organization={data.organization} isTenantView={isTenantRole} /></TabsContent>
        )}
        {accessibleTabs.includes('adjustments') && (
          <TabsContent value="adjustments" className="mt-4">
            <TenantAdjustmentsTab adjustments={data.adjustments} tenants={data.tenants} allotments={data.allotments} properties={data.properties} apartments={data.apartments} beds={data.beds} orgId={data.orgId!} />
          </TabsContent>
        )}
        {accessibleTabs.includes('collections') && (
          <TabsContent value="collections" className="mt-4"><CollectionsTab invoices={tenantInvoices} receipts={tenantReceipts} allotments={data.allotments} tenants={data.tenants} apartments={data.apartments} beds={data.beds} orgId={data.orgId!} properties={data.properties} organization={data.organization} bankAccounts={data.bankAccounts} isTenantView={isTenantRole} /></TabsContent>
        )}
        {accessibleTabs.includes('expenses') && (
          <TabsContent value="expenses" className="mt-4"><ExpensesTab expenses={data.expenses} properties={data.properties} apartments={data.apartments} beds={data.beds} vendors={data.vendors} orgId={data.orgId!} /></TabsContent>
        )}
        {accessibleTabs.includes('rental_payments') && (
          <TabsContent value="rental_payments" className="mt-4"><RentalPaymentsTab ownerPayments={data.ownerPayments} properties={data.properties} /></TabsContent>
        )}
        {accessibleTabs.includes('settlements') && (
          <TabsContent value="settlements" className="mt-4"><SettlementsTab settlements={data.settlements} allotments={data.allotments} tenants={data.tenants} invoices={data.invoices} orgId={data.orgId!} properties={data.properties} /></TabsContent>
        )}
        {accessibleTabs.includes('ledger') && (
          <TabsContent value="ledger" className="mt-4">
            <LedgerTab invoices={tenantInvoices} receipts={tenantReceipts} adjustments={data.adjustments} settlements={data.settlements} tenants={data.tenants} allotments={data.allotments} properties={data.properties} apartments={data.apartments} beds={data.beds} lifecyclePayments={data.lifecyclePayments} isTenantView={isTenantRole} tenantId={tenantRecord?.id} />
          </TabsContent>
        )}
        {accessibleTabs.includes('profitability') && (
          <TabsContent value="profitability" className="mt-4">
            <ProfitabilityTab invoices={data.invoices} receipts={data.receipts} expenses={data.expenses} adjustments={data.adjustments} ownerPayments={data.ownerPayments} properties={data.properties} apartments={data.apartments} beds={data.beds} allotments={data.allotments} ownerContracts={data.ownerContracts} lifecyclePayments={data.lifecyclePayments} bedRates={data.bedRates} />
          </TabsContent>
        )}
        {accessibleTabs.includes('reports') && (
          <TabsContent value="reports" className="mt-4">
            <ReportsTab invoices={data.invoices} receipts={data.receipts} expenses={data.expenses} properties={data.properties} apartments={data.apartments} beds={data.beds} allotments={data.allotments} electricityReadings={data.electricityReadings} ownerPayments={data.ownerPayments} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
