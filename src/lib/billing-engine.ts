/**
 * Billing Engine — Core calculation logic
 * Handles rent from bed_rates, EB tenant-day model (previous month), late fees, discount
 */

import { differenceInDays, startOfMonth, endOfMonth, min, max, parseISO, isAfter, isBefore, subMonths, format } from 'date-fns';

interface Allotment {
  id: string;
  tenant_id: string;
  property_id: string;
  apartment_id: string;
  bed_id: string;
  monthly_rental: number | null;
  deposit_paid: number | null;
  onboarding_date: string | null;
  actual_exit_date: string | null;
  staying_status: string | null;
  discount: number | null;
  notice_date: string | null;
  estimated_exit_date?: string | null;
  premium?: number | null;
}

interface BedRate {
  bed_type: string;
  toilet_type: string;
  property_id: string | null;
  from_date: string;
  to_date: string | null;
  monthly_rate: number;
}

interface Bed {
  id: string;
  bed_code?: string;
  bed_type: string;
  toilet_type: string;
  apartment_id: string;
}

interface ElectricityReading {
  id: string;
  apartment_id: string;
  property_id: string;
  billing_month: string;
  reading_start: number;
  reading_end: number;
  unit_cost: number;
  units_consumed: number | null;
}

export interface EBTenantDetail {
  tenant_id: string;
  tenant_name: string;
  stay_days: number;
  allotment_id: string;
}

export interface EBBreakdown {
  apartment_id: string;
  billing_month: string;
  total_units: number;
  unit_cost: number;
  total_apartment_bill: number;
  total_tenant_days: number;
  per_day_rate: number;
  tenant_stay_days: number;
  tenant_eb_charge: number;
  all_tenants: EBTenantDetail[];
}

export interface InvoicePreview {
  tenant_id: string;
  tenant_name: string;
  property_id: string;
  apartment_id: string;
  bed_id: string;
  apartment_code: string;
  bed_code: string;
  billing_month: string;
  stay_days: number;
  total_days_in_month: number;
  per_day_rent: number;
  rent_amount: number;
  eb_amount: number;
  eb_details: string;
  eb_breakdown: EBBreakdown | null;
  late_fee: number;
  other_charges: number;
  total: number;
  allotment_id: string;
  discount: number;
  premium: number;
  bed_rate: number;
  is_eb_only?: boolean;
  estimated_eb_amount?: number;
  exit_charges?: number;
}

/**
 * Get bed rate for a specific date from bed_rates table.
 */
export function getBedRateForDate(
  bed: Bed | undefined,
  bedRates: BedRate[],
  date: string,
  propertyId?: string | null
): number {
  if (!bed) return 0;
  const matching = bedRates.filter(r =>
    r.bed_type === bed.bed_type &&
    r.toilet_type === bed.toilet_type &&
    r.from_date <= date &&
    (!r.to_date || r.to_date >= date)
  );
  if (matching.length === 0) return 0;
  if (propertyId) {
    const propSpecific = matching
      .filter(r => r.property_id === propertyId)
      .sort((a, b) => b.from_date.localeCompare(a.from_date));
    if (propSpecific.length > 0) return propSpecific[0].monthly_rate;
  }
  const sorted = matching.sort((a, b) => b.from_date.localeCompare(a.from_date));
  return sorted[0].monthly_rate;
}

/**
 * Calculate stay days for a tenant in a given month
 */
export function calcStayDays(
  onboarding: string | null,
  exitDate: string | null,
  monthStart: Date,
  monthEnd: Date
): number {
  if (!onboarding) return 0;
  const start = max([parseISO(onboarding), monthStart]);
  const end = exitDate ? min([parseISO(exitDate), monthEnd]) : monthEnd;
  if (isAfter(start, end)) return 0;
  return differenceInDays(end, start) + 1;
}

/**
 * Calculate rent with both discount and premium
 */
