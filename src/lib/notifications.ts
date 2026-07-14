// Notification presentation + deep-link resolution.
//
// WHY THIS FILE EXISTS
// --------------------
// The backend writes every notification with a `data.route` — but that route is
// authored for the FIELD app's route table (`/today`, `/outlets/<id>`, …), not
// this portal's. Two of the routes are outright wrong here:
//
//   inventory.low_stock -> data.route = "/today"          (no such admin route)
//   receivable.overdue  -> data.route = "/outlets/<id>"   (finance wants /receivables)
//
// So we NEVER navigate on `data.route`. We map by notification `type` to a route
// that actually exists in src/App.tsx, deriving the id from `data`, and we gate
// each destination on the SAME capabilities its <RequireCap> guard demands, so a
// user is never shown a link they would immediately bounce off.
//
// A type with no sensible admin destination resolves to `null` and renders as a
// plain, non-clickable row rather than dumping the user somewhere wrong.
import { Bell, Boxes, ClipboardList, IndianRupee, ShieldAlert, Store } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Notification, Role } from '@/api/types';
import { canAny, FIELD_SALES_CAPS } from '@/auth/rbac';
import type { Capability } from '@/auth/rbac';

// Mirrors the <Pill> tone union in @/components/ui/StatusPill.
type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'brand';

export type NotificationGroup = 'inventory' | 'receivables' | 'orders' | 'outlets' | 'other';

export interface GroupMeta {
  key: NotificationGroup;
  label: string;
  icon: LucideIcon;
  tone: Tone;
}

export const NOTIFICATION_GROUPS: GroupMeta[] = [
  { key: 'inventory', label: 'Inventory', icon: Boxes, tone: 'warning' },
  { key: 'receivables', label: 'Receivables', icon: IndianRupee, tone: 'danger' },
  { key: 'orders', label: 'Orders', icon: ClipboardList, tone: 'info' },
  { key: 'outlets', label: 'Outlets & Visits', icon: Store, tone: 'brand' },
  { key: 'other', label: 'Other', icon: Bell, tone: 'neutral' },
];

const GROUP_BY_KEY: Record<NotificationGroup, GroupMeta> = NOTIFICATION_GROUPS.reduce(
  (acc, g) => {
    acc[g.key] = g;
    return acc;
  },
  {} as Record<NotificationGroup, GroupMeta>,
);

/** Bucket a notification by its dotted type prefix (see app/services/notify.py). */
export function notificationGroup(type: string): NotificationGroup {
  if (type.startsWith('inventory.')) return 'inventory';
  if (type.startsWith('receivable.')) return 'receivables';
  if (type.startsWith('order.')) return 'orders';
  if (type.startsWith('outlet.') || type.startsWith('visit.')) return 'outlets';
  return 'other';
}

export function groupMeta(group: NotificationGroup): GroupMeta {
  return GROUP_BY_KEY[group] ?? GROUP_BY_KEY.other;
}

// Every type the backend emits today. Anything unknown falls back to a
// prettified last segment, so a new backend event still renders sanely.
const TYPE_LABELS: Record<string, string> = {
  'inventory.low_stock': 'Low stock',
  'receivable.overdue': 'Overdue',
  'outlet.onboarded': 'New outlet',
  'visit.flagged_check_in': 'Flagged check-in',
  'order.credit_hold': 'Credit hold',
  'order.credit_override': 'Credit override',
  'order.dispatched.warehouse': 'Dispatched',
  'order.allocated': 'Allocated',
  'order.dispatched': 'Dispatched',
  'order.delivered': 'Delivered',
  'order.cancelled': 'Cancelled',
  'order.submitted': 'Submitted',
  'order.approved': 'Approved',
  'order.invoiced': 'Invoiced',
};

export function typeLabel(type: string): string {
  const known = TYPE_LABELS[type];
  if (known) return known;
  const tail = type.split('.').slice(1).join(' ') || type;
  return tail.replace(/_/g, ' ').replace(/^\w/, (ch) => ch.toUpperCase());
}

