import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { outlets } from '@/api/client';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button, Card, Field } from '@/components/ui/primitives';
import { DataTable, Pagination } from '@/components/ui/DataTable';
import type { Column } from '@/components/ui/DataTable';
import { Modal } from '@/components/ui/Modal';
import { ClassPill } from '@/components/ui/StatusPill';
import { dateShort, fromNow } from '@/lib/format';
import { errorMessage } from '@/lib/errors';
import { useToast } from '@/components/ui/Toast';
import type { Outlet } from '@/api/types';

const PAGE_SIZE = 20;

export function ApprovalsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [approveTarget, setApproveTarget] = useState<Outlet | null>(null);
  const [rejectTarget, setRejectTarget] = useState<Outlet | null>(null);
  const [creditLimit, setCreditLimit] = useState('');
  const [outletClass, setOutletClass] = useState('B');
  const [reason, setReason] = useState('');

  const query = useQuery({
    queryKey: ['outlets', 'pending', page],
    queryFn: () => outlets.pending({ page, page_size: PAGE_SIZE }),
  });

  function invalidate() {
    qc.invalidateQueries({ queryKey: ['outlets', 'pending'] });
    qc.invalidateQueries({ queryKey: ['outlets'] });
    qc.invalidateQueries({ queryKey: ['analytics'] });
  }

  const approve = useMutation({
    mutationFn: (o: Outlet) =>
      outlets.approve(o.id, {
        credit_limit: creditLimit ? Number(creditLimit) : undefined,
        outlet_class: outletClass,
      }),
    onSuccess: () => {
      toast.success('Outlet approved');
      setApproveTarget(null);
      setCreditLimit('');
      invalidate();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const reject = useMutation({
    mutationFn: (o: Outlet) => outlets.reject(o.id, reason),
    onSuccess: () => {
      toast.success('Outlet rejected');
      setRejectTarget(null);
      setReason('');
      invalidate();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const columns: Column<Outlet>[] = [
    {
      key: 'name',
      header: 'Outlet',
      render: (o) => (
        <div>
          <div className="font-medium">{o.name}</div>
          <div className="text-xs text-muted nums">{o.code}</div>
        </div>
      ),
    },
    {
      key: 'owner',
      header: 'Owner',
      render: (o) => (
        <div className="text-sm">
          <div>{o.profile?.owner_name ?? '—'}</div>
          <div className="text-xs text-muted">{o.profile?.owner_phone ?? ''}</div>
        </div>
      ),
    },
    { key: 'type', header: 'Shop type', render: (o) => o.profile?.shop_type ?? '—' },
    { key: 'class', header: 'Class', render: (o) => <ClassPill outletClass={o.outlet_class} /> },
    {
      key: 'submitted',
      header: 'Submitted',
      render: (o) => (
        <div className="text-sm">
          <div>{dateShort(o.created_at)}</div>
          <div className="text-xs text-muted">{fromNow(o.created_at)}</div>
        </div>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (o) => (
        <div className="flex justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
          <Button variant="ghost" className="h-7 px-2.5" onClick={() => navigate(`/outlets/${o.id}`)}>
            Review
          </Button>
          <Button
            variant="danger"
            className="h-7 px-2.5"
            onClick={() => {
              setRejectTarget(o);
              setReason('');
            }}
          >
            Reject
          </Button>
          <Button
            className="h-7 px-2.5"
            onClick={() => {
              setApproveTarget(o);
              setOutletClass(o.outlet_class || 'B');
              setCreditLimit(o.credit_limit ? String(o.credit_limit) : '');
            }}
          >
            Approve
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Approval Queue"
        description="Outlets onboarded in the field, awaiting approval. Approving sets the geofence and activates the outlet."
      />

      <Card pad={false}>
        <DataTable
          columns={columns}
          rows={query.data?.items ?? []}
          rowKey={(o) => o.id}
          loading={query.isLoading}
          onRowClick={(o) => navigate(`/outlets/${o.id}`)}
          emptyTitle="Queue is clear"
          emptyHint="No outlets are awaiting approval right now."
        />
        <div className="border-t border-line px-2">
          <Pagination page={page} pageSize={PAGE_SIZE} total={query.data?.total ?? 0} onPage={setPage} />
        </div>
      </Card>

      {/* Approve modal */}
      <Modal
        open={!!approveTarget}
        onClose={() => setApproveTarget(null)}
        title={`Approve ${approveTarget?.name ?? ''}`}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setApproveTarget(null)}>
              Cancel
            </Button>
            <Button
              disabled={approve.isPending}
              onClick={() => approveTarget && approve.mutate(approveTarget)}
            >
              Approve & activate
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-muted">
            The outlet's current GPS location becomes the geofence center. Set the credit limit and
            class now or adjust later.
          </p>
          <Field label="Outlet class">
            <select className="input" value={outletClass} onChange={(e) => setOutletClass(e.target.value)}>
              {['A', 'B', 'C', 'D'].map((c) => (
                <option key={c} value={c}>
                  Class {c}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Credit limit (₹)">
            <input
              className="input"
              type="number"
              min={0}
              value={creditLimit}
              onChange={(e) => setCreditLimit(e.target.value)}
              placeholder="0"
            />
          </Field>
        </div>
      </Modal>

      {/* Reject modal */}
      <Modal
        open={!!rejectTarget}
        onClose={() => setRejectTarget(null)}
        title={`Reject ${rejectTarget?.name ?? ''}`}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setRejectTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={!reason.trim() || reject.isPending}
              onClick={() => rejectTarget && reject.mutate(rejectTarget)}
            >
              Reject
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
