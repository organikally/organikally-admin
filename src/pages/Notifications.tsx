import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { Bell, CheckCheck, ChevronRight } from 'lucide-react';
import { notifications as notificationsApi, NOTIFICATIONS_MAX_LIMIT } from '@/api/client';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button, Card, EmptyState, ErrorState, TableSkeleton } from '@/components/ui/primitives';
import { Pill } from '@/components/ui/StatusPill';
import { FilterBar } from '@/components/ui/Filters';
import { useAuth } from '@/auth/AuthContext';
import { dateTime, fromNow } from '@/lib/format';
import { errorMessage } from '@/lib/errors';
import { useToast } from '@/components/ui/Toast';
import {
  groupMeta,
  isUrgent,
  NOTIFICATION_GROUPS,
  notificationGroup,
  resolveNotificationTarget,
  typeLabel,
} from '@/lib/notifications';
import type { NotificationGroup } from '@/lib/notifications';
import type { Notification } from '@/api/types';

// The endpoint pages by `limit` (max 200), not page/page_size — so "Load more"
// grows the window rather than stepping an offset.
const PAGE_STEP = 25;

export function NotificationsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();

  const [unreadOnly, setUnreadOnly] = useState(false);
  const [group, setGroup] = useState<NotificationGroup | 'all'>('all');
  const [limit, setLimit] = useState(PAGE_STEP);

  const query = useQuery({
    queryKey: ['notifications', 'list', { unreadOnly, limit }],
    queryFn: () => notificationsApi.list({ unread_only: unreadOnly, limit }),
  });

  function refresh() {
    void qc.invalidateQueries({ queryKey: ['notifications'] });
  }

  const markRead = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: refresh,
    onError: (e) => toast.error(errorMessage(e)),
  });

  const markAll = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => {
      refresh();
      toast.success('All notifications marked read');
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const items = query.data?.items ?? [];
  const unread = query.data?.unread_count ?? 0;

  // Type grouping is client-side: the endpoint has no type filter, and the
  // fetched window is small (<= 200).
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const n of items) {
      const g = notificationGroup(n.type);
      c[g] = (c[g] ?? 0) + 1;
    }
    return c;
  }, [items]);

  const visible = useMemo(
    () => (group === 'all' ? items : items.filter((n) => notificationGroup(n.type) === group)),
    [items, group],
  );

  const atCap = limit >= NOTIFICATIONS_MAX_LIMIT;
  const canLoadMore = !atCap && items.length >= limit;

  function onOpen(n: Notification) {
    const target = resolveNotificationTarget(user?.role, n);
    if (!n.read) markRead.mutate(n.id);
    if (target) navigate(target.to);
  }

  return (
    <div>
      <PageHeader
        title="Notifications"
        eyebrow="Alerts"
        description="Low stock, overdue receivables, order movements, new outlets and flagged check-ins — everything routed to you, in one feed."
        actions={
          <Button
            variant="secondary"
            onClick={() => markAll.mutate()}
            disabled={unread === 0 || markAll.isPending}
          >
            <CheckCheck className="h-4 w-4" strokeWidth={1.5} />
            Mark all read
          </Button>
        }
      />

      <Card pad={false}>
        <div className="p-3">
          <FilterBar>
            <button
              onClick={() => {
                setUnreadOnly((v) => !v);
                setLimit(PAGE_STEP);
              }}
              className={clsx(
                'h-9 cursor-pointer rounded-chip border px-3 text-sm font-medium transition-colors',
                unreadOnly
                  ? 'border-gold-ink/30 bg-yellow/12 text-gold-ink'
                  : 'border-line bg-paper text-ink-muted hover:bg-surface hover:text-ink',
              )}
            >
              Unread only
              {unread > 0 && <span className="ml-1.5 tnum">({unread})</span>}
            </button>

            <span aria-hidden className="mx-1 h-5 w-px bg-line" />

            <GroupChip
              active={group === 'all'}
              label="All"
              count={items.length}
              onClick={() => setGroup('all')}
            />
            {NOTIFICATION_GROUPS.map((g) => (
              <GroupChip
                key={g.key}
                active={group === g.key}
                label={g.label}
                count={counts[g.key] ?? 0}
                onClick={() => setGroup(g.key)}
              />
            ))}
          </FilterBar>
        </div>

        {query.isLoading ? (
          <TableSkeleton rows={6} cols={3} />
        ) : query.isError ? (
          <ErrorState message={errorMessage(query.error)} onRetry={() => query.refetch()} />
        ) : visible.length === 0 ? (
          <EmptyState
            icon={<Bell className="h-5 w-5" strokeWidth={1.5} />}
            title={unreadOnly ? 'No unread notifications' : 'No notifications'}
            hint={
              group === 'all'
                ? 'Alerts routed to your role and territory will appear here.'
                : 'Nothing in this category. Clear the filter to see the rest.'
            }
          />
        ) : (
          <ul className="divide-y divide-line">
            {visible.map((n) => (
              <Row
                key={n.id}
                n={n}
                linkable={!!resolveNotificationTarget(user?.role, n)}
                onOpen={() => onOpen(n)}
                onMarkRead={() => markRead.mutate(n.id)}
              />
            ))}
          </ul>
        )}

        {(canLoadMore || atCap) && !query.isLoading && !query.isError && items.length > 0 && (
          <div className="flex items-center justify-center gap-3 border-t border-line px-3 py-3">
            {canLoadMore ? (
              <Button
                variant="ghost"
                onClick={() => setLimit((l) => Math.min(l + PAGE_STEP, NOTIFICATIONS_MAX_LIMIT))}
                disabled={query.isFetching}
              >
                Load more
              </Button>
            ) : (
              <span className="text-xs text-ink-faint">
                Showing the latest {NOTIFICATIONS_MAX_LIMIT}. Filter to unread to narrow the feed.
              </span>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}

function GroupChip({
  active,
  label,
  count,
  onClick,
}: {
  active: boolean;
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'h-9 cursor-pointer rounded-chip border px-3 text-sm font-medium transition-colors',
        active
          ? 'border-ink/15 bg-surface text-ink'
          : 'border-line bg-paper text-ink-muted hover:bg-surface hover:text-ink',
      )}
    >
      {label}
      <span className="ml-1.5 text-xs text-ink-faint tnum">{count}</span>
    </button>
  );
}

function Row({
  n,
  linkable,
  onOpen,
  onMarkRead,
}: {
  n: Notification;
  linkable: boolean;
  onOpen: () => void;
  onMarkRead: () => void;
}) {
  const meta = groupMeta(notificationGroup(n.type));
  const Icon = meta.icon;
  const urgent = isUrgent(n.type) && !n.read;

  return (
    <li
      className={clsx(
        'group relative flex items-start gap-3 px-4 py-3 transition-colors',
        !n.read && 'bg-yellow/8',
        linkable && 'cursor-pointer hover:bg-surface',
      )}
      onClick={linkable ? onOpen : undefined}
    >
      {!n.read && (
        <span
          aria-hidden
          className={clsx(
            'absolute left-0 top-0 h-full w-[3px]',
            urgent ? 'bg-danger' : 'bg-gold-ink',
          )}
        />
      )}

      <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-chip bg-surface text-ink-muted">
        <Icon className="h-4 w-4" strokeWidth={1.5} />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={clsx(
              'text-sm',
              n.read ? 'font-medium text-ink-muted' : 'font-semibold text-ink',
            )}
          >
            {n.title}
          </span>
          <Pill tone={meta.tone}>{typeLabel(n.type)}</Pill>
          {!n.read && (
            <span className="rounded-pill border border-gold-ink/25 bg-yellow/12 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gold-ink">
              New
            </span>
          )}
        </div>

        {n.body && <p className="mt-1 text-sm text-ink-faint">{n.body}</p>}

        <div className="mt-1 flex items-center gap-2 text-[11px] text-ink-faint">
          <span className="tnum" title={dateTime(n.created_at)}>
            {fromNow(n.created_at)}
          </span>
          {!linkable && (
            <>
              <span aria-hidden className="text-line">
                ·
              </span>
              {/* No admin screen maps to this event (unknown type, or the payload
                  has no id, or the destination needs a capability this role lacks).
                  Say so rather than link somewhere wrong. */}
              <span>No linked screen</span>
            </>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {!n.read && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onMarkRead();
            }}
            className="cursor-pointer rounded-chip px-2 py-1 text-[11px] font-semibold text-ink-faint opacity-0 transition-opacity hover:bg-surface hover:text-ink group-hover:opacity-100 focus:opacity-100"
          >
            Mark read
          </button>
        )}
        {linkable && (
          <ChevronRight
            className="h-4 w-4 text-ink-faint opacity-0 transition-opacity group-hover:opacity-100"
            strokeWidth={1.5}
          />
        )}
      </div>
    </li>
  );
}
