import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BATCH_SIZE = 50;

// Working hours SLA: 9:30 – 18:00 IST
function calculateWorkingHoursDeadlineFn(start: Date, slaHours: number): string {
  const IST = 5.5 * 3600000;
  const toIST = (d: Date) => new Date(d.getTime() + IST + d.getTimezoneOffset() * 60000);
  const fromIST = (ist: Date, ref: Date) => new Date(ist.getTime() - IST - ref.getTimezoneOffset() * 60000);
  const ws = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 9, 30);
  const we = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 18, 0);
  const nws = (d: Date) => { const n = new Date(d); n.setDate(n.getDate() + 1); return ws(n); };
  const clamp = (d: Date) => { if (d < ws(d)) return ws(d); if (d >= we(d)) return nws(d); return d; };
  let rem = slaHours * 3600000;
  const ref = new Date(start);
  let c = clamp(toIST(start));
  let g = 0;
  while (rem > 0 && g < 365) {
    g++;
    const end = we(c);
    const avail = end.getTime() - c.getTime();
    if (avail <= 0) { c = nws(c); continue; }
    if (avail >= rem) { c = new Date(c.getTime() + rem); rem = 0; } else { rem -= avail; c = nws(c); }
  }
  return fromIST(c, ref).toISOString();
}

function calculateNextRunDate(frequency: string, fromDate: Date): Date {
  const d = new Date(fromDate);
  switch (frequency) {
    case 'Monthly': d.setMonth(d.getMonth() + 1); break;
    case 'Bi-Monthly': d.setMonth(d.getMonth() + 2); break;
    case 'Quarterly': d.setMonth(d.getMonth() + 3); break;
    case 'Half-Yearly': d.setMonth(d.getMonth() + 6); break;
    case 'Yearly': d.setFullYear(d.getFullYear() + 1); break;
    default: d.setMonth(d.getMonth() + 1);
  }
  return d;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const now = new Date().toISOString();

    // Fetch active rules where next_run_at <= now
    const { data: rules, error: rulesError } = await supabase
      .from('regular_maintenance_rules')
      .select('*')
      .eq('is_active', true)
      .lte('next_run_at', now);

    if (rulesError) throw rulesError;
    if (!rules || rules.length === 0) {
      return new Response(JSON.stringify({ message: 'No rules due', tickets_created: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let totalCreated = 0;
    const errors: string[] = [];

    for (const rule of rules) {
      try {
        // Fetch issue type for description and SLA
        const { data: issueType } = await supabase
          .from('issue_types')
          .select('name, sla_hours, priority')
          .eq('id', rule.issue_type_id)
          .single();

        // Fetch asset type name
        let assetTypeName = 'General';
        if (rule.asset_type_id) {
          const { data: at } = await supabase
            .from('asset_types')
            .select('name')
            .eq('id', rule.asset_type_id)
            .single();
          if (at) assetTypeName = at.name;
        }

        // Build list of assets to create tickets for
        let assetsQuery = supabase
          .from('assets')
          .select('id, organization_id, apartment_id, asset_code')
          .eq('organization_id', rule.organization_id)
          .neq('status', 'disposed');

        if (rule.asset_type_id) {
          assetsQuery = assetsQuery.eq('asset_type_id', rule.asset_type_id);
        }

        const { data: assets } = await assetsQuery;

        // If no asset_type_id specified and no assets found, create a single general ticket
        const targets = (assets && assets.length > 0) ? assets : [null];

        // Filter by property scope
        let filteredTargets = targets;
        if (rule.property_id && assets && assets.length > 0) {
          // Get apartments in this property
          const { data: propApartments } = await supabase
            .from('apartments')
            .select('id')
            .eq('property_id', rule.property_id);
          const aptIds = new Set((propApartments || []).map((a: any) => a.id));

          if (rule.apartment_id) {
            filteredTargets = assets.filter((a: any) => a.apartment_id === rule.apartment_id);
          } else {
            filteredTargets = assets.filter((a: any) => a.apartment_id && aptIds.has(a.apartment_id));
          }

          if (filteredTargets.length === 0) filteredTargets = [null]; // fallback: one general ticket
        }

        // Check for existing tickets this period to prevent duplicates
        const periodStart = rule.last_run_at || rule.start_date;
        const { data: existingTickets } = await supabase
          .from('maintenance_tickets')
          .select('description')
          .eq('organization_id', rule.organization_id)
          .eq('issue_type_id', rule.issue_type_id)
          .gte('created_at', periodStart)
          .like('description', `%Scheduled Maintenance:%`);

        const existingDescriptions = new Set((existingTickets || []).map((t: any) => t.description));

        // Get ticket count for numbering
        const { count: ticketCount } = await supabase
          .from('maintenance_tickets')
          .select('*', { count: 'exact', head: true });

        let seqNum = (ticketCount || 0) + 1;
        const year = new Date().getFullYear();

        // Assignment logic
        let assignedTo: string | null = null;
        if (rule.auto_assign) {
          // Try assignment rules
          const { data: assignRules } = await supabase
            .from('ticket_assignment_rules')
            .select('*')
            .order('priority', { ascending: false });

          if (assignRules?.length) {
            const issueRule = assignRules.find((r: any) => r.rule_type === 'issue_type' && r.issue_type_id === rule.issue_type_id);
            if (issueRule) {
              const { data: member } = await supabase
                .from('team_members')
                .select('user_id')
                .eq('id', issueRule.assigned_employee_id)
                .eq('status', 'active')
                .single();
              if (member?.user_id) assignedTo = member.user_id;
            }
          }

          // Workload balancing fallback
          if (!assignedTo) {
            const { data: activeTeam } = await supabase
              .from('team_members')
              .select('id, user_id')
              .eq('status', 'active')
              .not('user_id', 'is', null);

            if (activeTeam?.length) {
              const { data: activeTickets } = await supabase
                .from('maintenance_tickets')
                .select('assigned_to')
                .not('status', 'in', '("completed","closed","pending_tenant_approval","pending_admin_approval")');

              const workload: Record<string, number> = {};
              activeTeam.forEach((m: any) => { if (m.user_id) workload[m.user_id] = 0; });
              (activeTickets || []).forEach((t: any) => {
                if (t.assigned_to && workload[t.assigned_to] !== undefined) workload[t.assigned_to]++;
              });

              const sorted = Object.entries(workload).sort(([, a], [, b]) => a - b);
              if (sorted.length > 0) assignedTo = sorted[0][0];
            }
          }
        }

        const slaDeadline = issueType?.sla_hours
          ? calculateWorkingHoursDeadlineFn(new Date(), issueType.sla_hours)
          : null;

        // Batch create tickets
        const ticketsToInsert: any[] = [];
        for (const target of filteredTargets) {
          const desc = `Scheduled Maintenance: ${rule.maintenance_type} for ${assetTypeName}${target ? ` (${target.asset_code})` : ''}`;

          // Skip if duplicate
          if (existingDescriptions.has(desc)) continue;

          const ticketNumber = `VISH-${year}-${String(seqNum).padStart(4, '0')}`;
          seqNum++;

          // Resolve property/apartment from asset allocation
          let propertyId = rule.property_id || null;
          let apartmentId = rule.apartment_id || (target?.apartment_id || null);

          if (apartmentId && !propertyId) {
            const { data: apt } = await supabase
              .from('apartments')
              .select('property_id')
              .eq('id', apartmentId)
              .single();
            if (apt) propertyId = apt.property_id;
          }

          if (!propertyId) {
            const { data: firstProp } = await supabase.from('properties').select('id').limit(1).single();
            propertyId = firstProp?.id || null;
          }

          ticketsToInsert.push({
            organization_id: rule.organization_id,
            ticket_number: ticketNumber,
            issue_type_id: rule.issue_type_id,
            description: desc,
            priority: issueType?.priority || 'medium',
            status: assignedTo ? 'assigned' : 'open',
            assigned_to: assignedTo,
            sla_deadline: slaDeadline,
            property_id: propertyId,
            apartment_id: apartmentId,
            tenant_id: null,
            tenant_name: 'System (Scheduled)',
            created_by: rule.created_by,
          });
        }

        // Insert in batches
        for (let i = 0; i < ticketsToInsert.length; i += BATCH_SIZE) {
          const batch = ticketsToInsert.slice(i, i + BATCH_SIZE);
          const { error: insertError } = await supabase.from('maintenance_tickets').insert(batch);
          if (insertError) {
            errors.push(`Rule ${rule.id}: batch insert failed - ${insertError.message}`);
          } else {
            totalCreated += batch.length;
          }
        }

        // Update rule: last_run_at and next_run_at
        const nextRun = calculateNextRunDate(rule.frequency, new Date());
        await supabase
          .from('regular_maintenance_rules')
          .update({
            last_run_at: now,
            next_run_at: nextRun.toISOString(),
          })
          .eq('id', rule.id);

      } catch (ruleErr: any) {
        errors.push(`Rule ${rule.id}: ${ruleErr.message}`);
      }
    }

    return new Response(
      JSON.stringify({
        message: `Processed ${rules.length} rules`,
        tickets_created: totalCreated,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
