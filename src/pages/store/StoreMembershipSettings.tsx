import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { storeApi } from '@/api/storeClient';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button, Card, CardHeader, ErrorState, Field, LoadingState } from '@/components/ui/primitives';
import { paiseToInr, inrToPaise } from '@/lib/format';
import { errorMessage } from '@/lib/errors';
import { useToast } from '@/components/ui/Toast';
import type { MembershipPlanAdmin, MembershipPlanInput } from '@/api/types';

const DEFAULT_BENEFITS = [
  'Free delivery on every order',
  'Up to 12% member savings, every day',
  'Earn Organikaly Coins 2x faster',
  'Redeem coins at full value',
  'Early access to launches and sales',
  'Member-only pack sizes',
  'Seasonal gifts and birthday treats',
];

const DEFAULT_PLAN: MembershipPlanAdmin = {
  id: '',
  name: 'Organikaly Club',
  slug: 'organikaly-club',
  price_paise: 120000,
  price: 1200,
  duration_days: 365,
  free_delivery_for_members: true,
  member_discount_bps: 1200,
  member_discount_pct: 12,
  coin_earn_paise_per_coin: 1000,
  member_earn_multiplier_pct: 200,
  coin_redeem_value_paise: 100,
  non_member_redeem_pct: 50,
  max_redeem_pct_of_order: 20,
  welcome_coins: 200,
  renewal_bonus_coins: 0,
  benefits: DEFAULT_BENEFITS,
  active: true,
};

function toInput(d: MembershipPlanAdmin): MembershipPlanInput {
  return {
    name: d.name.trim(),
    price: d.price,
    duration_days: d.duration_days,
    free_delivery_for_members: d.free_delivery_for_members,
    member_discount_bps: d.member_discount_bps,
    coin_earn_paise_per_coin: d.coin_earn_paise_per_coin,
    member_earn_multiplier_pct: d.member_earn_multiplier_pct,
    coin_redeem_value_paise: d.coin_redeem_value_paise,
    non_member_redeem_pct: d.non_member_redeem_pct,
    max_redeem_pct_of_order: d.max_redeem_pct_of_order,
    welcome_coins: d.welcome_coins,
    renewal_bonus_coins: d.renewal_bonus_coins,
    benefits: d.benefits.map((b) => b.trim()).filter(Boolean),
    active: d.active,
  };
}

