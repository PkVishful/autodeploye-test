import { useMemo, useState } from 'react';
import { calculateWorkingHoursDeadline, calculateWorkingHoursElapsed } from '@/lib/date-utils';
import {
  Wrench, Plus, AlertTriangle, Clock, CheckCircle2, Search,
  LayoutDashboard, List, Camera, ChevronLeft, Brain, Download, ChevronRight, RotateCw
} from 'lucide-react';
import LucideIcon from '@/components/shared/LucideIcon';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllRows } from '@/lib/supabase-utils';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { SortableTableHead, useSort } from '@/components/shared/SortableTableHead';
import { FileUploadField } from '@/components/shared/FileUploadField';
import { searchAllFields } from '@/lib/search-utils';
import { exportTickets } from '@/lib/export-utils';
import { TicketDetail } from '@/components/tickets/TicketDetail';
import { TicketsDashboard } from '@/components/tickets/TicketsDashboard';
import { AIInsights } from '@/components/tickets/AIInsights';
import { RegularMaintenanceTab } from '@/components/tickets/RegularMaintenanceTab';
import { useTicketRole } from '@/hooks/useTicketRole';
import { formatDistanceToNow } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';

export default function Tickets() {
  const { profile, user } = useAuth();
  const { ticketRole, isAdmin, isTenantRole, isEmployee, tenantRecord } = useTicketRole();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [statusFilter, setStatusFilter] = useState<string>('open');
  const [bedFilter, setBedFilter] = useState<string>('all');
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 25;
  const [form, setForm] = useState({
    tenant_id: '', issue_type_id: '', description: '', photo_url: null as string | null,
    // Admin-only fields
    property_id: '', apartment_id: '', bed_id: '',
  });
  const [selectedSubIssue, setSelectedSubIssue] = useState<string | null>(null);
  const { sortConfig, handleSort, sortData } = useSort();

  // Server-side filtered ticket query based on role
  const { data: allTickets = [], isLoading } = useQuery({
    queryKey: ['maintenance_tickets', ticketRole, tenantRecord?.id, user?.id],
    queryFn: async () => {
      return fetchAllRows((from, to) => {
        let q = supabase.from('maintenance_tickets')
          .select('*')
          .order('created_at', { ascending: false });
        if (isTenantRole && tenantRecord) q = q.eq('tenant_id', tenantRecord.id);
        else if (isEmployee && !isAdmin && user?.id) q = q.eq('assigned_to', user.id);
        return q.range(from, to);
      });
    },
    enabled: !!profile?.organization_id,
  });

  const { data: issueTypes = [] } = useQuery({
    queryKey: ['issue_types'],
    queryFn: () => fetchAllRows((from, to) => supabase.from('issue_types').select('*').range(from, to)),
    enabled: !!profile?.organization_id,
  });

  const tenantIds = useMemo(
    () => [...new Set(allTickets.map((ticket: any) => ticket.tenant_id).filter(Boolean))],
    [allTickets]
  );

  const creatorIds = useMemo(
    () => [...new Set(allTickets.map((ticket: any) => ticket.created_by).filter(Boolean))],
    [allTickets]
  );

  const propertyIds = useMemo(
    () => [...new Set(allTickets.map((ticket: any) => ticket.property_id).filter(Boolean))],
    [allTickets]
  );

  const apartmentIds = useMemo(
    () => [...new Set(allTickets.map((ticket: any) => ticket.apartment_id).filter(Boolean))],
    [allTickets]
  );

  const { data: ticketTenants = [] } = useQuery({
    queryKey: ['ticket-tenants', tenantIds],
    queryFn: async () => {
      if (!tenantIds.length) return [];
      const { data } = await supabase.from('tenants').select('id, full_name').in('id', tenantIds);
      return data || [];
    },
    enabled: tenantIds.length > 0,
  });

  const { data: ticketCreators = [] } = useQuery({
    queryKey: ['ticket-creators', creatorIds],
    queryFn: async () => {
      if (!creatorIds.length) return [];
      const { data } = await supabase.from('profiles').select('id, full_name').in('id', creatorIds);
      return data || [];
    },
    enabled: creatorIds.length > 0,
  });

  const { data: ticketProperties = [] } = useQuery({
    queryKey: ['ticket-properties', propertyIds],
    queryFn: async () => {
      if (!propertyIds.length) return [];
      const { data } = await supabase.from('properties').select('id, property_name').in('id', propertyIds);
      return data || [];
    },
    enabled: propertyIds.length > 0,
  });

  const { data: ticketApartments = [] } = useQuery({
    queryKey: ['ticket-apartments', apartmentIds],
    queryFn: async () => {
      if (!apartmentIds.length) return [];
      const { data } = await supabase.from('apartments').select('id, apartment_code').in('id', apartmentIds);
      return data || [];
    },
    enabled: apartmentIds.length > 0,
  });

  // Fetch user_roles for all ticket creators to identify admin vs tenant creation
  const { data: creatorRoles = [] } = useQuery({
    queryKey: ['creator-roles', creatorIds],
    queryFn: async () => {
      if (!creatorIds.length) return [];
      const { data } = await supabase.from('user_roles').select('user_id, role').in('user_id', creatorIds);
      return data || [];
    },
    enabled: creatorIds.length > 0,
  });

  // Map creator user_id -> set of roles
  const creatorRoleMap = useMemo(() => {
    const map = new Map<string, Set<string>>();
    creatorRoles.forEach((r: any) => {
      if (!map.has(r.user_id)) map.set(r.user_id, new Set());
      map.get(r.user_id)!.add(r.role);
    });
    return map;
  }, [creatorRoles]);

  const ADMIN_ROLES = ['super_admin', 'org_admin', 'property_manager'];

  // Helper: check if a ticket was created by an admin/PM (not tenant)
  const isAdminCreated = (t: any) => {
    if (!t.created_by) return false; // No creator = legacy/tenant
    const roles = creatorRoleMap.get(t.created_by);
    if (!roles) return false;
    return ADMIN_ROLES.some(r => roles.has(r));
  };

  // Helper: check if a ticket was created by a tenant (not admin/PM)
  const isTenantCreated = (t: any) => !isAdminCreated(t);

  const tickets = useMemo(() => {
    const issueTypeMap = new Map(issueTypes.map((issue: any) => [issue.id, issue]));
    const tenantMap = new Map(ticketTenants.map((tenant: any) => [tenant.id, tenant]));
    const creatorMap = new Map(ticketCreators.map((creator: any) => [creator.id, creator]));
    const propertyMap = new Map(ticketProperties.map((property: any) => [property.id, property]));
    const apartmentMap = new Map(ticketApartments.map((apartment: any) => [apartment.id, apartment]));

    return allTickets.map((ticket: any) => ({
      ...ticket,
      tenants: tenantMap.get(ticket.tenant_id) || null,
      profiles: creatorMap.get(ticket.created_by) || null,
      issue_types: issueTypeMap.get(ticket.issue_type_id) || null,
      properties: propertyMap.get(ticket.property_id) || null,
      apartments: apartmentMap.get(ticket.apartment_id) || null,
    }));
  }, [allTickets, issueTypes, ticketTenants, ticketCreators, ticketProperties, ticketApartments]);

  const { data: issueSubTypes = [] } = useQuery({
    queryKey: ['issue_sub_types', form.issue_type_id],
    queryFn: async () => {
      if (!form.issue_type_id) return [];
      return fetchAllRows((from, to) => supabase.from('issue_sub_types').select('*').eq('issue_type_id', form.issue_type_id).order('sort_order', { ascending: true }).range(from, to));
    },
    enabled: !!profile?.organization_id && !!form.issue_type_id,
  });

  const { data: tenants = [] } = useQuery({
    queryKey: ['tenants_active'],
    queryFn: () => fetchAllRows((from, to) => supabase.from('tenants').select('id, full_name, staying_status').in('staying_status', ['staying', 'on-notice', 'booked']).range(from, to)),
    enabled: !!profile?.organization_id && isAdmin,
  });

  const { data: allotments = [] } = useQuery({
    queryKey: ['tenant_allotments'],
    queryFn: () => fetchAllRows((from, to) => supabase.from('tenant_allotments').select('tenant_id, property_id, apartment_id, bed_id, staying_status').in('staying_status', ['Staying', 'Booked', 'On-Notice'] as any).range(from, to)),
    enabled: !!profile?.organization_id,
  });

  const { data: allLogs = [] } = useQuery({
    queryKey: ['all_ticket_logs'],
    queryFn: () => fetchAllRows((from, to) => supabase.from('ticket_logs').select('*').order('created_at', { ascending: false }).range(from, to)),
    enabled: !!profile?.organization_id,
  });

  const { data: teamMembers = [] } = useQuery({
    queryKey: ['team_members_active'],
    queryFn: () => fetchAllRows((from, to) => supabase.from('team_members').select('id, first_name, last_name, user_id, designation, phone').eq('status', 'active').range(from, to)),
    enabled: !!profile?.organization_id,
  });

  // Admin ticket creation: apartments & beds
  const { data: properties = [] } = useQuery({
    queryKey: ['properties_for_tickets'],
    queryFn: () => fetchAllRows((from, to) => supabase.from('properties').select('id, property_name').eq('status', 'Live').range(from, to)),
    enabled: !!profile?.organization_id && isAdmin,
  });

  const { data: apartments = [] } = useQuery({
    queryKey: ['apartments_for_tickets'],
    queryFn: () => fetchAllRows((from, to) => supabase.from('apartments').select('id, apartment_code, property_id').range(from, to)),
    enabled: !!profile?.organization_id && isAdmin,
  });

  const { data: beds = [] } = useQuery({
    queryKey: ['beds_for_tickets'],
    queryFn: () => fetchAllRows((from, to) => supabase.from('beds').select('id, bed_code, apartment_id, bed_type, toilet_type').range(from, to)),
    enabled: !!profile?.organization_id && isAdmin,
  });

  // Fetch cost estimates with pending status for approval tracking
  const { data: allPendingEstimates = [] } = useQuery({
    queryKey: ['all_pending_cost_estimates'],
    queryFn: () => fetchAllRows((from, to) => supabase.from('ticket_cost_estimates').select('ticket_id, status').eq('status', 'pending').range(from, to)),
    enabled: !!profile?.organization_id,
  });

  // Check if a tenant has pending_tenant_approval tickets
  const getTenantPendingApprovals = (tenantId: string) => {
    return allTickets.filter((t: any) => t.tenant_id === tenantId && t.status === 'pending_tenant_approval');
  };

  // For tenant role, tenant_id comes from tenantRecord; admins don't need a tenant_id

  // Check if tenant is blocked from creating tickets
  const tenantBlocked = isTenantRole && tenantRecord && getTenantPendingApprovals(tenantRecord.id).length > 0;
  const tenantPendingTickets = isTenantRole && tenantRecord ? getTenantPendingApprovals(tenantRecord.id) : [];

  // Admin: filter apartments by selected property
  const adminFilteredApartments = isAdmin && form.property_id
    ? apartments.filter((a: any) => a.property_id === form.property_id) : [];
  const adminFilteredBeds = isAdmin && form.apartment_id
    ? beds.filter((b: any) => b.apartment_id === form.apartment_id) : [];

  const createTicket = useMutation({
    mutationFn: async () => {
      // For admin/PM: tenant_id is null (management ticket, no tenant record needed)
      // For tenant: use their tenant record
      let ticketTenantId: string | null = null;
      if (isTenantRole && tenantRecord) {
        ticketTenantId = tenantRecord.id;
      } else if (isAdmin) {
        // Admin tickets don't require a tenant record — tenant_id stays null
        ticketTenantId = null;
      } else {
        throw new Error('Unable to determine ticket creator identity');
      }

      // For tenant: auto-detect allotment. For admin: use selected apartment/bed (no allotment needed)
      let allotment = ticketTenantId ? allotments.find((a: any) => a.tenant_id === ticketTenantId) : null;

      // Block if tenant has pending approval tickets (only for tenant role)
      if (isTenantRole) {
        const pendingApprovals = getTenantPendingApprovals(ticketTenantId);
        if (pendingApprovals.length > 0) {
          throw new Error(`You have ${pendingApprovals.length} ticket(s) awaiting your approval. Please accept or reject them first.`);
        }
      }

      const issueType = issueTypes.find((i: any) => i.id === form.issue_type_id);

      // Generate ticket number
      const year = new Date().getFullYear();
      const { count } = await supabase.from('maintenance_tickets')
        .select('*', { count: 'exact', head: true });
      const ticketNumber = `VISH-${year}-${String((count || 0) + 1).padStart(4, '0')}`;
      const slaDeadline = issueType ? calculateWorkingHoursDeadline(new Date(), issueType.sla_hours) : null;

      // Determine property/apartment/bed
      let propertyId = allotment?.property_id;
      let apartmentId = allotment?.apartment_id;
      let bedId = allotment?.bed_id || null;

      // Admin: use selected property/apartment/bed
      if (isAdmin) {
        if (form.property_id) {
          propertyId = form.property_id;
        }
        if (form.apartment_id) {
          apartmentId = form.apartment_id;
          const apt = apartments.find((a: any) => a.id === form.apartment_id);
          if (apt) propertyId = apt.property_id;
        }
        if (form.bed_id && form.bed_id !== '__none') bedId = form.bed_id;
      }

      if (!propertyId) {
        const { data: firstProp } = await supabase.from('properties').select('id').limit(1).single();
        propertyId = firstProp?.id;
      }
      if (!apartmentId) {
        const { data: firstApt } = await supabase.from('apartments').select('id').limit(1).single();
        apartmentId = firstApt?.id;
      }

      // Get apartment code for rule matching — fetch inline if not in pre-loaded list
      let aptCode = '';
      if (apartmentId) {
        const apt = apartments.find((a: any) => a.id === apartmentId);
        if (apt) {
          aptCode = apt.apartment_code || '';
        } else {
          const { data: aptData } = await supabase.from('apartments').select('apartment_code').eq('id', apartmentId).single();
          aptCode = aptData?.apartment_code || '';
        }
      }

      // Dynamic assignment from ticket_assignment_rules table — NO hardcoding
      let assignedTo: string | null = null;
      const { data: rules } = await supabase.from('ticket_assignment_rules')
        .select('*')
        .order('priority', { ascending: false });

      if (rules?.length) {
        // Rule 1: Issue type match (higher priority)
        const issueRule = rules.find((r: any) => r.rule_type === 'issue_type' && r.issue_type_id === form.issue_type_id);
        if (issueRule) {
          const member = teamMembers.find((m: any) => m.id === issueRule.assigned_employee_id);
          if (member?.user_id) assignedTo = member.user_id;
        }

        // Rule 2: Apartment match (match first letter of apartment code)
        if (!assignedTo && aptCode) {
          const aptRule = rules.find((r: any) => {
            if (r.rule_type !== 'apartment' || !r.apartment_code) return false;
            return aptCode.toUpperCase().startsWith(r.apartment_code.toUpperCase());
          });
          if (aptRule) {
            const member = teamMembers.find((m: any) => m.id === aptRule.assigned_employee_id);
            if (member?.user_id) assignedTo = member.user_id;
          }
        }
      }

      // Workload balancing fallback — only if no rule matched
      if (!assignedTo && teamMembers.length > 0) {
        const activeTickets = allTickets.filter((t: any) => !['completed', 'closed', 'pending_tenant_approval', 'pending_admin_approval'].includes(t.status));
        const workload: Record<string, number> = {};
        teamMembers.forEach((m: any) => { if (m.user_id) workload[m.user_id] = 0; });
        activeTickets.forEach((t: any) => { if (t.assigned_to && workload[t.assigned_to] !== undefined) workload[t.assigned_to]++; });
        const sorted = Object.entries(workload).sort(([, a], [, b]) => a - b);
        if (sorted.length > 0) assignedTo = sorted[0][0];
      }

      const photoUrls = form.photo_url ? [form.photo_url] : null;

      // Resolve creator name for the ticket
      let creatorTenantName = '';
      let creatorTenantPhone = '';
      if (isTenantRole && tenantRecord) {
        creatorTenantName = tenantRecord.full_name || '';
        creatorTenantPhone = '';
      } else if (isAdmin && profile) {
        creatorTenantName = profile.full_name || 'Admin';
        creatorTenantPhone = profile.phone || '';
      }

      const insertData: any = {
        organization_id: profile.organization_id,
        ticket_number: ticketNumber,
        tenant_id: ticketTenantId, // null for admin tickets
        property_id: propertyId,
        apartment_id: apartmentId,
        bed_id: bedId,
        issue_type_id: form.issue_type_id,
        description: form.description,
        priority: issueType?.priority || 'medium',
        sla_deadline: slaDeadline,
        assigned_to: assignedTo,
        status: assignedTo ? 'assigned' : 'open',
        photo_urls: photoUrls,
        created_by: user?.id || null,
        tenant_name: creatorTenantName,
        tenant_phone: creatorTenantPhone,
      };

      const { error } = await supabase.from('maintenance_tickets').insert(insertData);
      if (error) throw error;

      const newTicketId = (await supabase.from('maintenance_tickets').select('id').eq('ticket_number', ticketNumber).single()).data?.id;
      if (newTicketId) {
        const creatorInfo = isAdmin ? ` Created by admin: ${profile?.full_name || 'Admin'}.` : '';
        await supabase.from('ticket_logs').insert({
          ticket_id: newTicketId,
          action: 'Ticket created',
          notes: `Issue: ${issueType?.name}.${creatorInfo} ${assignedTo ? ' Auto-assigned to employee.' : ' Pending assignment.'}`,
          created_by: user?.id,
        } as any);
      }

      // Send SMS notification for ticket assignment
      if (assignedTo) {
        const assignedMember = teamMembers.find((m: any) => m.user_id === assignedTo);
        const empName = assignedMember ? `${assignedMember.first_name || ''} ${assignedMember.last_name || ''}`.trim() : 'Employee';
        supabase.functions.invoke('ticket-notifications', {
          body: { event: 'ticket_assigned', ticketNumber, employeeName: empName, phoneNumber: assignedMember?.phone || '' },
        }).catch(console.error);
      }

      return { ticketNumber, slaHours: issueType?.sla_hours, assigned: !!assignedTo };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['maintenance_tickets'] });
      queryClient.invalidateQueries({ queryKey: ['all_ticket_logs'] });
      setOpen(false);
      setForm({ tenant_id: '', issue_type_id: '', description: '', photo_url: null, property_id: '', apartment_id: '', bed_id: '' });
      toast({
        title: 'Ticket Created!',
        description: `${data.ticketNumber} — SLA: ${data.slaHours}h ${data.assigned ? '• Auto-assigned' : ''}`,
      });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  // SLA helper
  const getSlaStatus = (ticket: any) => {
    if (!ticket.sla_deadline || ['completed', 'closed'].includes(ticket.status)) return 'ok';
    const deadline = new Date(ticket.sla_deadline);
    const now = new Date();
    if (now > deadline) return 'breached';
    const slaHours = ticket.issue_types?.sla_hours || 24;
    const totalMs = slaHours * 3600000;
    const slaStart = new Date(deadline.getTime() - totalMs);
    const elapsed = calculateWorkingHoursElapsed(slaStart, now);
    if ((elapsed / totalMs) * 100 >= 50) return 'warning';
    return 'ok';
  };

  const openStatuses = ['open', 'assigned', 'in_progress', 'waiting_for_parts', 'completed', 'reassigned'];
  const closedCutoff = new Date();
  closedCutoff.setDate(closedCutoff.getDate() - 30);

  const filtered = tickets
    .filter((t: any) => {
      if (statusFilter === 'all') return true;
      if (statusFilter === 'open') {
        return openStatuses.includes(t.status);
      }
      if (statusFilter === 'tenant_approval') {
        return t.status === 'pending_tenant_approval';
      }
      if (statusFilter === 'admin_approval') {
        return t.status === 'pending_admin_approval';
      }
      if (statusFilter === 'waiting_for_cost_approval') return t.status === 'waiting_for_cost_approval';
      if (statusFilter === 'closed') {
        return t.status === 'closed' && new Date(t.closed_at || t.created_at) >= closedCutoff;
      }
      return t.status === statusFilter;
    })
    .filter((t: any) => searchAllFields(t, search));

  const sorted = sortData(filtered, (item, key) => {
    if (key === 'tenant') return (item as any).tenants?.full_name;
    if (key === 'property') return (item as any).properties?.property_name;
    if (key === 'issue') return (item as any).issue_types?.name;
    return item[key];
  });

  // If a ticket is selected, show detail view
  if (selectedTicket) {
    const fullTicket = tickets.find((t: any) => t.id === selectedTicket.id) || selectedTicket;
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => setSelectedTicket(null)} className="gap-1">
          <ChevronLeft className="h-4 w-4" /> Back to Tickets
        </Button>
        <TicketDetail ticket={fullTicket} onClose={() => setSelectedTicket(null)} />
      </div>
    );
  }

  // Approval counts split by who raised the ticket
  const tenantApprovalCount = tickets.filter((t: any) => t.status === 'pending_tenant_approval').length;
  const adminApprovalCount = tickets.filter((t: any) => t.status === 'pending_admin_approval').length;

  // Simplified 5-tab structure uses openStatuses and closedCutoff defined above

  const statusTabs = [
    { value: 'open', label: 'Open', count: tickets.filter((t: any) => openStatuses.includes(t.status)).length },
    { value: 'waiting_for_cost_approval', label: 'Cost Approval', count: tickets.filter((t: any) => t.status === 'waiting_for_cost_approval').length },
    { value: 'admin_approval', label: 'Admin Approval', count: adminApprovalCount },
    { value: 'tenant_approval', label: 'Tenant Approval', count: tenantApprovalCount },
    { value: 'closed', label: 'Closed', count: tickets.filter((t: any) => t.status === 'closed' && new Date(t.closed_at || t.created_at) >= closedCutoff).length },
  ];

  const visibleStatusTabs = isTenantRole
    ? statusTabs.filter(t => ['open', 'tenant_approval', 'closed'].includes(t.value))
    : statusTabs;

  // Can create ticket: Tenant always, Admin always
  const canCreateTicket = isTenantRole || isAdmin;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {isTenantRole ? 'My Tickets' : isEmployee ? 'Assigned Tickets' : 'Maintenance Tickets'}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isTenantRole ? 'View and manage your maintenance requests' : isEmployee ? 'Tickets assigned to you' : 'Track and manage maintenance requests'}
          </p>
        </div>
        {/* Create Ticket - for Tenant and Admin */}
        {canCreateTicket && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2" disabled={isTenantRole && !!tenantBlocked}>
                <Plus className="h-4 w-4" /> New Ticket
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Create Maintenance Ticket</DialogTitle>
                <DialogDescription>
                  {isTenantRole ? 'Submit a new maintenance request. Location is auto-detected from your stay.' : 'Create a ticket on behalf of a tenant.'}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-2 max-h-[70vh] overflow-y-auto">
                {/* Tenant role: auto-filled, no tenant selector */}
                {isTenantRole && tenantRecord?.id && (() => {
                  const a = allotments.find((x: any) => x.tenant_id === tenantRecord.id);
                  const pendingApprovals = getTenantPendingApprovals(tenantRecord.id);
                  return (
                    <>
                      {a
                        ? <p className="text-xs text-muted-foreground bg-secondary p-2 rounded">✅ Auto-detected location from your current stay</p>
                        : <p className="text-xs text-destructive bg-destructive/10 p-2 rounded">⚠️ No active stay allocation found</p>
                      }
                      {pendingApprovals.length > 0 && (
                        <p className="text-xs text-destructive bg-destructive/10 p-2 rounded">
                          🚫 You have {pendingApprovals.length} completed ticket(s) awaiting your approval ({pendingApprovals.map((t: any) => t.ticket_number).join(', ')}). Please accept or reject those first.
                        </p>
                      )}
                    </>
                  );
                })()}

                {/* Admin/PM: Management-level ticket with property/apartment/bed selectors */}
                {isAdmin && (
                  <>
                    <p className="text-xs text-muted-foreground bg-secondary p-2 rounded">
                      ℹ️ Creating a management-level ticket. Select location below.
                    </p>
                    <div>
                      <Label>Property *</Label>
                      <Select value={form.property_id} onValueChange={(v) => setForm({ ...form, property_id: v, apartment_id: '', bed_id: '' })}>
                        <SelectTrigger><SelectValue placeholder="Select property" /></SelectTrigger>
                        <SelectContent>
                          {properties.map((p: any) => (
                            <SelectItem key={p.id} value={p.id}>{p.property_name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {form.property_id && (
                      <div>
                        <Label>Apartment</Label>
                        <Select value={form.apartment_id} onValueChange={(v) => setForm({ ...form, apartment_id: v, bed_id: '' })}>
                          <SelectTrigger><SelectValue placeholder="Select apartment (optional)" /></SelectTrigger>
                          <SelectContent>
                            {adminFilteredApartments.map((a: any) => (
                              <SelectItem key={a.id} value={a.id}>{a.apartment_code}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    {form.apartment_id && (
                      <div>
                        <Label>Bed</Label>
                        <Select value={form.bed_id} onValueChange={(v) => setForm({ ...form, bed_id: v })}>
                          <SelectTrigger><SelectValue placeholder="Select bed (optional)" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none">No specific bed</SelectItem>
                            {adminFilteredBeds.map((b: any) => (
                              <SelectItem key={b.id} value={b.id}>{b.bed_code} ({b.bed_type})</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </>
                )}

                <div>
                  <Label>Issue Category *</Label>
                  <Select value={form.issue_type_id} onValueChange={(v) => { setForm({ ...form, issue_type_id: v, description: '' }); setSelectedSubIssue(null); }}>
                    <SelectTrigger><SelectValue placeholder="Select issue category" /></SelectTrigger>
                    <SelectContent>{issueTypes.map((i: any) => (
                      <SelectItem key={i.id} value={i.id}>
                        <span className="flex items-center gap-2">
                          <LucideIcon name={i.icon || 'wrench'} className="h-3.5 w-3.5 text-muted-foreground" />
                          {i.name}
                          <span className="text-muted-foreground text-xs">({i.sla_hours}h SLA)</span>
                        </span>
                      </SelectItem>
                    ))}</SelectContent>
                  </Select>
                </div>
                {form.issue_type_id && issueSubTypes.length > 0 && (
                  <div>
                    <Label className="mb-2 block">What's the specific issue?</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {issueSubTypes.map((sub: any) => (
                        <button
                          key={sub.id}
                          type="button"
                          onClick={() => {
                            setSelectedSubIssue(sub.name);
                            setForm({ ...form, description: sub.description || sub.name });
                          }}
                          className={`flex items-center gap-2.5 p-2.5 rounded-lg border text-left text-sm transition-all hover:border-primary/50 hover:bg-accent ${
                            selectedSubIssue === sub.name
                              ? 'border-primary bg-primary/10 ring-1 ring-primary/30 text-primary font-medium'
                              : 'border-border bg-card text-foreground'
                          }`}
                        >
                          <span className={`flex-shrink-0 ${selectedSubIssue === sub.name ? 'text-primary' : 'text-muted-foreground'}`}>
                            <LucideIcon name={sub.icon || 'circle-dot'} className="h-4 w-4" />
                          </span>
                          <span className="truncate">{sub.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div>
                  <Label>Description</Label>
                  <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Describe the issue in detail..." rows={3} />
                </div>
                <FileUploadField
                  label="Issue Photo"
                  value={form.photo_url}
                  onChange={(url) => setForm({ ...form, photo_url: url })}
                  folder="ticket-photos"
                  accept="image/*"
                />
                <Button
                  className="w-full"
                  onClick={() => createTicket.mutate()}
                  disabled={createTicket.isPending || !form.issue_type_id || (isTenantRole && (!tenantRecord?.id || getTenantPendingApprovals(tenantRecord.id).length > 0))}
                >
                  {createTicket.isPending ? 'Creating...' : 'Submit Ticket'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Tenant blocked banner */}
      {tenantBlocked && tenantPendingTickets.length > 0 && (
        <Card className="border-amber-500 bg-amber-500/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              <span className="font-semibold text-sm">Action Required: Pending Approval</span>
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              You have {tenantPendingTickets.length} ticket(s) marked as completed that need your approval. Please approve or reject them before creating new tickets.
            </p>
            <div className="flex flex-wrap gap-2">
              {tenantPendingTickets.map((t: any) => (
                <Button key={t.id} size="sm" variant="outline" onClick={() => setSelectedTicket(t)}>
                  {t.ticket_number}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Approval alerts moved to dashboard — removed from tickets page */}

      <Tabs defaultValue="list">
        <TabsList>
          <TabsTrigger value="list" className="gap-1"><List className="h-3.5 w-3.5" /> Tickets</TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="regular" className="gap-1"><RotateCw className="h-3.5 w-3.5" /> Regular Maintenance</TabsTrigger>
          )}
          {isAdmin && (
            <TabsTrigger value="dashboard" className="gap-1"><LayoutDashboard className="h-3.5 w-3.5" /> Dashboard</TabsTrigger>
          )}
          {isAdmin && (
            <TabsTrigger value="ai" className="gap-1"><Brain className="h-3.5 w-3.5" /> AI Insights</TabsTrigger>
          )}
        </TabsList>

        {isAdmin && (
          <TabsContent value="regular" className="mt-4">
            <RegularMaintenanceTab />
          </TabsContent>
        )}

        <TabsContent value="dashboard" className="mt-4">
          <TicketsDashboard tickets={tickets} allTickets={allTickets} logs={allLogs} teamMembers={teamMembers} ticketRole={ticketRole} />
        </TabsContent>

        {isAdmin && (
          <TabsContent value="ai" className="mt-4">
            <AIInsights tickets={allTickets} logs={allLogs} teamMembers={teamMembers} />
          </TabsContent>
        )}

        <TabsContent value="list" className="mt-4 space-y-4">
          <div className="flex gap-2 flex-wrap">
            {visibleStatusTabs.map(tab => (
              <Button
                key={tab.value}
                variant={statusFilter === tab.value ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter(tab.value)}
                className="text-xs"
              >
                {tab.label}
                {tab.count > 0 && (
                  <span className="ml-1.5 bg-background/20 text-[10px] px-1.5 py-0.5 rounded-full">
                    {tab.count}
                  </span>
                )}
              </Button>
            ))}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative max-w-sm flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search tickets..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} className="pl-9" />
            </div>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => exportTickets(sorted, 'pdf')}>
              <Download className="h-3.5 w-3.5" /> PDF
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => exportTickets(sorted, 'csv')}>
              <Download className="h-3.5 w-3.5" /> CSV
            </Button>
          </div>

          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableTableHead label="Ticket #" sortKey="ticket_number" sortConfig={sortConfig} onSort={handleSort} />
                  {!isTenantRole && <SortableTableHead label="Name" sortKey="tenant" sortConfig={sortConfig} onSort={handleSort} />}
                  <SortableTableHead label="Location" sortKey="property" sortConfig={sortConfig} onSort={handleSort} />
                  <SortableTableHead label="Issue" sortKey="issue" sortConfig={sortConfig} onSort={handleSort} />
                  <SortableTableHead label="Priority" sortKey="priority" sortConfig={sortConfig} onSort={handleSort} />
                  <SortableTableHead label="Status" sortKey="status" sortConfig={sortConfig} onSort={handleSort} />
                  <TableHead>SLA</TableHead>
                  <SortableTableHead label="Created" sortKey="created_at" sortConfig={sortConfig} onSort={handleSort} />
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, r) => (
                    <TableRow key={r}>{Array.from({ length: isTenantRole ? 7 : 8 }).map((_, c) => <TableCell key={c}><Skeleton className="h-4 w-full" /></TableCell>)}</TableRow>
                  ))
                ) : sorted.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={isTenantRole ? 7 : 8} className="text-center text-muted-foreground py-8">
                      No tickets found
                    </TableCell>
                  </TableRow>
                ) : sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map((t: any) => {
                  const sla = getSlaStatus(t);
                  return (
                    <TableRow
                      key={t.id}
                      className="cursor-pointer hover:bg-accent/50"
                      onClick={() => setSelectedTicket(t)}
                    >
                      <TableCell className="font-mono text-xs font-medium">{t.ticket_number}</TableCell>
                      {!isTenantRole && (
                          <TableCell className="text-sm">
                          {(() => {
                            const adminCreated = isAdminCreated(t);
                            const creatorName = t.tenant_name || t.profiles?.full_name || t.tenants?.full_name || 'Unknown';
                            return (
                              <span className="flex items-center gap-1.5">
                                {creatorName}
                                {adminCreated && (
                                  <span className="inline-flex items-center justify-center w-2 h-2 rounded-full bg-primary shrink-0" title="Created by Admin/PM" />
                                )}
                              </span>
                            );
                          })()}
                        </TableCell>
                      )}
                      <TableCell className="text-sm">
                        <span>{t.properties?.property_name}</span>
                        {t.apartments?.apartment_code && (
                          <span className="text-muted-foreground text-xs ml-1">• {t.apartments.apartment_code}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">{t.issue_types?.name}</TableCell>
                      <TableCell><StatusBadge status={t.priority} type="priority" /></TableCell>
                      <TableCell><StatusBadge status={t.status} type="ticket" /></TableCell>
                      <TableCell>
                        {sla === 'breached' && <span className="inline-flex items-center gap-1 text-[10px] font-bold text-destructive">🔴 Breached</span>}
                        {sla === 'warning' && <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-500">⚠️ Warning</span>}
                        {sla === 'ok' && t.sla_deadline && <span className="text-[10px] text-muted-foreground">✓ On track</span>}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(t.created_at), { addSuffix: true })}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>

          {/* Pagination */}
          {sorted.length > PAGE_SIZE && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-xs text-muted-foreground">
                Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, sorted.length)} of {sorted.length}
              </p>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <span className="text-xs px-2">{page + 1} / {Math.ceil(sorted.length / PAGE_SIZE)}</span>
                <Button variant="outline" size="sm" disabled={(page + 1) * PAGE_SIZE >= sorted.length} onClick={() => setPage(p => p + 1)}>
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
