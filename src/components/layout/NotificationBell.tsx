import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { Bell, CheckCheck } from 'lucide-react';
import { notifications as notificationsApi } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { fromNow } from '@/lib/format';
import {
  groupMeta,
  notificationGroup,
  resolveNotificationTarget,
  typeLabel,
} from '@/lib/notifications';
import type { Notification } from '@/api/types';

// Poll cadence for the unread count. Notifications are operational, not
// real-time-critical; 60s is enough for a low-stock / overdue alert and costs
// one small request per minute per open tab.
const POLL_MS = 60_000;
const PREVIEW_LIMIT = 8;

/**
 * Top-bar bell. Mounted for EVERY authenticated staff role — notifications are
 * not capability-gated: warehouse_manager and finance receive events (low stock,
 * overdue) and this portal is their ONLY delivery surface (they cannot log into
 * the field app at all — FIELD_ROLES excludes them).
 */
export function NotificationBell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const q = useQuery({
    queryKey: ['notifications', 'bell'],
    queryFn: () => notificationsApi.list({ limit: PREVIEW_LIMIT }),
    refetchInterval: POLL_MS,
    refetchOnWindowFocus: true,
    staleTime: 30_000,
  });

  const unread = q.data?.unread_count ?? 0;
  const items = q.data?.items ?? [];

  function refresh() {
    // Prefix invalidation: refreshes the bell AND the /notifications page.
    void qc.invalidateQueries({ queryKey: ['notifications'] });
  }

  const markRead = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: refresh,
  });

  const markAll = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: refresh,
  });

  function onItem(n: Notification) {
    const target = resolveNotificationTarget(user?.role, n);
    if (!n.read) markRead.mutate(n.id);
    if (target) {
      setOpen(false);
      navigate(target.to);
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
        className={clsx(
          'relative grid h-9 w-9 cursor-pointer place-items-center rounded-pill border border-line bg-paper text-ink-muted transition-colors hover:bg-surface hover:text-ink',
          open && 'bg-surface text-ink',
        )}
      >
        <Bell className="h-[18px] w-[18px]" strokeWidth={1.5} />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-pill border border-paper bg-danger px-1 text-[10px] font-semibold leading-none text-paper tnum">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-1 w-[24rem] max-w-[calc(100vw-2rem)] overflow-hidden rounded-card border border-line bg-paper shadow-md">
            <div className="flex items-center justify-between border-b border-line px-3 py-2">
              <div className="font-display text-sm text-ink">
                Notifications
                {unread > 0 && (
                  <span className="ml-1.5 text-xs font-normal text-ink-faint tnum">
                    {unread} unread
                  </span>
                )}
              </div>
              <button
                onClick={() => markAll.mutate()}
                disabled={unread === 0 || markAll.isPending}
                className="flex cursor-pointer items-center gap-1 rounded-chip px-1.5 py-1 text-[11px] font-semibold text-ink-muted hover:bg-surface hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
              >
                <CheckCheck className="h-3.5 w-3.5" strokeWidth={1.5} />
                Mark all read
              </button>
            </div>

            <div className="max-h-[26rem] overflow-y-auto">
              {q.isLoading ? (
                <div className="px-3 py-8 text-center text-xs text-ink-faint">Loading…</div>
              ) : q.isError ? (
                <div className="px-3 py-8 text-center text-xs text-danger">
                  Could not load notifications
                </div>
              ) : items.length === 0 ? (
                <div className="px-3 py-8 text-center text-xs text-ink-faint">
                  Nothing yet. Alerts for low stock, overdue receivables, orders and outlets land
                  here.
                </div>
              ) : (
                <ul className="divide-y divide-line">
                  {items.map((n) => (
                    <BellRow
                      key={n.id}
                      n={n}
                      linkable={!!resolveNotificationTarget(user?.role, n)}
                      onClick={() => onItem(n)}
                    />
                  ))}
                </ul>
              )}
            </div>

            <button
              onClick={() => {
                setOpen(false);
                navigate('/notifications');
              }}
              className="w-full cursor-pointer border-t border-line px-3 py-2 text-center text-xs font-semibold text-ink-muted hover:bg-surface hover:text-ink"
            >
              View all notifications
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function BellRow({
  n,
  linkable,
  onClick,
}: {
  n: Notification;
  linkable: boolean;
  onClick: () => void;
}) {
  const meta = groupMeta(notificationGroup(n.type));
  const Icon = meta.icon;
  return (
    <li>
      <button
        onClick={onClick}
        className={clsx(
          'flex w-full cursor-pointer gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-surface',
          !n.read && 'bg-yellow/8',
        )}
        // A non-linkable row is still a button: clicking it marks it read, it
        // just never navigates (there is no correct admin destination).
        title={linkable ? undefined : 'No linked screen for this alert'}
      >
        <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-chip bg-surface text-ink-muted">
          <Icon className="h-3.5 w-3.5" strokeWidth={1.5} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            {!n.read && (
              <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-pill bg-gold-ink" />
            )}
            <span
              className={clsx(
                'truncate text-sm',
                n.read ? 'font-medium text-ink-muted' : 'font-semibold text-ink',
              )}
            >
              {n.title}
            </span>
          </span>
          {n.body && (
            <span className="mt-0.5 line-clamp-2 block text-xs text-ink-faint">{n.body}</span>
          )}
          <span className="mt-1 flex items-center gap-1.5 text-[10px] text-ink-faint">
            <span className="rounded-pill border border-line bg-surface px-1.5 py-px font-semibold uppercase tracking-wide">
              {typeLabel(n.type)}
            </span>
            <span className="tnum">{fromNow(n.created_at)}</span>
          </span>
        </span>
      </button>
    </li>
  );
}
