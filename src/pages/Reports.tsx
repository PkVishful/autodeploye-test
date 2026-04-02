import { BarChart3 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllRows } from '@/lib/supabase-utils';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';

export default function Reports() {
  const { profile } = useAuth();

  const { data: tenants = [] } = useQuery({ queryKey: ['tenants'], queryFn: () => fetchAllRows((from, to) => supabase.from('tenants').select('*').range(from, to)), enabled: !!profile?.organization_id });
  const { data: allotments = [] } = useQuery({ queryKey: ['tenant_allotments'], queryFn: () => fetchAllRows((from, to) => supabase.from('tenant_allotments').select('*').range(from, to)), enabled: !!profile?.organization_id });
  const { data: beds = [] } = useQuery({ queryKey: ['beds'], queryFn: () => fetchAllRows((from, to) => supabase.from('beds').select('*').range(from, to)), enabled: !!profile?.organization_id });
  const { data: invoices = [] } = useQuery({ queryKey: ['invoices'], queryFn: () => fetchAllRows((from, to) => supabase.from('invoices').select('*').range(from, to)), enabled: !!profile?.organization_id });
  const { data: tickets = [] } = useQuery({ queryKey: ['maintenance_tickets'], queryFn: () => fetchAllRows((from, to) => supabase.from('maintenance_tickets').select('*').range(from, to)), enabled: !!profile?.organization_id });

  const totalBeds = beds.length;
  const occupiedBeds = allotments.filter((a: any) => a.staying_status === 'staying').length;
  const occupancyRate = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;
  const totalRevenue = invoices.filter((i: any) => i.status === 'paid').reduce((s: number, i: any) => s + parseFloat(i.total_amount || 0), 0);
  const pendingPayments = invoices.filter((i: any) => i.status === 'pending').reduce((s: number, i: any) => s + parseFloat(i.total_amount || 0), 0);

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold tracking-tight">Reports</h1><p className="text-sm text-muted-foreground mt-1">Analytics and insights</p></div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card><CardContent className="p-4"><p className="text-2xl font-bold">{tenants.length}</p><p className="text-xs text-muted-foreground">Total Tenants</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-2xl font-bold">{occupancyRate}%</p><p className="text-xs text-muted-foreground">Occupancy Rate</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-2xl font-bold">₹{totalRevenue.toLocaleString()}</p><p className="text-xs text-muted-foreground">Total Revenue</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-2xl font-bold text-warning">₹{pendingPayments.toLocaleString()}</p><p className="text-xs text-muted-foreground">Pending Payments</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-2xl font-bold">{tickets.length}</p><p className="text-xs text-muted-foreground">Total Tickets</p></CardContent></Card>
      </div>

      <Tabs defaultValue="occupancy">
        <TabsList>
          <TabsTrigger value="occupancy">Occupancy</TabsTrigger>
          <TabsTrigger value="revenue">Revenue</TabsTrigger>
          <TabsTrigger value="maintenance">Maintenance</TabsTrigger>
        </TabsList>
        <TabsContent value="occupancy" className="mt-4">
          <Card><CardHeader><CardTitle className="text-base">Occupancy Overview</CardTitle></CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <BarChart3 className="h-16 w-16 mx-auto text-muted-foreground/20 mb-4" />
                <p className="text-3xl font-bold">{occupancyRate}%</p>
                <p className="text-muted-foreground">Current Occupancy</p>
                <p className="text-sm mt-2">{occupiedBeds} / {totalBeds} beds occupied</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="revenue" className="mt-4">
          <Card><CardHeader><CardTitle className="text-base">Revenue Report</CardTitle></CardHeader>
            <CardContent><div className="text-center py-12 text-muted-foreground">Revenue charts will populate as invoices are created</div></CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="maintenance" className="mt-4">
          <Card><CardHeader><CardTitle className="text-base">Maintenance Costs</CardTitle></CardHeader>
            <CardContent><div className="text-center py-12 text-muted-foreground">Maintenance cost analytics will appear as tickets are resolved</div></CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
