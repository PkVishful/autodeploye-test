import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { BedDouble, Calendar, TrendingUp, Clock, Users, IndianRupee } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { format, differenceInDays, parseISO, isBefore, max as dateMax, startOfMonth, endOfMonth, eachMonthOfInterval, startOfYear, endOfYear } from 'date-fns';

interface BedHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bed: any;
}

const fmtDate = (d: string | null) => {
  if (!d) return '—';
  try { return format(parseISO(d), 'dd MMM yyyy'); } catch { return d; }
};

/** Resolve bed inception = max(contractStartDate for apartment, property.start_date) */
export function getInceptionDate(
  contractStartDate: string | null | undefined,
  propertyStartDate: string | null | undefined
): Date {
  const contractDate = contractStartDate ? parseISO(contractStartDate) : null;
  const propDate = propertyStartDate ? parseISO(propertyStartDate) : null;
  const candidates: Date[] = [];
  if (contractDate) candidates.push(contractDate);
  if (propDate) candidates.push(propDate);
  if (candidates.length === 0) return new Date(2023, 3, 1); // fallback 01-Apr-2023
  return dateMax(candidates);
}

/** Clamp a tenant's effective start to not be before the inception date */
function clampedStayDays(
  onboardingDate: string | null,
  exitDate: string | null,
  stayingStatus: string | null,
  inception: Date
): number {
  const today = new Date();
  const rawStart = onboardingDate ? parseISO(onboardingDate) : null;
  const end = exitDate ? parseISO(exitDate) : (stayingStatus === 'Exited' ? null : today);
  if (!rawStart || !end) return 0;
  const start = isBefore(rawStart, inception) ? inception : rawStart;
  return Math.max(0, differenceInDays(end, start));
}

