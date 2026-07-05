import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { storeApi } from '@/api/storeClient';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button, Card, CardHeader, ErrorState, Field, LoadingState } from '@/components/ui/primitives';
import { paiseToInr, inrToPaise } from '@/lib/format';
import { errorMessage } from '@/lib/errors';
import { useToast } from '@/components/ui/Toast';
import type { ServiceabilityMode, StoreConfig } from '@/api/types';

export function StoreSettingsPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const query = useQuery({ queryKey: ['store', 'settings'], queryFn: storeApi.settings.get });
  const whQuery = useQuery({
    queryKey: ['store', 'warehouses', 'for-settings'],
    queryFn: storeApi.warehouses,
    staleTime: 5 * 60_000,
  });
  const [draft, setDraft] = useState<StoreConfig | null>(null);

  useEffect(() => {
    if (query.data) setDraft(structuredClone(query.data));
  }, [query.data]);

  const save = useMutation({
    mutationFn: (body: StoreConfig) => storeApi.settings.update(body),
    onSuccess: () => {
      toast.success('Store settings saved');
      qc.invalidateQueries({ queryKey: ['store', 'settings'] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (query.isLoading || !draft) return <LoadingState />;
  if (query.isError) return <ErrorState message={errorMessage(query.error)} onRetry={() => query.refetch()} />;

  function update<K extends keyof StoreConfig>(key: K, value: StoreConfig[K]) {
    setDraft((d) => (d ? { ...d, [key]: value } : d));
  }

  return (
    <div>
      <PageHeader
        title="Store Settings"
        description="Shipping, pincode serviceability, fulfillment warehouse and store-wide config. Changes are audited."
        actions={
          <Button disabled={save.isPending} onClick={() => save.mutate(draft)}>
            Save changes
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {/* Store status */}
        <Card>
          <CardHeader title="Store status" subtitle="Global kill switch honoured by checkout + cart writes" />
          <label className="flex items-center justify-between text-sm">
            <span>
              Store enabled
              <span className="ml-1 text-xs text-ink-faint">(off = checkout returns 503)</span>
            </span>
            <input type="checkbox" checked={draft.store_enabled} onChange={(e) => update('store_enabled', e.target.checked)} />
          </label>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Field label="Currency">
              <input className="input" value={draft.currency} onChange={(e) => update('currency', e.target.value)} />
            </Field>
            <Field label="Order code prefix">
              <input className="input" value={draft.order_prefix} onChange={(e) => update('order_prefix', e.target.value)} />
            </Field>
            <Field label="Payment TTL (min)" hint="Reservation window before the sweeper cancels">
              <input className="input" type="number" min={1} value={draft.payment_ttl_min} onChange={(e) => update('payment_ttl_min', Number(e.target.value))} />
            </Field>
            <Field label="Low-stock threshold" hint="Sellable ≤ this shows the low-stock badge">
              <input className="input" type="number" min={0} value={draft.low_stock_threshold} onChange={(e) => update('low_stock_threshold', Number(e.target.value))} />
            </Field>
          </div>
        </Card>

        {/* Shipping */}
        <Card>
          <CardHeader title="Shipping" subtitle="Flat fee + free-shipping threshold (entered in INR, stored in paise)" />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Flat shipping fee (₹)">
              <input
                className="input"
                type="number"
                min={0}
                step="0.01"
                value={paiseToInr(draft.flat_fee_paise)}
                onChange={(e) => update('flat_fee_paise', inrToPaise(Number(e.target.value)))}
              />
            </Field>
            <Field label="Free-shipping threshold (₹)" hint="Post-coupon subtotal ≥ this → free">
              <input
                className="input"
                type="number"
                min={0}
                step="0.01"
                value={paiseToInr(draft.free_shipping_threshold_paise)}
                onChange={(e) => update('free_shipping_threshold_paise', inrToPaise(Number(e.target.value)))}
              />
            </Field>
          </div>
        </Card>

        {/* Fulfillment */}
        <Card>
          <CardHeader title="Fulfillment" subtitle="Inventory source for live store stock" />
          <Field label="Fulfillment warehouse" hint="Store reservations/decrements hit this warehouse's inventory rows.">
            <select
              className="input"
              value={draft.fulfillment_warehouse_id}
              onChange={(e) => update('fulfillment_warehouse_id', e.target.value)}
              disabled={whQuery.isLoading}
            >
              <option value="">{whQuery.isLoading ? 'Loading warehouses…' : 'Select a warehouse…'}</option>
              {(whQuery.data?.items ?? []).map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} ({w.code})
                </option>
              ))}
            </select>
          </Field>
        </Card>

        {/* Support + payments */}
        <Card>
          <CardHeader title="Support & payments" />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Support email">
              <input className="input" value={draft.support_email} onChange={(e) => update('support_email', e.target.value)} />
            </Field>
            <Field label="Support phone">
              <input className="input" value={draft.support_phone ?? ''} onChange={(e) => update('support_phone', e.target.value)} />
            </Field>
            <div className="col-span-2">
              <Field label="Razorpay key id" hint="Public key surfaced to the storefront via /store/config">
                <input className="input tnum" value={draft.razorpay_key_id ?? ''} onChange={(e) => update('razorpay_key_id', e.target.value)} placeholder="rzp_live_…" />
              </Field>
            </div>
          </div>
        </Card>

        {/* Serviceability */}
        <Card className="xl:col-span-2">
          <CardHeader title="Pincode serviceability" subtitle="Block checkout for non-serviceable pincodes" />
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <Field label="Mode">
              <select className="input" value={draft.serviceability_mode} onChange={(e) => update('serviceability_mode', e.target.value as ServiceabilityMode)}>
                <option value="all">All India (no block)</option>
                <option value="list">Exact pincode list</option>
                <option value="prefix">Pincode prefixes</option>
              </select>
            </Field>
            <Field label="Serviceable pincodes" hint="One per line or comma-separated (mode = list)">
              <textarea
                className="input h-28 py-2 tnum"
                value={(draft.serviceable_pincodes ?? []).join('\n')}
                onChange={(e) => update('serviceable_pincodes', splitList(e.target.value))}
                placeholder="110001&#10;110002"
              />
            </Field>
            <Field label="Serviceable prefixes" hint="One per line or comma-separated (mode = prefix)">
              <textarea
                className="input h-28 py-2 tnum"
                value={(draft.serviceable_pincode_prefixes ?? []).join('\n')}
                onChange={(e) => update('serviceable_pincode_prefixes', splitList(e.target.value))}
                placeholder="110&#10;201"
              />
            </Field>
          </div>
          <p className="mt-2 text-xs text-ink-faint">
            <span className="tnum">{draft.serviceable_pincodes?.length ?? 0}</span> exact pincodes ·{' '}
            <span className="tnum">{draft.serviceable_pincode_prefixes?.length ?? 0}</span> prefixes configured.
          </p>
        </Card>
      </div>
    </div>
  );
}

function splitList(raw: string): string[] {
  return raw
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);
}
