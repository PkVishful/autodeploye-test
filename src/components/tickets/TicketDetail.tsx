import { useState, useMemo, useRef } from 'react';
import { calculateWorkingHoursDeadline, calculateWorkingHoursElapsed } from '@/lib/date-utils';
import {
  Clock, User, MapPin, AlertTriangle, MessageSquare, Camera, DollarSign,
  ArrowRightLeft, CheckCircle2, Play, Pause, Package, Send, ChevronRight,
  Image as ImageIcon, X, Upload, Stethoscope, Timer, ThumbsUp, ThumbsDown,
  ShieldCheck, ShieldX, ShoppingCart, FileText, Receipt, Download
} from 'lucide-react';
import { DiagnosticFlow } from './DiagnosticFlow';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { FileUploadField } from '@/components/shared/FileUploadField';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import { useTicketRole } from '@/hooks/useTicketRole';
import { format, formatDistanceToNow } from 'date-fns';

const TICKET_STATUSES = [
  { value: 'open', label: 'Open', icon: AlertTriangle, color: 'text-red-500' },
  { value: 'assigned', label: 'Assigned', icon: User, color: 'text-amber-500' },
  { value: 'in_progress', label: 'In Progress', icon: Play, color: 'text-sky-500' },
  { value: 'waiting_for_cost_approval', label: 'Waiting for Cost Approval', icon: Receipt, color: 'text-indigo-500' },
  { value: 'waiting_for_parts', label: 'Waiting for Parts', icon: Package, color: 'text-slate-500' },
  
  { value: 'completed', label: 'Completed', icon: CheckCircle2, color: 'text-emerald-500' },
  { value: 'pending_tenant_approval', label: 'Pending Tenant Approval', icon: ThumbsUp, color: 'text-violet-500' },
  { value: 'pending_admin_approval', label: 'Pending Admin Approval', icon: ThumbsUp, color: 'text-indigo-500' },
  { value: 'closed', label: 'Closed', icon: Pause, color: 'text-gray-500' },
];

interface TicketDetailProps {
  ticket: any;
  onClose: () => void;
}

