/**
 * Parse an Excel date value (serial number, Date object, or string) to yyyy-MM-dd
 * using UTC to avoid timezone-related date shifts (IST fix).
 */
export function parseExcelDateUTC(raw: any): string | null {
  if (!raw && raw !== 0) return null;
  let d: Date | undefined;
  if (typeof raw === 'number') {
    d = new Date(Math.round((raw - 25569) * 86400) * 1000);
  } else if (raw instanceof Date) {
    d = raw;
  } else {
    const s = String(raw).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.substring(0, 10);
    const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    const num = Number(s);
    if (!isNaN(num) && num > 40000 && num < 60000) {
      d = new Date(Math.round((num - 25569) * 86400) * 1000);
    } else {
      try { d = new Date(s); } catch { return null; }
    }
  }
  if (!d || isNaN(d.getTime())) return null;
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

/** Format billing_month (yyyy-MM) to MMM-yy display */
export function fmtMonthLabel(m: string | null): string {
  if (!m) return '—';
  try {
    if (/^\d{4}-\d{2}$/.test(m)) {
      const [y, mo] = m.split('-');
      const d = new Date(parseInt(y), parseInt(mo) - 1, 1);
      const month = d.toLocaleString('en-US', { month: 'short' });
      const year = d.toLocaleString('en-US', { year: '2-digit' });
      return `${month}-${year}`;
    }
    return m;
  } catch { return m; }
}

// ─── Working-hours SLA utilities ───────────────────────────────────────────

const WORK_START_H = 9;
const WORK_START_M = 30;
const WORK_END_H = 18;
const WORK_END_M = 0;
const DAILY_WORK_MS =
  (WORK_END_H * 60 + WORK_END_M - (WORK_START_H * 60 + WORK_START_M)) * 60 * 1000; // 8.5h in ms

/** IST offset: +5:30 */
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

function toIST(d: Date): Date {
  return new Date(d.getTime() + IST_OFFSET_MS + d.getTimezoneOffset() * 60000);
}

function fromIST(istDate: Date, original: Date): Date {
  return new Date(istDate.getTime() - IST_OFFSET_MS - original.getTimezoneOffset() * 60000);
}

function workStartOfDay(ist: Date): Date {
  return new Date(ist.getFullYear(), ist.getMonth(), ist.getDate(), WORK_START_H, WORK_START_M, 0, 0);
}

function workEndOfDay(ist: Date): Date {
  return new Date(ist.getFullYear(), ist.getMonth(), ist.getDate(), WORK_END_H, WORK_END_M, 0, 0);
}

function nextWorkStart(ist: Date): Date {
  const next = new Date(ist);
  next.setDate(next.getDate() + 1);
  return workStartOfDay(next);
}

function clampToWorkingHours(ist: Date): Date {
  const ws = workStartOfDay(ist);
  const we = workEndOfDay(ist);
  if (ist < ws) return ws;
  if (ist >= we) return nextWorkStart(ist);
  return ist;
}

/**
 * Calculate an SLA deadline counting only working hours (9:30–18:00 IST).
 * @param startUtc  UTC start time
 * @param slaHours  number of working hours
 * @returns ISO string of the deadline in UTC
 */
export function calculateWorkingHoursDeadline(startUtc: Date, slaHours: number): string {
  let remainingMs = slaHours * 3600000;
  const ref = new Date(startUtc);
  let cursor = clampToWorkingHours(toIST(startUtc));

  let guard = 0;
  while (remainingMs > 0 && guard < 365) {
    guard++;
    const endOfDay = workEndOfDay(cursor);
    const availableMs = endOfDay.getTime() - cursor.getTime();
    if (availableMs <= 0) {
      cursor = nextWorkStart(cursor);
      continue;
    }
    if (availableMs >= remainingMs) {
      cursor = new Date(cursor.getTime() + remainingMs);
      remainingMs = 0;
    } else {
      remainingMs -= availableMs;
      cursor = nextWorkStart(cursor);
    }
  }
  return fromIST(cursor, ref).toISOString();
}

/**
 * Calculate elapsed working-hours milliseconds between two UTC dates.
 */
export function calculateWorkingHoursElapsed(startUtc: Date, endUtc: Date): number {
  if (endUtc <= startUtc) return 0;
  let cursor = clampToWorkingHours(toIST(startUtc));
  const endIst = toIST(endUtc);
  let elapsed = 0;
  let guard = 0;

  while (cursor < endIst && guard < 365) {
    guard++;
    const endOfDay = workEndOfDay(cursor);
    const dayEnd = endIst < endOfDay ? endIst : endOfDay;
    const chunk = dayEnd.getTime() - cursor.getTime();
    if (chunk > 0) elapsed += chunk;
    if (endIst <= endOfDay) break;
    cursor = nextWorkStart(cursor);
  }
  return elapsed;
}