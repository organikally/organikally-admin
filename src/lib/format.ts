import { format, formatDistanceToNow, parseISO, differenceInDays } from 'date-fns';

const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
});
const inrCompact = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  notation: 'compact',
  maximumFractionDigits: 1,
});

export function money(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '-';
  return inr.format(n);
}

export function moneyCompact(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '-';
  return inrCompact.format(n);
}

export function num(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '-';
  return new Intl.NumberFormat('en-IN').format(n);
}

export function pct(n: number | null | undefined, digits = 0): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '-';
  return `${n.toFixed(digits)}%`;
}

export function dateShort(iso?: string | null): string {
  if (!iso) return '-';
  try {
    return format(parseISO(iso), 'd MMM yyyy');
  } catch {
    return '-';
  }
}

export function dateTime(iso?: string | null): string {
  if (!iso) return '-';
  try {
    return format(parseISO(iso), 'd MMM yyyy, HH:mm');
  } catch {
    return '-';
  }
}

export function timeOnly(iso?: string | null): string {
  if (!iso) return '-';
  try {
    return format(parseISO(iso), 'HH:mm');
  } catch {
    return '-';
  }
}

export function fromNow(iso?: string | null): string {
  if (!iso) return '-';
  try {
    return formatDistanceToNow(parseISO(iso), { addSuffix: true });
  } catch {
    return '-';
  }
}

export function daysSince(iso?: string | null): number | null {
  if (!iso) return null;
  try {
    return differenceInDays(new Date(), parseISO(iso));
  } catch {
    return null;
  }
}

export function growthColor(n: number | null | undefined): string {
  if (n === null || n === undefined) return 'text-ink-faint';
  if (n > 0) return 'text-success';
  if (n < 0) return 'text-danger';
  return 'text-ink-faint';
}
