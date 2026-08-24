/**
 * Parse a date-only input without letting the browser reinterpret it as UTC.
 * HTML date inputs return YYYY-MM-DD, which must be evaluated in local time
 * for day-of-week calculations in the UI.
 */
export function parseLocalDate(value, endOfDay = false) {
  if (!value || typeof value !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const [, year, month, day] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  if (Number.isNaN(date.getTime())) return null;

  if (endOfDay) {
    date.setHours(23, 59, 59, 999);
  } else {
    date.setHours(0, 0, 0, 0);
  }
  return date;
}
