import { useState } from 'react';
import {
  Brain, Sparkles, TrendingUp, AlertTriangle, Users, DollarSign,
  Loader2, RefreshCw, Lightbulb, MapPin
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface AIAnalysis {
  issueFrequency: { summary: string; details: string[] };
  predictiveMaintenance: { summary: string; alerts: { location: string; issue: string; recommendation: string }[] };
  employeePerformance: { summary: string; highlights: string[] };
  costAnalysis: { summary: string; insights: string[] };
  generalInsights: string[];
}

interface AIInsightsProps {
  tickets: any[];
  logs: any[];
  teamMembers: any[];
}

export function AIInsights({ tickets, logs, teamMembers }: AIInsightsProps) {
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null);
  const [loading, setLoading] = useState(false);

  const runAnalysis = async () => {
    setLoading(true);
    try {
      // Prepare summarized data for AI (don't send raw IDs, just relevant info)
      const ticketData = {
        totalTickets: tickets.length,
        statusBreakdown: {} as Record<string, number>,
        issueTypes: {} as Record<string, number>,
        apartments: {} as Record<string, number>,
        properties: {} as Record<string, number>,
        priorities: {} as Record<string, number>,
        slaBreaches: 0,
        avgResolutionHours: 0,
        totalCost: 0,
        recentTickets: tickets.slice(0, 50).map(t => ({
          issue: t.issue_types?.name,
          property: t.properties?.property_name,
          apartment: t.apartments?.apartment_code,
          status: t.status,
          priority: t.priority,
          createdAt: t.created_at,
          resolvedAt: t.resolved_at,
          slaDeadline: t.sla_deadline,
        })),
        costEntries: logs.filter(l => l.cost_total > 0).map(l => ({
          item: l.cost_item,
          total: l.cost_total,
          date: l.created_at,
        })),
        employeeData: teamMembers.map(m => ({
          name: `${m.first_name} ${m.last_name}`,
          designation: m.designation,
          activeTickets: tickets.filter(t => t.assigned_to === m.user_id && !['completed', 'closed'].includes(t.status)).length,
          resolvedTickets: tickets.filter(t => t.assigned_to === m.user_id && ['completed', 'closed'].includes(t.status)).length,
        })),
      };

      // Compute aggregates
      tickets.forEach(t => {
        ticketData.statusBreakdown[t.status] = (ticketData.statusBreakdown[t.status] || 0) + 1;
        const issue = t.issue_types?.name || 'Unknown';
        ticketData.issueTypes[issue] = (ticketData.issueTypes[issue] || 0) + 1;
        const apt = t.apartments?.apartment_code || 'Unknown';
        ticketData.apartments[apt] = (ticketData.apartments[apt] || 0) + 1;
        const prop = t.properties?.property_name || 'Unknown';
        ticketData.properties[prop] = (ticketData.properties[prop] || 0) + 1;
        ticketData.priorities[t.priority] = (ticketData.priorities[t.priority] || 0) + 1;
        if (t.sla_deadline && new Date(t.sla_deadline) < new Date() && !['completed', 'closed'].includes(t.status)) {
          ticketData.slaBreaches++;
        }
      });

      const resolved = tickets.filter(t => t.resolved_at);
      if (resolved.length > 0) {
        const totalHours = resolved.reduce((sum, t) =>
          sum + (new Date(t.resolved_at).getTime() - new Date(t.created_at).getTime()) / 3600000, 0
        );
        ticketData.avgResolutionHours = Math.round(totalHours / resolved.length);
      }

      ticketData.totalCost = logs.reduce((sum, l) => sum + (parseFloat(l.cost_total) || 0), 0);

      const { data, error } = await supabase.functions.invoke('ticket-analytics', {
        body: { ticketData },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setAnalysis(data.analysis);
      toast({ title: '✨ AI Analysis Complete' });
    } catch (e: any) {
      toast({ title: 'Analysis failed', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  if (!analysis) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <Brain className="h-12 w-12 text-primary/40 mb-4" />
          <h3 className="text-lg font-semibold mb-2">AI-Powered Maintenance Insights</h3>
          <p className="text-sm text-muted-foreground mb-6 max-w-md">
            Analyze ticket patterns, predict maintenance needs, evaluate employee performance, and identify cost optimization opportunities.
          </p>
          <Button onClick={runAnalysis} disabled={loading || tickets.length === 0} className="gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {loading ? 'Analyzing...' : 'Generate AI Insights'}
          </Button>
          {tickets.length === 0 && <p className="text-xs text-muted-foreground mt-2">Need ticket data to analyze</p>}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">AI Insights</h3>
        </div>
        <Button variant="outline" size="sm" onClick={runAnalysis} disabled={loading} className="gap-1">
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Issue Frequency */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><TrendingUp className="h-4 w-4 text-sky-500" /> Issue Frequency</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm mb-3">{analysis.issueFrequency.summary}</p>
            <ul className="space-y-1">
              {analysis.issueFrequency.details.map((d, i) => (
                <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                  <span className="text-primary mt-0.5">•</span>{d}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* Predictive Maintenance */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-500" /> Predictive Maintenance</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm mb-3">{analysis.predictiveMaintenance.summary}</p>
            {analysis.predictiveMaintenance.alerts.length > 0 && (
              <div className="space-y-2">
                {analysis.predictiveMaintenance.alerts.map((alert, i) => (
                  <div key={i} className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-2.5">
                    <div className="flex items-center gap-1.5 mb-1">
                      <MapPin className="h-3 w-3 text-amber-500" />
                      <span className="text-xs font-medium">{alert.location}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{alert.issue}</p>
                    <p className="text-xs text-primary mt-1">→ {alert.recommendation}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Employee Performance */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><Users className="h-4 w-4 text-emerald-500" /> Employee Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm mb-3">{analysis.employeePerformance.summary}</p>
            <ul className="space-y-1">
              {analysis.employeePerformance.highlights.map((h, i) => (
                <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                  <span className="text-emerald-500 mt-0.5">•</span>{h}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* Cost Analysis */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><DollarSign className="h-4 w-4 text-primary" /> Cost Analysis</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm mb-3">{analysis.costAnalysis.summary}</p>
            <ul className="space-y-1">
              {analysis.costAnalysis.insights.map((ins, i) => (
                <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                  <span className="text-primary mt-0.5">•</span>{ins}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* General Insights */}
      {analysis.generalInsights.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><Lightbulb className="h-4 w-4 text-amber-400" /> Key Recommendations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {analysis.generalInsights.map((insight, i) => (
                <div key={i} className="flex items-start gap-2 bg-muted/50 rounded-lg p-3">
                  <Badge variant="outline" className="text-[10px] mt-0.5">{i + 1}</Badge>
                  <p className="text-xs">{insight}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
