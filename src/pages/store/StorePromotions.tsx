import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Sparkles, Star } from 'lucide-react';
import { storeApi } from '@/api/storeClient';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button, Card, CardHeader, ErrorState, LoadingState } from '@/components/ui/primitives';
import { SearchInput } from '@/components/ui/Filters';
import { Pill } from '@/components/ui/StatusPill';
import { formatPaise } from '@/lib/format';
import { errorMessage } from '@/lib/errors';
import { useToast } from '@/components/ui/Toast';
import { useDebounced } from '@/lib/useDebounced';
import type { StoreProductAdmin } from '@/api/types';

export function StorePromotionsPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const [q, setQ] = useState('');
  const debouncedQ = useDebounced(q, 300);

  const query = useQuery({
    queryKey: ['store', 'products', 'promotions', { q: debouncedQ }],
    queryFn: () => storeApi.products.list({ status: 'published', q: debouncedQ || undefined, page_size: 100 }),
  });

  function invalidate() {
    qc.invalidateQueries({ queryKey: ['store', 'products'] });
  }

  const setHero = useMutation({
    mutationFn: (p: StoreProductAdmin) => storeApi.promotions.setHero(p.id),
    onSuccess: () => { toast.success('Hero updated — storefront revalidating'); invalidate(); },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const toggleFeatured = useMutation({
    mutationFn: (p: StoreProductAdmin) => storeApi.products.flags(p.id, { featured: !p.featured }),
    onSuccess: () => { toast.success('Featured rail updated'); invalidate(); },
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (query.isLoading) return <LoadingState />;
  if (query.isError) return <ErrorState message={errorMessage(query.error)} onRetry={() => query.refetch()} />;

  const items = query.data?.items ?? [];
  const hero = items.find((p) => p.is_hero);
  const featured = items.filter((p) => p.featured);
  const pending = setHero.isPending || toggleFeatured.isPending;

  return (
    <div>
      <PageHeader
        title="Promotions"
        description="Curate the storefront hero and the featured rail. Changes trigger on-demand revalidation of the listing."
      />

      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Storefront hero" action={<Sparkles className="h-4 w-4 text-gold-ink" strokeWidth={1.5} />} />
          {hero ? (
            <div className="flex items-center gap-3">
              <Thumb url={hero.images?.[0]} />
              <div className="min-w-0">
                <Link className="font-medium text-gold-ink hover:underline" to={`/store/products/${hero.id}`}>
                  {hero.name}
                </Link>
                <div className="text-xs text-ink-faint">{formatPaise(hero.price_paise)} · /{hero.slug}</div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-ink-faint">No hero product set. Choose one below — only one product can be the hero.</p>
          )}
        </Card>

        <Card>
          <CardHeader title="Featured rail" action={<Star className="h-4 w-4 text-gold-ink" strokeWidth={1.5} />} />
          {featured.length === 0 ? (
            <p className="text-sm text-ink-faint">No featured products yet.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {featured.map((p) => (
                <Pill key={p.id} tone="warning">{p.name}</Pill>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card pad={false}>
        <div className="border-b border-line p-3">
          <SearchInput value={q} onChange={setQ} placeholder="Search published products…" />
        </div>
        {items.length === 0 ? (
          <p className="py-12 text-center text-sm text-ink-faint">No published products.</p>
        ) : (
          <div className="divide-y divide-line">
            {items.map((p) => (
              <div key={p.id} className="flex items-center gap-3 px-4 py-3">
                <Thumb url={p.images?.[0]} />
                <div className="min-w-0 flex-1">
                  <Link className="font-medium hover:underline" to={`/store/products/${p.id}`}>
                    {p.name}
                  </Link>
                  <div className="text-xs text-ink-faint tnum">{formatPaise(p.price_paise)} · {p.category}</div>
                </div>
                <div className="flex items-center gap-2">
                  {p.is_hero ? (
                    <Pill tone="brand"><Sparkles className="h-3 w-3" strokeWidth={2} /> hero</Pill>
                  ) : (
                    <Button variant="ghost" className="h-8 px-2.5" disabled={pending} onClick={() => setHero.mutate(p)}>
                      Set as hero
                    </Button>
                  )}
                  <Button
                    variant={p.featured ? 'secondary' : 'ghost'}
                    className="h-8 px-2.5"
                    disabled={pending}
                    onClick={() => toggleFeatured.mutate(p)}
                  >
                    <Star className="h-3.5 w-3.5" strokeWidth={1.5} />
                    {p.featured ? 'Featured' : 'Feature'}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function Thumb({ url }: { url?: string | null }) {
  if (!url) return <span className="grid h-10 w-10 shrink-0 place-items-center rounded-chip bg-surface text-[10px] text-ink-faint">—</span>;
  return <img src={url} alt="" className="h-10 w-10 shrink-0 rounded-chip border border-line object-cover" loading="lazy" />;
}