export function TicketDetail({ ticket, onClose }: TicketDetailProps) {
  const { profile, user, roles } = useAuth();
  const { ticketRole, isAdmin, isTenantRole, isEmployee, tenantRecord } = useTicketRole();
  const queryClient = useQueryClient();
  const [reassignForm, setReassignForm] = useState({ employee_id: '', reason: '' });
  const [showReassign, setShowReassign] = useState(false);
  const [showDiagnostic, setShowDiagnostic] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showReject, setShowReject] = useState(false);
  const [showCostEstimate, setShowCostEstimate] = useState(false);
  const [costEstimateItems, setCostEstimateItems] = useState<{ item_name: string; cost_type: string; quantity: number; unit_price: number }[]>([]);
  const [showPurchase, setShowPurchase] = useState(false);
  const [purchaseForm, setPurchaseForm] = useState({
    cost_estimate_id: '', item_name: '', quantity: 1, actual_cost: 0,
    vendor_id: '', vendor_name_manual: '', vendor_pan: '', vendor_address: '', vendor_mobile: '',
    invoice_url: null as string | null,
  });
  const [showDeclineDialog, setShowDeclineDialog] = useState(false);
  const [declineEstimateId, setDeclineEstimateId] = useState('');
  const [declineReason, setDeclineReason] = useState('');
  const [employeeDiagnosticNotes, setEmployeeDiagnosticNotes] = useState('');
  const [showDiagAccept, setShowDiagAccept] = useState(false);
  const [lastDiagResult, setLastDiagResult] = useState<any>(null);
  const costSubmitGuardRef = useRef(false);

  // Fetch logs
  const { data: logs = [] } = useQuery({
    queryKey: ['ticket_logs', ticket.id],
    queryFn: async () => {
      const { data } = await supabase.from('ticket_logs')
        .select('*')
        .eq('ticket_id', ticket.id)
        .order('created_at', { ascending: true });
      if (!data) return [];
      const performerIds = [...new Set(data.map(l => l.created_by).filter(Boolean))];
      let profileMap: Record<string, string> = {};
      if (performerIds.length > 0) {
        const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', performerIds);
        if (profiles) profileMap = Object.fromEntries(profiles.map(p => [p.id, p.full_name || 'Unknown']));
      }
      return data.map(log => ({ ...log, performer_name: log.created_by ? (profileMap[log.created_by] || 'System') : 'System' }));
    },
  });

  // Fetch team members
  const { data: teamMembers = [] } = useQuery({
    queryKey: ['team_members_active'],
    queryFn: async () => {
      const { data } = await supabase.from('team_members').select('id, first_name, last_name, user_id, designation, email, phone').eq('status', 'active');
      return data || [];
    },
  });

  // Fetch org profiles
  const { data: orgProfiles = [] } = useQuery({
    queryKey: ['org_profiles', profile?.organization_id],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('id, full_name, email, phone').eq('organization_id', profile?.organization_id!);
      return data || [];
    },
    enabled: !!profile?.organization_id,
  });

  // Fetch eligible assignees via SECURITY DEFINER RPC (bypasses RLS on user_roles)
  const { data: eligibleAssignees = [] } = useQuery({
    queryKey: ['eligible_assignees', ticket.assigned_to],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_eligible_assignees', {
        _exclude_user_id: ticket.assigned_to || null,
      });
      if (error) { console.error('Eligible assignees error:', error); return []; }
      return data || [];
    },
  });

  // Check if current user is an authorized approver (ONLY from cost_estimate_approvers table)
  const { data: isApprover = false } = useQuery({
    queryKey: ['is_cost_approver', user?.id, ticket.property_id, ticket.issue_type_id],
    queryFn: async () => {
      if (!user?.id) return false;
      // Check global scope first, then property/issue-type specific
      const { data } = await supabase.from('cost_estimate_approvers')
        .select('id, scope_type, property_id, issue_type_id')
        .eq('approver_user_id', user.id);
      if (!data?.length) return false;
      // Match: global, or matching property, or matching issue type
      return data.some((rule: any) => {
        if (rule.scope_type === 'global') return true;
        if (rule.scope_type === 'property' && rule.property_id === ticket.property_id) return true;
        if (rule.scope_type === 'issue_type' && rule.issue_type_id === ticket.issue_type_id) return true;
        return false;
      });
    },
    enabled: !!user?.id,
  });

  // Fetch cost estimates for this ticket
  const { data: costEstimates = [] } = useQuery({
    queryKey: ['ticket_cost_estimates', ticket.id],
    queryFn: async () => {
      const { data } = await supabase.from('ticket_cost_estimates')
        .select('*')
        .eq('ticket_id', ticket.id)
        .order('created_at', { ascending: true });
      return data || [];
    },
  });

  // Fetch purchases for this ticket
  const { data: purchases = [] } = useQuery({
    queryKey: ['ticket_purchases', ticket.id],
    queryFn: async () => {
      const { data } = await supabase.from('ticket_purchases')
        .select('*')
        .eq('ticket_id', ticket.id)
        .order('created_at', { ascending: true });
      return data || [];
    },
  });

  // Fetch vendors
  const { data: vendors = [] } = useQuery({
    queryKey: ['vendors_list'],
    queryFn: async () => {
      const { data } = await supabase.from('vendors').select('id, vendor_name').eq('status', 'active');
      return data || [];
    },
  });

  // Fetch existing diagnostic session
  const { data: diagnosticSession } = useQuery({
    queryKey: ['diagnostic_session', ticket.id],
    queryFn: async () => {
      const { data } = await supabase.from('diagnostic_sessions')
        .select('*')
        .eq('ticket_id', ticket.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  // Fetch creator's roles to determine if ticket was created by admin/PM
  const { data: creatorUserRoles = [] } = useQuery({
    queryKey: ['creator_roles', ticket.created_by],
    queryFn: async () => {
      if (!ticket.created_by) return [];
      const { data } = await supabase.from('user_roles').select('role').eq('user_id', ticket.created_by);
      return data || [];
    },
    enabled: !!ticket.created_by,
  });

  const ADMIN_ROLES = ['super_admin', 'org_admin', 'property_manager'];
  const isCreatorAdmin = ticket.created_by && creatorUserRoles.some((r: any) => ADMIN_ROLES.includes(r.role));
  const isCreatorTenant = !isCreatorAdmin;

  // SLA calculations
  const slaDeadline = ticket.sla_deadline ? new Date(ticket.sla_deadline) : null;
  const now = new Date();
  const created = new Date(ticket.created_at);
  // Fetch actual SLA hours from issue_types so the progress bar resets correctly on reassignment
  const { data: issueTypeSla } = useQuery({
    queryKey: ['issue_type_sla', ticket.issue_type_id],
    queryFn: async () => {
      const { data } = await supabase.from('issue_types')
        .select('sla_hours').eq('id', ticket.issue_type_id).maybeSingle();
      return data?.sla_hours || 24;
    },
    enabled: !!ticket.issue_type_id,
  });
  const slaHours = issueTypeSla || 24;
  const totalSlaMs = slaHours * 60 * 60 * 1000;
  const slaStartLog = logs.length > 0
    ? [...logs].reverse().find((l: any) =>
        l.action?.toLowerCase().includes('ticket reassigned') ||
        l.action?.toLowerCase().includes('status changed to assigned') ||
        l.action?.toLowerCase().includes('ticket created')
      )
    : null;
  const slaStartTime = slaStartLog ? new Date(slaStartLog.created_at) : created;
  const elapsedMs = calculateWorkingHoursElapsed(slaStartTime, now);
  const slaPercent = totalSlaMs > 0 ? Math.min(100, (elapsedMs / totalSlaMs) * 100) : 0;
  const slaExceeded = slaDeadline ? now > slaDeadline : false;
  const slaWarning = slaPercent >= 50 && !slaExceeded;
  const isActiveTicket = !['completed', 'closed', 'pending_tenant_approval', 'pending_admin_approval', 'waiting_for_cost_approval'].includes(ticket.status);
  const isPendingApproval = ticket.status === 'pending_tenant_approval' || ticket.status === 'pending_admin_approval';
  const hasDiagnostic = !!ticket.diagnostic_data ||
    (!!diagnosticSession && diagnosticSession.performed_by === ticket.assigned_to);
  const hasPendingEstimates = costEstimates.some((e: any) => e.status === 'pending');
  const isAssignedToMe = ticket.assigned_to === user?.id;

  // Actions visible ONLY to the assigned user — no one else can act
  const canShowActions = isActiveTicket && isAssignedToMe;
  // Approval ONLY from cost_estimate_approvers table — NO admin fallback
  const canApprove = isApprover;

  // SLA pause: timer pauses when status is pending_tenant_approval or waiting_for_parts with pending estimates
  const isSlaPaused = ticket.status === 'pending_tenant_approval' || ticket.status === 'pending_admin_approval' || ticket.status === 'waiting_for_cost_approval' || (ticket.status === 'waiting_for_parts' && hasPendingEstimates);

  const totalCost = purchases.reduce((sum: number, p: any) => sum + (parseFloat(p.actual_cost) || 0), 0);

  // Time efficiency metrics
  const timeMetrics = useMemo(() => {
    const findLogTime = (actionMatch: string) => {
      const log = [...logs].reverse().find((l: any) => l.action?.toLowerCase().includes(actionMatch));
      return log ? new Date(log.created_at) : null;
    };
    const reassignedAt = findLogTime('ticket reassigned');
    const firstAssigned = findLogTime('status changed to assigned') || findLogTime('ticket created');
    const assignedAt = reassignedAt && firstAssigned && reassignedAt > firstAssigned ? reassignedAt : firstAssigned;
    const startedAt = findLogTime('status changed to in_progress') || findLogTime('work started');
    const completedAt = findLogTime('status changed to completed') || findLogTime('status changed to pending_tenant_approval') || findLogTime('status changed to pending_admin_approval') || findLogTime('work completed');
    const formatDuration = (ms: number) => {
      const totalMinutes = Math.floor(ms / 60000);
      if (totalMinutes < 60) return `${totalMinutes}m`;
      const hours = Math.floor(totalMinutes / 60);
      const mins = totalMinutes % 60;
      if (hours < 24) return `${hours}h ${mins}m`;
      const days = Math.floor(hours / 24);
      return `${days}d ${hours % 24}h`;
    };
    return {
      responseTime: assignedAt && startedAt ? formatDuration(calculateWorkingHoursElapsed(assignedAt, startedAt)) : null,
      workDuration: startedAt && completedAt ? formatDuration(calculateWorkingHoursElapsed(startedAt, completedAt)) : null,
      totalTime: assignedAt && completedAt ? formatDuration(calculateWorkingHoursElapsed(assignedAt, completedAt)) : null,
    };
  }, [logs]);

  // Helper: extend SLA deadline by paused working hours when resuming from a paused state
  const extendSlaForPausedTime = async (ticketId: string) => {
    // Fetch fresh deadline from DB (not stale React state)
    const { data: freshTicket } = await supabase.from('maintenance_tickets')
      .select('sla_deadline').eq('id', ticketId).single();
    if (!freshTicket?.sla_deadline) return;

    // Fetch recent logs directly from DB
    const { data: recentLogs } = await supabase.from('ticket_logs')
      .select('created_at, action')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: false })
      .limit(30);

    // Broader pause action matching
    const pauseActions = [
      'cost estimate submitted',
      'waiting_for_cost_approval',
      'pending_tenant_approval',
      'pending_admin_approval',
      'status changed to pending',
      'status changed to waiting',
      'awaiting approval',
    ];

    const pauseLog = recentLogs?.find((l: any) =>
      pauseActions.some(pa => l.action?.toLowerCase().includes(pa))
    );
    if (!pauseLog) return;

    const pausedAt = new Date(pauseLog.created_at);
    const resumeNow = new Date();
    const pausedWorkingMs = calculateWorkingHoursElapsed(pausedAt, resumeNow);

    if (pausedWorkingMs > 0) {
      const currentDeadline = new Date(freshTicket.sla_deadline);
      const newDeadline = calculateWorkingHoursDeadline(
        currentDeadline,
        pausedWorkingMs / 3600000
      );
      await supabase.from('maintenance_tickets')
        .update({ sla_deadline: newDeadline })
        .eq('id', ticketId);
    }
  };

  // Save diagnostic result + create diagnostic_sessions record + optionally submit parts for approval
  const saveDiagnostic = useMutation({
    mutationFn: async (data: { answers: { question: string; answer: string }[]; result: { cause: string; severity: string; estimatedCost: string; recommendation: string }; fullDiagnosis?: any; parts?: { item_name: string; cost_type: string; quantity: number; unit_price: number }[]; submitForApproval?: boolean }) => {
      const qaText = data.answers.map(a => `Q: ${a.question}\nA: ${a.answer}`).join('\n\n');
      const resultText = `\n\n--- DIAGNOSIS ---\nCause: ${data.result.cause}\nSeverity: ${data.result.severity}\nEst. Cost: ${data.result.estimatedCost}\nRecommendation: ${data.result.recommendation}`;

      // Save to diagnostic_sessions table
      await supabase.from('diagnostic_sessions').insert({
        ticket_id: ticket.id,
        organization_id: profile.organization_id,
        issue_type_id: ticket.issue_type_id,
        performed_by: user?.id,
        questions_answers: data.answers as any,
        ai_diagnosis: (data.fullDiagnosis || data.result) as any,
        status: 'completed',
        completed_at: new Date().toISOString(),
      } as any);

      // Save to ticket_logs
      const { error } = await supabase.from('ticket_logs').insert({
        ticket_id: ticket.id, action: 'Diagnostic completed', notes: qaText + resultText, created_by: user?.id,
      } as any);
      if (error) throw error;

      // Update maintenance_tickets diagnostic_data
      await supabase.from('maintenance_tickets')
        .update({ diagnostic_data: { answers: data.answers, result: data.result, performed_at: new Date().toISOString() } as any })
        .eq('id', ticket.id);

      // If parts are provided and submitForApproval is true, submit cost estimates
      if (data.submitForApproval && data.parts && data.parts.length > 0) {
        const inserts = data.parts.map(item => ({
          ticket_id: ticket.id,
          organization_id: profile.organization_id,
          item_name: item.item_name,
          cost_type: item.cost_type,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total: item.quantity * item.unit_price,
          submitted_by: user?.id,
          status: 'pending',
        }));
        const { error: estError } = await supabase.from('ticket_cost_estimates').insert(inserts as any);
        if (estError) throw estError;
        const totalEst = inserts.reduce((s, i) => s + i.total, 0);
        await supabase.from('ticket_logs').insert({
          ticket_id: ticket.id, action: 'Cost estimate submitted',
          notes: `${inserts.length} items totalling ₹${totalEst.toLocaleString()} submitted for approval (from diagnosis).`,
          created_by: user?.id,
        } as any);
        await supabase.from('maintenance_tickets').update({ status: 'waiting_for_cost_approval' }).eq('id', ticket.id);

        // Send SMS to approver(s)
        try {
          const { data: approvers } = await supabase.from('cost_estimate_approvers')
            .select('approver_user_id')
            .eq('organization_id', profile.organization_id);
          if (approvers?.length) {
            const approverIds = [...new Set(approvers.map(a => a.approver_user_id))];
            const { data: approverProfiles } = await supabase.from('profiles')
              .select('phone').in('id', approverIds);
            const phones = approverProfiles?.map(p => p.phone).filter(Boolean) || [];
            for (const phone of phones) {
              supabase.functions.invoke('ticket-notifications', {
                body: { event: 'cost_approval', ticketNumber: ticket.ticket_number, phoneNumber: phone },
              }).catch(console.error);
            }
          }
        } catch (e) { console.error('SMS notification error:', e); }
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['ticket_logs', ticket.id] });
      queryClient.invalidateQueries({ queryKey: ['maintenance_tickets'] });
      queryClient.invalidateQueries({ queryKey: ['diagnostic_session', ticket.id] });
      queryClient.invalidateQueries({ queryKey: ['ticket_cost_estimates', ticket.id] });
      setShowDiagnostic(false);
      if (variables.submitForApproval) {
        toast({ title: 'Diagnosis saved & cost estimates submitted for approval' });
      } else {
        // Auto-transition to in_progress — no modal review
        supabase.from('maintenance_tickets')
          .update({ status: 'in_progress' })
          .eq('id', ticket.id)
          .then(() => {
            queryClient.invalidateQueries({ queryKey: ['maintenance_tickets'] });
          });
        toast({ title: 'Diagnostic completed — ticket moved to In Progress' });
      }
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  // Employee accepts or provides own diagnosis
  const saveEmployeeDiagnosticResponse = useMutation({
    mutationFn: async (accepted: boolean) => {
      const notes = accepted
        ? 'Employee accepted the system diagnostic.'
        : `Employee provided own diagnosis: ${employeeDiagnosticNotes}`;
      await supabase.from('ticket_logs').insert({
        ticket_id: ticket.id, action: accepted ? 'Diagnostic accepted' : 'Employee diagnosis provided',
        notes, created_by: user?.id,
      } as any);
      // Update diagnostic session with employee override if not accepted
      if (!accepted && diagnosticSession?.id) {
        await supabase.from('diagnostic_sessions')
          .update({ employee_override: { notes: employeeDiagnosticNotes, overridden_at: new Date().toISOString() } as any })
          .eq('id', diagnosticSession.id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket_logs', ticket.id] });
      queryClient.invalidateQueries({ queryKey: ['diagnostic_session', ticket.id] });
      setShowDiagAccept(false);
      setEmployeeDiagnosticNotes('');
      setShowCostEstimate(true);
      toast({ title: 'Diagnosis response saved. Now add cost estimates.' });
    },
  });

  // Status update
  const updateStatus = useMutation({
    mutationFn: async (newStatus: string) => {
      let actualStatus = newStatus;
      if (newStatus === 'completed') {
        // Use security definer function to bypass RLS on user_roles
        // Direct query fails when a technician checks the creator's roles
        let creatorIsAdmin = false;
        if (ticket.created_by) {
          const { data: isAdmin } = await supabase
            .rpc('is_admin_user', { _user_id: ticket.created_by });
          creatorIsAdmin = !!isAdmin;
        }
        actualStatus = creatorIsAdmin ? 'pending_admin_approval' : 'pending_tenant_approval';
      }
      const updates: any = { status: actualStatus };
      if (actualStatus === 'pending_tenant_approval' || actualStatus === 'pending_admin_approval') updates.resolved_at = new Date().toISOString();
      if (actualStatus === 'closed') updates.closed_at = new Date().toISOString();
      const { error } = await supabase.from('maintenance_tickets').update(updates).eq('id', ticket.id);
      if (error) throw error;
      const approvalLabel = actualStatus === 'pending_admin_approval' ? 'admin' : 'tenant';
      await supabase.from('ticket_logs').insert({
        ticket_id: ticket.id,
        action: `Status changed to ${actualStatus}`,
        created_by: user?.id,
        notes: (actualStatus === 'pending_tenant_approval' || actualStatus === 'pending_admin_approval')
          ? `Work completed. Awaiting ${approvalLabel} approval.`
           : `Ticket status updated from ${ticket.status} to ${actualStatus}`,
      } as any);

      // SMS when status moves to pending approval
      if (actualStatus === 'pending_tenant_approval' || actualStatus === 'pending_admin_approval') {
        const approvalPhone = actualStatus === 'pending_tenant_approval'
          ? (ticket.tenant_phone || '')
          : (() => { const creator = teamMembers.find((m: any) => m.user_id === ticket.created_by); return creator?.phone || ''; })();
        supabase.functions.invoke('ticket-notifications', {
          body: { event: 'ticket_closed', ticketNumber: ticket.ticket_number, name: ticket.tenant_name || 'User', phoneNumber: approvalPhone },
        }).catch(console.error);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance_tickets'] });
      queryClient.invalidateQueries({ queryKey: ['ticket_logs', ticket.id] });
      toast({ title: 'Status Updated' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  // Tenant/Admin accepts completion
  const tenantAccept = useMutation({
    mutationFn: async () => {
      const isAdminApproval = ticket.status === 'pending_admin_approval';
      const { error } = await supabase.from('maintenance_tickets')
        .update({ status: 'closed', closed_at: new Date().toISOString(), tenant_approved: true } as any)
        .eq('id', ticket.id);
      if (error) throw error;
      const approverLabel = isAdminApproval ? 'Admin' : 'Tenant';
      await supabase.from('ticket_logs').insert({
        ticket_id: ticket.id, action: `${approverLabel} approved completion`,
        notes: `${approverLabel} confirmed the issue has been resolved. Ticket closed.`,
        created_by: user?.id,
      } as any);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance_tickets'] });
      queryClient.invalidateQueries({ queryKey: ['ticket_logs', ticket.id] });
      // SMS for ticket closed
      supabase.functions.invoke('ticket-notifications', {
        body: { event: 'ticket_closed', ticketNumber: ticket.ticket_number, name: ticket.tenant_name || 'User', phoneNumber: ticket.tenant_phone || '' },
      }).catch(console.error);
      toast({ title: 'Ticket closed', description: 'Thank you for confirming.' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  // Tenant/Admin rejects completion — reopen and keep same assignee
  const tenantReject = useMutation({
    mutationFn: async () => {
      if (!rejectionReason.trim()) throw new Error('Please provide a reason');
      const isAdminApproval = ticket.status === 'pending_admin_approval';
      const { error } = await supabase.from('maintenance_tickets')
        .update({
          status: 'in_progress',
          tenant_approved: false,
          tenant_rejection_reason: rejectionReason,
          resolved_at: null,
        } as any)
        .eq('id', ticket.id);
      if (error) throw error;
      // Extend SLA deadline to account for paused time during approval
      await extendSlaForPausedTime(ticket.id);
      const rejectorLabel = isAdminApproval ? 'Admin' : 'Tenant';
      await supabase.from('ticket_logs').insert({
        ticket_id: ticket.id, action: `${rejectorLabel} rejected completion`,
        notes: `Reason: ${rejectionReason}. Ticket re-opened and assigned back to the same employee (${ticket.assigned_to ? 'preserved' : 'unassigned'}). SLA timer resumed.`,
        created_by: user?.id,
      } as any);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance_tickets'] });
      queryClient.invalidateQueries({ queryKey: ['ticket_logs', ticket.id] });
      setShowReject(false);
      setRejectionReason('');
      toast({ title: 'Ticket re-opened', description: 'The assignee has been notified.' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  // Submit cost estimates for approval (with guard against duplicate submissions)
  const submitCostEstimates = useMutation({
    mutationFn: async () => {
      if (costSubmitGuardRef.current) throw new Error('Submission already in progress');
      costSubmitGuardRef.current = true;
      if (costEstimateItems.length === 0) throw new Error('Add at least one item');
      const inserts = costEstimateItems.map(item => ({
        ticket_id: ticket.id,
        organization_id: profile.organization_id,
        item_name: item.item_name,
        cost_type: item.cost_type,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total: item.quantity * item.unit_price,
        submitted_by: user?.id,
        status: 'pending',
      }));
      const { error } = await supabase.from('ticket_cost_estimates').insert(inserts as any);
      if (error) throw error;
      const totalEst = inserts.reduce((s, i) => s + i.total, 0);
      await supabase.from('ticket_logs').insert({
        ticket_id: ticket.id, action: 'Cost estimate submitted',
        notes: `${inserts.length} items totalling ₹${totalEst.toLocaleString()} submitted for approval.`,
        created_by: user?.id,
      } as any);
      await supabase.from('maintenance_tickets').update({ status: 'waiting_for_cost_approval' }).eq('id', ticket.id);

      // Send SMS to the approver(s)
      try {
        const { data: approvers } = await supabase.from('cost_estimate_approvers')
          .select('approver_user_id')
          .eq('organization_id', profile.organization_id);
        if (approvers?.length) {
          const approverIds = [...new Set(approvers.map(a => a.approver_user_id))];
          const { data: approverProfiles } = await supabase.from('profiles')
            .select('phone').in('id', approverIds);
          const phones = approverProfiles?.map(p => p.phone).filter(Boolean) || [];
          for (const phone of phones) {
            supabase.functions.invoke('ticket-notifications', {
              body: { event: 'cost_approval', ticketNumber: ticket.ticket_number, phoneNumber: phone },
            }).catch(console.error);
          }
        }
      } catch (e) { console.error('SMS notification error:', e); }
    },
    onSuccess: () => {
      costSubmitGuardRef.current = false;
      queryClient.invalidateQueries({ queryKey: ['ticket_cost_estimates', ticket.id] });
      queryClient.invalidateQueries({ queryKey: ['ticket_logs', ticket.id] });
      queryClient.invalidateQueries({ queryKey: ['maintenance_tickets'] });
      setCostEstimateItems([]);
      setShowCostEstimate(false);
      toast({ title: 'Cost estimates submitted for approval' });
    },
    onError: (e: any) => {
      costSubmitGuardRef.current = false;
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    },
  });

  // Admin cost edit state for inline modification during approval
  const [editingEstimate, setEditingEstimate] = useState<string | null>(null);
  const [editedCosts, setEditedCosts] = useState<Record<string, { quantity: number; unit_price: number }>>({});

  // Approve cost estimate (with optional admin-modified values)
  const approveCostEstimate = useMutation({
    mutationFn: async (estimateId: string) => {
      const edited = editedCosts[estimateId];
      const original = costEstimates.find((e: any) => e.id === estimateId);
      
      const updatePayload: any = { status: 'approved', approved_by: user?.id, approved_at: new Date().toISOString() };
      let auditChanges: Record<string, any> = {};
      
      // If admin modified the cost, update quantity/unit_price/total
      if (edited && original) {
        const newTotal = edited.quantity * edited.unit_price;
        if (edited.quantity !== original.quantity || edited.unit_price !== original.unit_price) {
          updatePayload.quantity = edited.quantity;
          updatePayload.unit_price = edited.unit_price;
          updatePayload.total = newTotal;
          auditChanges = {
            original_quantity: original.quantity,
            new_quantity: edited.quantity,
            original_unit_price: original.unit_price,
            new_unit_price: edited.unit_price,
            original_total: original.total,
            new_total: newTotal,
          };
        }
      }

      const { error } = await supabase.from('ticket_cost_estimates')
        .update(updatePayload as any)
        .eq('id', estimateId);
      if (error) throw error;

      const costChangeNote = Object.keys(auditChanges).length > 0
        ? ` Admin modified cost: ₹${auditChanges.original_total} → ₹${auditChanges.new_total} (Qty: ${auditChanges.original_quantity}→${auditChanges.new_quantity}, Unit: ₹${auditChanges.original_unit_price}→₹${auditChanges.new_unit_price}).`
        : '';
      await supabase.from('ticket_logs').insert({
        ticket_id: ticket.id, action: 'Cost estimate approved',
        notes: `Estimate approved by management.${costChangeNote}`, created_by: user?.id,
      } as any);

      // Audit log for cost modifications
      if (Object.keys(auditChanges).length > 0 && profile?.organization_id) {
        await supabase.from('audit_logs').insert({
          organization_id: profile.organization_id,
          table_name: 'ticket_cost_estimates',
          record_id: estimateId,
          action: 'updated',
          changes: { ...auditChanges, reason: 'Admin cost adjustment during approval' },
          performed_by: user?.id,
        } as any);
      }

      // Check if all pending estimates for this ticket are now approved
      const { data: remainingPending } = await supabase.from('ticket_cost_estimates')
        .select('id').eq('ticket_id', ticket.id).eq('status', 'pending').neq('id', estimateId);
      if (!remainingPending?.length) {
        // Extend SLA deadline to account for paused time before changing status
        await extendSlaForPausedTime(ticket.id);
        await supabase.from('maintenance_tickets').update({ status: 'waiting_for_parts' }).eq('id', ticket.id);
        await supabase.from('ticket_logs').insert({
          ticket_id: ticket.id, action: 'Status changed to waiting_for_parts',
          notes: 'All cost estimates approved. Ticket moved to Waiting for Parts. SLA resumed.',
          created_by: user?.id,
        } as any);
      }

      // Clean up edit state
      setEditingEstimate(null);
      setEditedCosts(prev => { const next = { ...prev }; delete next[estimateId]; return next; });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket_cost_estimates', ticket.id] });
      queryClient.invalidateQueries({ queryKey: ['ticket_logs', ticket.id] });
      queryClient.invalidateQueries({ queryKey: ['maintenance_tickets'] });
      toast({ title: 'Estimate approved' });
    },
  });

  // Decline cost estimate — resume timer if no pending estimates remain
  const declineCostEstimate = useMutation({
    mutationFn: async () => {
      if (!declineReason.trim()) throw new Error('Provide a reason');
      const { error } = await supabase.from('ticket_cost_estimates')
        .update({ status: 'declined', approved_by: user?.id, decline_reason: declineReason } as any)
        .eq('id', declineEstimateId);
      if (error) throw error;
      await supabase.from('ticket_logs').insert({
        ticket_id: ticket.id, action: 'Cost estimate declined',
        notes: `Reason: ${declineReason}`, created_by: user?.id,
      } as any);

      // Check if any pending estimates remain (excluding the one just declined)
      const { data: remainingPending } = await supabase.from('ticket_cost_estimates')
        .select('id').eq('ticket_id', ticket.id).eq('status', 'pending').neq('id', declineEstimateId);

      if (!remainingPending?.length) {
        // No pending estimates left — check if any were approved
        const { data: approvedOnes } = await supabase.from('ticket_cost_estimates')
          .select('id').eq('ticket_id', ticket.id).eq('status', 'approved');

        const nextStatus = approvedOnes?.length ? 'waiting_for_parts' : 'in_progress';
        // Extend SLA deadline to account for paused time
        await extendSlaForPausedTime(ticket.id);
        await supabase.from('maintenance_tickets').update({ status: nextStatus }).eq('id', ticket.id);
        await supabase.from('ticket_logs').insert({
          ticket_id: ticket.id,
          action: `Status changed to ${nextStatus}`,
          notes: nextStatus === 'waiting_for_parts'
            ? 'Remaining estimates approved. Ticket moved to Waiting for Parts. SLA resumed.'
            : 'All cost estimates declined. Ticket returned to In Progress. SLA timer resumed.',
          created_by: user?.id,
        } as any);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket_cost_estimates', ticket.id] });
      queryClient.invalidateQueries({ queryKey: ['ticket_logs', ticket.id] });
      queryClient.invalidateQueries({ queryKey: ['maintenance_tickets'] });
      setShowDeclineDialog(false);
      setDeclineReason('');
      toast({ title: 'Estimate declined' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  // Record purchase with enhanced vendor details + maintenance cost allocation by bed type
  const recordPurchase = useMutation({
    mutationFn: async () => {
      if (!purchaseForm.item_name) throw new Error('Item name required');
      const estimate = costEstimates.find((e: any) => e.id === purchaseForm.cost_estimate_id);
      const vendorId = purchaseForm.vendor_id && purchaseForm.vendor_id !== '__general' ? purchaseForm.vendor_id : null;

      const { data: purchaseData, error } = await supabase.from('ticket_purchases').insert({
        ticket_id: ticket.id,
        organization_id: profile.organization_id,
        cost_estimate_id: purchaseForm.cost_estimate_id || null,
        item_name: purchaseForm.item_name,
        quantity: purchaseForm.quantity,
        estimated_cost: estimate ? estimate.total : 0,
        actual_cost: purchaseForm.actual_cost,
        vendor_id: vendorId,
        vendor_name_manual: purchaseForm.vendor_name_manual || null,
        invoice_url: purchaseForm.invoice_url,
        purchased_by: user?.id,
      } as any).select('id').single();
      if (error) throw error;

      const vendorLabel = vendorId
        ? vendors.find((v: any) => v.id === vendorId)?.vendor_name
        : purchaseForm.vendor_name_manual || 'General Vendor';
      await supabase.from('ticket_logs').insert({
        ticket_id: ticket.id, action: 'Purchase recorded',
        notes: `${purchaseForm.item_name} (Qty: ${purchaseForm.quantity}) from ${vendorLabel}. Actual: ₹${purchaseForm.actual_cost}${estimate ? ` (Est: ₹${estimate.total})` : ''}`,
        created_by: user?.id,
      } as any);

      await supabase.from('maintenance_tickets').update({ status: 'in_progress' }).eq('id', ticket.id);
      await supabase.from('ticket_logs').insert({
        ticket_id: ticket.id, action: 'Status changed to in_progress',
        notes: 'Purchase recorded. Ticket moved to In Progress.',
        created_by: user?.id,
      } as any);

      // Allocate maintenance cost — single record per part
      const allocated = await allocateMaintenanceCost(purchaseData?.id, purchaseForm.actual_cost, vendorLabel || '');

      // Fallback: if no distribution happened (no allotments), store a single base record with distributed_beds
      if (!allocated && purchaseData?.id) {
        const distributedBeds: Record<string, number> = {};
        if (ticket.bed_id) {
          const { data: bedInfo } = await supabase.from('beds').select('bed_code').eq('id', ticket.bed_id).maybeSingle();
          if (bedInfo) distributedBeds[bedInfo.bed_code] = purchaseForm.actual_cost;
        }
        await supabase.from('running_bed_maintenance_details').insert({
          organization_id: profile.organization_id,
          ticket_id: ticket.id,
          purchase_id: purchaseData.id,
          tenant_id: ticket.tenant_id,
          bed_id: ticket.bed_id,
          apartment_id: ticket.apartment_id,
          property_id: ticket.property_id,
          item_name: purchaseForm.item_name,
          quantity: purchaseForm.quantity,
          unit_price: purchaseForm.actual_cost / (purchaseForm.quantity || 1),
          actual_cost: purchaseForm.actual_cost,
          vendor_name: vendorLabel,
          cost_scope: ticket.bed_id ? 'bed' : ticket.apartment_id ? 'apartment' : 'common',
          billing_month: format(new Date(), 'yyyy-MM'),
          maintenance_type: ticket.issue_types?.name || 'general',
          diagnosis_summary: diagnosticSession?.ai_diagnosis ? JSON.stringify(diagnosticSession.ai_diagnosis) : null,
          distributed_amount: purchaseForm.actual_cost,
          distributed_beds: Object.keys(distributedBeds).length > 0 ? distributedBeds : null,
        } as any);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket_purchases', ticket.id] });
      queryClient.invalidateQueries({ queryKey: ['ticket_logs', ticket.id] });
      queryClient.invalidateQueries({ queryKey: ['maintenance_tickets'] });
      setShowPurchase(false);
      setPurchaseForm({ cost_estimate_id: '', item_name: '', quantity: 1, actual_cost: 0, vendor_id: '', vendor_name_manual: '', vendor_pan: '', vendor_address: '', vendor_mobile: '', invoice_url: null });
      toast({ title: 'Purchase recorded' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  // Dynamic cost distribution using apartments/beds tables
  const allocateMaintenanceCost = async (purchaseId: string | undefined, amount: number, vendorLabel: string): Promise<boolean> => {
    if (!purchaseId || !amount) return false;
    const issueTypeName = ticket.issue_types?.name?.toLowerCase() || '';
    const billingMonth = format(new Date(), 'yyyy-MM');

    let costScope = 'bed';
    const commonIssues = ['common area', 'building', 'parking', 'lift', 'generator', 'water tank', 'borewell', 'microwave', 'tv', 'sofa'];
    const toiletIssues = ['toilet', 'bathroom'];
    const apartmentIssues = ['plumbing', 'kitchen', ...toiletIssues];

    if (commonIssues.some(ci => issueTypeName.includes(ci))) {
      costScope = ticket.apartment_id ? 'apartment' : 'common';
    } else if (apartmentIssues.some(ai => issueTypeName.includes(ai))) {
      costScope = 'apartment';
    } else if (ticket.bed_id) {
      costScope = 'bed';
    } else if (ticket.apartment_id) {
      costScope = 'apartment';
    } else {
      costScope = 'common';
    }

    const isToiletIssue = toiletIssues.some(ti => issueTypeName.includes(ti));
    const baseInsert = {
      organization_id: profile.organization_id,
      ticket_id: ticket.id,
      purchase_id: purchaseId,
      property_id: ticket.property_id,
      item_name: purchaseForm.item_name,
      quantity: purchaseForm.quantity,
      unit_price: amount / (purchaseForm.quantity || 1),
      actual_cost: amount,
      vendor_name: vendorLabel,
      billing_month: billingMonth,
      maintenance_type: ticket.issue_types?.name || 'general',
      diagnosis_summary: diagnosticSession?.ai_diagnosis ? JSON.stringify(diagnosticSession.ai_diagnosis) : null,
      cost_scope: costScope,
    };

    if (costScope === 'bed' && ticket.bed_id) {
      const { data: allotment } = await supabase.from('tenant_allotments')
        .select('tenant_id').eq('bed_id', ticket.bed_id)
        .in('staying_status', ['Staying', 'On-Notice'] as any).maybeSingle();
      const distributedBeds: Record<string, number> = {};
      const { data: bedInfo } = await supabase.from('beds').select('bed_code').eq('id', ticket.bed_id).maybeSingle();
      if (bedInfo) distributedBeds[bedInfo.bed_code] = amount;
      await supabase.from('running_bed_maintenance_details').insert({
        ...baseInsert, tenant_id: allotment?.tenant_id || ticket.tenant_id,
        bed_id: ticket.bed_id, apartment_id: ticket.apartment_id,
        distributed_amount: amount, distributed_beds: distributedBeds,
      } as any);
      return true;

    } else if (costScope === 'apartment' && ticket.apartment_id) {
      const { data: bedsInApt } = await supabase.from('beds')
        .select('id, bed_code, bed_type, toilet_type').eq('apartment_id', ticket.apartment_id);
      if (!bedsInApt?.length) return false;
      const bedIds = bedsInApt.map(b => b.id);
      const { data: allotments } = await supabase.from('tenant_allotments')
        .select('tenant_id, bed_id').in('bed_id', bedIds)
        .in('staying_status', ['Staying', 'On-Notice'] as any);
      if (!allotments?.length) return false;

      let targetBeds = bedsInApt;
      if (isToiletIssue && ticket.bed_id) {
        const issueBed = bedsInApt.find(b => b.id === ticket.bed_id);
        const tt = (issueBed?.toilet_type || '').toLowerCase();
        if (tt === 'attached') {
          targetBeds = bedsInApt.filter(b => b.bed_type === issueBed?.bed_type);
        } else {
          targetBeds = bedsInApt.filter(b => (b.toilet_type || '').toLowerCase() === 'common');
          if (targetBeds.length === 0) targetBeds = bedsInApt;
        }
      }
      const occupiedBeds = targetBeds.filter(b => allotments.some(a => a.bed_id === b.id));
      if (!occupiedBeds.length) return false;
      const splitAmount = Math.round((amount / occupiedBeds.length) * 100) / 100;
      const distributedBeds: Record<string, number> = {};
      occupiedBeds.forEach(b => { distributedBeds[b.bed_code] = splitAmount; });
      await supabase.from('running_bed_maintenance_details').insert({
        ...baseInsert,
        tenant_id: allotments[0]?.tenant_id || ticket.tenant_id,
        bed_id: ticket.bed_id || occupiedBeds[0]?.id,
        apartment_id: ticket.apartment_id,
        distributed_amount: amount,
        distributed_beds: distributedBeds,
      } as any);
      return true;

    } else if (costScope === 'common' && ticket.property_id) {
      const { data: apts } = await supabase.from('apartments').select('id').eq('property_id', ticket.property_id);
      if (!apts?.length) return false;
      const { data: allBeds } = await supabase.from('beds').select('id, bed_code, apartment_id').in('apartment_id', apts.map(a => a.id));
      if (!allBeds?.length) return false;
      const { data: allotments } = await supabase.from('tenant_allotments')
        .select('tenant_id, bed_id, apartment_id').in('bed_id', allBeds.map(b => b.id))
        .in('staying_status', ['Staying', 'On-Notice'] as any);
      if (!allotments?.length) return false;
      const occupiedBeds = allBeds.filter(b => allotments.some(a => a.bed_id === b.id));
      const splitAmount = Math.round((amount / occupiedBeds.length) * 100) / 100;
      const distributedBeds: Record<string, number> = {};
      occupiedBeds.forEach(b => { distributedBeds[b.bed_code] = splitAmount; });
      await supabase.from('running_bed_maintenance_details').insert({
        ...baseInsert,
        tenant_id: allotments[0]?.tenant_id || ticket.tenant_id,
        bed_id: ticket.bed_id || occupiedBeds[0]?.id,
        apartment_id: ticket.apartment_id || allotments[0]?.apartment_id,
        distributed_amount: amount,
        distributed_beds: distributedBeds,
      } as any);
      return true;
    }
    return false;
  };



  // Reassign ticket
  const reassign = useMutation({
    mutationFn: async () => {
      if (!reassignForm.employee_id) throw new Error('Select a person');
      const assignedUserId = reassignForm.employee_id;
      const member = teamMembers.find((m: any) => m.user_id === assignedUserId);
      const profile2 = orgProfiles.find((p: any) => p.id === assignedUserId);
      const assigneeName = member ? `${member.first_name} ${member.last_name}` : profile2?.full_name || profile2?.email || 'Unknown';
      // Reset SLA deadline on reassignment
      const { data: issueType } = await supabase
        .from('issue_types')
        .select('sla_hours')
        .eq('id', ticket.issue_type_id)
        .maybeSingle();
      const slaHours = issueType?.sla_hours || 24;
      const newDeadline = calculateWorkingHoursDeadline(new Date(), slaHours);
      const { error } = await supabase.from('maintenance_tickets')
        .update({ assigned_to: assignedUserId, status: 'assigned', sla_deadline: newDeadline, diagnostic_data: null } as any).eq('id', ticket.id);
      if (error) throw error;
      await supabase.from('ticket_logs').insert({
        ticket_id: ticket.id, action: 'Ticket reassigned',
        notes: `Reassigned to ${assigneeName}. Reason: ${reassignForm.reason}. Ticket starts fresh for the new assignee.`,
        created_by: user?.id,
      } as any);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance_tickets'] });
      queryClient.invalidateQueries({ queryKey: ['ticket_logs', ticket.id] });
      queryClient.invalidateQueries({ queryKey: ['diagnostic_session', ticket.id] });
      // SMS for reassignment
      const member = teamMembers.find((m: any) => m.user_id === reassignForm.employee_id);
      const empName = member ? `${member.first_name || ''} ${member.last_name || ''}`.trim() : 'Employee';
      supabase.functions.invoke('ticket-notifications', {
        body: { event: 'ticket_assigned', ticketNumber: ticket.ticket_number, employeeName: empName, phoneNumber: member?.phone || '' },
      }).catch(console.error);
      setShowReassign(false);
      setReassignForm({ employee_id: '', reason: '' });
      toast({ title: 'Ticket reassigned', description: 'Starts fresh for the new assignee. History preserved.' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const getNextStatuses = () => {
    const flow: Record<string, string[]> = {
      open: ['assigned'],
      assigned: ['in_progress'],
      in_progress: ['waiting_for_parts', 'completed'],
      waiting_for_cost_approval: [],
      waiting_for_parts: ['in_progress'],
      completed: [],
      pending_tenant_approval: [],
      pending_admin_approval: [],
      closed: [],
    };
    return flow[ticket.status] || [];
  };

  const assignedEmployee = teamMembers.find((m: any) => m.user_id === ticket.assigned_to);
  const approvedEstimates = costEstimates.filter((e: any) => e.status === 'approved');
  const pendingEstimates = costEstimates.filter((e: any) => e.status === 'pending');

  // Determine which action buttons employee/technician can see
  const getEmployeeActions = () => {
    const actions: string[] = [];
    if (!isActiveTicket) return actions;
    // Disable reassign and mark_completed when cost estimation is pending
    const hasPendingCostEstimates = costEstimates.some((e: any) => e.status === 'pending');
    if (!hasPendingCostEstimates) actions.push('reassign');
    if (!hasDiagnostic) actions.push('diagnose');
    if (hasDiagnostic && !hasPendingEstimates && costEstimates.filter((e: any) => e.status === 'pending').length === 0) {
      actions.push('cost_estimate');
    }
    if (!hasPendingCostEstimates && (purchases.length > 0 || hasDiagnostic)) actions.push('mark_completed');
    return actions;
  };

  const employeeActions = canShowActions ? getEmployeeActions() : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold font-mono">{ticket.ticket_number}</h2>
            <StatusBadge status={ticket.status} type="ticket" />
            <StatusBadge status={ticket.priority} type="priority" />
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Created {formatDistanceToNow(created, { addSuffix: true })} • {format(created, 'dd MMM yyyy, hh:mm a')}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>✕</Button>
      </div>

      {/* Tenant Approval Banner — visible to the ticket CREATOR (tenant or admin) */}
      {isPendingApproval && (() => {
        const isCreator = (isTenantRole && tenantRecord && ticket.tenant_id === tenantRecord.id) ||
          (ticket.created_by && ticket.created_by === user?.id) ||
          (ticket.status === 'pending_admin_approval' && isAdmin);
        if (!isCreator) return null;
        return (
          <Card className="border-violet-500 bg-violet-500/5">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <ThumbsUp className="h-5 w-5 text-violet-500" />
                <span className="font-semibold text-sm">Awaiting Your Approval</span>
              </div>
              <p className="text-sm text-muted-foreground mb-3">
                The assigned employee has marked this ticket as completed. Please confirm if the issue has been resolved.
              </p>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => tenantAccept.mutate()} disabled={tenantAccept.isPending} className="bg-emerald-600 hover:bg-emerald-700">
                  <ThumbsUp className="h-3.5 w-3.5 mr-1" /> Accept & Close
                </Button>
                <Button size="sm" variant="destructive" onClick={() => setShowReject(true)}>
                  <ThumbsDown className="h-3.5 w-3.5 mr-1" /> Not Resolved
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })()}

      {/* Pending Cost Estimate Approval Banner - visible ONLY to approvers with inline edit */}
      {hasPendingEstimates && canApprove && !isPendingApproval && (
        <Card className="border-amber-500 bg-amber-500/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Receipt className="h-5 w-5 text-amber-500" />
              <span className="font-semibold text-sm">Cost Estimate Pending Your Approval</span>
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              This ticket has {pendingEstimates.length} cost estimate(s) awaiting your approval. Click ✏️ to modify costs before approving.
            </p>
            <div className="space-y-2">
              {pendingEstimates.map((est: any) => {
                const isEditing = editingEstimate === est.id;
                const edited = editedCosts[est.id] || { quantity: est.quantity, unit_price: est.unit_price };
                const displayTotal = isEditing ? edited.quantity * edited.unit_price : est.total;
                return (
                  <div key={est.id} className="p-3 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/20">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="text-sm font-medium">{est.item_name}</p>
                        {isEditing ? (
                          <div className="flex items-center gap-2 mt-1">
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-muted-foreground">Qty:</span>
                              <Input
                                type="number" min={1} className="h-7 w-16 text-xs"
                                value={edited.quantity}
                                onChange={e => setEditedCosts(prev => ({ ...prev, [est.id]: { ...edited, quantity: parseInt(e.target.value) || 1 } }))}
                              />
                            </div>
                            <span className="text-xs text-muted-foreground">×</span>
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-muted-foreground">₹</span>
                              <Input
                                type="number" min={0} className="h-7 w-24 text-xs"
                                value={edited.unit_price}
                                onChange={e => setEditedCosts(prev => ({ ...prev, [est.id]: { ...edited, unit_price: parseFloat(e.target.value) || 0 } }))}
                              />
                            </div>
                            <span className="text-xs font-bold">= ₹{displayTotal.toLocaleString()}</span>
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground">{est.cost_type} • {est.quantity} × ₹{est.unit_price} = ₹{est.total}</p>
                        )}
                      </div>
                      <div className="flex gap-1 items-center">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => {
                          if (isEditing) {
                            setEditingEstimate(null);
                          } else {
                            setEditingEstimate(est.id);
                            setEditedCosts(prev => ({ ...prev, [est.id]: { quantity: est.quantity, unit_price: est.unit_price } }));
                          }
                        }}>
                          <span className="text-xs">{isEditing ? '✕' : '✏️'}</span>
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-emerald-600" onClick={() => approveCostEstimate.mutate(est.id)} disabled={approveCostEstimate.isPending}>
                          <ShieldCheck className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-red-600" onClick={() => { setDeclineEstimateId(est.id); setShowDeclineDialog(true); }}>
                          <ShieldX className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Employee pending estimate status message — NO estimate details visible, just status */}
      {hasPendingEstimates && isEmployee && !canApprove && (
        <Card className="border-sky-400 bg-sky-50/50 dark:bg-sky-950/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Receipt className="h-5 w-5 text-sky-500" />
              <span className="font-semibold text-sm">Cost Estimate Submitted — Awaiting Approval</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Your cost estimate ({pendingEstimates.length} item{pendingEstimates.length > 1 ? 's' : ''}) has been submitted and is pending management approval. You will be notified once approved.
            </p>
          </CardContent>
        </Card>
      )}

      {/* SLA Progress */}
      {slaDeadline && (isActiveTicket || isSlaPaused) && (
        <Card className={isSlaPaused ? 'border-violet-500 bg-violet-500/5' : slaExceeded ? 'border-destructive bg-destructive/5' : slaWarning ? 'border-amber-500 bg-amber-500/5' : 'border-border'}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                {isSlaPaused ? (
                  <Pause className="h-4 w-4 text-violet-500" />
                ) : (
                  <Clock className={`h-4 w-4 ${slaExceeded ? 'text-destructive' : slaWarning ? 'text-amber-500' : 'text-muted-foreground'}`} />
                )}
                <span className="text-sm font-medium">
                  {isSlaPaused ? '⏸ SLA Paused — Awaiting Approval' : slaExceeded ? '🔴 SLA EXCEEDED' : slaWarning ? '⚠️ SLA Warning' : 'SLA Timer'}
                </span>
              </div>
              <span className="text-xs text-muted-foreground">Deadline: {format(slaDeadline, 'dd MMM, hh:mm a')}</span>
            </div>
            {!isSlaPaused && (
              <>
                <Progress value={Math.min(slaPercent, 100)} className={`h-2 ${slaExceeded ? '[&>div]:bg-destructive' : slaWarning ? '[&>div]:bg-amber-500' : ''}`} />
                <p className="text-xs text-muted-foreground mt-1">
                  {slaExceeded ? `Exceeded by ${formatDistanceToNow(slaDeadline)}` : `${formatDistanceToNow(slaDeadline, { addSuffix: false })} remaining`}
                </p>
              </>
            )}
            {isSlaPaused && (
              <p className="text-xs text-violet-600 dark:text-violet-400 mt-1">Timer paused until approval is completed.</p>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-4">
          {/* Ticket Info */}
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">Ticket Details</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Created By:</span>
                  <p className="font-medium flex items-center gap-1.5">
                    {ticket.tenant_name || ticket.profiles?.full_name || ticket.tenants?.full_name || 'Unknown'}
                    {ticket.created_by && !isCreatorTenant && (
                      <span className="inline-flex items-center justify-center w-2 h-2 rounded-full bg-primary shrink-0" title="Admin/PM" />
                    )}
                  </p>
                </div>
                <div><span className="text-muted-foreground">Issue Type:</span><p className="font-medium">{ticket.issue_types?.name}</p></div>
                <div><span className="text-muted-foreground">Property:</span><p className="font-medium">{ticket.properties?.property_name}</p></div>
                <div><span className="text-muted-foreground">Apartment:</span><p className="font-medium">{ticket.apartments?.apartment_code}</p></div>
                <div><span className="text-muted-foreground">Assigned To:</span>
                  <p className="font-medium">{assignedEmployee ? `${assignedEmployee.first_name} ${assignedEmployee.last_name}` : 'Unassigned'}</p>
                </div>
                {(isAdmin || isEmployee) && totalCost > 0 && (
                  <div><span className="text-muted-foreground">Total Cost:</span>
                    <p className="font-medium text-primary">₹{totalCost.toLocaleString()}</p>
                  </div>
                )}
              </div>
              {ticket.description && (<><Separator /><div><span className="text-xs text-muted-foreground">Description</span><p className="text-sm mt-1">{ticket.description}</p></div></>)}
              {ticket.photo_urls?.length > 0 && (
                <><Separator /><div><span className="text-xs text-muted-foreground">Attached Photos</span>
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {ticket.photo_urls.map((url: string, i: number) => (
                      <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                        <img src={url} alt={`Photo ${i + 1}`} className="w-20 h-20 object-cover rounded-lg border hover:opacity-80 transition" />
                      </a>
                    ))}
                  </div>
                </div></>
              )}
            </CardContent>
          </Card>

          {/* Time Efficiency Metrics */}
          {(isAdmin || isEmployee) && (timeMetrics.responseTime || timeMetrics.workDuration || timeMetrics.totalTime) && (
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Timer className="h-4 w-4" /> Time Metrics</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-3">
                  {timeMetrics.responseTime && (<div className="bg-muted/50 rounded-lg p-3 text-center"><p className="text-[10px] text-muted-foreground uppercase tracking-wider">Response Time</p><p className="text-lg font-bold text-primary mt-1">{timeMetrics.responseTime}</p><p className="text-[10px] text-muted-foreground">Assigned → Started</p></div>)}
                  {timeMetrics.workDuration && (<div className="bg-muted/50 rounded-lg p-3 text-center"><p className="text-[10px] text-muted-foreground uppercase tracking-wider">Work Duration</p><p className="text-lg font-bold text-primary mt-1">{timeMetrics.workDuration}</p><p className="text-[10px] text-muted-foreground">Started → Completed</p></div>)}
                  {timeMetrics.totalTime && (<div className="bg-muted/50 rounded-lg p-3 text-center"><p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Time</p><p className="text-lg font-bold text-primary mt-1">{timeMetrics.totalTime}</p><p className="text-[10px] text-muted-foreground">Assigned → Completed</p></div>)}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Cost Estimates & Approval — Role-based visibility:
              - Approver: sees ALL estimates (pending for action, approved/declined for reference)
              - Employee: sees only APPROVED/DECLINED estimates (not pending — handled by banner above)
              - Admin: sees ALL estimates
          */}
          {costEstimates.length > 0 && (isAdmin || isEmployee || canApprove) && (() => {
            // Filter estimates based on role visibility
            const visibleEstimates = isAdmin || canApprove
              ? costEstimates
              : costEstimates.filter((e: any) => e.status !== 'pending'); // Employee only sees non-pending
            if (visibleEstimates.length === 0) return null;
            return (
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Receipt className="h-4 w-4" /> Cost Estimates</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {visibleEstimates.map((est: any) => (
                    <div key={est.id} className={`p-3 rounded-lg border ${est.status === 'approved' ? 'border-emerald-300 bg-emerald-50 dark:bg-emerald-950/20' : est.status === 'declined' ? 'border-red-300 bg-red-50 dark:bg-red-950/20' : 'border-amber-300 bg-amber-50 dark:bg-amber-950/20'}`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">{est.item_name}</p>
                          <p className="text-xs text-muted-foreground">{est.cost_type} • {est.quantity} × ₹{est.unit_price} = ₹{est.total}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className={est.status === 'approved' ? 'bg-emerald-100 text-emerald-700' : est.status === 'declined' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}>
                            {est.status}
                          </Badge>
                          {/* Approve/decline buttons only shown here if the banner is NOT visible (e.g. isPendingApproval hides banner) */}
                          {est.status === 'pending' && canApprove && isPendingApproval && (
                            <div className="flex gap-1">
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-emerald-600" onClick={() => approveCostEstimate.mutate(est.id)} disabled={approveCostEstimate.isPending}>
                                <ShieldCheck className="h-4 w-4" />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-red-600" onClick={() => { setDeclineEstimateId(est.id); setShowDeclineDialog(true); }}>
                                <ShieldX className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                      {est.decline_reason && <p className="text-xs text-red-600 mt-1">Decline reason: {est.decline_reason}</p>}
                    </div>
                  ))}
                </CardContent>
              </Card>
            );
          })()}

          {/* Purchases / Procurement */}
          {purchases.length > 0 && (isAdmin || isEmployee) && (
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><ShoppingCart className="h-4 w-4" /> Procurement Log</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {purchases.map((p: any) => {
                  const vendor = vendors.find((v: any) => v.id === p.vendor_id);
                  const diff = p.estimated_cost ? p.actual_cost - p.estimated_cost : null;
                  return (
                    <div key={p.id} className="p-3 rounded-lg border bg-muted/30">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">{p.item_name} (Qty: {p.quantity})</p>
                          <p className="text-xs text-muted-foreground">
                            Vendor: {vendor?.vendor_name || p.vendor_name_manual || 'General'} •
                            {p.purchase_date && ` ${format(new Date(p.purchase_date), 'dd MMM yyyy')}`}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold">₹{p.actual_cost?.toLocaleString()}</p>
                          {diff !== null && (
                            <p className={`text-[10px] ${diff > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                              {diff > 0 ? '+' : ''}₹{diff.toLocaleString()} vs est.
                            </p>
                          )}
                        </div>
                      </div>
                      {p.invoice_url && (
                        <a href={p.invoice_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline flex items-center gap-1 mt-1">
                          <FileText className="h-3 w-3" /> View Invoice
                        </a>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {/* Actions - Only for assigned Employee/Technician */}
          {canShowActions && employeeActions.length > 0 && (
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm">Actions</CardTitle></CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {employeeActions.includes('reassign') && (
                    <Button variant="outline" size="sm" onClick={() => setShowReassign(true)}><ArrowRightLeft className="h-3.5 w-3.5 mr-1" /> Reassign</Button>
                  )}
                  {employeeActions.includes('diagnose') && (
                    <Button variant="outline" size="sm" onClick={() => setShowDiagnostic(!showDiagnostic)}><Stethoscope className="h-3.5 w-3.5 mr-1" /> Run Diagnose</Button>
                  )}
                  {/* Submit Cost Estimate button removed per requirement */}
                  {(() => {
                    const purchasedEstimateIds = new Set(purchases.map((p: any) => p.cost_estimate_id).filter(Boolean));
                    const unsubmittedEstimates = approvedEstimates.filter((e: any) => !purchasedEstimateIds.has(e.id));
                    return unsubmittedEstimates.length > 0 ? (
                      <Button variant="outline" size="sm" onClick={() => setShowPurchase(true)}><ShoppingCart className="h-3.5 w-3.5 mr-1" /> Record Purchase</Button>
                    ) : null;
                  })()}
                  {employeeActions.includes('mark_completed') && (
                    <Button variant="outline" size="sm" onClick={() => updateStatus.mutate('completed')} disabled={updateStatus.isPending}>
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1 text-emerald-500" /> Mark Completed
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Diagnostic Flow — visible to assigned user (any role) */}
          {isActiveTicket && showDiagnostic && isAssignedToMe && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2"><Stethoscope className="h-4 w-4 text-primary" /> Smart Diagnostics — {ticket.issue_types?.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <DiagnosticFlow
                  issueTypeName={ticket.issue_types?.name || ''}
                  issueSubType={ticket.issue_subtype || ticket.description || ''}
                  onComplete={(data) => {
                    setLastDiagResult(data.result);
                    saveDiagnostic.mutate(data);
                  }}
                  onCancel={() => setShowDiagnostic(false)}
                />
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right column - Ticket Log */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">Activity Log ({logs.length})</CardTitle></CardHeader>
            <CardContent>
              {logs.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No activity yet</p>
              ) : (
                <div className="max-h-[500px] overflow-y-auto space-y-1 pr-1">
                  {[...logs].reverse().map((log: any) => {
                    const isStatus = log.action.startsWith('Status changed');
                    const isCost = log.action === 'cost_entry';
                    const isReassign = log.action.includes('reassign');
                    const isDiagnostic = log.action.includes('Diagnostic') || log.action.includes('diagnosis');
                    const isTenantAction = log.action.includes('Tenant');
                    const isEstimate = log.action.includes('Cost estimate');
                    const isPurchase = log.action.includes('Purchase');

                    const iconBg = isTenantAction ? 'bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300'
                      : isCost ? 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300'
                      : isReassign ? 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300'
                      : isStatus ? 'bg-sky-100 text-sky-700 dark:bg-sky-900 dark:text-sky-300'
                      : isDiagnostic ? 'bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300'
                      : isEstimate ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300'
                      : isPurchase ? 'bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300'
                      : 'bg-muted text-muted-foreground';
                    const iconChar = isTenantAction ? '👤' : isCost ? '₹' : isReassign ? '↗' : isStatus ? '◉' : isDiagnostic ? '🔍' : isEstimate ? '📋' : isPurchase ? '🛒' : '•';

                    return (
                      <details key={log.id} className="group border rounded-lg">
                        <summary className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-muted/30 transition-colors list-none [&::-webkit-details-marker]:hidden">
                          <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full flex-shrink-0 text-[10px] ${iconBg}`}>
                            {iconChar}
                          </span>
                          <span className="text-xs font-medium truncate flex-1">{isCost ? `Cost: ${log.cost_item}` : log.action}</span>
                          <span className="text-[10px] text-muted-foreground whitespace-nowrap">{format(new Date(log.created_at), 'dd MMM, hh:mm a')}</span>
                          <ChevronRight className="h-3 w-3 text-muted-foreground transition-transform group-open:rotate-90" />
                        </summary>
                        <div className="px-3 pb-2 pl-10 space-y-1">
                          {log.notes && <p className="text-xs text-muted-foreground whitespace-pre-line">{log.notes}</p>}
                          {isCost && log.cost_total > 0 && (
                            <p className="text-xs font-medium text-amber-600 dark:text-amber-400">{log.cost_quantity} × ₹{log.cost_unit_price} = ₹{log.cost_total}</p>
                          )}
                          {log.photo_urls?.length > 0 && (
                            <div className="flex gap-1.5">
                              {log.photo_urls.map((url: string, pi: number) => (
                                <a key={pi} href={url} target="_blank" rel="noopener noreferrer">
                                  <img src={url} alt="" className="w-10 h-10 object-cover rounded border hover:opacity-80 transition" />
                                </a>
                              ))}
                            </div>
                          )}
                          <p className="text-[10px] text-muted-foreground">by {log.performer_name}</p>
                        </div>
                      </details>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Cost Summary */}
          {totalCost > 0 && (isAdmin || isEmployee) && (
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm">Cost Summary</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {purchases.map((p: any) => (
                    <div key={p.id} className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{p.item_name}</span>
                      <span className="font-medium">₹{parseFloat(p.actual_cost).toLocaleString()}</span>
                    </div>
                  ))}
                  <Separator />
                  <div className="flex justify-between text-sm font-bold">
                    <span>Total</span><span className="text-primary">₹{totalCost.toLocaleString()}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Reassign Dialog */}
      <Dialog open={showReassign} onOpenChange={setShowReassign}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reassign Ticket</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label>Assign To</Label>
              <Select value={reassignForm.employee_id} onValueChange={v => setReassignForm({ ...reassignForm, employee_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select person" /></SelectTrigger>
                <SelectContent>
                  {eligibleAssignees.length === 0 && (
                    <div className="px-2 py-4 text-sm text-muted-foreground text-center">No eligible technicians or property managers found</div>
                  )}
                  {eligibleAssignees.map((m: any) => (
                    <SelectItem key={`ea-${m.resolved_user_id}`} value={m.resolved_user_id}>
                      {m.display_name}
                      <span className="text-muted-foreground ml-1 text-xs">
                        ({m.role?.replace('_', ' ') || 'Staff'})
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Reason</Label><Textarea value={reassignForm.reason} onChange={e => setReassignForm({ ...reassignForm, reason: e.target.value })} placeholder="Why is this being reassigned?" /></div>
            <Button className="w-full" onClick={() => reassign.mutate()} disabled={reassign.isPending || !reassignForm.employee_id}>Reassign Ticket</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Rejection Dialog — works for both tenant and admin */}
      <Dialog open={showReject} onOpenChange={setShowReject}>
        <DialogContent>
          <DialogHeader><DialogTitle>Report Issue Not Resolved</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-sm text-muted-foreground">Please explain why the issue is not resolved. The ticket will be re-opened and assigned back to the same employee for further action.</p>
            <div><Label>Reason for rejection *</Label><Textarea value={rejectionReason} onChange={e => setRejectionReason(e.target.value)} placeholder="Describe what's still not working..." rows={3} /></div>
            <Button className="w-full" variant="destructive" onClick={() => tenantReject.mutate()} disabled={tenantReject.isPending || !rejectionReason.trim()}>
              Re-open Ticket
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Diagnostic Accept/Own Dialog */}
      <Dialog open={showDiagAccept} onOpenChange={setShowDiagAccept}>
        <DialogContent>
          <DialogHeader><DialogTitle>Review Diagnostic Result</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            {lastDiagResult && (
              <div className="bg-muted/50 p-4 rounded-lg text-sm space-y-2">
                <p><strong>Cause:</strong> {lastDiagResult.cause}</p>
                <p><strong>Severity:</strong> {lastDiagResult.severity}</p>
                <p><strong>Est. Cost:</strong> {lastDiagResult.estimatedCost}</p>
                {lastDiagResult.recommendation && <p><strong>Recommendation:</strong> {lastDiagResult.recommendation}</p>}
              </div>
            )}
            <Button variant="secondary" size="sm" className="w-full" onClick={() => {
              const diag = lastDiagResult || diagnosticSession?.ai_diagnosis;
              if (!diag) return;
              const now = format(new Date(), 'dd-MMM-yyyy HH:mm');
              const html = `<!DOCTYPE html><html><head><title>Diagnosis Report - ${ticket.ticket_number}</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:40px;color:#1a1a1a}
.header{border-bottom:2px solid #e5e7eb;padding-bottom:16px;margin-bottom:24px;display:flex;justify-content:space-between;align-items:center}
.header h1{font-size:20px;font-weight:700}.header .meta{font-size:11px;color:#6b7280;text-align:right}
.section{margin-bottom:20px}.section-title{font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:#374151;margin-bottom:8px;border-bottom:1px solid #e5e7eb;padding-bottom:4px}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.field{margin-bottom:8px}.field-label{font-size:11px;color:#6b7280;margin-bottom:2px}.field-value{font-size:13px;font-weight:500}
.diagnosis-box{background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin-top:16px}
.severity-badge{display:inline-block;padding:2px 10px;border-radius:12px;font-size:11px;font-weight:600;background:#fef3c7;color:#92400e}
.footer{margin-top:32px;font-size:10px;color:#9ca3af;text-align:center;border-top:1px solid #e5e7eb;padding-top:12px}
@media print{body{padding:20px}}</style></head><body>
<div class="header"><h1>Diagnosis Report</h1><div class="meta">Generated: ${now}<br/>Ticket: ${ticket.ticket_number}</div></div>
<div class="section"><div class="section-title">Ticket Information</div><div class="grid">
<div class="field"><div class="field-label">Ticket Number</div><div class="field-value">${ticket.ticket_number}</div></div>
<div class="field"><div class="field-label">Issue Type</div><div class="field-value">${ticket.issue_types?.name || '—'}</div></div>
<div class="field"><div class="field-label">Tenant</div><div class="field-value">${ticket.tenants?.full_name || '—'}</div></div>
<div class="field"><div class="field-label">Property</div><div class="field-value">${ticket.properties?.property_name || '—'}</div></div>
<div class="field"><div class="field-label">Apartment</div><div class="field-value">${ticket.apartments?.apartment_code || '—'}</div></div>
<div class="field"><div class="field-label">Status</div><div class="field-value">${ticket.status}</div></div>
</div></div>
<div class="section"><div class="section-title">Diagnosis Result</div><div class="diagnosis-box">
<div class="field"><div class="field-label">Root Cause</div><div class="field-value">${diag.cause || '—'}</div></div>
<div class="field"><div class="field-label">Severity</div><div class="field-value"><span class="severity-badge">${diag.severity || '—'}</span></div></div>
<div class="field"><div class="field-label">Estimated Cost</div><div class="field-value">${diag.estimatedCost || '—'}</div></div>
<div class="field"><div class="field-label">Recommendation</div><div class="field-value">${diag.recommendation || '—'}</div></div>
</div></div>
<div class="footer">Vishful OS — Diagnosis Report</div></body></html>`;
              const w = window.open('', '_blank');
              if (w) { w.document.write(html); w.document.close(); setTimeout(() => w.print(), 500); }
            }}>
              <Download className="h-3.5 w-3.5 mr-1" /> Download Diagnosis PDF
            </Button>
            <p className="text-sm text-muted-foreground">Do you agree with this diagnosis, or would you like to provide your own?</p>
            <Button className="w-full" onClick={() => saveEmployeeDiagnosticResponse.mutate(true)}>
              <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Accept Diagnosis & Add Cost Estimate
            </Button>
            <Separator />
            <div><Label>Your own diagnosis</Label><Textarea value={employeeDiagnosticNotes} onChange={e => setEmployeeDiagnosticNotes(e.target.value)} placeholder="Describe your findings..." rows={3} /></div>
            <Button className="w-full" variant="outline" onClick={() => saveEmployeeDiagnosticResponse.mutate(false)} disabled={!employeeDiagnosticNotes.trim()}>
              Submit Own Diagnosis & Add Cost Estimate
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Cost Estimate Dialog */}
      <Dialog open={showCostEstimate} onOpenChange={setShowCostEstimate}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Submit Cost Estimate for Approval</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-sm text-muted-foreground">Add items (parts/labor) and submit for management approval.</p>
            {costEstimateItems.map((item, i) => (
              <div key={i} className="flex items-center gap-2 bg-muted/50 p-2 rounded text-sm">
                <span className="flex-1">{item.item_name} ({item.cost_type})</span>
                <span>{item.quantity} × ₹{item.unit_price}</span>
                <span className="font-bold">= ₹{(item.quantity * item.unit_price).toLocaleString()}</span>
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setCostEstimateItems(costEstimateItems.filter((_, idx) => idx !== i))}><X className="h-3 w-3" /></Button>
              </div>
            ))}
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Item Name</Label><Input id="est-item" placeholder="e.g., Capacitor" /></div>
              <div><Label>Type</Label>
                <Select defaultValue="parts">
                  <SelectTrigger id="est-type"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="parts">Parts</SelectItem><SelectItem value="labor">Labor</SelectItem></SelectContent>
                </Select>
              </div>
              <div><Label>Quantity</Label><Input id="est-qty" type="number" min={1} defaultValue={1} /></div>
              <div><Label>Unit Price (₹)</Label><Input id="est-price" type="number" min={0} defaultValue={0} /></div>
            </div>
            <Button variant="outline" size="sm" onClick={() => {
              const name = (document.getElementById('est-item') as HTMLInputElement)?.value;
              const qty = parseInt((document.getElementById('est-qty') as HTMLInputElement)?.value) || 1;
              const price = parseFloat((document.getElementById('est-price') as HTMLInputElement)?.value) || 0;
              if (!name) { toast({ title: 'Item name required', variant: 'destructive' }); return; }
              setCostEstimateItems([...costEstimateItems, { item_name: name, cost_type: 'parts', quantity: qty, unit_price: price }]);
              (document.getElementById('est-item') as HTMLInputElement).value = '';
              (document.getElementById('est-qty') as HTMLInputElement).value = '1';
              (document.getElementById('est-price') as HTMLInputElement).value = '0';
            }}>+ Add Item</Button>
            {costEstimateItems.length > 0 && (
              <>
                <div className="text-sm font-bold text-right">Total: ₹{costEstimateItems.reduce((s, i) => s + i.quantity * i.unit_price, 0).toLocaleString()}</div>
                <Button className="w-full" onClick={() => submitCostEstimates.mutate()} disabled={submitCostEstimates.isPending || costSubmitGuardRef.current}>
                  {submitCostEstimates.isPending ? 'Submitting...' : 'Submit for Approval'}
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Decline Estimate Dialog */}
      <Dialog open={showDeclineDialog} onOpenChange={setShowDeclineDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Decline Cost Estimate</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div><Label>Reason for declining *</Label><Textarea value={declineReason} onChange={e => setDeclineReason(e.target.value)} placeholder="Why is this being declined?" rows={3} /></div>
            <Button className="w-full" variant="destructive" onClick={() => declineCostEstimate.mutate()} disabled={declineCostEstimate.isPending || !declineReason.trim()}>Decline Estimate</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Record Purchase Dialog with enhanced vendor details */}
      <Dialog open={showPurchase} onOpenChange={setShowPurchase}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Record Purchase</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            {(() => {
              // Filter out estimates that already have a purchase recorded
              const purchasedEstimateIds = new Set(purchases.map((p: any) => p.cost_estimate_id).filter(Boolean));
              const unsubmittedEstimates = approvedEstimates.filter((e: any) => !purchasedEstimateIds.has(e.id));
              if (unsubmittedEstimates.length === 0) return null;
              return (
                <div>
                  <Label>Linked Estimate</Label>
                  <Select value={purchaseForm.cost_estimate_id} onValueChange={v => {
                    const est = costEstimates.find((e: any) => e.id === v);
                    setPurchaseForm({
                      ...purchaseForm,
                      cost_estimate_id: v,
                      item_name: est?.item_name || '',
                      quantity: est?.quantity || 1,
                      actual_cost: est?.total || 0,
                    });
                  }}>
                    <SelectTrigger><SelectValue placeholder="Select approved estimate" /></SelectTrigger>
                    <SelectContent>
                      {unsubmittedEstimates.map((e: any) => <SelectItem key={e.id} value={e.id}>{e.item_name} (₹{e.total})</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              );
            })()}
            <div><Label>Item Name</Label><Input value={purchaseForm.item_name} onChange={e => setPurchaseForm({ ...purchaseForm, item_name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Quantity</Label><Input type="number" min={1} value={purchaseForm.quantity} onChange={e => setPurchaseForm({ ...purchaseForm, quantity: parseInt(e.target.value) || 1 })} /></div>
              <div><Label>Actual Cost (₹)</Label><Input type="number" min={0} value={purchaseForm.actual_cost} onChange={e => setPurchaseForm({ ...purchaseForm, actual_cost: parseFloat(e.target.value) || 0 })} /></div>
            </div>
            <div>
              <Label>Vendor</Label>
              <Select value={purchaseForm.vendor_id} onValueChange={v => setPurchaseForm({ ...purchaseForm, vendor_id: v, vendor_name_manual: '' })}>
                <SelectTrigger><SelectValue placeholder="Select vendor" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__general">General / One-time Vendor</SelectItem>
                  {vendors.map((v: any) => <SelectItem key={v.id} value={v.id}>{v.vendor_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {purchaseForm.vendor_id === '__general' && (
              <div className="space-y-3 border rounded-lg p-3 bg-muted/30">
                <p className="text-xs font-medium text-muted-foreground">General Vendor Details</p>
                <div><Label>Vendor Name *</Label><Input value={purchaseForm.vendor_name_manual} onChange={e => setPurchaseForm({ ...purchaseForm, vendor_name_manual: e.target.value })} placeholder="Enter vendor name" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>PAN Number</Label><Input value={purchaseForm.vendor_pan} onChange={e => setPurchaseForm({ ...purchaseForm, vendor_pan: e.target.value })} placeholder="ABCDE1234F" /></div>
                  <div><Label>Mobile</Label><Input value={purchaseForm.vendor_mobile} onChange={e => setPurchaseForm({ ...purchaseForm, vendor_mobile: e.target.value })} placeholder="9876543210" /></div>
                </div>
                <div><Label>Address</Label><Input value={purchaseForm.vendor_address} onChange={e => setPurchaseForm({ ...purchaseForm, vendor_address: e.target.value })} placeholder="Vendor address" /></div>
              </div>
            )}
            <FileUploadField label="Invoice / Bill Image" value={purchaseForm.invoice_url} onChange={url => setPurchaseForm({ ...purchaseForm, invoice_url: url })} folder="purchase-invoices" accept="image/*,.pdf" required />
            <Button className="w-full" onClick={() => recordPurchase.mutate()} disabled={recordPurchase.isPending || !purchaseForm.item_name || !purchaseForm.invoice_url}>
              {!purchaseForm.invoice_url ? 'Upload Invoice to Submit' : 'Record Purchase'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