export function StoreMembershipSettingsPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const query = useQuery({ queryKey: ['store', 'membership-plans'], queryFn: storeApi.membershipPlans.list });

  const [draft, setDraft] = useState<MembershipPlanAdmin | null>(null);
  const [planId, setPlanId] = useState<string | null>(null);

  useEffect(() => {
    if (!query.data) return;
    const active = query.data.items.find((p) => p.active) ?? query.data.items[0];
    if (active) {
      setDraft(structuredClone(active));
      setPlanId(active.id);
    } else {
      setDraft(structuredClone(DEFAULT_PLAN));
      setPlanId(null);
    }
  }, [query.data]);

  const save = useMutation({
    mutationFn: (d: MembershipPlanAdmin) =>
      planId ? storeApi.membershipPlans.update(planId, toInput(d)) : storeApi.membershipPlans.create(toInput(d)),
    onSuccess: () => {
      toast.success('Club plan saved');
      qc.invalidateQueries({ queryKey: ['store', 'membership-plans'] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (query.isLoading || !draft) return <LoadingState />;
  if (query.isError) return <ErrorState message={errorMessage(query.error)} onRetry={() => query.refetch()} />;

  function update<K extends keyof MembershipPlanAdmin>(key: K, value: MembershipPlanAdmin[K]) {
    setDraft((d) => (d ? { ...d, [key]: value } : d));
  }

  return (
    <div>
      <PageHeader
        title="Membership"
        description="Configure the Organikaly Club plan: price, duration, member benefits and coin economics. Changes are audited."
        actions={
          <Button disabled={save.isPending} onClick={() => save.mutate(draft)}>
            Save changes
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {/* Plan */}
        <Card>
          <CardHeader title="Plan" subtitle="The purchasable club product. Only an active plan can be bought." />
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Field label="Plan name">
                <input className="input" value={draft.name} onChange={(e) => update('name', e.target.value)} />
              </Field>
            </div>
            <Field label="Annual price (₹)" hint="Entered in INR, stored in paise.">
              <input
                className="input tnum"
                type="number"
                min={0}
                step="0.01"
                value={draft.price}
                onChange={(e) => update('price', Number(e.target.value))}
              />
            </Field>
            <Field label="Duration (days)">
              <input
                className="input tnum"
                type="number"
                min={1}
                value={draft.duration_days}
                onChange={(e) => update('duration_days', Number(e.target.value))}
              />
            </Field>
            <label className="col-span-2 flex items-center justify-between text-sm">
              <span>
                Active
                <span className="ml-1 text-xs text-ink-faint">(off = not purchasable)</span>
              </span>
              <input type="checkbox" checked={draft.active} onChange={(e) => update('active', e.target.checked)} />
            </label>
          </div>
        </Card>

        {/* Member benefits */}
        <Card>
          <CardHeader title="Member benefits" subtitle="Applied for active members at checkout." />
          <div className="grid grid-cols-2 gap-3">
            <label className="col-span-2 flex items-center justify-between text-sm">
              <span>Free delivery for members</span>
              <input
                type="checkbox"
                checked={draft.free_delivery_for_members}
                onChange={(e) => update('free_delivery_for_members', e.target.checked)}
              />
            </label>
            <div className="col-span-2">
              <Field
                label="Member discount (basis points)"
                hint={`= ${(draft.member_discount_bps / 100).toFixed(2)}% off merchandise (1200 bps = 12%)`}
              >
                <input
                  className="input tnum"
                  type="number"
                  min={0}
                  max={10000}
                  value={draft.member_discount_bps}
                  onChange={(e) => update('member_discount_bps', Number(e.target.value))}
                />
              </Field>
            </div>
          </div>
        </Card>

        {/* Coin earning */}
        <Card>
          <CardHeader title="Coin earning" subtitle="Base earn applies to every shopper; the multiplier boosts members." />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Earn 1 coin per (₹ net spend)" hint="Everyone earns at this rate. Stored in paise.">
              <input
                className="input tnum"
                type="number"
                min={0}
                step="0.01"
                value={paiseToInr(draft.coin_earn_paise_per_coin)}
                onChange={(e) => update('coin_earn_paise_per_coin', inrToPaise(Number(e.target.value)))}
              />
            </Field>
            <Field label="Member earn multiplier (%)" hint="200 = members earn 2x coins.">
              <input
                className="input tnum"
                type="number"
                min={100}
                value={draft.member_earn_multiplier_pct}
                onChange={(e) => update('member_earn_multiplier_pct', Number(e.target.value))}
              />
            </Field>
            <Field label="Welcome coins" hint="Credited once on activation.">
              <input
                className="input tnum"
                type="number"
                min={0}
                value={draft.welcome_coins}
                onChange={(e) => update('welcome_coins', Number(e.target.value))}
              />
            </Field>
            <Field label="Renewal bonus coins" hint="Credited on a renewal activation.">
              <input
                className="input tnum"
                type="number"
                min={0}
                value={draft.renewal_bonus_coins}
                onChange={(e) => update('renewal_bonus_coins', Number(e.target.value))}
              />
            </Field>
          </div>
        </Card>

        {/* Coin redemption */}
        <Card>
          <CardHeader title="Coin redemption" subtitle="What a coin is worth and how much of an order it can cover." />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Coin value for members (₹ per coin)" hint="Member redemption value. Stored in paise.">
              <input
                className="input tnum"
                type="number"
                min={0}
                step="0.01"
                value={paiseToInr(draft.coin_redeem_value_paise)}
                onChange={(e) => update('coin_redeem_value_paise', inrToPaise(Number(e.target.value)))}
              />
            </Field>
            <Field label="Non-member redeem (%)" hint="50 = non-members redeem at half the member value.">
              <input
                className="input tnum"
                type="number"
                min={0}
                max={100}
                value={draft.non_member_redeem_pct}
                onChange={(e) => update('non_member_redeem_pct', Number(e.target.value))}
              />
            </Field>
            <div className="col-span-2">
              <Field label="Max redeem (% of order)" hint="Caps the coin discount at this share of pre-coin merchandise.">
                <input
                  className="input tnum"
                  type="number"
                  min={0}
                  max={100}
                  value={draft.max_redeem_pct_of_order}
                  onChange={(e) => update('max_redeem_pct_of_order', Number(e.target.value))}
                />
              </Field>
            </div>
          </div>
        </Card>

        {/* Benefits copy */}
        <Card className="xl:col-span-2">
          <CardHeader title="Storefront benefit bullets" subtitle="One per line. Shown on the storefront and app membership page." />
          <textarea
            className="input h-40 py-2"
            value={draft.benefits.join('\n')}
            onChange={(e) => update('benefits', e.target.value.split('\n'))}
            placeholder={DEFAULT_BENEFITS.join('\n')}
          />
          <p className="mt-2 text-xs text-ink-faint">
            <span className="tnum">{draft.benefits.filter((b) => b.trim()).length}</span> benefit bullets.
          </p>
        </Card>
      </div>
    </div>
  );
}
