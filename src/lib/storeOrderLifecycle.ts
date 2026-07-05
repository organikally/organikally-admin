import type { StoreOrderStatus, PaymentStatus, ShipmentStatus } from '@/api/types';

// Store fulfillment lifecycle (STORE_CONTRACT §3.1). The happy path; the
// off-path states (payment_failed / cancelled / refunded) are shown separately.
export const STORE_ORDER_FLOW: StoreOrderStatus[] = [
  'created',
  'pending_payment',
  'paid',
  'confirmed',
  'packed',
  'shipped',
  'delivered',
];

export const STORE_TERMINAL: StoreOrderStatus[] = [
  'delivered',
  'cancelled',
  'refunded',
  'payment_failed',
];

export function isStoreTerminal(status: StoreOrderStatus): boolean {
  return STORE_TERMINAL.includes(status);
}

// Admin fulfillment actions available from the current order state (§6.2).
export interface StoreOrderActions {
  pack: boolean;
  ship: boolean;
  deliver: boolean;
  cancel: boolean;
  refund: boolean;
  markReturned: boolean;
}

export function availableStoreActions(
  status: StoreOrderStatus,
  paymentStatus: PaymentStatus,
  shipment: ShipmentStatus,
): StoreOrderActions {
  return {
    // confirmed → packed
    pack: status === 'confirmed',
    // packed → shipped (needs courier + AWB)
    ship: status === 'packed',
    // shipped → delivered
    deliver: status === 'shipped',
    // refund-gated for paid orders; unpaid orders just release. Forbidden once
    // shipped/delivered (use refund + mark-returned instead).
    cancel: ['created', 'pending_payment', 'paid', 'confirmed', 'packed'].includes(status),
    // a captured (or partially-refunded) payment can be refunded via Razorpay
    refund: paymentStatus === 'captured' || paymentStatus === 'partially_refunded',
    // returns only apply to goods that physically went out
    markReturned: shipment === 'shipped' || shipment === 'delivered',
  };
}

// Short operator-facing copy for the irreversible / money-moving actions.
export const STORE_ACTION_NOTE: Record<string, string> = {
  cancel:
    'For a paid order this triggers a full Razorpay refund and restocks the lines. For an unpaid order it only releases the stock reservation. Shipped/delivered orders cannot be cancelled — refund instead.',
  refund:
    'Initiates a Razorpay refund for the captured payment. The order/payment status only changes when the refund.processed webhook lands. Leave amount blank for a full refund.',
  'mark-returned':
    'Marks the shipment returned. Tick restock to add the units back to available stock (guarded so a later refund cannot double-restock).',
  ship: 'Sends the shipment email to the customer with the courier, AWB and tracking link.',
};
