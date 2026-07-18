// Pure logic for the audit-log viewer: humanizing dotted action keys into
// friendly labels + pill tones, formatting field values sensibly, and computing
// a field-level before/after diff. No React here — keep it testable.
import { dateTime, formatPaise, money, num } from '@/lib/format';
import type { AuditLog, AuditOutcome } from '@/api/types';

// Mirrors the StatusPill `Tone` union (minus `brand`); every value below is a
// valid <Pill tone> so these can be handed straight to the component.
export type AuditTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

// ---------------------------------------------------------------------------
// Actions → friendly label + pill tone
// ---------------------------------------------------------------------------
// `action` is a dotted event key: `<domain>.<verb>` (e.g. `outlet.create`,
// `order.transition`) or an auth event (`auth.login`, `store.auth.login_failed`).
// Tone is derived from the trailing verb; a `failure` outcome always wins red.

const EXPLICIT_LABELS: Record<string, string> = {
  'auth.login': 'Login',
  'auth.login_failed': 'Login failed',
  'auth.logout': 'Logout',
  'store.auth.login': 'Store login',
  'store.auth.login_failed': 'Store login failed',
  'store.auth.logout': 'Store logout',
  'store.auth.register': 'Store signup',
  'store.auth.signup': 'Store signup',
};

export function auditActionLabel(action: string): string {
  if (!action) return 'Unknown';
  if (EXPLICIT_LABELS[action]) return EXPLICIT_LABELS[action];
  const verb = action.split('.').pop() ?? action;
  return verb.replace(/[_-]+/g, ' ').trim() || action;
}

const DANGER =
  /(fail|denied|deny|error|reject|cancel|delete|destroy|remove|block|revoke|disable|forbidden|unauthor|breach)/i;
const SUCCESS =
  /(create|add|approve|activat|collect|publish|enable|grant|register|signup|onboard|complete|resolve)/i;
const WARN = /(warn|pending|hold|flag|retry|expire)/i;
const INFO =
  /(update|patch|edit|transition|assign|reassign|allocat|dispatch|deliver|override|adjust|move|change|import|export|read|view|list)/i;

export function auditActionTone(action: string, outcome?: AuditOutcome | null): AuditTone {
  if (outcome === 'failure') return 'danger';
  const verb = (action.split('.').pop() ?? action).toLowerCase();
  if (DANGER.test(verb)) return 'danger';
  if (SUCCESS.test(verb)) return 'success';
  if (WARN.test(verb)) return 'warning';
  if (INFO.test(verb)) return 'info';
  return 'neutral';
}

export function statusTone(code?: number | null): AuditTone {
  if (!code) return 'neutral';
  if (code >= 500) return 'danger';
  if (code >= 400) return 'warning';
  if (code >= 300) return 'info';
  if (code >= 200) return 'success';
  return 'neutral';
}

// ---------------------------------------------------------------------------
// Value formatting
// ---------------------------------------------------------------------------
// Money detection is a heuristic on the KEY NAME (the wire gives us bare
// numbers). `*_paise` are store integers → formatPaise; the field-sales money
// keys below are whole rupees → money(). Everything else is a plain number.
// Deliberately excludes rate/percent/day counters (gst_rate, discount_pct,
// credit_days) so they don't render as ₹.
const MONEY_KEY =
  /(^|_)(mrp|ptr|ptd|subtotal|balance|outstanding|amount|amt)($|_)|_total$|^total$|unit_price|order_value|credit_limit|line_total|amount_collected/i;
const DATE_KEY = /(_at$|_date$|^date$|timestamp|expires|due|starts_at|ends_at|seen)/i;
const ISO_RE = /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2})/;

export function formatAuditValue(key: string, value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return '—';
    if (/_paise$/i.test(key)) return formatPaise(value);
    if (MONEY_KEY.test(key)) return money(value);
    return num(value);
  }
  if (typeof value === 'string') {
    if (ISO_RE.test(value) && DATE_KEY.test(key)) return dateTime(value);
    return value;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return '—';
    if (value.every((v) => v === null || typeof v !== 'object')) {
      return value.map((v) => (v === null ? '—' : String(v))).join(', ');
    }
    return JSON.stringify(value);
  }
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

// `credit_limit` → "Credit Limit", `assigned_rep_id` → "Assigned Rep ID".
export function humanizeKey(key: string): string {
  return key
    .replace(/_id$/i, ' ID')
    .replace(/[_.]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

// ---------------------------------------------------------------------------
// Field-level diff
// ---------------------------------------------------------------------------
export type DiffKind = 'added' | 'removed' | 'changed';

export interface DiffRow {
  key: string;
  kind: DiffKind;
  before?: unknown;
  after?: unknown;
}

export type ChangeType = 'create' | 'update' | 'delete' | 'none';

function nonEmpty(o: Record<string, unknown> | null | undefined): boolean {
  return o != null && Object.keys(o).length > 0;
}

export function changeType(log: Pick<AuditLog, 'before' | 'after'>): ChangeType {
  const hasBefore = nonEmpty(log.before);
  const hasAfter = nonEmpty(log.after);
  if (hasBefore && hasAfter) return 'update';
  if (hasAfter) return 'create';
  if (hasBefore) return 'delete';
  return 'none';
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null || a === undefined || b === undefined) return a === b;
  if (typeof a !== typeof b) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((v, i) => deepEqual(v, b[i]));
  }
  if (typeof a === 'object' && typeof b === 'object') {
    const ak = Object.keys(a as Record<string, unknown>);
    const bk = Object.keys(b as Record<string, unknown>);
    if (ak.length !== bk.length) return false;
    return ak.every((k) =>
      deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]),
    );
  }
  return false;
}

// Splits the union of keys into changed (added / removed / changed) and
// unchanged. For a create the before map is empty → every key is `added`;
// for a delete the after map is empty → every key is `removed`.
export function computeDiff(
  before: Record<string, unknown> | null | undefined,
  after: Record<string, unknown> | null | undefined,
): { changed: DiffRow[]; unchanged: DiffRow[] } {
  const b = before ?? {};
  const a = after ?? {};
  const keys = Array.from(new Set([...Object.keys(b), ...Object.keys(a)])).sort();
  const changed: DiffRow[] = [];
  const unchanged: DiffRow[] = [];
  for (const key of keys) {
    const inB = Object.prototype.hasOwnProperty.call(b, key);
    const inA = Object.prototype.hasOwnProperty.call(a, key);
    if (inB && !inA) changed.push({ key, kind: 'removed', before: b[key] });
    else if (!inB && inA) changed.push({ key, kind: 'added', after: a[key] });
    else if (!deepEqual(b[key], a[key]))
      changed.push({ key, kind: 'changed', before: b[key], after: a[key] });
    else unchanged.push({ key, kind: 'changed', before: b[key], after: a[key] });
  }
  return { changed, unchanged };
}
