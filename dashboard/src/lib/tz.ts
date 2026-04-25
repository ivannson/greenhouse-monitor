import { formatInTimeZone } from 'date-fns-tz';
import { TZ } from './constants';

export type DateLike = Date | number | string;

function toDate(d: DateLike): Date {
  if (d instanceof Date) return d;
  return new Date(d);
}

export function formatMsk(d: DateLike, pattern: string): string {
  return formatInTimeZone(toDate(d), TZ, pattern);
}

/** ISO day key (YYYY-MM-DD) in Europe/Moscow. Used to bucket readings by day. */
export function dayKeyMsk(d: DateLike): string {
  return formatMsk(d, 'yyyy-MM-dd');
}

/** Short label for tick marks on time-based charts. */
export function shortTick(d: DateLike, span: 'hours' | 'days'): string {
  return span === 'hours' ? formatMsk(d, 'HH:mm') : formatMsk(d, 'd MMM');
}

/** Friendly full timestamp for tooltips. */
export function fullStamp(d: DateLike): string {
  return formatMsk(d, 'd MMM yyyy, HH:mm');
}
