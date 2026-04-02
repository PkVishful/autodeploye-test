import { useMemo } from 'react';
import { calculateWorkingHoursElapsed } from '@/lib/date-utils';
import {
  AlertTriangle, CheckCircle2, Clock, Wrench, TrendingUp, TrendingDown,
  DollarSign, Users, Timer, BarChart3, ThumbsUp
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { format, subDays, differenceInHours, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import type { TicketUserRole } from '@/hooks/useTicketRole';

interface TicketsDashboardProps {
  tickets: any[];
  allTickets: any[];
  logs: any[];
  teamMembers: any[];
  ticketRole: TicketUserRole;
}

export function TicketsDashboard({ tickets, allTickets, logs, teamMembers, ticketRole }: TicketsDashboardProps) {
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  // Use role-filtered tickets for metrics
  const displayTickets = tickets;

  const stats = useMemo(() => {
    const open = displayTickets.filter(t => !['completed', 'closed'].includes(t.status));
    const today = new Date().toDateString();
    const resolvedToday = displayTickets.filter(t => t.resolved_at && new Date(t.resolved_at).toDateString() === today);

    const slaViolations = displayTickets.filter(t =>
      t.sla_deadline && new Date(t.sla_deadline) < now && !['completed', 'closed'].includes(t.status)
    );

    const slaWarnings = displayTickets.filter(t => {
      if (!t.sla_deadline || ['completed', 'closed'].includes(t.status)) return false;
      const deadline = new Date(t.sla_deadline);
      const slaHours = t.issue_types?.sla_hours || 24;
      const totalMs = slaHours * 3600000;
      const slaStart = new Date(deadline.getTime() - totalMs);
      const elapsed = calculateWorkingHoursElapsed(slaStart, now);
      const pct = (elapsed / totalMs) * 100;
      return pct >= 50 && pct < 100;
    });

    // Avg resolution time (hours) for completed tickets this month
    const completedThisMonth = displayTickets.filter(t =>
      t.resolved_at && isWithinInterval(new Date(t.resolved_at), { start: monthStart, end: monthEnd })
    );
    const avgResolution = completedThisMonth.length > 0
      ? completedThisMonth.reduce((sum, t) => sum + differenceInHours(new Date(t.resolved_at), new Date(t.created_at)), 0) / completedThisMonth.length
      : 0;

    // Monthly cost
    const monthlyCost = logs
      .filter(l => l.cost_total && l.created_at && isWithinInterval(new Date(l.created_at), { start: monthStart, end: monthEnd }))
      .reduce((sum, l) => sum + (parseFloat(l.cost_total) || 0), 0);

    // Issue type distribution
    const issueDistribution: Record<string, number> = {};
    displayTickets.forEach(t => {
      const name = t.issue_types?.name || 'Unknown';
      issueDistribution[name] = (issueDistribution[name] || 0) + 1;
    });
    const topIssues = Object.entries(issueDistribution)
      .sort(([, a], [, b]) => (b as number) - (a as number))
      .slice(0, 5);

    // Employee performance (admin view only)
    const employeeStats: Record<string, { name: string; resolved: number; active: number; avgHours: number }> = {};
    if (ticketRole === 'admin') {
      allTickets.forEach(t => {
        if (!t.assigned_to) return;
        const member = teamMembers.find(m => m.user_id === t.assigned_to);
        const name = member ? `${member.first_name} ${member.last_name}` : 'Unknown';
        if (!employeeStats[t.assigned_to]) {
          employeeStats[t.assigned_to] = { name, resolved: 0, active: 0, avgHours: 0 };
        }
        if (['completed', 'closed'].includes(t.status)) {
          employeeStats[t.assigned_to].resolved += 1;
          if (t.resolved_at) {
            const hours = differenceInHours(new Date(t.resolved_at), new Date(t.created_at));
            employeeStats[t.assigned_to].avgHours += hours;
          }
        } else {
          employeeStats[t.assigned_to].active += 1;
        }
      });
      Object.values(employeeStats).forEach(s => {
        if (s.resolved > 0) s.avgHours = Math.round(s.avgHours / s.resolved);
      });
    }

    return {
      total: displayTickets.length,
      open: open.length,
      resolvedToday: resolvedToday.length,
      slaViolations: slaViolations.length,
      slaWarnings: slaWarnings.length,
      avgResolution: Math.round(avgResolution),
      monthlyCost,
      completedThisMonth: completedThisMonth.length,
      topIssues,
      employeeStats: Object.values(employeeStats).sort((a, b) => b.resolved - a.resolved),
      slaViolationTickets: slaViolations,
      slaWarningTickets: slaWarnings,
      pendingApproval: displayTickets.filter(t => t.status === 'pending_tenant_approval').length,
      closed: displayTickets.filter(t => ['completed', 'closed'].includes(t.status)).length,
    };
  }, [displayTickets, allTickets, logs, teamMembers, now, ticketRole]);

  // Tenant-specific dashboard
  if (ticketRole === 'tenant') {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard icon={Wrench} iconColor="text-primary" label="Total Tickets" value={stats.total} />
          <KpiCard icon={AlertTriangle} iconColor="text-amber-500" label="Active" value={stats.open} />
          <KpiCard icon={CheckCircle2} iconColor="text-emerald-500" label="Resolved" value={stats.closed} />
          <KpiCard icon={Clock} iconColor="text-violet-500" label="Pending Approval" value={stats.pendingApproval} alert={stats.pendingApproval > 0} />
        </div>
      </div>
    );
  }

  // Employee/Technician-specific dashboard
  if (ticketRole === 'employee' || ticketRole === 'technician') {
    const openCount = displayTickets.filter(t => ['open', 'assigned', 'reassigned'].includes(t.status)).length;
    const inProgress = displayTickets.filter(t => ['in_progress', 'waiting_for_parts'].includes(t.status)).length;
    const waitingApproval = displayTickets.filter(t => t.status === 'pending_tenant_approval').length;
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <KpiCard icon={AlertTriangle} iconColor="text-amber-500" label="Open" value={openCount} />
          <KpiCard icon={Clock} iconColor="text-sky-500" label="In Progress" value={inProgress} />
          <KpiCard icon={ThumbsUp} iconColor="text-violet-500" label="Waiting Approval" value={waitingApproval} />
          <KpiCard icon={CheckCircle2} iconColor="text-emerald-500" label="Closed" value={stats.closed} />
          <KpiCard icon={Timer} iconColor="text-primary" label="Avg Close Time" value={`${stats.avgResolution}h`} />
        </div>
      </div>
    );
  }

  // Admin / Super Admin dashboard - full view
  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard icon={AlertTriangle} iconColor="text-destructive" label="Open" value={stats.open} />
        <KpiCard icon={CheckCircle2} iconColor="text-emerald-500" label="Resolved Today" value={stats.resolvedToday} />
        <KpiCard icon={Clock} iconColor="text-destructive" label="SLA Breached" value={stats.slaViolations} alert={stats.slaViolations > 0} />
        <KpiCard icon={Timer} iconColor="text-amber-500" label="SLA Warning" value={stats.slaWarnings} />
        <KpiCard icon={BarChart3} iconColor="text-sky-500" label="Avg Resolution" value={`${stats.avgResolution}h`} />
        <KpiCard icon={DollarSign} iconColor="text-primary" label="Cost (Month)" value={`₹${stats.monthlyCost.toLocaleString()}`} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* SLA Alerts */}
        {(stats.slaViolations > 0 || stats.slaWarnings > 0) && (
          <Card className="border-destructive/30">
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-destructive" /> SLA Alerts</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {stats.slaViolationTickets.map((t: any) => (
                <div key={t.id} className="flex items-center justify-between text-sm bg-destructive/5 p-2 rounded">
                  <div>
                    <span className="font-mono text-xs">{t.ticket_number}</span>
                    <span className="text-muted-foreground ml-2">{t.issue_types?.name}</span>
                  </div>
                  <Badge variant="destructive" className="text-[10px]">BREACHED</Badge>
                </div>
              ))}
              {stats.slaWarningTickets.map((t: any) => (
                <div key={t.id} className="flex items-center justify-between text-sm bg-amber-500/5 p-2 rounded">
                  <div>
                    <span className="font-mono text-xs">{t.ticket_number}</span>
                    <span className="text-muted-foreground ml-2">{t.issue_types?.name}</span>
                  </div>
                  <Badge className="text-[10px] bg-amber-100 text-amber-700 border-amber-200">WARNING</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Top Issue Categories */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Top Issue Categories</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {stats.topIssues.map(([name, count]) => (
              <div key={name}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">{name}</span>
                  <span className="font-medium">{count as number}</span>
                </div>
                <Progress value={((count as number) / stats.total) * 100} className="h-1.5" />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Employee Performance */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Users className="h-4 w-4" /> Employee Performance</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.employeeStats.slice(0, 5).map((emp, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <div>
                    <p className="font-medium">{emp.name}</p>
                    <p className="text-xs text-muted-foreground">{emp.active} active • Avg {emp.avgHours}h</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-emerald-600 dark:text-emerald-400">{emp.resolved}</p>
                    <p className="text-[10px] text-muted-foreground">resolved</p>
                  </div>
                </div>
              ))}
              {stats.employeeStats.length === 0 && <p className="text-sm text-muted-foreground text-center py-2">No data</p>}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function KpiCard({ icon: Icon, iconColor, label, value, alert }: {
  icon: any; iconColor: string; label: string; value: string | number; alert?: boolean;
}) {
  return (
    <Card className={alert ? 'border-destructive animate-pulse' : ''}>
      <CardContent className="p-3 flex items-center gap-3">
        <Icon className={`h-5 w-5 flex-shrink-0 ${iconColor}`} />
        <div>
          <p className="text-lg font-bold leading-none">{value}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}