export function calcRentWithPremium(
  monthlyRental: number,
  stayDays: number,
  totalDaysInMonth: number,
  discount: number = 0,
  premium: number = 0
): number {
  if (stayDays <= 0 || totalDaysInMonth <= 0) return 0;
  const effectiveRent = Math.max(0, monthlyRental - discount + premium);
  const perDayRent = effectiveRent / totalDaysInMonth;
  return Math.ceil(perDayRent * stayDays);
}

/**
 * Calculate absent days for a tenant in a given month based on absence records
 */
export function calcAbsentDays(
  absenceRecords: { tenant_id: string; allotment_id?: string; from_date: string; to_date: string }[],
  tenantId: string,
  allotmentId: string,
  monthStart: Date,
  monthEnd: Date
): number {
  let absentDays = 0;
  for (const rec of absenceRecords) {
    if (rec.tenant_id !== tenantId) continue;
    if (rec.allotment_id && rec.allotment_id !== allotmentId) continue;
    const from = max([parseISO(rec.from_date), monthStart]);
    const to = min([parseISO(rec.to_date), monthEnd]);
    if (isAfter(from, to)) continue;
    absentDays += differenceInDays(to, from) + 1;
  }
  return absentDays;
}

/**
 * EB Billing — Tenant-Day Model
 * Now accepts absence records to deduct absent days from EB calculation
 */
export function calcEBForApartment(
  reading: ElectricityReading | undefined,
  allotmentsInApartment: { tenant_id: string; stay_days: number; tenant_name: string; allotment_id: string }[],
  absenceRecords?: { tenant_id: string; allotment_id?: string; from_date: string; to_date: string }[],
  monthStart?: Date,
  monthEnd?: Date
): { ebMap: Map<string, number>; breakdowns: Map<string, EBBreakdown> } {
  const ebMap = new Map<string, number>();
  const breakdowns = new Map<string, EBBreakdown>();
  if (!reading) return { ebMap, breakdowns };

  const totalUnits = reading.reading_end - reading.reading_start;
  if (totalUnits <= 0) return { ebMap, breakdowns };

  const ebTotal = totalUnits * reading.unit_cost;

  // Adjust stay days by subtracting absent days
  const adjustedAllotments = allotmentsInApartment.map(a => {
    let absentDays = 0;
    if (absenceRecords && monthStart && monthEnd) {
      absentDays = calcAbsentDays(absenceRecords, a.tenant_id, a.allotment_id, monthStart, monthEnd);
    }
    return { ...a, stay_days: Math.max(0, a.stay_days - absentDays) };
  });

  const totalTenantDays = adjustedAllotments.reduce((s, a) => s + a.stay_days, 0);
  if (totalTenantDays === 0) return { ebMap, breakdowns };

  const ebPerDay = ebTotal / totalTenantDays;

  const allTenants: EBTenantDetail[] = adjustedAllotments
    .filter(a => a.stay_days > 0)
    .map(a => ({ tenant_id: a.tenant_id, tenant_name: a.tenant_name, stay_days: a.stay_days, allotment_id: a.allotment_id }));

  for (const a of adjustedAllotments) {
    if (a.stay_days > 0) {
      const charge = Math.ceil(ebPerDay * a.stay_days);
      ebMap.set(a.allotment_id, charge);
      breakdowns.set(a.allotment_id, {
        apartment_id: reading.apartment_id,
        billing_month: reading.billing_month,
        total_units: totalUnits,
        unit_cost: reading.unit_cost,
        total_apartment_bill: Math.ceil(ebTotal),
        total_tenant_days: totalTenantDays,
        per_day_rate: Math.round(ebPerDay * 100) / 100,
        tenant_stay_days: a.stay_days,
        tenant_eb_charge: charge,
        all_tenants: allTenants,
      });
    }
  }

  return { ebMap, breakdowns };
}

/**
 * Late fee: ₹100 × days delayed after due date
 */
