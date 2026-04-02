import { Wrench, Receipt, IndianRupee, Megaphone } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { useTicketRole } from '@/hooks/useTicketRole';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllRows } from '@/lib/supabase-utils';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { ApprovalAlertBanner } from '@/components/dashboard/ApprovalAlertBanner';

const container = { hidden: {}, show: { transition: { staggerChildren: 0.08 } } };
const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.35 } } };

export default function TenantDashboard() {
  const { profile } = useAuth();
  const { tenantRecord } = useTicketRole();
  const orgId = profile?.organization_id;

  const { data: tickets = [], isLoading: ticketsLoading } = useQuery({
    queryKey: ['tenant-dash-tickets', tenantRecord?.id],
    queryFn: async () => {
      const { data } = await supabase.from('maintenance_tickets')
        .select('id, status, ticket_number, created_at, issue_types(name)')
        .eq('tenant_id', tenantRecord!.id)
        .order('created_at', { ascending: false })
        .limit(10);
      return data || [];
    },
    enabled: !!tenantRecord?.id,
  });

  const { data: invoices = [], isLoading: invoicesLoading } = useQuery({
    queryKey: ['tenant-dash-invoices', tenantRecord?.id],
    queryFn: async () => {
      const { data } = await supabase.from('invoices')
        .select('id, billing_month, total_amount, balance, status')
        .eq('tenant_id', tenantRecord!.id)
        .order('created_at', { ascending: false })
        .limit(10);
      return data || [];
    },
    enabled: !!tenantRecord?.id,
  });

  const { data: announcements = [] } = useQuery({
    queryKey: ['tenant-announcements', orgId],
    queryFn: async () => {
      const { data } = await supabase.from('announcements')
        .select('*')
        .eq('organization_id', orgId!)
        .eq('is_published', true)
        .order('published_at', { ascending: false })
        .limit(5);
      return data || [];
    },
    enabled: !!orgId,
  });

  const openTickets = tickets.filter((t: any) => !['completed', 'closed'].includes(t.status)).length;
  const pendingInvoices = invoices.filter((i: any) => i.status !== 'paid').length;
  const totalDue = invoices.filter((i: any) => i.status !== 'paid').reduce((s: number, i: any) => s + Number(i.balance || 0), 0);

  const stats = [
    { label: 'Open Tickets', value: String(openTickets), icon: Wrench, color: 'text-accent' },
    { label: 'Pending Invoices', value: String(pendingInvoices), icon: Receipt, color: 'text-primary' },
    { label: 'Total Due', value: `₹${totalDue.toLocaleString('en-IN')}`, icon: IndianRupee, color: totalDue > 0 ? 'text-destructive' : 'text-success' },
  ];

  const priorityColors: Record<string, string> = {
    urgent: 'bg-destructive text-destructive-foreground',
    important: 'bg-warning text-warning-foreground',
    normal: 'bg-secondary text-secondary-foreground',
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Welcome, {tenantRecord?.full_name || profile?.full_name || 'Tenant'}</h1>
        <p className="text-sm text-muted-foreground mt-1">Your dashboard overview</p>
      </div>

      <ApprovalAlertBanner />

      {/* Stats */}
      <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {stats.map(s => (
          <motion.div key={s.label} variants={item}>
            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="p-4 flex items-center gap-4">
                {ticketsLoading || invoicesLoading ? (
                  <Skeleton className="h-12 w-full" />
                ) : (
                  <>
                    <div className={`p-3 rounded-xl bg-secondary ${s.color}`}><s.icon className="h-5 w-5" /></div>
                    <div>
                      <p className="text-2xl font-bold leading-tight">{s.value}</p>
                      <p className="text-xs text-muted-foreground">{s.label}</p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>

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
              <div className="space-y-3">
                {announcements.map((a: any) => (
                  <div key={a.id} className="p-3 rounded-lg border bg-card hover:bg-accent/30 transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge className={`text-[10px] ${priorityColors[a.priority] || priorityColors.normal}`}>
                            {a.priority === 'urgent' ? '🔴' : a.priority === 'important' ? '🟡' : '🟢'} {a.priority}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground">
                            {a.published_at ? format(new Date(a.published_at), 'dd MMM yyyy') : ''}
                          </span>
                        </div>
                        <h3 className="text-sm font-semibold">{a.title}</h3>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{a.content}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

    </div>
  );
}