/** Types that carry an urgency worth colouring the row (SLA-ish events). */
export function isUrgent(type: string): boolean {
  return (
    type === 'inventory.low_stock' ||
    type === 'receivable.overdue' ||
    type === 'order.credit_hold' ||
    type === 'visit.flagged_check_in'
  );
}

export function urgentIcon(): LucideIcon {
  return ShieldAlert;
}

// ---------------------------------------------------------------------------
// Deep links
// ---------------------------------------------------------------------------

export interface NotificationTarget {
  /** A path that exists in src/App.tsx. */
  to: string;
  /** The caps that path's <RequireCap> requires — checked before we render a link. */
  caps: Capability[];
}

function idOf(data: Record<string, unknown> | undefined, key: string): string | null {
  const v = data?.[key];
  if (typeof v === 'string' && v.trim() !== '') return v.trim();
  return null;
}

/**
 * Ordered destination candidates for a notification, best first. Resolution
 * picks the first candidate the caller's role can actually open.
 *
 * Route table + guards (src/App.tsx), which these MUST agree with:
 *   /inventory       RequireCap ['inventory_view']
 *   /receivables     RequireCap ['receivables_view']
 *   /orders/:id      RequireCap FIELD_SALES_CAPS
 *   /outlets/:id     RequireCap FIELD_SALES_CAPS
 */
function candidates(n: Notification): NotificationTarget[] {
  const data = n.data;
  const outletId = idOf(data, 'outlet_id');
  const orderId = idOf(data, 'order_id');
  const warehouseId = idOf(data, 'warehouse_id');
  const type = n.type;

  // Low stock -> the Inventory page, pre-filtered to the warehouse that ran low
  // and to low/out-of-stock rows (both filters are URL-driven on that page).
  if (type === 'inventory.low_stock') {
    const params = new URLSearchParams({ low: '1' });
    if (warehouseId) params.set('warehouse', warehouseId);
    return [{ to: `/inventory?${params.toString()}`, caps: ['inventory_view'] }];
  }

  // Overdue receivable -> Receivables for finance. The same event also goes to
  // the owning REP, who has no receivables_view: fall back to the outlet, whose
  // detail carries the outstanding balance.
  if (type === 'receivable.overdue') {
    const out: NotificationTarget[] = [{ to: '/receivables', caps: ['receivables_view'] }];
    if (outletId) out.push({ to: `/outlets/${outletId}`, caps: FIELD_SALES_CAPS });
    return out;
  }

  // Any order.* event (incl. order.dispatched.warehouse, order.credit_hold,
  // order.credit_override) -> the order detail. Without an order_id there is
  // nothing to open, so fall back to the outlet if one is named.
  if (type.startsWith('order.')) {
    if (orderId) return [{ to: `/orders/${orderId}`, caps: FIELD_SALES_CAPS }];
    if (outletId) return [{ to: `/outlets/${outletId}`, caps: FIELD_SALES_CAPS }];
    return [];
  }

  // Onboarding + flagged check-ins -> outlet detail (it carries visit history).
  if (type === 'outlet.onboarded' || type === 'visit.flagged_check_in') {
    if (outletId) return [{ to: `/outlets/${outletId}`, caps: FIELD_SALES_CAPS }];
    return [];
  }

  // Unknown type, or a known type missing its id: no admin destination.
  return [];
}

/**
 * The route this notification should open for THIS role, or `null` when there is
 * no correct destination (unknown type, missing id, or the role lacks the
 * capability the target route guards on). Callers must render `null` as a
 * non-clickable row.
 */
export function resolveNotificationTarget(
  role: Role | undefined,
  n: Notification,
): NotificationTarget | null {
  for (const c of candidates(n)) {
    if (canAny(role, c.caps)) return c;
  }
  return null;
}