export function BedHistoryDialog({ open, onOpenChange, bed }: BedHistoryDialogProps) {
  const bedId = bed?.id;

  const { data: allotments = [], isLoading: loadingAllotments, error: allotmentsError } = useQuery({
    queryKey: ['bed-history-allotments', bedId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tenant_allotments')
        .select('id, tenant_id, onboarding_date, actual_exit_date, staying_status, tenants(full_name, phone)')
        .eq('bed_id', bedId)
        .order('onboarding_date', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!bedId && open,
  });

  const { data: invoices = [], isLoading: loadingInvoices } = useQuery({
    queryKey: ['bed-history-invoices', bedId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select('amount_paid, tenant_id')
        .eq('bed_id', bedId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!bedId && open,
  });

  const isLoading = loadingAllotments || loadingInvoices;
  const today = new Date();

  const inception = getInceptionDate(bed?.contractStartDate, bed?.propertyStartDate);

  const revenueByTenant = invoices.reduce((acc: Record<string, number>, inv: any) => {
    acc[inv.tenant_id] = (acc[inv.tenant_id] || 0) + (inv.amount_paid || 0);
    return acc;
  }, {});

  const allotmentRows = allotments.map((a: any) => {
    const stayDays = clampedStayDays(a.onboarding_date, a.actual_exit_date, a.staying_status, inception);
    const revenue = revenueByTenant[a.tenant_id] || 0;
    return { ...a, stayDays, revenue };
  });

  const totalDaysSinceInception = Math.max(1, differenceInDays(today, inception));
  const totalOccupiedDays = allotmentRows.reduce((sum, a) => sum + a.stayDays, 0);
  const occupancyPct = Math.min(100, Math.round((totalOccupiedDays / totalDaysSinceInception) * 100));
  const totalRevenue = allotmentRows.reduce((sum, a) => sum + a.revenue, 0);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <BedDouble className="h-5 w-5 text-primary" />
            <span>Bed History — {bed?.apartments?.apartment_code || ''} / {bed?.bed_code}</span>
          </SheetTitle>
        </SheetHeader>

        {allotmentsError ? (
          <div className="text-center py-8 text-destructive text-sm mt-4">
            Error loading data: {(allotmentsError as Error).message}
          </div>
        ) : isLoading ? (
          <div className="space-y-3 pt-6">
            <div className="grid grid-cols-2 gap-3">
              {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-20 rounded-lg" />)}
            </div>
            <Skeleton className="h-40 rounded-lg" />
          </div>
        ) : (
          <div className="space-y-5 pt-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border bg-card p-3 space-y-1">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Calendar className="h-3.5 w-3.5" />
                  <span className="text-[11px] font-medium">Since Inception</span>
                </div>
                <p className="text-lg font-bold">{totalDaysSinceInception.toLocaleString()} <span className="text-xs font-normal text-muted-foreground">days</span></p>
                <p className="text-[10px] text-muted-foreground">From {format(inception, 'dd MMM yyyy')}</p>
              </div>

              <div className="rounded-lg border bg-card p-3 space-y-1">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  <span className="text-[11px] font-medium">Occupied Days</span>
                </div>
                <p className="text-lg font-bold">{totalOccupiedDays.toLocaleString()} <span className="text-xs font-normal text-muted-foreground">days</span></p>
              </div>

              <div className="rounded-lg border bg-card p-3 space-y-1">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <TrendingUp className="h-3.5 w-3.5" />
                  <span className="text-[11px] font-medium">Occupancy %</span>
                </div>
                <p className="text-lg font-bold">{occupancyPct}%</p>
                <div className="w-full bg-muted rounded-full h-1.5">
                  <div
                    className="h-1.5 rounded-full transition-all"
                    style={{
                      width: `${occupancyPct}%`,
                      backgroundColor: getOccupancyColor(occupancyPct),
                    }}
                  />
                </div>
              </div>

              <div className="rounded-lg border bg-card p-3 space-y-1">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <IndianRupee className="h-3.5 w-3.5" />
                  <span className="text-[11px] font-medium">Total Revenue</span>
                </div>
                <p className="text-lg font-bold">₹{totalRevenue.toLocaleString()}</p>
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-3">
                <Users className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold">Tenant History ({allotmentRows.length})</h3>
              </div>

              {allotmentRows.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm border rounded-lg">
                  No tenants have been allotted to this bed yet.
                </div>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="text-xs">#</TableHead>
                        <TableHead className="text-xs">Tenant</TableHead>
                        <TableHead className="text-xs">Onboarding</TableHead>
                        <TableHead className="text-xs">Exit Date</TableHead>
                        <TableHead className="text-xs text-right">Stay Days</TableHead>
                        <TableHead className="text-xs text-right">Revenue</TableHead>
                        <TableHead className="text-xs">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {allotmentRows.map((a: any, idx: number) => (
                        <TableRow key={a.id} className="hover:bg-muted/30">
                          <TableCell className="text-xs text-muted-foreground">{idx + 1}</TableCell>
                          <TableCell>
                            <div>
                              <p className="text-xs font-medium">{a.tenants?.full_name || '—'}</p>
                              <p className="text-[10px] text-muted-foreground">{a.tenants?.phone || ''}</p>
                            </div>
                          </TableCell>
                          <TableCell className="text-xs">{fmtDate(a.onboarding_date)}</TableCell>
                          <TableCell className="text-xs">{fmtDate(a.actual_exit_date)}</TableCell>
                          <TableCell className="text-xs text-right font-medium">{a.stayDays}</TableCell>
                          <TableCell className="text-xs text-right font-medium">₹{a.revenue.toLocaleString()}</TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={`text-[10px] ${
                                a.staying_status === 'Staying' ? 'border-emerald-500 text-emerald-600' :
                                a.staying_status === 'On-Notice' ? 'border-yellow-500 text-yellow-600' :
                                a.staying_status === 'Exited' ? 'border-red-500 text-red-500' :
                                a.staying_status === 'Booked' ? 'border-blue-500 text-blue-500' :
                                'border-muted-foreground text-muted-foreground'
                              }`}
                            >
                              {a.staying_status || '—'}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

export function getOccupancyColor(pct: number): string {
  if (pct >= 75) return 'hsl(142, 71%, 45%)';   // green
  if (pct >= 50) return 'hsl(45, 93%, 47%)';     // yellow
  if (pct >= 30) return 'hsl(25, 95%, 53%)';     // orange
  return 'hsl(0, 72%, 51%)';                      // red
}

export function computeBedOccupancy(
  bedId: string,
  allotments: any[],
  contractStartDate: string | null,
  propertyStartDate: string | null
): number {
  return computeBedOccupancyStats(bedId, allotments, contractStartDate, propertyStartDate).overall;
}

export interface OccupancyStats {
  overall: number;
  monthly: Record<string, number>; // "2024-01" → 85
  yearly: Record<string, number>;  // "2024" → 78
}

export function computeBedOccupancyStats(
  bedId: string,
  allotments: any[],
  contractStartDate: string | null,
  propertyStartDate: string | null
): OccupancyStats {
  const today = new Date();
  const inception = getInceptionDate(contractStartDate, propertyStartDate);
  const bedAllotments = allotments.filter((a: any) => a.bed_id === bedId);

  // Overall
  const totalDays = Math.max(1, differenceInDays(today, inception));
  let totalOccupied = 0;
  for (const a of bedAllotments) {
    totalOccupied += clampedStayDays(a.onboarding_date, a.actual_exit_date, a.staying_status, inception);
  }
  const overall = Math.min(100, Math.round((totalOccupied / totalDays) * 100));

  // Monthly breakdown
  const monthly: Record<string, number> = {};
  const months = eachMonthOfInterval({ start: inception, end: today });
  for (const monthStart of months) {
    const mStart = startOfMonth(monthStart);
    const mEnd = endOfMonth(monthStart);
    const clampEnd = isBefore(mEnd, today) ? mEnd : today;
    const daysInPeriod = Math.max(1, differenceInDays(clampEnd, mStart) + 1);
    let occupied = 0;
    for (const a of bedAllotments) {
      const rawStart = a.onboarding_date ? parseISO(a.onboarding_date) : null;
      const rawEnd = a.actual_exit_date ? parseISO(a.actual_exit_date) : (a.staying_status === 'Exited' ? null : today);
      if (!rawStart || !rawEnd) continue;
      const effStart = isBefore(rawStart, mStart) ? mStart : rawStart;
      const effEnd = isBefore(rawEnd, clampEnd) ? rawEnd : clampEnd;
      if (!isBefore(effStart, effEnd) && differenceInDays(effEnd, effStart) < 0) continue;
      occupied += Math.max(0, differenceInDays(effEnd, effStart) + 1);
    }
    const key = format(mStart, 'yyyy-MM');
    monthly[key] = Math.min(100, Math.round((occupied / daysInPeriod) * 100));
  }

  // Yearly breakdown
  const yearly: Record<string, number> = {};
  const startYear = inception.getFullYear();
  const endYear = today.getFullYear();
  for (let y = startYear; y <= endYear; y++) {
    const yStart = new Date(y, 0, 1);
    const yEnd = new Date(y, 11, 31);
    const effYStart = isBefore(yStart, inception) ? inception : yStart;
    const effYEnd = isBefore(yEnd, today) ? yEnd : today;
    const daysInYear = Math.max(1, differenceInDays(effYEnd, effYStart) + 1);
    let occupied = 0;
    for (const a of bedAllotments) {
      const rawStart = a.onboarding_date ? parseISO(a.onboarding_date) : null;
      const rawEnd = a.actual_exit_date ? parseISO(a.actual_exit_date) : (a.staying_status === 'Exited' ? null : today);
      if (!rawStart || !rawEnd) continue;
      const effStart = isBefore(rawStart, effYStart) ? effYStart : rawStart;
      const effEnd = isBefore(rawEnd, effYEnd) ? rawEnd : effYEnd;
      if (differenceInDays(effEnd, effStart) < 0) continue;
      occupied += Math.max(0, differenceInDays(effEnd, effStart) + 1);
    }
    yearly[String(y)] = Math.min(100, Math.round((occupied / daysInYear) * 100));
  }

  return { overall, monthly, yearly };
}

/** Find beds where 2+ tenants are currently active (Staying/On-Notice/Booked) */
export function findBedDiscrepancies(
  beds: any[],
  allotments: any[]
): Array<{ bed: any; activeAllotments: any[] }> {
  const discrepancies: Array<{ bed: any; activeAllotments: any[] }> = [];
  const activeStatuses = ['Staying', 'On-Notice', 'Booked'];

  for (const bed of beds) {
    const activeForBed = allotments.filter(
      (a: any) => a.bed_id === bed.id && activeStatuses.includes(a.staying_status)
    );
    if (activeForBed.length >= 2) {
      discrepancies.push({ bed, activeAllotments: activeForBed });
    }
  }
  return discrepancies;
}

/** Find tenants with 2+ active beds (Staying/On-Notice/Booked) simultaneously */
export function findTenantDiscrepancies(
  allotments: any[]
): Array<{ tenantId: string; tenantName: string; tenantPhone: string; activeAllotments: any[] }> {
  const activeStatuses = ['Staying', 'On-Notice', 'Booked'];
  const activeAllotments = allotments.filter((a: any) => activeStatuses.includes(a.staying_status));

  const tenantMap = new Map<string, any[]>();
  for (const a of activeAllotments) {
    const tid = a.tenant_id;
    if (!tid) continue;
    if (!tenantMap.has(tid)) tenantMap.set(tid, []);
    tenantMap.get(tid)!.push(a);
  }

  const discrepancies: Array<{ tenantId: string; tenantName: string; tenantPhone: string; activeAllotments: any[] }> = [];
  for (const [tenantId, allots] of tenantMap) {
    if (allots.length >= 2) {
      discrepancies.push({
        tenantId,
        tenantName: allots[0]?.tenants?.full_name || 'Unknown',
        tenantPhone: allots[0]?.tenants?.phone || '',
        activeAllotments: allots,
      });
    }
  }
  return discrepancies;
}
