/**
 * Formatting helpers shared by both apps.
 *
 * Two conventions this file exists to enforce:
 *
 * 1. Timestamps are stored as UTC ISO-8601 with an explicit Z and millisecond
 *    precision, written only through nowIso(). SQLite's datetime('now') returns
 *    "2026-08-03 10:15:30" — space-separated, no Z, no millis — and mixing the
 *    two formats breaks lexical ordering silently.
 *
 * 2. Everything is displayed in Asia/Kolkata with an explicit IST suffix. This
 *    app schedules interviews; a 5.5-hour error means a candidate misses one,
 *    and the bug survives all testing because the developer's machine is also
 *    in IST.
 *
 * Plan reference: HIGH-14, MEDIUM-30, MEDIUM-31.
 */

export const DISPLAY_TIME_ZONE = 'Asia/Kolkata';

/** The only way a timestamp should ever be generated. */
export function nowIso(): string {
  return new Date().toISOString();
}

export function toIso(date: Date): string {
  return date.toISOString();
}

/** SQL default expression matching nowIso()'s format exactly. */
export const SQL_NOW = "strftime('%Y-%m-%dT%H:%M:%fZ','now')";

const dateTimeFormatter = new Intl.DateTimeFormat('en-IN', {
  timeZone: DISPLAY_TIME_ZONE,
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: true,
});

const dateFormatter = new Intl.DateTimeFormat('en-IN', {
  timeZone: DISPLAY_TIME_ZONE,
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

/** e.g. "03 Aug 2026, 04:30 pm IST". Always carries the zone. */
export function formatDateTime(iso: string | Date): string {
  const date = typeof iso === 'string' ? new Date(iso) : iso;
  if (Number.isNaN(date.getTime())) return '—';
  return `${dateTimeFormatter.format(date)} IST`;
}

/** e.g. "03 Aug 2026". No zone suffix — a bare date has no time to mislead. */
export function formatDate(iso: string | Date): string {
  const date = typeof iso === 'string' ? new Date(iso) : iso;
  if (Number.isNaN(date.getTime())) return '—';
  return dateFormatter.format(date);
}

export function formatRelative(iso: string | Date): string {
  const date = typeof iso === 'string' ? new Date(iso) : iso;
  if (Number.isNaN(date.getTime())) return '—';
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(date);
}

// ---------------------------------------------------------------------------
// Money
//
// Stored as INTEGER rupees per annum. Displayed in lakhs, because Indian
// salaries are universally discussed in LPA and an admin typing "12" into a
// rupee field means twelve lakh, not twelve rupees.
// ---------------------------------------------------------------------------

export const RUPEES_PER_LAKH = 100_000;

export function lpaToRupees(lpa: number): number {
  return Math.round(lpa * RUPEES_PER_LAKH);
}

export function rupeesToLpa(rupees: number): number {
  return rupees / RUPEES_PER_LAKH;
}

/** e.g. "₹12,00,000" — Indian digit grouping. */
export function formatRupees(rupees: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(rupees);
}

/** e.g. "12 LPA" / "12.5 LPA". */
export function formatLpa(rupees: number): string {
  const lpa = rupeesToLpa(rupees);
  const rounded = Number.isInteger(lpa) ? lpa.toString() : lpa.toFixed(1);
  return `${rounded} LPA`;
}

/** e.g. "₹12,00,000 (12 LPA)" — the echo shown under salary inputs. */
export function formatSalary(rupees: number): string {
  return `${formatRupees(rupees)} (${formatLpa(rupees)})`;
}

export function formatSalaryRange(min: number, max: number): string {
  return `${formatLpa(min)} – ${formatLpa(max)}`;
}
