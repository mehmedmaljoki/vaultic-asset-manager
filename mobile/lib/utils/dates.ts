/**
 * Format a single ISO/parseable date as a localized short date.
 * Falls back to the raw input if the date cannot be parsed.
 */
export function formatDate(iso: string | undefined, locale: string = 'en'): string {
  if (!iso) return '–';
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return iso;
  try {
    return new Intl.DateTimeFormat(locale, { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(t));
  } catch {
    return new Date(t).toISOString().slice(0, 10);
  }
}

/** Format a from/to range. Empty when from is missing. */
export function formatDateRange(
  from: string | undefined,
  to: string | undefined,
  locale: string = 'en',
): string {
  if (!from && !to) return '';
  if (!from) return formatDate(to, locale);
  if (!to) return formatDate(from, locale);
  return `${formatDate(from, locale)} – ${formatDate(to, locale)}`;
}
