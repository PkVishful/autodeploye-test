import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface Props {
  invoices: any[];
  receipts: any[];
  expenses: any[];
  properties: any[];
  apartments: any[];
  beds: any[];
  allotments: any[];
  electricityReadings: any[];
  ownerPayments: any[];
}

export function ReportsTab({ invoices, receipts, expenses, properties, apartments, beds, allotments, electricityReadings, ownerPayments }: Props) {
  const [reportType, setReportType] = useState('pnl_property');

  // P&L per property
  const propertyPnL = useMemo(() => {
    return properties.map((prop: any) => {
      const propInvoices = invoices.filter((i: any) => i.property_id === prop.id);
      const revenue = propInvoices.reduce((s: number, i: any) => s + Number(i.total_amount || 0), 0);
      const collected = propInvoices.filter((i: any) => i.status === 'paid').reduce((s: number, i: any) => s + Number(i.total_amount || 0), 0);
      const rentRevenue = propInvoices.reduce((s: number, i: any) => s + Number(i.rent_amount || 0), 0);
      const ebBilled = propInvoices.reduce((s: number, i: any) => s + Number(i.electricity_amount || 0), 0);

      const propExpenses = expenses.filter((e: any) => e.property_id === prop.id);
      const totalExpense = propExpenses.reduce((s: number, e: any) => s + Number(e.amount || 0), 0);
      const ebActual = propExpenses.filter((e: any) => e.category === 'eb_actual').reduce((s: number, e: any) => s + Number(e.amount || 0), 0);

      const propApts = apartments.filter((a: any) => a.property_id === prop.id);
      const propBeds = beds.filter((b: any) => propApts.some((a: any) => a.id === b.apartment_id));
      const totalBeds = propBeds.length;
      const occupiedBeds = propBeds.filter((b: any) => b.status === 'live').length;
      const occupancy = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;

      const profit = revenue - totalExpense;

      return {
        ...prop,
        revenue, collected, rentRevenue, ebBilled, ebActual,
        totalExpense, profit, totalBeds, occupiedBeds, occupancy,
        ebVariance: ebBilled - ebActual,
        revPerBed: occupiedBeds > 0 ? Math.round(revenue / occupiedBeds) : 0,
      };
    });
  }, [invoices, expenses, properties, apartments, beds]);

  // Bed-level profitability
  const bedProfitability = useMemo(() => {
    return beds.map((bed: any) => {
      const apt = apartments.find((a: any) => a.id === bed.apartment_id);
      const prop = apt ? properties.find((p: any) => p.id === apt.property_id) : null;

      // Revenue from this bed's invoices
      const bedInvoices = invoices.filter((i: any) => i.bed_id === bed.id);
      const revenue = bedInvoices.reduce((s: number, i: any) => s + Number(i.total_amount || 0), 0);

      // Costs allocated to this bed
      const bedExpenses = expenses.filter((e: any) => e.bed_id === bed.id);
      const directCost = bedExpenses.reduce((s: number, e: any) => s + Number(e.amount || 0), 0);

      // Shared property costs (allocate by bed count)
      const propBeds = apt ? beds.filter((b: any) => {
        const bApt = apartments.find((a: any) => a.id === b.apartment_id);
        return bApt && bApt.property_id === apt.property_id;
      }) : [];
      const occupiedCount = propBeds.filter((b: any) => b.status === 'live').length || 1;

      const propSharedExpenses = prop ? expenses.filter((e: any) => e.property_id === prop.id && !e.apartment_id && !e.bed_id) : [];
      const sharedCost = propSharedExpenses.reduce((s: number, e: any) => s + Number(e.amount || 0), 0) / occupiedCount;

      const totalCost = directCost + sharedCost;
      const profit = revenue - totalCost;

      return {
        bed_code: bed.bed_code,
        bed_type: bed.bed_type,
        status: bed.status,
        property_name: prop?.property_name || '—',
        apartment_code: apt?.apartment_code || '—',
        revenue,
        totalCost: Math.round(totalCost),
        profit: Math.round(profit),
        isLoss: profit < 0,
      };
    }).filter(b => b.status === 'live');
  }, [beds, apartments, properties, invoices, expenses]);

  // EB Reconciliation
  const ebRecon = useMemo(() => {
    return properties.map((prop: any) => {
      const propInvoices = invoices.filter((i: any) => i.property_id === prop.id);
      const ebBilled = propInvoices.reduce((s: number, i: any) => s + Number(i.electricity_amount || 0), 0);
      const propExpenses = expenses.filter((e: any) => e.property_id === prop.id && e.category === 'eb_actual');
      const ebActual = propExpenses.reduce((s: number, e: any) => s + Number(e.amount || 0), 0);
      const variance = ebBilled - ebActual;
      const variancePct = ebActual > 0 ? Math.round((variance / ebActual) * 100) : 0;
      return { property_name: prop.property_name, ebBilled, ebActual, variance, variancePct };
    }).filter(r => r.ebBilled > 0 || r.ebActual > 0);
  }, [invoices, expenses, properties]);

  return (
    <div className="space-y-4">
      <Tabs value={reportType} onValueChange={setReportType}>
        <TabsList>
          <TabsTrigger value="pnl_property">P&L by Property</TabsTrigger>
          <TabsTrigger value="bed_profit">Bed Profitability</TabsTrigger>
          <TabsTrigger value="eb_recon">EB Reconciliation</TabsTrigger>
        </TabsList>

        <TabsContent value="pnl_property" className="mt-4">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Property</TableHead>
                  <TableHead>Revenue</TableHead>
                  <TableHead>Expenses</TableHead>
                  <TableHead>Profit</TableHead>
                  <TableHead>Occupancy</TableHead>
                  <TableHead>Rev/Bed</TableHead>
                  <TableHead>EB Margin</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {propertyPnL.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No data</TableCell></TableRow>
                ) : propertyPnL.map((p: any) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.property_name}</TableCell>
                    <TableCell>₹{p.revenue.toLocaleString()}</TableCell>
                    <TableCell>₹{p.totalExpense.toLocaleString()}</TableCell>
                    <TableCell className={p.profit >= 0 ? 'text-green-600 font-semibold' : 'text-destructive font-semibold'}>
                      <span className="flex items-center gap-1">
                        {p.profit >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                        ₹{Math.abs(p.profit).toLocaleString()}
                      </span>
                    </TableCell>
                    <TableCell>{p.occupancy}%</TableCell>
                    <TableCell>₹{p.revPerBed.toLocaleString()}</TableCell>
                    <TableCell className={p.ebVariance >= 0 ? 'text-green-600' : 'text-destructive'}>
                      ₹{p.ebVariance.toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="bed_profit" className="mt-4">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bed</TableHead>
                  <TableHead>Property</TableHead>
                  <TableHead>Apartment</TableHead>
                  <TableHead>Revenue</TableHead>
                  <TableHead>Cost</TableHead>
                  <TableHead>Profit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bedProfitability.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No occupied beds</TableCell></TableRow>
                ) : bedProfitability.map((b, i) => (
                  <TableRow key={i} className={b.isLoss ? 'bg-destructive/5' : ''}>
                    <TableCell className="font-mono">{b.bed_code}</TableCell>
                    <TableCell className="text-xs">{b.property_name}</TableCell>
                    <TableCell className="font-mono text-xs">{b.apartment_code}</TableCell>
                    <TableCell>₹{b.revenue.toLocaleString()}</TableCell>
                    <TableCell>₹{b.totalCost.toLocaleString()}</TableCell>
                    <TableCell className={b.isLoss ? 'text-destructive font-semibold' : 'text-green-600 font-semibold'}>
                      <span className="flex items-center gap-1">
                        {b.isLoss ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
                        ₹{Math.abs(b.profit).toLocaleString()}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="eb_recon" className="mt-4">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Property</TableHead>
                  <TableHead>EB Billed</TableHead>
                  <TableHead>EB Actual</TableHead>
                  <TableHead>Variance</TableHead>
                  <TableHead>Variance %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ebRecon.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No EB data</TableCell></TableRow>
                ) : ebRecon.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{r.property_name}</TableCell>
                    <TableCell>₹{r.ebBilled.toLocaleString()}</TableCell>
                    <TableCell>₹{r.ebActual.toLocaleString()}</TableCell>
                    <TableCell className={r.variance >= 0 ? 'text-green-600 font-semibold' : 'text-destructive font-semibold'}>
                      {r.variance >= 0 ? '+' : ''}₹{r.variance.toLocaleString()}
                    </TableCell>
                    <TableCell className={r.variance >= 0 ? 'text-green-600' : 'text-destructive'}>
                      {r.variancePct >= 0 ? '+' : ''}{r.variancePct}%
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
