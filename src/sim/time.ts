/** Milliseconds at the J2000 epoch (2000-01-01 12:00 UTC). */
export const J2000_MS = Date.UTC(2000, 0, 1, 12, 0, 0);
export const MS_PER_DAY = 86_400_000;
export const DAYS_PER_CENTURY = 36_525;
export const DAYS_PER_YEAR = 365.25;

/** Days elapsed since J2000 for a date or epoch milliseconds. */
export function daysSinceJ2000(date: Date | number): number {
  const ms = typeof date === 'number' ? date : date.getTime();
  return (ms - J2000_MS) / MS_PER_DAY;
}

/** Calendar date for a number of days since J2000. */
export function dateFromDays(days: number): Date {
  return new Date(J2000_MS + days * MS_PER_DAY);
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Short UTC label such as "27 Sep 2026". */
export function formatDays(days: number): string {
  const date = dateFromDays(days);
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

/** Days since J2000 for midnight UTC on January 1 of a year. */
export function daysForYear(year: number): number {
  return daysSinceJ2000(Date.UTC(year, 0, 1));
}
