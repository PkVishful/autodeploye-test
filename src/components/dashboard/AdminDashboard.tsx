import { Building2, Users, BedDouble, Wrench, IndianRupee, AlertCircle, Zap, TrendingUp, Receipt, BarChart3, Megaphone } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar } from 'recharts';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllRows } from '@/lib/supabase-utils';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { format, subMonths } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { useTicketRole } from '@/hooks/useTicketRole';
import { ApprovalAlertBanner } from '@/components/dashboard/ApprovalAlertBanner';

const container = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.35 } } };
const pieColors = ['hsl(var(--primary))', 'hsl(142 71% 45%)', 'hsl(35 92% 50%)', 'hsl(var(--muted))'];

export default function AdminDashboard() {
  const { profile, user } = useAuth();
  const { ticketRole, isAdmin, isEmployee } = useTicketRole();
  const orgId = profile?.organization_id;

  const { data: properties = [], isLoading: propsLoading } = useQuery({
    queryKey: ['dash-properties'], queryFn: () => fetchAllRows((from, to) => supabase.from('properties').select('id, property_name').range(from, to)), enabled: !!orgId,
  });
  const { data: beds = [], isLoading: bedsLoading } = useQuery({
    queryKey: ['dash-beds'], queryFn: () => fetchAllRows((from, to) => supabase.from('beds').select('id, status, apartment_id, apartments!beds_apartment_id_fkey!inner(id, status)').eq('status', 'Live').eq('apartments.status', 'Live').range(from, to)), enabled: !!orgId,
  });
  const { data: allotments = [] } = useQuery({
    queryKey: ['dash-allotments'], queryFn: () => fetchAllRows((from, to) => supabase.from('tenant_allotments').select('id, bed_id, staying_status').in('staying_status', ['Staying', 'On-Notice', 'Booked']).range(from, to)), enabled: !!orgId,
  });
  const { data: tenantCount = 0 } = useQuery({
    queryKey: ['dash-tenant-count'], queryFn: async () => { const { count } = await supabase.from('tenants').select('id', { count: 'exact', head: true }); return count || 0; }, enabled: !!orgId,
  });
  const { data: ticketCount = 0 } = useQuery({
    queryKey: ['dash-ticket-count'], queryFn: async () => { const { count } = await supabase.from('maintenance_tickets').select('id', { count: 'exact', head: true }).in('status', ['open', 'in_progress']); return count || 0; }, enabled: !!orgId,
  });
  const { data: invoices = [] } = useQuery({
    queryKey: ['dash-invoices'], queryFn: () => fetchAllRows((from, to) => supabase.from('invoices').select('id, total_amount, rent_amount, electricity_amount, status, invoice_date, billing_month, property_id').range(from, to)), enabled: !!orgId,
  });
  const { data: expenses = [] } = useQuery({
    queryKey: ['dash-expenses'], queryFn: () => fetchAllRows((from, to) => supabase.from('expenses' as any).select('id, amount, category, expense_date, property_id').range(from, to)), enabled: !!orgId,
  });

  // Announcements for admin
  const { data: announcements = [] } = useQuery({
    queryKey: ['dash-announcements', orgId],
    queryFn: () => fetchAllRows((from, to) =>
      supabase.from('announcements').select('*').eq('organization_id', orgId!).eq('is_published', true).order('published_at', { ascending: false }).limit(5).range(from, to)
    ),
    enabled: !!orgId,
  });

  const { data: assignedTickets = [] } = useQuery({
    queryKey: ['dash-assigned-tickets', user?.id],
    queryFn: () => fetchAllRows((from, to) =>
      supabase
        .from('maintenance_tickets')
        .select('id, status, created_at, resolved_at, closed_at, assigned_to')
        .eq('assigned_to', user!.id)
        .range(from, to)
    ),
    enabled: !!orgId && !!user?.id && isEmployee && !isAdmin,
  });

  const isLoading = propsLoading || bedsLoading;

  const { activeBeds, occupiedBeds, vacantBeds, bookedBeds, noticeBeds, totalBeds, occupancyPct } = useMemo(() => {
    const active = beds;
    let occupied = 0, booked = 0, notice = 0, noticeBooked = 0;
    for (const bed of active) {
      const bedAllots = allotments.filter((a: any) => a.bed_id === (bed as any).id);
      const hasStaying = bedAllots.some((a: any) => a.staying_status === 'Staying');
      const hasNotice = bedAllots.some((a: any) => a.staying_status === 'On-Notice');
      const hasBooked = bedAllots.some((a: any) => a.staying_status === 'Booked');
      if (hasStaying) occupied++;
      else if (hasNotice && hasBooked) noticeBooked++;
      else if (hasNotice) notice++;
      else if (hasBooked) booked++;
    }
    const total = active.length;
    const vacant = total - occupied - notice - booked - noticeBooked;
    return { activeBeds: total, occupiedBeds: occupied, vacantBeds: vacant, bookedBeds: booked, noticeBeds: notice + noticeBooked, totalBeds: total, occupancyPct: total > 0 ? Math.round((occupied / total) * 100) : 0 };
  }, [beds, allotments]);
  const liveBeds = activeBeds;

  const totalRevenue = invoices.reduce((s: number, i: any) => s + Number(i.total_amount || 0), 0);
  const pendingAmount = invoices.filter((i: any) => i.status !== 'paid').reduce((s: number, i: any) => s + Number(i.total_amount || 0), 0);
  const totalExpenseAmt = expenses.reduce((s: number, e: any) => s + Number(e.amount || 0), 0);
  const profit = totalRevenue - totalExpenseAmt;
  const ebBilled = invoices.reduce((s: number, i: any) => s + Number(i.electricity_amount || 0), 0);
  const ebActual = expenses.filter((e: any) => e.category === 'eb_actual').reduce((s: number, e: any) => s + Number(e.amount || 0), 0);
  const ebMargin = ebBilled - ebActual;
  const revPerBed = occupiedBeds > 0 ? Math.round(totalRevenue / occupiedBeds) : 0;

  const revenueData = useMemo(() => {
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = subMonths(new Date(), i);
      const key = format(d, 'yyyy-MM');
      const label = format(d, 'MMM');
      const rev = invoices.filter((inv: any) => (inv.billing_month || '').startsWith(key)).reduce((s: number, inv: any) => s + Number(inv.total_amount || 0), 0);
      const exp = expenses.filter((e: any) => (e.expense_date || '').startsWith(key)).reduce((s: number, e: any) => s + Number(e.amount || 0), 0);
      months.push({ month: label, revenue: rev, expenses: exp });
    }
    return months;
  }, [invoices, expenses]);

  const occupancyData = [
    { name: 'Occupied', value: occupiedBeds },
    { name: 'Booked', value: bookedBeds },
    { name: 'Notice', value: noticeBeds },
    { name: 'Vacant', value: vacantBeds || (totalBeds === 0 ? 1 : 0) },
  ].filter(d => d.value > 0 || d.name === 'Vacant');

  const propertyData = useMemo(() => {
    return properties.map((p: any) => {
      const rev = invoices.filter((i: any) => i.property_id === p.id).reduce((s: number, i: any) => s + Number(i.total_amount || 0), 0);
      const exp = expenses.filter((e: any) => e.property_id === p.id).reduce((s: number, e: any) => s + Number(e.amount || 0), 0);
      return { name: p.property_name?.slice(0, 12), revenue: rev, expenses: exp, profit: rev - exp };
    }).filter(p => p.revenue > 0 || p.expenses > 0);
  }, [properties, invoices, expenses]);

  const stats = [
    { label: 'Properties', value: String(properties.length), icon: Building2, color: 'text-primary' },
    { label: 'Tenants', value: String(tenantCount), icon: Users, color: 'text-success' },
    { label: 'Live Beds', value: String(liveBeds), icon: BedDouble, color: 'text-accent' },
    { label: 'Active Tickets', value: String(ticketCount), icon: Wrench, color: 'text-destructive' },
    { label: 'Revenue', value: `₹${(totalRevenue / 1000).toFixed(0)}K`, icon: IndianRupee, color: 'text-primary' },
    { label: 'Outstanding', value: `₹${(pendingAmount / 1000).toFixed(0)}K`, icon: AlertCircle, color: 'text-accent' },
    { label: 'Profit', value: `₹${(profit / 1000).toFixed(0)}K`, icon: TrendingUp, color: profit >= 0 ? 'text-success' : 'text-destructive' },
    { label: 'Occupancy', value: `${occupancyPct}%`, icon: BarChart3, color: 'text-primary' },
    { label: 'Rev/Bed', value: `₹${revPerBed.toLocaleString()}`, icon: Receipt, color: 'text-primary' },
    { label: 'EB Margin', value: `₹${ebMargin.toLocaleString()}`, icon: Zap, color: ebMargin >= 0 ? 'text-success' : 'text-destructive' },
  ];

  const priorityColors: Record<string, string> = {
    urgent: 'bg-destructive text-destructive-foreground',
    important: 'bg-warning text-warning-foreground',
    normal: 'bg-secondary text-secondary-foreground',
  };

  if (isEmployee && !isAdmin) {
    const openCount = assignedTickets.filter((ticket: any) => ['open', 'assigned', 'reassigned'].includes(ticket.status)).length;
    const inProgressCount = assignedTickets.filter((ticket: any) => ticket.status === 'in_progress').length;
    const waitingApprovalCount = assignedTickets.filter((ticket: any) => ticket.status === 'pending_tenant_approval').length;
    const partsPendingCount = assignedTickets.filter((ticket: any) => ticket.status === 'waiting_for_parts').length;
    const closedTickets = assignedTickets.filter((ticket: any) => ['completed', 'closed'].includes(ticket.status));
    const averageCloseTime = closedTickets.length
      ? Math.round(
          closedTickets.reduce((sum: number, ticket: any) => {
            const endTime = ticket.closed_at || ticket.resolved_at;
            if (!endTime) return sum;
            return sum + (new Date(endTime).getTime() - new Date(ticket.created_at).getTime()) / (1000 * 60 * 60);
          }, 0) / closedTickets.length
        )
      : 0;

    const scopedStats = [
      { label: 'Open Tickets', value: String(openCount), icon: Wrench, color: 'text-destructive' },
      { label: 'In Progress', value: String(inProgressCount), icon: BarChart3, color: 'text-primary' },
      { label: 'Waiting Approval', value: String(waitingApprovalCount), icon: AlertCircle, color: 'text-accent' },
      { label: 'Parts Pending', value: String(partsPendingCount), icon: Receipt, color: 'text-warning' },
      { label: 'Closed Tickets', value: String(closedTickets.length), icon: TrendingUp, color: 'text-success' },
      { label: 'Avg Close Time', value: `${averageCloseTime}h`, icon: IndianRupee, color: 'text-primary' },
    ];

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Your assigned ticket performance overview</p>
        </div>

        <ApprovalAlertBanner />

        <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {scopedStats.map((stat) => (
            <motion.div key={stat.label} variants={item}>
              <Card className="hover:shadow-md transition-shadow">
                <CardContent className="p-3">
                  <div className="flex items-center gap-2">
                    <div className={`p-1.5 rounded-lg bg-secondary ${stat.color}`}><stat.icon className="h-3.5 w-3.5" /></div>
                    <div>
                      <p className="text-sm font-bold leading-tight">{stat.value}</p>
                      <p className="text-[9px] text-muted-foreground leading-tight">{stat.label}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Overview of your property management system</p>
      </div>

      <ApprovalAlertBanner />

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-5 lg:grid-cols-10 gap-3">
          {Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
        </div>
      ) : (
        <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-2 md:grid-cols-5 lg:grid-cols-10 gap-3">
          {stats.map(s => (
            <motion.div key={s.label} variants={item}>
              <Card className="hover:shadow-md transition-shadow">
                <CardContent className="p-3">
                  <div className="flex items-center gap-2">
                    <div className={`p-1.5 rounded-lg bg-secondary ${s.color}`}><s.icon className="h-3.5 w-3.5" /></div>
                    <div>
                      <p className="text-sm font-bold leading-tight">{s.value}</p>
                      <p className="text-[9px] text-muted-foreground leading-tight">{s.label}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Announcements - only show when available */}
      {announcements.length > 0 && (
        <motion.div variants={item} initial="hidden" animate="show">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Megaphone className="h-4 w-4 text-primary" /> Announcements
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {announcements.slice(0, 3).map((a: any) => (
                  <div key={a.id} className="p-2.5 rounded-lg border bg-card hover:bg-accent/20 transition-colors">
                    <div className="flex items-center gap-2 mb-0.5">
                      <Badge className={`text-[10px] ${priorityColors[a.priority] || priorityColors.normal}`}>
                        {a.priority}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">
                        {a.published_at ? format(new Date(a.published_at), 'dd MMM') : ''}
                      </span>
                    </div>
                    <h3 className="text-sm font-semibold">{a.title}</h3>
                    <p className="text-xs text-muted-foreground line-clamp-1">{a.content}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.div variants={item} initial="hidden" animate="show" className="lg:col-span-2">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base font-semibold">Revenue vs Expenses</CardTitle></CardHeader>
            <CardContent>
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={revenueData}>
                    <defs>
                      <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.3} /><stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} /></linearGradient>
                      <linearGradient id="expGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="hsl(var(--destructive))" stopOpacity={0.2} /><stop offset="100%" stopColor="hsl(var(--destructive))" stopOpacity={0} /></linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} />
                    <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" fill="url(#revGrad)" strokeWidth={2} name="Revenue" />
                    <Area type="monotone" dataKey="expenses" stroke="hsl(var(--destructive))" fill="url(#expGrad)" strokeWidth={2} name="Expenses" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={item} initial="hidden" animate="show">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base font-semibold">Occupancy Rate</CardTitle></CardHeader>
            <CardContent>
              <div className="h-[280px] flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={occupancyData} innerRadius={70} outerRadius={100} paddingAngle={4} dataKey="value">
                      {occupancyData.map((_, i) => <Cell key={i} fill={pieColors[i]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap justify-center gap-3 mt-2">
                <div className="flex items-center gap-1.5 text-xs"><div className="h-3 w-3 rounded-full" style={{ backgroundColor: pieColors[0] }} /> Occupied ({occupiedBeds})</div>
                <div className="flex items-center gap-1.5 text-xs"><div className="h-3 w-3 rounded-full" style={{ backgroundColor: pieColors[1] }} /> Booked ({bookedBeds})</div>
                <div className="flex items-center gap-1.5 text-xs"><div className="h-3 w-3 rounded-full" style={{ backgroundColor: pieColors[2] }} /> Notice ({noticeBeds})</div>
                <div className="flex items-center gap-1.5 text-xs"><div className="h-3 w-3 rounded-full" style={{ backgroundColor: pieColors[3] }} /> Vacant ({vacantBeds})</div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {propertyData.length > 0 && (
        <motion.div variants={item} initial="hidden" animate="show">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base font-semibold">Property Performance</CardTitle></CardHeader>
            <CardContent>
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={propertyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} />
                    <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Revenue" />
                    <Bar dataKey="expenses" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} name="Expenses" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}
