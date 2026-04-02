import { useState, useMemo } from 'react';
import { Search, BedDouble, User, CalendarDays, Phone, IndianRupee, AlertTriangle, ChevronDown, ChevronUp, SortAsc, FileWarning } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { differenceInDays } from 'date-fns';
import { format, parseISO, isValid } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';

const STATUS_COLORS: Record<string, { bg: string; border: string; text: string; label: string; dot: string }> = {
  occupied:       { bg: 'bg-[#4CAF50]/15', border: 'border-[#4CAF50]', text: 'text-[#2E7D32]', label: 'Occupied', dot: 'bg-[#4CAF50]' },
  vacant:         { bg: 'bg-[#FF5A5F]/15', border: 'border-[#FF5A5F]', text: 'text-[#C62828]', label: 'Vacant',   dot: 'bg-[#FF5A5F]' },
  notice:         { bg: 'bg-[#FFDE42]/20', border: 'border-[#FFDE42]', text: 'text-[#8B6914]', label: 'Notice',   dot: 'bg-[#FFDE42]' },
  booked:         { bg: 'bg-[#3B82F6]/15', border: 'border-[#3B82F6]', text: 'text-[#1565C0]', label: 'Booked',   dot: 'bg-[#3B82F6]' },
  'notice-booked': { bg: 'bg-purple-100/50', border: 'border-purple-400', text: 'text-purple-700', label: 'Notice-Booked', dot: 'bg-purple-500' },
};

const BED_TYPE_SHORT: Record<string, string> = {
  Single: 'S', Double: 'D', Triple: 'T', single: 'S', double: 'D', triple: 'T',
  Executive: 'E', executive: 'E', Quad: 'Q', quad: 'Q',
  '2-share': '2S', '3-share': '3S', '4-share': '4S',
};

const TOILET_TYPE_SHORT: Record<string, string> = {
  attached: 'AW', Attached: 'AW', common: 'CW', Common: 'CW',
};

