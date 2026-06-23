import type { OrderStatus } from '@/api/types';

// Legal order transitions from CONTRACT.md §2. cancelled & invoiced are terminal.
export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  draft: ['submitted', 'cancelled'],
  submitted: ['approved', 'cancelled'],
  approved: ['allocated', 'cancelled'],
  allocated: ['dispatched', 'cancelled'],
  dispatched: ['delivered'],
  delivered: ['invoiced'],
  invoiced: [],
  cancelled: [],
};

// Ordered lifecycle for the stepper (excludes cancelled — shown separately).
export const ORDER_FLOW: OrderStatus[] = [
  'draft',
  'submitted',
  'approved',
  'allocated',
  'dispatched',
  'delivered',
  'invoiced',
];

export function nextStatuses(status: OrderStatus): OrderStatus[] {
  return ORDER_TRANSITIONS[status] ?? [];
}

export function isTerminal(status: OrderStatus): boolean {
  return status === 'cancelled' || status === 'invoiced';
}

// Side-effects copy for the UI (matches §2 stock semantics).
export const TRANSITION_NOTE: Partial<Record<OrderStatus, string>> = {
  dispatched: 'Reserved stock will be decremented (qty_reserved↓, qty_available↓).',
  cancelled: 'If the order holds reserved stock, the reservation is released (qty_available↑).',
};
