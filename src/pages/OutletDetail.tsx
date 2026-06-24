import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { outlets } from '@/api/client';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button, Card, CardHeader, ErrorState, Field, LoadingState } from '@/components/ui/primitives';
import { Modal } from '@/components/ui/Modal';
import { ClassPill, InFencePill, OutletStatusPill, Pill } from '@/components/ui/StatusPill';
import { MiniMap } from '@/components/ui/MiniMap';
import { DataTable } from '@/components/ui/DataTable';
import type { Column } from '@/components/ui/DataTable';
import { dateShort, dateTime, money } from '@/lib/format';
import { errorMessage } from '@/lib/errors';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/auth/AuthContext';
import type { Visit } from '@/api/types';

export function OutletDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const { can } = useAuth();

  const outlet = useQuery({ queryKey: ['outlet', id], queryFn: () => outlets.get(id) });
  const visits = useQuery({
    queryKey: ['outlet', id, 'visits'],
    queryFn: () => outlets.visits(id, { page_size: 50 }),
  });
  const dedupe = useQuery({
    queryKey: ['outlet', id, 'dedupe'],
    queryFn: () => outlets.dedupe(id),
    enabled: !!outlet.data,
  });

  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState('');

  const approve = useMutation({
    mutationFn: () => outlets.approve(id),
    onSuccess: () => {
      toast.success('Outlet approved');
      qc.invalidateQueries({ queryKey: ['outlet', id] });
      qc.invalidateQueries({ queryKey: ['outlets'] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const reject = useMutation({
    mutationFn: () => outlets.reject(id, reason),
    onSuccess: () => {
      toast.success('Outlet rejected');
      setRejectOpen(false);
      setReason('');
      qc.invalidateQueries({ queryKey: ['outlet', id] });
      qc.invalidateQueries({ queryKey: ['outlets'] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (outlet.isLoading) return <LoadingState />;
  if (outlet.isError || !outlet.data)
    return <ErrorState message={errorMessage(outlet.error)} onRetry={() => outlet.refetch()} />;

  const o = outlet.data;
  const isPending = o.status === 'pending_approval';
  const canApprove = can('approve_outlets');

  const visitColumns: Column<Visit>[] = [
    { key: 'date', header: 'When', render: (v) => dateTime(v.check_in?.timestamp ?? v.created_at) },
    {
      key: 'fence',
      header: 'Geofence',
      render: (v) => (
        <div className="flex items-center gap-1.5">
          <InFencePill inFence={!!v.check_in?.in_fence} />
          <span className="text-xs text-ink-faint tnum">{Math.round(v.check_in?.distance_m ?? 0)}m</span>
          {v.check_in?.is_mock && <Pill tone="danger">mock</Pill>}
        </div>
      ),
    },
    {
      key: 'outcome',
      header: 'Outcome',
      render: (v) =>
        v.outcome === 'order_placed' ? (
          <Pill tone="success">order placed</Pill>
        ) : v.outcome === 'no_order' ? (
          <Pill tone="warning">{v.reason_code?.replace(/_/g, ' ') ?? 'no order'}</Pill>
        ) : (
          <span className="text-ink-faint">-</span>
        ),
    },
    { key: 'duration', header: 'Duration', align: 'right', render: (v) => (v.duration_min ? `${v.duration_min} min` : '-') },
    {
      key: 'order',
      header: 'Order',
      render: (v) =>
        v.order_id ? (
          <Link to={`/orders/${v.order_id}`} className="text-gold-ink hover:underline">
            View
          </Link>
        ) : (
          '-'
        ),
    },
  ];

  return (
    <div>
      <PageHeader
        title={o.name}
        description={`${o.code} · ${o.profile?.shop_type ?? 'Outlet'}`}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => navigate(-1)}>
              Back
            </Button>
            {isPending && canApprove && (
              <>
                <Button variant="danger" onClick={() => setRejectOpen(true)}>
                  Reject
                </Button>
                <Button onClick={() => approve.mutate()} disabled={approve.isPending}>
                  Approve
                </Button>
              </>
            )}
          </div>
        }
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <OutletStatusPill status={o.status} />
        <ClassPill outletClass={o.outlet_class} />
        {o.outstanding > 0 && <Pill tone="danger">Outstanding {money(o.outstanding)}</Pill>}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {/* Profile */}
        <Card>
          <CardHeader title="Profile" />
          <dl className="space-y-2 text-sm">
            <Row label="Owner" value={o.profile?.owner_name} />
            <Row label="Phone" value={o.profile?.owner_phone} />
            <Row label="GST" value={o.profile?.gst} />
            <Row label="PAN" value={o.profile?.pan} />
            <Row label="Shop type" value={o.profile?.shop_type} />
            <Row label="Refrigeration" value={o.profile?.refrigeration ? 'Yes' : 'No'} />
            <Row label="Shelf space" value={o.profile?.shelf_space} />
            <Row
              label="Est. monthly volume"
              value={o.profile?.est_monthly_volume ? money(o.profile.est_monthly_volume) : undefined}
            />
            <Row
              label="Competitors"
              value={o.profile?.competitor_brands?.join(', ')}
            />
            <Row label="Preferred order day" value={o.profile?.preferred_order_day} />
          </dl>
        </Card>

        {/* Commercials + location */}
        <Card>
          <CardHeader title="Commercials" />
          <dl className="space-y-2 text-sm">
            <Row label="Credit limit" value={money(o.credit_limit)} />
            <Row label="Outstanding" value={money(o.outstanding)} />
            <Row label="Last order" value={dateShort(o.last_order_at)} />
            <Row label="Last visit" value={dateShort(o.last_visit_at)} />
            <Row label="Next visit" value={dateShort(o.next_visit_date)} />
            <Row label="Approved by" value={o.approved_by ?? undefined} />
          </dl>
          <div className="mt-3">
            <div className="label">Location</div>
            <MiniMap
              markers={[{ id: o.id, point: o.location, label: o.name, tone: 'gold', selected: true }]}
              height={180}
            />
            <p className="mt-1 text-[11px] text-ink-faint tnum">
              {o.location?.coordinates?.[1]?.toFixed(5)}, {o.location?.coordinates?.[0]?.toFixed(5)} ·
              geofence {o.geofence_radius_m ?? '-'}m
            </p>
          </div>
        </Card>

        {/* Possible duplicates */}
        <Card>
          <CardHeader
            title="Possible duplicates"
            subtitle="Nearby outlets that may be the same shop"
          />
          {dedupe.isLoading ? (
            <LoadingState label="Checking" />
          ) : dedupe.isError ? (
            <ErrorState message={errorMessage(dedupe.error)} onRetry={() => dedupe.refetch()} />
          ) : (dedupe.data?.items?.length ?? 0) === 0 ? (
            <p className="py-6 text-center text-sm text-ink-faint">No nearby duplicates found.</p>
          ) : (
            <div className="space-y-2">
              {dedupe.data!.items.map((d) => (
                <Link
                  key={d.id}
                  to={`/outlets/${d.id}`}
                  className="flex items-center justify-between rounded-chip border border-line px-3 py-2 text-sm hover:bg-surface"
                >
                  <div>
                    <div className="font-medium">{d.name}</div>
                    <div className="text-xs text-ink-faint tnum">{d.code}</div>
                  </div>
                  <OutletStatusPill status={d.status} />
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Visit history */}
      <Card className="mt-4" pad={false}>
        <div className="border-b border-line px-4 py-3">
          <h3 className="font-display text-base leading-tight text-ink">Visit history</h3>
        </div>
        <DataTable
          columns={visitColumns}
          rows={visits.data?.items ?? []}
          rowKey={(v) => v.id}
          loading={visits.isLoading}
          error={visits.isError ? errorMessage(visits.error) : null}
          onRetry={() => visits.refetch()}
          emptyTitle="No visits recorded"
          emptyHint="Visits logged by reps for this outlet will appear here."
        />
      </Card>

      <Modal
        open={rejectOpen}
        onClose={() => setRejectOpen(false)}
        title="Reject outlet"
        footer={
          <>
            <Button variant="ghost" onClick={() => setRejectOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={!reason.trim() || reject.isPending}
              onClick={() => reject.mutate()}
            >
              Reject outlet
            </Button>
          </>
        }
      >
        <Field label="Reason" required>
          <textarea
            className="input h-24 py-2"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why is this outlet being rejected?"
          />
        </Field>
      </Modal>
    </div>
  );
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-ink-faint">{label}</dt>
      <dd className="text-right font-medium tnum">{value || '-'}</dd>
    </div>
  );
}