const fmtAmt = (v: number | null | undefined): string => {
  if (v == null) return '0';
  return new Intl.NumberFormat('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Math.ceil(v));
};

const isValidDate = (d: string | null | undefined): boolean => {
  if (!d) return false;
  try {
    const parsed = parseISO(d);
    return isValid(parsed) && parsed.getFullYear() > 1970;
  } catch { return false; }
};

const fmtDate = (d: string | null | undefined) => {
  if (!isValidDate(d)) return null;
  try { return format(parseISO(d!), 'dd-MMM-yy'); } catch { return null; }
};

interface BedOccupancyMapProps {
  beds: any[];
  apartments: any[];
  properties: any[];
  allotments: any[];
  notices: any[];
  getBedRate: (bedId: string) => number;
}

export default function BedOccupancyMap({ beds, apartments, properties, allotments, notices, getBedRate }: BedOccupancyMapProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [propertyFilter, setPropertyFilter] = useState<string | null>(null);
  const [selectedBed, setSelectedBed] = useState<any>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [sortBy, setSortBy] = useState<'apartment' | 'gender'>('apartment');
  const [discrepanciesOpen, setDiscrepanciesOpen] = useState(false);

  const activeApartments = useMemo(() => apartments.filter((a: any) => a.status === 'Live'), [apartments]);
  const activeApartmentIds = useMemo(() => new Set(activeApartments.map((a: any) => a.id)), [activeApartments]);

  // Comprehensive data discrepancies
  const dataDiscrepancies = useMemo(() => {
    const items: { type: string; severity: 'error' | 'warning' | 'info'; message: string }[] = [];

    allotments.forEach((allot: any) => {
      const name = allot.tenants?.full_name || 'Unknown';

      // 1. Active allotment in inactive apartment
      if (['Staying', 'On-Notice', 'Booked'].includes(allot.staying_status)) {
        if (allot.apartment_id && !activeApartmentIds.has(allot.apartment_id)) {
          const apt = apartments.find((a: any) => a.id === allot.apartment_id);
          items.push({ type: 'Inactive Apartment', severity: 'error', message: `"${name}" has active allotment in inactive apartment ${apt?.apartment_code || '?'}` });
        }
      }

      // 2. Exited but no notice_date and/or exit_date
      if (allot.staying_status === 'Exited') {
        const hasNotice = isValidDate(allot.notice_date);
        const hasExit = isValidDate(allot.actual_exit_date);
        if (!hasNotice && !hasExit) {
          items.push({ type: 'Missing Dates', severity: 'warning', message: `"${name}" is Exited but has no notice date or exit date recorded` });
        } else if (!hasExit) {
          items.push({ type: 'Missing Exit Date', severity: 'warning', message: `"${name}" is Exited but has no exit date recorded` });
        }
      }

      // 3. Exited but advance still pending over 1 month
      if (allot.staying_status === 'Exited') {
        const exitDate = allot.actual_exit_date;
        if (isValidDate(exitDate)) {
          const daysSinceExit = differenceInDays(new Date(), parseISO(exitDate));
          if (daysSinceExit > 30 && (allot.deposit_paid || 0) > 0 && allot.payment_status !== 'refunded') {
            items.push({ type: 'Pending Advance', severity: 'error', message: `"${name}" exited ${daysSinceExit} days ago but deposit (₹${fmtAmt(allot.deposit_paid)}) may still be pending` });
          }
        }
      }

      // 4. Staying but no onboarding date
      if (allot.staying_status === 'Staying' && !isValidDate(allot.onboarding_date)) {
        items.push({ type: 'Missing Onboarding', severity: 'warning', message: `"${name}" is Staying but has no onboarding date` });
      }

      // 5. Booked but no booking date
      if (allot.staying_status === 'Booked' && !isValidDate(allot.booking_date)) {
        items.push({ type: 'Missing Booking Date', severity: 'warning', message: `"${name}" is Booked but has no booking date` });
      }

      // 6. On-Notice but no notice date
      if (allot.staying_status === 'On-Notice' && !isValidDate(allot.notice_date)) {
        items.push({ type: 'Missing Notice Date', severity: 'warning', message: `"${name}" is On-Notice but has no notice date` });
      }

      // 7. Duplicate active allotments on same bed
      if (['Staying', 'On-Notice'].includes(allot.staying_status)) {
        const dupes = allotments.filter((a2: any) =>
          a2.id !== allot.id && a2.bed_id === allot.bed_id && ['Staying', 'On-Notice'].includes(a2.staying_status)
        );
        if (dupes.length > 0) {
          items.push({ type: 'Duplicate Allotment', severity: 'error', message: `Bed ${allot.beds?.bed_code || '?'} has multiple active tenants: "${name}" and "${dupes[0].tenants?.full_name || 'Unknown'}"` });
        }
      }

      // 8. Allotment has no bed assigned
      if (['Staying', 'On-Notice', 'Booked'].includes(allot.staying_status) && !allot.bed_id) {
        items.push({ type: 'No Bed Assigned', severity: 'error', message: `"${name}" has active allotment (${allot.staying_status}) but no bed assigned` });
      }
    });

    // Deduplicate (e.g. duplicate allotment flagged from both sides)
    const seen = new Set<string>();
    return items.filter(item => {
      const key = `${item.type}:${item.message}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [allotments, activeApartmentIds, apartments]);

  // Build bed data - derive status from allotments (source of truth), not bed_lifecycle_status
  const bedData = useMemo(() => {
    return beds
      .filter((bed: any) =>
        activeApartmentIds.has(bed.apartment_id) &&
        (bed.status === 'Live' || bed.status === 'live')
      )
      .map((bed: any) => {
        const apt = activeApartments.find((a: any) => a.id === bed.apartment_id);
        const prop = apt ? properties.find((p: any) => p.id === apt.property_id) : null;

        // Find ALL active allotments for this bed to detect notice-booked
        const activeAllots = allotments.filter((a: any) =>
          a.bed_id === bed.id && ['Staying', 'On-Notice', 'Booked'].includes(a.staying_status)
        );

        const onNoticeAllot = activeAllots.find((a: any) => a.staying_status === 'On-Notice');
        const bookedAllot = activeAllots.find((a: any) => a.staying_status === 'Booked');
        const stayingAllot = activeAllots.find((a: any) => a.staying_status === 'Staying');

        // Derive bed status from allotment staying_status
        let status = 'vacant';
        if (onNoticeAllot && bookedAllot) {
          status = 'notice-booked';
        } else if (stayingAllot) {
          status = 'occupied';
        } else if (onNoticeAllot) {
          status = 'notice';
        } else if (bookedAllot) {
          status = 'booked';
        }

        // Primary allotment for general display (staying > on-notice > booked)
        const primaryAllot = stayingAllot || onNoticeAllot || bookedAllot || null;

        const noticeRecord = onNoticeAllot ? notices.find((n: any) => n.allotment_id === onNoticeAllot.id) : null;
        const rawNoticeDate = onNoticeAllot?.notice_date || noticeRecord?.notice_date || null;
        const rawEstimatedExitDate = onNoticeAllot?.estimated_exit_date || noticeRecord?.exit_date || null;
        const rawBookingDate = bookedAllot?.booking_date || null;

        const bedTypeShort = BED_TYPE_SHORT[bed.bed_type] || bed.bed_type?.charAt(0)?.toUpperCase() || '?';
        const toiletShort = TOILET_TYPE_SHORT[bed.toilet_type] || bed.toilet_type?.charAt(0)?.toUpperCase() || '';

        return {
          ...bed,
          apartment: apt,
          property: prop,
          status,
          allotment: primaryAllot,
          noticeAllotment: onNoticeAllot || null,
          bookedAllotment: bookedAllot || null,
          noticeRecord,
          tenantName: primaryAllot?.tenants?.full_name || null,
          tenantFirstName: primaryAllot?.tenants?.full_name?.split(' ')[0] || null,
          tenantPhone: primaryAllot?.tenants?.phone || null,
          noticeTenantName: onNoticeAllot?.tenants?.full_name || null,
          bookedTenantName: bookedAllot?.tenants?.full_name || null,
          noticeDate: (status === 'notice' || status === 'notice-booked') && isValidDate(rawNoticeDate) ? rawNoticeDate : null,
          bookingDate: (status === 'booked' || status === 'notice-booked') && isValidDate(rawBookingDate) ? rawBookingDate : null,
          label: bed.bed_code,
          bedTypeShort: `${bedTypeShort}-${toiletShort}`,
        };
      });
  }, [beds, activeApartments, activeApartmentIds, properties, allotments, notices]);

  // Group beds
  const grouped = useMemo(() => {
    let filtered = bedData;
    if (statusFilter) filtered = filtered.filter(b => b.status === statusFilter);
    if (propertyFilter) filtered = filtered.filter(b => b.property?.id === propertyFilter);
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(b =>
        b.label.toLowerCase().includes(q) ||
        b.tenantName?.toLowerCase().includes(q) ||
        b.bed_code?.toLowerCase().includes(q) ||
        b.apartment?.apartment_code?.toLowerCase().includes(q)
      );
    }

    const byProp: Record<string, { property: any; apartments: Record<string, { apartment: any; beds: any[] }> }> = {};
    filtered.forEach(b => {
      const propId = b.property?.id || 'unknown';
      if (!byProp[propId]) byProp[propId] = { property: b.property, apartments: {} };
      const aptId = b.apartment?.id || 'unknown';
      if (!byProp[propId].apartments[aptId]) byProp[propId].apartments[aptId] = { apartment: b.apartment, beds: [] };
      byProp[propId].apartments[aptId].beds.push(b);
    });

    Object.values(byProp).forEach(p => {
      Object.values(p.apartments).forEach(a => {
        a.beds.sort((x: any, y: any) => (x.bed_code || '').localeCompare(y.bed_code || ''));
      });
    });

    return byProp;
  }, [bedData, statusFilter, propertyFilter, search]);

  // Sort apartments
  const sortApartments = (entries: [string, { apartment: any; beds: any[] }][]) => {
    if (sortBy === 'gender') {
      return entries.sort(([, a], [, b]) => {
        const gA = (a.apartment?.gender_allowed || '').toLowerCase();
        const gB = (b.apartment?.gender_allowed || '').toLowerCase();
        const cmp = gA.localeCompare(gB);
        return cmp !== 0 ? cmp : (a.apartment?.apartment_code || '').localeCompare(b.apartment?.apartment_code || '');
      });
    }
    return entries.sort(([, a], [, b]) => (a.apartment?.apartment_code || '').localeCompare(b.apartment?.apartment_code || ''));
  };

  const counts = useMemo(() => {
    const c: Record<string, number> = { occupied: 0, vacant: 0, notice: 0, booked: 0, 'notice-booked': 0 };
    bedData.forEach(b => { c[b.status] = (c[b.status] || 0) + 1; });
    return c;
  }, [bedData]);

  const handleBedClick = (bed: any) => {
    setSelectedBed(bed);
    setDetailOpen(true);
  };


  return (
    <div className="space-y-3">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input placeholder="Search tenant or bed..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 h-8 text-xs" />
        </div>
        {properties.length > 1 && (
          <div className="flex gap-1">
            <Button size="sm" variant={propertyFilter === null ? 'default' : 'outline'} className="h-7 text-[10px] px-2" onClick={() => setPropertyFilter(null)}>All</Button>
            {properties.map((p: any) => (
              <Button key={p.id} size="sm" variant={propertyFilter === p.id ? 'default' : 'outline'} className="h-7 text-[10px] px-2" onClick={() => setPropertyFilter(propertyFilter === p.id ? null : p.id)}>{p.property_name}</Button>
            ))}
          </div>
        )}
        <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
          <SelectTrigger className="h-7 w-auto text-[10px] gap-1 px-2">
            <SortAsc className="h-3 w-3" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="apartment">Sort: Apartment</SelectItem>
            <SelectItem value="gender">Sort: Gender</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-1.5">
        {Object.entries(STATUS_COLORS).map(([key, val]) => (
          <button
            key={key}
            onClick={() => setStatusFilter(statusFilter === key ? null : key)}
            className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium transition-all cursor-pointer border ${
              statusFilter === key
                ? `${val.bg} ${val.border} ${val.text} ring-1 ring-offset-1`
                : statusFilter === null
                  ? `${val.bg} ${val.border} ${val.text}`
                  : 'bg-muted/30 border-border text-muted-foreground opacity-50'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${val.dot}`} />
            {val.label} ({counts[key] || 0})
          </button>
        ))}
        {statusFilter && (
          <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2" onClick={() => setStatusFilter(null)}>Clear</Button>
        )}
      </div>

      <TooltipProvider delayDuration={200}>
        <div className="space-y-1">
          {Object.entries(grouped).length === 0 && (
            <div className="text-center text-muted-foreground py-12">
              <BedDouble className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm font-medium">No beds found</p>
            </div>
          )}

          {Object.entries(grouped).map(([propId, propGroup]) => (
            <div key={propId}>
              {properties.length > 1 && (
                <h3 className="text-[10px] font-semibold text-muted-foreground mb-1 uppercase tracking-wider">
                  {propGroup.property?.property_name || 'Unknown Property'}
                </h3>
              )}

              <div className="border rounded-lg overflow-hidden">
                {sortApartments(Object.entries(propGroup.apartments))
                  .map(([aptId, aptGroup]) => {
                    const gender = (aptGroup.apartment?.gender_allowed || '').toLowerCase();
                    const genderIcon = gender === 'male' ? '♂' : gender === 'female' ? '♀' : '';
                    // Vivid row backgrounds
                    const rowBg = gender === 'male'
                      ? 'bg-sky-100/80 dark:bg-sky-950/30'
                      : gender === 'female'
                        ? 'bg-pink-100/80 dark:bg-pink-950/30'
                        : 'bg-muted/20';

                    return (
                      <div key={aptId} className={`flex items-start border-b last:border-b-0 ${rowBg}`}>
                        {/* Apartment label — narrow left column */}
                        <div className={`w-14 shrink-0 px-1 py-1.5 flex flex-col items-center justify-center border-r ${
                          gender === 'male' ? 'bg-sky-200/60 dark:bg-sky-900/50' : gender === 'female' ? 'bg-pink-200/60 dark:bg-pink-900/50' : 'bg-muted/40'
                        }`}>
                          <span className="text-[11px] font-bold leading-tight">{aptGroup.apartment?.apartment_code || '?'}</span>
                          {genderIcon && (
                            <span className={`text-[9px] font-semibold px-1 rounded mt-0.5 ${
                              gender === 'male' ? 'text-sky-700 bg-sky-200 dark:bg-sky-800 dark:text-sky-200' : 'text-pink-700 bg-pink-200 dark:bg-pink-800 dark:text-pink-200'
                            }`}>
                              {genderIcon} {gender === 'male' ? 'M' : 'F'}
                            </span>
                          )}
                        </div>

                        {/* Beds grid — wider, responsive */}
                        <div className="flex-1 p-1.5 flex flex-wrap gap-1.5">
                          <AnimatePresence mode="popLayout">
                            {aptGroup.beds.map((bed: any) => {
                              const sc = STATUS_COLORS[bed.status] || STATUS_COLORS.vacant;
                              return (
                                <Tooltip key={bed.id}>
                                  <TooltipTrigger asChild>
                                    <motion.button
                                      layout
                                      initial={{ opacity: 0, scale: 0.9 }}
                                      animate={{ opacity: 1, scale: 1 }}
                                      exit={{ opacity: 0, scale: 0.9 }}
                                      whileHover={{ scale: 1.06, y: -1 }}
                                      whileTap={{ scale: 0.96 }}
                                      onClick={() => handleBedClick(bed)}
                                      className={`rounded-md border px-1.5 py-1 text-left cursor-pointer hover:shadow-sm min-w-[60px] ${sc.bg} ${sc.border}`}
                                    >
                                      <div className="flex items-center gap-0.5">
                                        <span className="text-[10px] font-bold leading-none truncate">{bed.label}</span>
                                        <span className="text-[9px] text-muted-foreground font-medium">{bed.bedTypeShort}</span>
                                      </div>
                                      {bed.status === 'notice-booked' ? (
                                        <>
                                          <p className="text-[9px] font-medium leading-tight truncate text-[#E65100]">
                                            ⚠ {bed.noticeTenantName?.split(' ')[0] || 'Notice'}
                                          </p>
                                          <p className="text-[9px] font-medium leading-tight truncate text-[#1565C0]">
                                            📅 {bed.bookedTenantName?.split(' ')[0] || 'Booked'}
                                          </p>
                                        </>
                                      ) : bed.tenantFirstName ? (
                                        <p className={`text-[10px] font-medium leading-tight truncate ${sc.text}`}>
                                          {bed.tenantFirstName}
                                        </p>
                                      ) : (
                                        <p className={`text-[10px] leading-tight ${sc.text}`}>{sc.label}</p>
                                      )}
                                      {bed.status !== 'notice-booked' && bed.noticeDate && (
                                        <p className="text-[8px] text-[#E65100] leading-tight truncate">⚠ {fmtDate(bed.noticeDate)}</p>
                                      )}
                                      {bed.status !== 'notice-booked' && bed.bookingDate && !bed.noticeDate && (
                                        <p className="text-[8px] text-[#1565C0] leading-tight truncate">📅 {fmtDate(bed.bookingDate)}</p>
                                      )}
                                    </motion.button>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="text-[10px] max-w-[180px] p-2">
                                    <p className="font-semibold">{aptGroup.apartment?.apartment_code}-{bed.label} ({bed.bedTypeShort}) — {sc.label}</p>
                                    {bed.status === 'notice-booked' ? (
                                      <>
                                        <p className="flex items-center gap-1 text-[#E65100]"><User className="h-2.5 w-2.5" />Notice: {bed.noticeTenantName}</p>
                                        <p className="flex items-center gap-1 text-[#1565C0]"><User className="h-2.5 w-2.5" />Booked: {bed.bookedTenantName}</p>
                                      </>
                                    ) : bed.tenantName ? (
                                      <p className="flex items-center gap-1"><User className="h-2.5 w-2.5" />{bed.tenantName}</p>
                                    ) : null}
                                    {(() => {
                                      const currentRate = getBedRate(bed.id);
                                      const discount = bed.allotment?.discount || 0;
                                      const effectiveRent = Math.max(0, currentRate - discount);
                                      return currentRate > 0 ? (
                                        <p className="flex items-center gap-1"><IndianRupee className="h-2.5 w-2.5" />₹{fmtAmt(effectiveRent)}/mo{discount > 0 ? ` (disc ₹${fmtAmt(discount)})` : ''}</p>
                                      ) : null;
                                    })()}
                                    {bed.noticeDate && <p className="flex items-center gap-1 text-[#E65100]"><CalendarDays className="h-2.5 w-2.5" />Notice: {fmtDate(bed.noticeDate)}</p>}
                                    {bed.bookingDate && <p className="flex items-center gap-1 text-[#1565C0]"><CalendarDays className="h-2.5 w-2.5" />Booked: {fmtDate(bed.bookingDate)}</p>}
                                  </TooltipContent>
                                </Tooltip>
                              );
                            })}
                          </AnimatePresence>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          ))}
        </div>
      </TooltipProvider>

      {/* Data Discrepancies Report */}
      {dataDiscrepancies.length > 0 && (
        <Collapsible open={discrepanciesOpen} onOpenChange={setDiscrepanciesOpen}>
          <CollapsibleTrigger asChild>
            <button className="w-full flex items-center justify-between rounded-lg border border-orange-300 bg-orange-50 dark:bg-orange-950/20 dark:border-orange-700 px-3 py-2 cursor-pointer hover:bg-orange-100 dark:hover:bg-orange-950/30 transition-colors">
              <div className="flex items-center gap-2 text-orange-700 dark:text-orange-400 font-semibold text-sm">
                <FileWarning className="h-4 w-4" /> Data Discrepancies Report ({dataDiscrepancies.length})
              </div>
              {discrepanciesOpen ? <ChevronUp className="h-4 w-4 text-orange-600" /> : <ChevronDown className="h-4 w-4 text-orange-600" />}
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="rounded-b-lg border border-t-0 border-orange-300 dark:border-orange-700 bg-orange-50/50 dark:bg-orange-950/10 px-3 py-2 space-y-1.5 max-h-[300px] overflow-auto">
            {dataDiscrepancies.map((item, i) => (
              <div key={i} className="flex items-start gap-2 text-xs">
                <span className={`mt-0.5 shrink-0 w-1.5 h-1.5 rounded-full ${
                  item.severity === 'error' ? 'bg-red-500' : item.severity === 'warning' ? 'bg-orange-500' : 'bg-blue-500'
                }`} />
                <span className={`font-medium shrink-0 w-32 ${
                  item.severity === 'error' ? 'text-red-600 dark:text-red-400' : 'text-orange-600 dark:text-orange-400'
                }`}>{item.type}</span>
                <span className="text-muted-foreground">{item.message}</span>
              </div>
            ))}
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Bed Detail Sheet */}
      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent className="sm:max-w-sm overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2 text-sm">
              <BedDouble className="h-4 w-4" />
              {selectedBed?.apartment?.apartment_code}-{selectedBed?.label || 'Bed'} ({selectedBed?.bedTypeShort})
            </SheetTitle>
          </SheetHeader>

          {selectedBed && (
            <div className="mt-4 space-y-4">
              {/* Status */}
              <div className={`rounded-md p-2 ${STATUS_COLORS[selectedBed.status]?.bg || 'bg-muted'} ${STATUS_COLORS[selectedBed.status]?.border || 'border-border'} border`}>
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-semibold ${STATUS_COLORS[selectedBed.status]?.text}`}>
                    {STATUS_COLORS[selectedBed.status]?.label || selectedBed.status}
                  </span>
                  <Badge variant="outline" className="text-[9px] px-1.5 py-0">{selectedBed.bed_type} • {selectedBed.toilet_type}</Badge>
                </div>
              </div>

              {/* Tenant Info */}
              {selectedBed.tenantName && (
                <div className="space-y-2">
                  <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Tenant</h4>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="text-sm font-medium">{selectedBed.tenantName}</span>
                    </div>
                    {selectedBed.tenantPhone && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="text-sm">{selectedBed.tenantPhone}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Allotment Details */}
              {selectedBed.allotment && (
                <div className="space-y-2">
                  <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Allotment</h4>
                  <div className="grid grid-cols-2 gap-1.5 text-sm">
                    {isValidDate(selectedBed.allotment.onboarding_date) && (
                      <div className="bg-muted/40 rounded p-1.5">
                        <p className="text-[9px] text-muted-foreground">Move-in</p>
                        <p className="text-xs font-medium">{fmtDate(selectedBed.allotment.onboarding_date)}</p>
                      </div>
                    )}
                    <div className="bg-muted/40 rounded p-1.5">
                      <p className="text-[9px] text-muted-foreground">Rent (Current Rate)</p>
                      <p className="text-xs font-medium">₹{fmtAmt(Math.max(0, getBedRate(selectedBed.id) - (selectedBed.allotment.discount || 0)))}/mo</p>
                    </div>
                    <div className="bg-muted/40 rounded p-1.5">
                      <p className="text-[9px] text-muted-foreground">Advance</p>
                      <p className="text-xs font-medium">₹{fmtAmt(selectedBed.allotment.deposit_paid)}</p>
                    </div>
                    <div className="bg-muted/40 rounded p-1.5">
                      <p className="text-[9px] text-muted-foreground">Payment</p>
                      <p className={`text-xs font-medium ${selectedBed.allotment.payment_status === 'paid' ? 'text-[#2E7D32]' : 'text-[#E65100]'}`}>
                        {selectedBed.allotment.payment_status === 'paid' ? 'Paid' : 'Pending'}
                      </p>
                    </div>
                  </div>
                  {selectedBed.bookingDate && (
                    <div className="bg-muted/40 rounded p-1.5 text-sm">
                      <p className="text-[9px] text-muted-foreground">Booking Date</p>
                      <p className="text-xs font-medium">{fmtDate(selectedBed.bookingDate)}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Notice Info */}
              {selectedBed.noticeDate && (
                <div className="space-y-2">
                  <h4 className="text-[10px] font-semibold text-[#E65100] uppercase tracking-wider">Notice</h4>
                  <div className="bg-[#FFA500]/10 border border-[#FFA500]/30 rounded p-2 text-sm space-y-1">
                    <div className="flex items-center gap-2">
                      <CalendarDays className="h-3.5 w-3.5 text-[#FFA500]" />
                      <span className="text-xs">Notice Date: <strong>{fmtDate(selectedBed.noticeDate)}</strong></span>
                    </div>
                    {selectedBed.allotment?.estimated_exit_date && isValidDate(selectedBed.allotment.estimated_exit_date) && (
                      <div className="flex items-center gap-2">
                        <CalendarDays className="h-3.5 w-3.5 text-[#FFA500]" />
                        <span className="text-xs">Est. Exit: <strong>{fmtDate(selectedBed.allotment.estimated_exit_date)}</strong></span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Bed Rate (for vacant) */}
              {!selectedBed.allotment && (
                <div className="space-y-2">
                  <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Rate</h4>
                  <div className="bg-muted/40 rounded p-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-xs">Monthly Rate</span>
                      <span className="text-xs font-semibold">₹{fmtAmt(getBedRate(selectedBed.id))}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