export function calcLateFee(dueDate: string, paidDate: string | null): number {
  if (!paidDate) {
    const due = parseISO(dueDate);
    const today = new Date();
    if (!isAfter(today, due)) return 0;
    return differenceInDays(today, due) * 100;
  }
  const due = parseISO(dueDate);
  const paid = parseISO(paidDate);
  if (!isAfter(paid, due)) return 0;
  return differenceInDays(paid, due) * 100;
}

/**
 * Generate invoice previews for a billing month.
 *
 * Tenant Eligibility:
 * - Active: staying_status = Staying or On-Notice, overlapping with billing month
 * - Exited (current month): actual_exit_date within billing month → pro-rated rent + estimated EB
 * - Exited (previous month): NO billing
 *
 * Stay Days:
 * (1) onboarding < month_start AND exit null/>=month_end → full month
 * (2) onboarding < month_start AND exit <=month_end → stay 1..min(exit, month_end)
 * (3) onboarding >= month_start AND exit null/>=month_end → max(onboarding,month_start)..month_end
 * (4) onboarding >= month_start AND exit <=month_end → max(onboarding,month_start)..min(exit,month_end)
 *
 * EB: billed one month in arrears from electricity_readings
 * Estimated EB: for On-Notice/Exited tenants exiting this month, prev month per-day rate × stay days
 * Exit Charges: ₹2,250 if total stay < 365 days
 */
