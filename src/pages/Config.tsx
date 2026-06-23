import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { config as configApi } from '@/api/client';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button, Card, CardHeader, ErrorState, Field, LoadingState } from '@/components/ui/primitives';
import { Pill } from '@/components/ui/StatusPill';
import { errorMessage } from '@/lib/errors';
import { useToast } from '@/components/ui/Toast';
import type {
  CreditAction,
  CustomFieldDef,
  ReasonCode,
  TenantConfig,
} from '@/api/types';

const REASON_CODES: ReasonCode[] = [
  'not_interested',
  'no_shelf_space',
  'decision_pending',
  'owner_absent',
  'shop_closed',
  'price_issue',
  'sufficient_stock',
  'other',
];
const CREDIT_ACTIONS: CreditAction[] = ['warn', 'block', 'require_approval'];
const FIELD_TYPES: CustomFieldDef['type'][] = ['text', 'number', 'boolean', 'select'];

export function ConfigPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const query = useQuery({ queryKey: ['config'], queryFn: configApi.get });
  const [draft, setDraft] = useState<TenantConfig | null>(null);

  useEffect(() => {
    if (query.data) setDraft(structuredClone(query.data));
  }, [query.data]);

  const save = useMutation({
    mutationFn: (body: Partial<TenantConfig>) => configApi.update(body),
    onSuccess: () => {
      toast.success('Configuration saved');
      qc.invalidateQueries({ queryKey: ['config'] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (query.isLoading || !draft) return <LoadingState />;
  if (query.isError) return <ErrorState message={errorMessage(query.error)} onRetry={() => query.refetch()} />;

  function update<K extends keyof TenantConfig>(key: K, value: TenantConfig[K]) {
    setDraft((d) => (d ? { ...d, [key]: value } : d));
  }

  function addCustomField() {
    update('outlet_custom_fields', [
      ...draft!.outlet_custom_fields,
      { key: '', label: '', type: 'text', required: false },
    ]);
  }
  function updateCustomField(i: number, patch: Partial<CustomFieldDef>) {
    const next = draft!.outlet_custom_fields.map((f, idx) => (idx === i ? { ...f, ...patch } : f));
    update('outlet_custom_fields', next);
  }
  function removeCustomField(i: number) {
    update('outlet_custom_fields', draft!.outlet_custom_fields.filter((_, idx) => idx !== i));
  }

  return (
    <div>
      <PageHeader
        title="Config"
        description="Tenant policy — geofence, GPS accuracy, credit rules, reason codes and custom outlet fields."
        actions={
          <Button disabled={save.isPending} onClick={() => save.mutate(draft)}>
            Save changes
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {/* Geofence */}
        <Card>
          <CardHeader title="Geofence & GPS" subtitle="Applied to check-in validation in the field app" />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Geofence radius (m)" hint="Default outlet fence radius">
              <input
                className="input"
                type="number"
                min={0}
                value={draft.geofence_radius_m}
                onChange={(e) => update('geofence_radius_m', Number(e.target.value))}
              />
            </Field>
            <Field label="GPS accuracy threshold (m)" hint="Max accuracy for an in-fence check-in">
              <input
                className="input"
                type="number"
                min={0}
                value={draft.gps_accuracy_threshold_m}
                onChange={(e) => update('gps_accuracy_threshold_m', Number(e.target.value))}
              />
            </Field>
            <Field label="Dormant after (days)" hint="No order/visit before flagged dormant">
              <input
                className="input"
                type="number"
                min={0}
                value={draft.dormant_days}
                onChange={(e) => update('dormant_days', Number(e.target.value))}
              />
            </Field>
          </div>
        </Card>

        {/* Credit policy */}
        <Card>
          <CardHeader title="Credit policy" subtitle="Action taken at order time" />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Over credit limit">
              <select
                className="input"
                value={draft.credit_policy.over_limit}
                onChange={(e) =>
                  update('credit_policy', { ...draft.credit_policy, over_limit: e.target.value as CreditAction })
                }
              >
                {CREDIT_ACTIONS.map((a) => (
                  <option key={a} value={a}>
                    {a.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Overdue receivable">
              <select
                className="input"
                value={draft.credit_policy.overdue}
                onChange={(e) =>
                  update('credit_policy', { ...draft.credit_policy, overdue: e.target.value as CreditAction })
                }
              >
                {CREDIT_ACTIONS.map((a) => (
                  <option key={a} value={a}>
                    {a.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </Card>

        {/* Reason codes */}
        <Card>
          <CardHeader title="Reason codes" subtitle="Available no-order reasons for field reps" />
          <div className="flex flex-wrap gap-2">
            {REASON_CODES.map((code) => {
              const on = draft.reason_codes.includes(code);
              return (
                <button
                  key={code}
                  onClick={() =>
                    update(
                      'reason_codes',
                      on ? draft.reason_codes.filter((c) => c !== code) : [...draft.reason_codes, code],
                    )
                  }
                  className={
                    'rounded-pill border px-3 py-1 text-xs font-medium capitalize transition-colors ' +
                    (on
                      ? 'border-brand bg-brand/10 text-brand'
                      : 'border-line text-muted hover:bg-surface-2')
                  }
                >
                  {code.replace(/_/g, ' ')}
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-muted">
            {draft.reason_codes.length} enabled. Tap to toggle.
          </p>
        </Card>

        {/* Custom outlet fields */}
        <Card>
          <CardHeader
            title="Custom outlet fields"
            subtitle="Extra fields captured during outlet onboarding"
            action={
              <Button variant="ghost" className="h-7 px-2.5" onClick={addCustomField}>
                + Field
              </Button>
            }
          />
          <div className="space-y-2">
            {draft.outlet_custom_fields.length === 0 && (
              <p className="py-4 text-center text-sm text-muted">No custom fields defined.</p>
            )}
            {draft.outlet_custom_fields.map((f, i) => (
              <div key={i} className="grid grid-cols-12 items-center gap-2 rounded-md border border-line p-2">
                <input
                  className="input col-span-3"
                  placeholder="key"
                  value={f.key}
                  onChange={(e) => updateCustomField(i, { key: e.target.value })}
                />
                <input
                  className="input col-span-4"
                  placeholder="Label"
                  value={f.label}
                  onChange={(e) => updateCustomField(i, { label: e.target.value })}
                />
                <select
                  className="input col-span-2"
                  value={f.type}
                  onChange={(e) => updateCustomField(i, { type: e.target.value as CustomFieldDef['type'] })}
                >
                  {FIELD_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                <label className="col-span-2 flex items-center gap-1 text-xs">
                  <input
                    type="checkbox"
                    checked={f.required}
                    onChange={(e) => updateCustomField(i, { required: e.target.checked })}
                  />
                  required
                </label>
                <button
                  className="col-span-1 text-danger hover:opacity-70"
                  onClick={() => removeCustomField(i)}
                  aria-label="Remove"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          {draft.outlet_custom_fields.some((f) => f.type === 'select') && (
            <p className="mt-2 text-xs text-muted">
              <Pill tone="info">select</Pill> field options are managed per-field in the field app schema.
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}
