import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { outlets } from '@/api/client';
import { Button, Field } from '@/components/ui/primitives';
import { Modal } from '@/components/ui/Modal';
import { errorMessage } from '@/lib/errors';
import { useToast } from '@/components/ui/Toast';
import type { Outlet, OutletClass, OutletStatus } from '@/api/types';

const CLASSES: OutletClass[] = ['A', 'B', 'C', 'D'];

// Statuses a reviewer can set on a live outlet. `rejected` deactivates a bad or
// duplicate outlet; `active` re-activates one. Onboarding itself needs no action —
// reps' outlets are already active.
const BASE_STATUS_OPTIONS: { value: OutletStatus; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'dormant', label: 'Dormant' },
  { value: 'churned', label: 'Churned' },
  { value: 'rejected', label: 'Deactivated (bad / duplicate)' },
];

/**
 * Single source of truth for editing an outlet's commercials & lifecycle via
 * PATCH /outlets/{id}: raise/lower the credit limit, change class, or deactivate.
 * Shared by the outlet detail page and the outlet-review queue so neither has to
 * duplicate the form.
 */
export function OutletManageModal({
  open,
  outlet,
  onClose,
  onSaved,
}: {
  open: boolean;
  outlet: Outlet | null;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const qc = useQueryClient();
  const toast = useToast();
  const [creditLimit, setCreditLimit] = useState('');
  const [outletClass, setOutletClass] = useState<OutletClass>('B');
  const [status, setStatus] = useState<OutletStatus>('active');

  useEffect(() => {
    if (outlet) {
      setCreditLimit(outlet.credit_limit != null ? String(outlet.credit_limit) : '');
      setOutletClass(outlet.outlet_class ?? 'B');
      setStatus(outlet.status);
    }
  }, [outlet]);

  // Keep the current status selectable even if it is a pre-onboarding state
  // (e.g. a legacy pending_approval outlet) that isn't in the base list.
  const statusOptions = useMemo(() => {
    if (outlet && !BASE_STATUS_OPTIONS.some((s) => s.value === outlet.status)) {
      return [{ value: outlet.status, label: outlet.status.replace(/_/g, ' ') }, ...BASE_STATUS_OPTIONS];
    }
    return BASE_STATUS_OPTIONS;
  }, [outlet]);

  const save = useMutation({
    mutationFn: () =>
      outlets.update(outlet!.id, {
        credit_limit: creditLimit === '' ? 0 : Number(creditLimit),
        outlet_class: outletClass,
        status,
      }),
    onSuccess: () => {
      toast.success('Outlet updated');
      qc.invalidateQueries({ queryKey: ['outlet'] });
      qc.invalidateQueries({ queryKey: ['outlets'] });
      qc.invalidateQueries({ queryKey: ['analytics'] });
      onSaved?.();
      onClose();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Manage ${outlet?.name ?? 'outlet'}`}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!outlet || save.isPending} onClick={() => save.mutate()}>
            Save changes
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <p className="text-sm text-ink-faint">
          Outlets go live the moment a rep onboards them — no approval needed. Set the credit cap and
          class here, or deactivate a bad or duplicate outlet.
        </p>
        <Field label="Outlet class">
          <select
            className="input"
            value={outletClass}
            onChange={(e) => setOutletClass(e.target.value as OutletClass)}
          >
            {CLASSES.map((c) => (
              <option key={c} value={c}>
                Class {c}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Credit limit (₹)" hint="Raise or lower the outlet's credit cap.">
          <input
            className="input"
            type="number"
            min={0}
            value={creditLimit}
            onChange={(e) => setCreditLimit(e.target.value)}
            placeholder="0"
          />
        </Field>
        <Field label="Status">
          <select
            className="input"
            value={status}
            onChange={(e) => setStatus(e.target.value as OutletStatus)}
          >
            {statusOptions.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </Field>
      </div>
    </Modal>
  );
}