export function generateInvoicePreviews(
  billingMonth: string,
  allotments: Allotment[],
  electricityReadings: ElectricityReading[],
  tenantNames: Map<string, string>,
  beds: Bed[],
  bedRates: BedRate[],
  propertyFilter?: string,
  apartments?: { id: string; apartment_code: string }[],
  absenceRecords?: { tenant_id: string; allotment_id?: string; from_date: string; to_date: string }[]
): InvoicePreview[] {
  const aptCodeMap = new Map((apartments || []).map(a => [a.id, a.apartment_code]));
  const bedCodeMap = new Map(beds.map(b => [b.id, b.bed_code || '']));

  const [year, month] = billingMonth.split('-').map(Number);
  const monthStart = startOfMonth(new Date(year, month - 1));
  const monthEnd = endOfMonth(new Date(year, month - 1));
  const totalDaysInMonth = differenceInDays(monthEnd, monthStart) + 1;

  const prevMonthDate = subMonths(monthStart, 1);
  const prevBillingMonthISO = format(prevMonthDate, 'yyyy-MM');
  const prevBillingMonthMMMyy = format(prevMonthDate, 'MMM-yy');
  const prevMonthStart = startOfMonth(prevMonthDate);
  const prevMonthEnd = endOfMonth(prevMonthDate);

  const rateDate = format(monthStart, 'yyyy-MM-dd');

  // ── Eligible allotments: Staying, On-Notice, or Exited within current billing month ──
  const activeAllotments = allotments.filter(a => {
    if (propertyFilter && a.property_id !== propertyFilter) return false;
    if (!a.onboarding_date) return false;
    if (isAfter(parseISO(a.onboarding_date), monthEnd)) return false;

    const status = a.staying_status || '';

    // Staying or On-Notice: include if not exited before month start
    if (['Staying', 'On-Notice'].includes(status)) {
      if (a.actual_exit_date && isBefore(parseISO(a.actual_exit_date), monthStart)) return false;
      // On-Notice with estimated exit before this month → already exited, skip
      if (status === 'On-Notice' && !a.actual_exit_date) {
        const estExit = a.estimated_exit_date || a.notice_date;
        if (estExit && isBefore(parseISO(estExit), monthStart)) return false;
      }
      return true;
    }

    // Exited: include if they were active during any part of this billing month
    // (i.e., actual_exit_date >= monthStart — they hadn't exited before the month began)
    if (status === 'Exited' && a.actual_exit_date) {
      const exitDate = parseISO(a.actual_exit_date);
      return !isBefore(exitDate, monthStart);
    }

    return false;
  });

  // ── All allotments overlapping previous month (for EB calculation) ──
  const allPrevMonthAllotments = allotments.filter(a => {
    if (propertyFilter && a.property_id !== propertyFilter) return false;
    if (!a.onboarding_date) return false;
    if (isAfter(parseISO(a.onboarding_date), prevMonthEnd)) return false;
    if (a.actual_exit_date && isBefore(parseISO(a.actual_exit_date), prevMonthStart)) return false;
    return true;
  });

  // Group by apartment for EB using ALL prev month allotments
  const aptGroupsEB = new Map<string, { tenant_id: string; stay_days: number; tenant_name: string; allotment_id: string }[]>();
  for (const a of allPrevMonthAllotments) {
    const stayDays = calcStayDays(a.onboarding_date, a.actual_exit_date, prevMonthStart, prevMonthEnd);
    if (stayDays <= 0) continue;
    const key = a.apartment_id;
    if (!aptGroupsEB.has(key)) aptGroupsEB.set(key, []);
    aptGroupsEB.get(key)!.push({
      tenant_id: a.tenant_id,
      stay_days: stayDays,
      tenant_name: tenantNames.get(a.tenant_id) || 'Unknown',
      allotment_id: a.id,
    });
  }

  // Calculate EB per apartment
  const tenantEBMap = new Map<string, number>();
  const tenantEBDetails = new Map<string, string>();
  const tenantEBBreakdowns = new Map<string, EBBreakdown>();

  for (const [aptId, group] of aptGroupsEB) {
    const reading = electricityReadings.find(r => r.apartment_id === aptId && (r.billing_month === prevBillingMonthISO || r.billing_month === prevBillingMonthMMMyy));
    const { ebMap, breakdowns } = calcEBForApartment(reading, group, absenceRecords, prevMonthStart, prevMonthEnd);
    for (const [allotmentId, amt] of ebMap) {
      tenantEBMap.set(allotmentId, amt);
      const bd = breakdowns.get(allotmentId);
      if (bd) tenantEBBreakdowns.set(allotmentId, bd);
      if (reading) {
        const units = reading.reading_end - reading.reading_start;
        tenantEBDetails.set(allotmentId, `${units} units × ₹${reading.unit_cost}/unit (${format(prevMonthDate, 'MMM-yy')})`);
      }
    }
  }

  // ── Compute apartment-level per-day EB rates from previous month readings ──
  // This is used for estimated EB when a per-allotment breakdown isn't available
  const aptPerDayEBRate = new Map<string, number>();
  for (const [aptId, group] of aptGroupsEB) {
    const reading = electricityReadings.find(r => r.apartment_id === aptId && (r.billing_month === prevBillingMonthISO || r.billing_month === prevBillingMonthMMMyy));
    if (reading) {
      const totalUnits = reading.reading_end - reading.reading_start;
      if (totalUnits > 0) {
        const ebTotal = totalUnits * reading.unit_cost;
        const totalTenantDays = group.reduce((s, a) => s + a.stay_days, 0);
        if (totalTenantDays > 0) {
          aptPerDayEBRate.set(aptId, Math.round((ebTotal / totalTenantDays) * 100) / 100);
        }
      }
    }
  }

  // ── Build previews ──
  const previews: InvoicePreview[] = [];
  for (const a of activeAllotments) {
    // Determine effective exit date for stay calculation
    const effectiveExit = getEffectiveExitDate(a, monthStart, monthEnd);

    const stayDays = calcStayDays(a.onboarding_date, effectiveExit, monthStart, monthEnd);
    if (stayDays <= 0) continue;

    const isExitingThisMonth = !!effectiveExit &&
      !isBefore(parseISO(effectiveExit), monthStart) &&
      !isAfter(parseISO(effectiveExit), monthEnd);

    const bed = beds.find(b => b.id === a.bed_id);
    const bedRate = getBedRateForDate(bed, bedRates, rateDate);
    const discount = a.discount || 0;
    const premium = a.premium || 0;
    const effectiveRent = Math.max(0, bedRate - discount + premium);
    const perDayRent = totalDaysInMonth > 0 ? effectiveRent / totalDaysInMonth : 0;
    const rentAmount = calcRentWithPremium(bedRate, stayDays, totalDaysInMonth, discount, premium);
    const ebAmount = tenantEBMap.get(a.id) || 0;
    const ebDetails = tenantEBDetails.get(a.id) || 'No reading';
    const ebBreakdown = tenantEBBreakdowns.get(a.id) || null;

    // Estimated EB for tenants exiting this month (On-Notice or Exited)
    // Uses per-allotment breakdown if available, otherwise apartment-level per-day rate
    let estimatedEbAmount = 0;
    if (isExitingThisMonth) {
      let prevPerDayRate = 0;
      if (ebBreakdown) {
        prevPerDayRate = ebBreakdown.per_day_rate;
      } else {
        // Fallback: use apartment-level per-day EB rate from previous month
        prevPerDayRate = aptPerDayEBRate.get(a.apartment_id) || 0;
      }
      if (prevPerDayRate > 0) {
        estimatedEbAmount = Math.ceil(prevPerDayRate * stayDays);
      }
    }

    // Exit charges: ₹2,250 if total stay < 1 year and tenant is exiting this month
    let exitCharges = 0;
    if (isExitingThisMonth && a.onboarding_date) {
      const exitRef = parseISO(effectiveExit!);
      const totalStayDays = differenceInDays(exitRef, parseISO(a.onboarding_date));
      if (totalStayDays < 365) {
        exitCharges = 2250;
      }
    }

    const total = Math.ceil(rentAmount + ebAmount + estimatedEbAmount + exitCharges);

    previews.push({
      tenant_id: a.tenant_id,
      tenant_name: tenantNames.get(a.tenant_id) || 'Unknown',
      property_id: a.property_id,
      apartment_id: a.apartment_id,
      bed_id: a.bed_id,
      apartment_code: aptCodeMap.get(a.apartment_id) || '',
      bed_code: bedCodeMap.get(a.bed_id) || '',
      billing_month: billingMonth,
      stay_days: stayDays,
      total_days_in_month: totalDaysInMonth,
      per_day_rent: Math.round(perDayRent * 100) / 100,
      rent_amount: rentAmount,
      eb_amount: ebAmount,
      eb_details: ebDetails,
      eb_breakdown: ebBreakdown,
      late_fee: 0,
      other_charges: 0,
      total,
      allotment_id: a.id,
      discount,
      premium,
      bed_rate: bedRate,
      is_eb_only: false,
      estimated_eb_amount: estimatedEbAmount,
      exit_charges: exitCharges,
    });
  }

  // NOTE: No EB-only invoices for previous-month exits per business rules

  return previews;
}

/**
 * Get the effective exit date for billing calculations.
 * Returns the earliest applicable exit date (actual or estimated) if it falls within the billing month.
 */
function getEffectiveExitDate(a: Allotment, monthStart: Date, monthEnd: Date): string | null {
  // actual_exit_date takes highest priority
  if (a.actual_exit_date) {
    const exitDate = parseISO(a.actual_exit_date);
    if (!isBefore(exitDate, monthStart) && !isAfter(exitDate, monthEnd)) {
      return a.actual_exit_date;
    }
    // If exited before month start — shouldn't be here, but return null
    if (isBefore(exitDate, monthStart)) return null;
    // If exited after month end — full month
    return null;
  }

  // estimated_exit_date for On-Notice tenants
  const exitRef = a.estimated_exit_date || a.notice_date;
  if (exitRef && (a.staying_status === 'On-Notice' || a.staying_status === 'Exited')) {
    const estDate = parseISO(exitRef);
    if (!isBefore(estDate, monthStart) && !isAfter(estDate, monthEnd)) {
      return exitRef;
    }
  }

  return null;
}
