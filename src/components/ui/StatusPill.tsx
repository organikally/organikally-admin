import clsx from 'clsx';
import type {
  OrderStatus,
  OutletStatus,
  ReceivableStatus,
  CreditResult,
} from '@/api/types';

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
