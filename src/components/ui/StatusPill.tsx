import clsx from 'clsx';
import type {
  OrderStatus,
  OutletStatus,
  ReceivableStatus,
  CreditResult,
  StoreOrderStatus,
  PaymentStatus,
  ShipmentStatus,
  StoreProductStatus,
  CustomerStatus,
  StockAlertStatus,
  MembershipStatus,
  AuditOutcome,
} from '@/api/types';
import { auditActionLabel, auditActionTone, statusTone } from '@/lib/audit';

type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'brand';

const TONE: Record<Tone, string> = {
  success: 'bg-success/12 text-success border-success/20',
  warning: 'bg-warning/12 text-warning border-warning/20',
  danger: 'bg-danger/12 text-danger border-danger/20',
  info: 'bg-info/12 text-info border-info/20',
  brand: 'bg-success/12 text-success border-success/20',
  neutral: 'bg-surface text-ink-muted border-line',
};

export function Pill({
  tone = 'neutral',
  children,
  className,
}: {
  tone?: Tone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded-pill border px-2.5 py-0.5 text-[11px] font-semibold capitalize whitespace-nowrap',
        TONE[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

const ORDER_TONE: Record<OrderStatus, Tone> = {
  draft: 'neutral',
  submitted: 'warning',
  approved: 'info',
  allocated: 'info',
  dispatched: 'info',
  delivered: 'success',
  invoiced: 'success',
  cancelled: 'danger',
};

export function OrderStatusPill({ status }: { status: OrderStatus }) {
  return <Pill tone={ORDER_TONE[status]}>{status}</Pill>;
}

const OUTLET_TONE: Record<OutletStatus, Tone> = {
  prospect: 'neutral',
  pending_approval: 'warning',
  active: 'success',
  dormant: 'info',
  churned: 'danger',
  rejected: 'danger',
};

export function OutletStatusPill({ status }: { status: OutletStatus }) {
  return <Pill tone={OUTLET_TONE[status]}>{status.replace(/_/g, ' ')}</Pill>;
}

const RECEIVABLE_TONE: Record<ReceivableStatus, Tone> = {
  open: 'info',
  partially_paid: 'warning',
  paid: 'success',
  overdue: 'danger',
};

export function ReceivablePill({ status }: { status: ReceivableStatus }) {
  return <Pill tone={RECEIVABLE_TONE[status]}>{status.replace(/_/g, ' ')}</Pill>;
}

const CREDIT_TONE: Record<CreditResult, Tone> = {
  ok: 'success',
  warn: 'warning',
  block: 'danger',
  approval_required: 'warning',
};

export function CreditResultPill({ result }: { result: CreditResult }) {
  return <Pill tone={CREDIT_TONE[result]}>{result.replace(/_/g, ' ')}</Pill>;
}

export function ClassPill({ outletClass }: { outletClass: string }) {
  const tone: Tone =
    outletClass === 'A' ? 'success' : outletClass === 'B' ? 'info' : outletClass === 'C' ? 'warning' : 'neutral';
  return <Pill tone={tone}>Class {outletClass}</Pill>;
}

export function InFencePill({ inFence }: { inFence: boolean }) {
  return inFence ? <Pill tone="success">in-fence</Pill> : <Pill tone="danger">out-of-fence</Pill>;
}

// ---------- Store workspace pills (STORE_CONTRACT §3) ----------
const STORE_ORDER_TONE: Record<StoreOrderStatus, Tone> = {
  created: 'neutral',
  pending_payment: 'warning',
  paid: 'info',
  confirmed: 'info',
  packed: 'info',
  shipped: 'info',
  delivered: 'success',
  payment_failed: 'danger',
  cancelled: 'danger',
  refunded: 'danger',
};

export function StoreOrderStatusPill({ status }: { status: StoreOrderStatus }) {
  return <Pill tone={STORE_ORDER_TONE[status]}>{status.replace(/_/g, ' ')}</Pill>;
}

const PAYMENT_TONE: Record<PaymentStatus, Tone> = {
  created: 'neutral',
  authorized: 'warning',
  captured: 'success',
  failed: 'danger',
  refunded: 'danger',
  partially_refunded: 'warning',
};

export function PaymentStatusPill({ status }: { status: PaymentStatus }) {
  return <Pill tone={PAYMENT_TONE[status]}>{status.replace(/_/g, ' ')}</Pill>;
}

const SHIPMENT_TONE: Record<ShipmentStatus, Tone> = {
  pending: 'neutral',
  packed: 'info',
  shipped: 'info',
  delivered: 'success',
  returned: 'warning',
};

export function ShipmentStatusPill({ status }: { status: ShipmentStatus }) {
  return <Pill tone={SHIPMENT_TONE[status]}>{status}</Pill>;
}

const STORE_PRODUCT_TONE: Record<StoreProductStatus, Tone> = {
  draft: 'neutral',
  published: 'success',
  archived: 'danger',
};

export function StoreProductStatusPill({ status }: { status: StoreProductStatus }) {
  return <Pill tone={STORE_PRODUCT_TONE[status]}>{status}</Pill>;
}

const CUSTOMER_TONE: Record<CustomerStatus, Tone> = {
  active: 'success',
  blocked: 'danger',
};

export function CustomerStatusPill({ status }: { status: CustomerStatus }) {
  return <Pill tone={CUSTOMER_TONE[status]}>{status}</Pill>;
}

const STOCK_ALERT_TONE: Record<StockAlertStatus, Tone> = {
  pending: 'warning',
  notified: 'success',
  cancelled: 'neutral',
};

export function StockAlertStatusPill({ status }: { status: StockAlertStatus }) {
  return <Pill tone={STOCK_ALERT_TONE[status]}>{status}</Pill>;
}

// ---------- Organikaly Club membership pills (MEMBERSHIP_CONTRACT §1) ----------
const MEMBERSHIP_TONE: Record<MembershipStatus, Tone> = {
  pending: 'warning',
  active: 'success',
  expired: 'neutral',
  cancelled: 'danger',
};

export function MembershipStatusPill({ status }: { status: MembershipStatus }) {
  return <Pill tone={MEMBERSHIP_TONE[status]}>{status}</Pill>;
}

// ---------- Audit-log pills ----------
// Action verb → friendly label + tone (see src/lib/audit.ts). A `failure`
// outcome forces the action pill red regardless of the verb.
export function AuditActionPill({
  action,
  outcome,
}: {
  action: string;
  outcome?: AuditOutcome | null;
}) {
  return <Pill tone={auditActionTone(action, outcome)}>{auditActionLabel(action)}</Pill>;
}

export function AuditOutcomePill({ outcome }: { outcome?: AuditOutcome | null }) {
  if (!outcome) return null;
  return <Pill tone={outcome === 'success' ? 'success' : 'danger'}>{outcome}</Pill>;
}

// HTTP status for request-source entries: 2xx green, 3xx blue, 4xx amber, 5xx red.
export function StatusCodePill({ code }: { code?: number | null }) {
  if (!code) return null;
  return (
    <Pill tone={statusTone(code)} className="tnum">
      {code}
    </Pill>
  );
}
