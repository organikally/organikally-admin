import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Send } from 'lucide-react';
import { storeApi } from '@/api/storeClient';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button, Card, CardHeader, Field } from '@/components/ui/primitives';
import { DataTable, Pagination } from '@/components/ui/DataTable';
import type { Column } from '@/components/ui/DataTable';
import { Pill } from '@/components/ui/StatusPill';
import { num, dateTime } from '@/lib/format';
import { errorMessage } from '@/lib/errors';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/auth/AuthContext';
import type { PushCampaignAdmin, PushCampaignInput, PushSegment } from '@/api/types';

const PAGE_SIZE = 20;

const SEGMENT_LABEL: Record<PushSegment, string> = {
  all: 'All app users',
  members: 'Members only',
  non_members: 'Non-members',
  customer_ids: 'Specific customers',
};

function statusTone(status: string): 'success' | 'warning' | 'danger' | 'neutral' {
  if (status === 'sent') return 'success';
  if (status === 'error') return 'danger';
  if (status === 'queued') return 'warning';
  return 'neutral';
}

interface ComposerForm {
  title: string;
  body: string;
  deep_link: string;
  segment: PushSegment;
  customer_ids: string; // comma / newline separated
}

const EMPTY: ComposerForm = {
  title: '',
  body: '',
  deep_link: '',
  segment: 'all',
  customer_ids: '',
};

function toInput(f: ComposerForm): PushCampaignInput {
  const ids = f.customer_ids
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);
  return {
    title: f.title.trim(),
    body: f.body.trim(),
    deep_link: f.deep_link.trim() || null,
    segment: f.segment,
    customer_ids: f.segment === 'customer_ids' ? ids : [],
  };
}

export function StorePushCampaignsPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const { can } = useAuth();
  const canSend = can('store_customers_manage');

  const [form, setForm] = useState<ComposerForm>(EMPTY);
  const [page, setPage] = useState(1);

  const query = useQuery({
    queryKey: ['store', 'push-campaigns', { page }],
    queryFn: () => storeApi.push.campaigns({ page, page_size: PAGE_SIZE }),
  });

  const send = useMutation({
    mutationFn: () => storeApi.push.sendCampaign(toInput(form)),
    onSuccess: (res) => {
      toast.success(`Campaign sent to ${num(res.target_count)} devices`);
      setForm(EMPTY);
      setPage(1);
      qc.invalidateQueries({ queryKey: ['store', 'push-campaigns'] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  function patch<K extends keyof ComposerForm>(key: K, value: ComposerForm[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const idsRequired = form.segment === 'customer_ids';
  const idsProvided = form.customer_ids.split(/[\n,]/).map((s) => s.trim()).filter(Boolean).length > 0;
  const canSubmit =
    canSend &&
    !send.isPending &&
    !!form.title.trim() &&
    !!form.body.trim() &&
    (!idsRequired || idsProvided);

  const columns: Column<PushCampaignAdmin>[] = [
    {
      key: 'title',
      header: 'Notification',
      className: 'max-w-sm',
      render: (c) => (
        <div>
          <div className="font-medium">{c.title}</div>
          <div className="line-clamp-1 text-xs text-ink-faint">{c.body}</div>
        </div>
      ),
    },
    { key: 'segment', header: 'Segment', render: (c) => <span className="text-xs">{SEGMENT_LABEL[c.segment] ?? c.segment}</span> },
    {
      key: 'delivery',
      header: 'Target / Accepted / Failed',
      align: 'right',
      render: (c) => (
        <span className="tnum text-xs">
          {num(c.target_count)} / <span className="text-success">{num(c.accepted_count)}</span> /{' '}
          <span className={c.failed_count > 0 ? 'text-danger' : ''}>{num(c.failed_count)}</span>
        </span>
      ),
    },
    { key: 'status', header: 'Status', render: (c) => <Pill tone={statusTone(c.status)}>{c.status}</Pill> },
    { key: 'sent_by', header: 'Sent by', render: (c) => c.sent_by_name ?? c.sent_by },
    { key: 'created', header: 'When', render: (c) => dateTime(c.created_at) },
  ];

  return (
    <div>
      <PageHeader
        title="Push"
        description="Compose and send Expo push notifications to the store app, and review the delivery log. Sends are audited."
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-1">
          <CardHeader title="Compose" subtitle="Promo pushes respect each customer's notification preferences." />
          <div className="space-y-3">
            <Field label="Title" required>
              <input
                className="input"
                value={form.title}
                onChange={(e) => patch('title', e.target.value)}
                placeholder="Fresh harvest just landed"
                disabled={!canSend}
              />
            </Field>
            <Field label="Body" required>
              <textarea
                className="input h-24 py-2"
                value={form.body}
                onChange={(e) => patch('body', e.target.value)}
                placeholder="Up to 12% off for members this week."
                disabled={!canSend}
              />
            </Field>
            <Field label="Deep link" hint="e.g. organikally-store://membership or /store/mustard-oil">
              <input
                className="input"
                value={form.deep_link}
                onChange={(e) => patch('deep_link', e.target.value)}
                placeholder="organikally-store://membership"
                disabled={!canSend}
              />
            </Field>
            <Field label="Segment">
              <select
                className="input"
                value={form.segment}
                onChange={(e) => patch('segment', e.target.value as PushSegment)}
                disabled={!canSend}
              >
                <option value="all">All app users</option>
                <option value="members">Members only</option>
                <option value="non_members">Non-members</option>
                <option value="customer_ids">Specific customers</option>
              </select>
            </Field>
            {idsRequired && (
              <Field label="Customer IDs" required hint="Comma or newline separated customer ids.">
                <textarea
                  className="input h-20 py-2 tnum"
                  value={form.customer_ids}
                  onChange={(e) => patch('customer_ids', e.target.value)}
                  placeholder="65a1f...&#10;65a2b..."
                  disabled={!canSend}
                />
              </Field>
            )}
            <Button className="w-full justify-center" disabled={!canSubmit} onClick={() => send.mutate()}>
              <Send className="h-4 w-4" strokeWidth={1.5} />
              {send.isPending ? 'Sending…' : 'Send campaign'}
            </Button>
            {!canSend && (
              <p className="text-xs text-ink-faint">You do not have permission to send campaigns.</p>
            )}
          </div>
        </Card>

        <Card className="xl:col-span-2" pad={false}>
          <div className="border-b border-line px-4 py-3">
            <h3 className="font-display text-base leading-tight text-ink">Delivery log</h3>
            <p className="mt-0.5 text-xs text-ink-faint">Every campaign send with accepted / failed ticket counts.</p>
          </div>
          <DataTable
            columns={columns}
            rows={query.data?.items ?? []}
            rowKey={(c) => c.id}
            loading={query.isLoading}
            error={query.isError ? errorMessage(query.error) : null}
            onRetry={() => query.refetch()}
            emptyTitle="No campaigns yet"
            emptyHint="Sent push campaigns appear here."
          />
          <div className="border-t border-line px-2">
            <Pagination page={page} pageSize={PAGE_SIZE} total={query.data?.total ?? 0} onPage={setPage} />
          </div>
        </Card>
      </div>
    </div>
  );
}
