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

// ---- Paise <-> INR (STORE_CONTRACT §0.1) ----
// Store money crosses the wire as integer paise. Display always converts to INR;
// inputs entered in INR are converted back to integer paise (round-half-up).
export function paiseToInr(paise: number | null | undefined): number {
  if (paise === null || paise === undefined || Number.isNaN(paise)) return 0;
  return paise / 100;
}

export function inrToPaise(rupees: number | null | undefined): number {
  if (rupees === null || rupees === undefined || Number.isNaN(rupees)) return 0;
  return Math.round(rupees * 100);
}

/** Format an integer-paise amount as an INR currency string. */
export function formatPaise(paise: number | null | undefined): string {
  if (paise === null || paise === undefined || Number.isNaN(paise)) return '-';
  return inr.format(paise / 100);
}

/** Compact INR (e.g. ₹1.8L) from integer paise — for KPI cards / chart axes. */
export function formatPaiseCompact(paise: number | null | undefined): string {
  if (paise === null || paise === undefined || Number.isNaN(paise)) return '-';
  return inrCompact.format(paise / 100);
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

/** Media timecode: 4:07, or 1:02:30 past the hour. Used by the Guides player. */
export function formatDuration(sec: number | null | undefined): string {
  if (sec === null || sec === undefined || !Number.isFinite(sec) || sec < 0) return '0:00';
  const total = Math.round(sec);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/** Coarse duration for cards — "8 min", "45 sec". */
export function durationLabel(sec: number | null | undefined): string {
  if (!sec || !Number.isFinite(sec) || sec <= 0) return '—';
  if (sec < 60) return `${Math.round(sec)} sec`;
  return `${Math.round(sec / 60)} min`;
}

export function growthColor(n: number | null | undefined): string {
  if (n === null || n === undefined) return 'text-ink-faint';
  if (n > 0) return 'text-success';
  if (n < 0) return 'text-danger';
  return 'text-ink-faint';
}
