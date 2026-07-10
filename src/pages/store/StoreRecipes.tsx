import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Plus, Star } from 'lucide-react';
import { storeApi } from '@/api/storeClient';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button, Card } from '@/components/ui/primitives';
import { DataTable, Pagination } from '@/components/ui/DataTable';
import type { Column } from '@/components/ui/DataTable';
import { FilterBar, SearchInput, Select } from '@/components/ui/Filters';
import { Pill } from '@/components/ui/StatusPill';
import { dateShort } from '@/lib/format';
import { errorMessage } from '@/lib/errors';
import { useDebounced } from '@/lib/useDebounced';
import type { RecipeAdmin, RecipeStatus } from '@/api/types';

const PAGE_SIZE = 20;

export function StoreRecipesPage() {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const debouncedQ = useDebounced(q, 300);

  const query = useQuery({
    queryKey: ['store', 'recipes', { q: debouncedQ, status, page }],
    queryFn: () =>
      storeApi.recipes.list({
        q: debouncedQ || undefined,
        status: (status || undefined) as RecipeStatus | undefined,
        page,
        page_size: PAGE_SIZE,
      }),
  });

  const columns: Column<RecipeAdmin>[] = [
    {
      key: 'title',
      header: 'Title',
      render: (r) => (
        <div>
          <div className="font-medium">{r.title}</div>
          {r.subtitle && <div className="text-xs text-ink-faint">{r.subtitle}</div>}
        </div>
      ),
    },
    { key: 'type', header: 'Type', render: (r) => r.recipe_type },
    {
      key: 'time',
      header: 'Time',
      align: 'right',
      render: (r) => <span className="tnum">{(r.prep_min ?? 0) + (r.cook_min ?? 0)} min</span>,
    },
    { key: 'difficulty', header: 'Difficulty', render: (r) => r.difficulty },
    {
      key: 'featured',
      header: 'Featured',
      render: (r) =>
        r.featured ? (
          <Pill tone="warning">
            <Star className="h-3 w-3" strokeWidth={2} /> featured
          </Pill>
        ) : (
          <span className="text-ink-faint">—</span>
        ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (r) => <Pill tone={r.status === 'published' ? 'brand' : 'neutral'}>{r.status}</Pill>,
    },
    { key: 'updated', header: 'Updated', render: (r) => dateShort(r.updated_at) },
  ];

  return (
    <div>
      <PageHeader
        title="Recipes"
        description="Kitchen-tested recipes published to the storefront"
        actions={
          <Button onClick={() => navigate('/store/recipes/new')}>
            <Plus className="h-4 w-4" strokeWidth={1.5} />
            New recipe
          </Button>
        }
      />

      <Card pad={false}>
        <div className="p-3">
          <FilterBar>
            <SearchInput value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Search title / subtitle / description…" />
            <Select
              value={status}
              onChange={(v) => { setStatus(v); setPage(1); }}
              options={[
                { value: 'draft', label: 'Draft' },
                { value: 'published', label: 'Published' },
              ]}
              placeholder="All statuses"
            />
          </FilterBar>
        </div>
        <DataTable
          columns={columns}
          rows={query.data?.items ?? []}
          rowKey={(r) => r.id}
          loading={query.isLoading}
          error={query.isError ? errorMessage(query.error) : null}
          onRetry={() => query.refetch()}
          onRowClick={(r) => navigate(`/store/recipes/${r.id}`)}
          emptyTitle="No recipes yet"
          emptyHint="Create your first recipe to feature it on the storefront."
        />
        <div className="border-t border-line px-2">
          <Pagination page={page} pageSize={PAGE_SIZE} total={query.data?.total ?? 0} onPage={setPage} />
        </div>
      </Card>
    </div>
  );
}
