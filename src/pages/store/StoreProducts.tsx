import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Plus, Star, Sparkles } from 'lucide-react';
import { storeApi } from '@/api/storeClient';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button, Card } from '@/components/ui/primitives';
import { DataTable, Pagination } from '@/components/ui/DataTable';
import type { Column } from '@/components/ui/DataTable';
import { FilterBar, SearchInput, Select } from '@/components/ui/Filters';
import { Pill, StoreProductStatusPill } from '@/components/ui/StatusPill';
import { formatPaise, num } from '@/lib/format';
import { errorMessage } from '@/lib/errors';
import { useDebounced } from '@/lib/useDebounced';
import type { StoreProductAdmin, StoreProductStatus } from '@/api/types';

const PAGE_SIZE = 20;

export function StoreProductsPage() {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [featured, setFeatured] = useState('');
  const [page, setPage] = useState(1);
  const debouncedQ = useDebounced(q, 300);

  const query = useQuery({
    queryKey: ['store', 'products', { q: debouncedQ, status, featured, page }],
    queryFn: () =>
      storeApi.products.list({
        q: debouncedQ || undefined,
        status: (status || undefined) as StoreProductStatus | undefined,
        featured: featured === '' ? undefined : featured === 'true',
        page,
        page_size: PAGE_SIZE,
      }),
  });

  const columns: Column<StoreProductAdmin>[] = [
    {
      key: 'name',
      header: 'Product',
      render: (p) => (
        <div className="flex items-center gap-3">
          <Thumb url={p.images?.[0]} alt={p.name} />
          <div>
            <div className="font-medium">{p.name}</div>
            <div className="text-xs text-ink-faint tnum">
              {p.sku_code ?? p.sku_id?.slice(-6)} · /{p.slug}
            </div>
          </div>
        </div>
      ),
    },
    { key: 'category', header: 'Category', render: (p) => p.category },
    { key: 'price', header: 'Price', align: 'right', render: (p) => formatPaise(p.price_paise) },
    {
      key: 'stock',
      header: 'Stock',
      align: 'right',
      render: (p) =>
        p.in_stock === false ? (
          <Pill tone="danger">out of stock</Pill>
        ) : p.low_stock ? (
          <span className="tnum text-warning">{num(p.sellable_qty)} low</span>
        ) : (
          <span className="tnum">{num(p.sellable_qty ?? 0)}</span>
        ),
    },
    {
      key: 'flags',
      header: 'Merchandising',
      render: (p) => (
        <div className="flex flex-wrap items-center gap-1">
          {p.is_hero && (
            <Pill tone="brand">
              <Sparkles className="h-3 w-3" strokeWidth={2} /> hero
            </Pill>
          )}
          {p.featured && (
            <Pill tone="warning">
              <Star className="h-3 w-3" strokeWidth={2} /> featured
            </Pill>
          )}
          {(p.badges ?? []).slice(0, 2).map((b) => (
            <Pill key={b} tone="neutral">
              {b}
            </Pill>
          ))}
        </div>
      ),
    },
    { key: 'status', header: 'Status', render: (p) => <StoreProductStatusPill status={p.status} /> },
  ];

  return (
    <div>
      <PageHeader
        title="Products"
        description="Store catalog: pricing (INR), SEO, imagery, merchandising flags and live stock from the fulfillment warehouse."
        actions={
          <Button onClick={() => navigate('/store/products/new')}>
            <Plus className="h-4 w-4" strokeWidth={1.5} />
            New product
          </Button>
        }
      />

      <Card pad={false}>
        <div className="p-3">
          <FilterBar>
            <SearchInput value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Search name / slug / SKU…" />
            <Select
              value={status}
              onChange={(v) => { setStatus(v); setPage(1); }}
              options={[
                { value: 'draft', label: 'Draft' },
                { value: 'published', label: 'Published' },
                { value: 'archived', label: 'Archived' },
              ]}
              placeholder="All statuses"
            />
            <Select
              value={featured}
              onChange={(v) => { setFeatured(v); setPage(1); }}
              options={[
                { value: 'true', label: 'Featured' },
                { value: 'false', label: 'Not featured' },
              ]}
              placeholder="Any rail"
            />
          </FilterBar>
        </div>
        <DataTable
          columns={columns}
          rows={query.data?.items ?? []}
          rowKey={(p) => p.id}
          loading={query.isLoading}
          error={query.isError ? errorMessage(query.error) : null}
          onRetry={() => query.refetch()}
          onRowClick={(p) => navigate(`/store/products/${p.id}`)}
          emptyTitle="No products"
          emptyHint="Create your first store product to start selling."
        />
        <div className="border-t border-line px-2">
          <Pagination page={page} pageSize={PAGE_SIZE} total={query.data?.total ?? 0} onPage={setPage} />
        </div>
      </Card>
    </div>
  );
}

function Thumb({ url, alt }: { url?: string | null; alt: string }) {
  if (!url) {
    return <span className="grid h-9 w-9 shrink-0 place-items-center rounded-chip bg-surface text-[10px] text-ink-faint">—</span>;
  }
  return (
    <img
      src={url}
      alt={alt}
      className="h-9 w-9 shrink-0 rounded-chip border border-line object-cover"
      loading="lazy"
    />
  );
}
