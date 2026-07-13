import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { GraduationCap, Truck } from 'lucide-react';
import { learnApi } from '@/api/learnClient';
import type { LearnSource } from '@/api/learnClient';
import type { LearnTrack, LearnVideoCard } from '@/api/types';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, EmptyState, ErrorState } from '@/components/ui/primitives';
import { FilterBar, SearchInput, Select } from '@/components/ui/Filters';
import { GuideCard, GuideCardSkeleton } from '@/components/learn/GuideCard';
import { errorMessage } from '@/lib/errors';
import { useDebounced } from '@/lib/useDebounced';
import { durationLabel } from '@/lib/format';
import { countCompleted, useLearnProgress } from '@/lib/learnProgress';

const LIMIT = 60;

const TABS: { source: LearnSource; label: string; icon: typeof GraduationCap; hint: string }[] = [
  {
    source: 'admin',
    label: 'Admin guides',
    icon: GraduationCap,
    hint: 'Training for this portal — visible to admins only.',
  },
  {
    source: 'public',
    label: 'Field guides',
    icon: Truck,
    hint: 'What the reps see in the public learn app. Read-only preview.',
  },
];

export function GuidesPage() {
  const [params, setParams] = useSearchParams();
  const source: LearnSource = params.get('tab') === 'field' ? 'public' : 'admin';
  const q = params.get('q') ?? '';
  const track = params.get('track') ?? '';
  const debouncedQ = useDebounced(q, 300);
  const progress = useLearnProgress();

  function patch(next: Record<string, string>) {
    const merged = new URLSearchParams(params);
    for (const [k, v] of Object.entries(next)) {
      if (v) merged.set(k, v);
      else merged.delete(k);
    }
    setParams(merged, { replace: true });
  }

  const tracksQuery = useQuery({
    queryKey: ['learn', source, 'tracks'],
    queryFn: () => learnApi(source).tracks(),
    staleTime: 5 * 60 * 1000,
  });

  const videosQuery = useQuery({
    queryKey: ['learn', source, 'videos', { q: debouncedQ, track }],
    queryFn: () =>
      learnApi(source).videos({
        q: debouncedQ || undefined,
        track: (track || undefined) as LearnTrack | undefined,
        limit: LIMIT,
        offset: 0,
      }),
    placeholderData: (prev) => prev,
  });

  const items: LearnVideoCard[] = videosQuery.data?.items ?? [];

  // Total videos per track drives the "Step N of M" line on each card.
  const trackTotals = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of tracksQuery.data ?? []) m.set(t.track, t.video_count);
    return m;
  }, [tracksQuery.data]);

  const watched = countCompleted(progress, items.map((v) => v.slug));
  const totalSec = items.reduce((s, v) => s + v.duration_sec, 0);
  const activeTab = TABS.find((t) => t.source === source)!;

  return (
    <div>
      <PageHeader
        eyebrow="Learning"
        title="Guides"
        description="Step-by-step walkthroughs of the Organikaly platform. Each track is sequenced — watch it start to finish and you know the surface."
      />

      <Card pad={false} className="mb-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-3">
          {/* Tabs — admin catalog vs. the public/field catalog a rep sees. */}
          <div className="flex gap-1 rounded-chip bg-surface p-1">
            {TABS.map((t) => {
              const Icon = t.icon;
              const active = t.source === source;
              return (
                <button
                  key={t.source}
                  onClick={() => patch({ tab: t.source === 'public' ? 'field' : 'admin', track: '' })}
                  className={clsx(
                    'inline-flex cursor-pointer items-center gap-1.5 rounded-[0.5rem] px-3 py-1.5 text-xs font-semibold transition-colors duration-200',
                    active ? 'bg-paper text-ink shadow-sm' : 'text-ink-faint hover:text-ink-muted',
                  )}
                  aria-pressed={active}
                >
                  <Icon className="h-4 w-4" strokeWidth={1.5} />
                  {t.label}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-3 text-[11px] text-ink-faint tnum">
            <span>
              <span className="font-semibold text-ink">{videosQuery.data?.total ?? items.length}</span>{' '}
              guides
            </span>
            <span aria-hidden className="text-line">/</span>
            <span>
              <span className="font-semibold text-ink">{watched}</span> watched
            </span>
            <span aria-hidden className="text-line">/</span>
            <span>{durationLabel(totalSec)} total</span>
          </div>
        </div>

        <div className="p-3">
          <FilterBar>
            <SearchInput
              value={q}
              onChange={(v) => patch({ q: v })}
              placeholder="Search title, summary, description, transcript…"
            />
            <Select
              value={track}
              onChange={(v) => patch({ track: v })}
              options={(tracksQuery.data ?? []).map((t) => ({
                value: t.track,
                label: `${t.label} (${t.video_count})`,
              }))}
              placeholder="All tracks"
            />
            <span className="ml-auto hidden text-[11px] text-ink-faint md:block">{activeTab.hint}</span>
          </FilterBar>
        </div>
      </Card>

      {videosQuery.isError ? (
        <Card>
          <ErrorState message={errorMessage(videosQuery.error)} onRetry={() => videosQuery.refetch()} />
        </Card>
      ) : videosQuery.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <GuideCardSkeleton key={i} />
          ))}
        </div>
      ) : items.length === 0 ? (
        <Card>
          <EmptyState
            title={q || track ? 'No guides match this search' : 'No guides published yet'}
            hint={
              q || track
                ? 'Search covers the title, summary, full description and the transcript. Try a shorter term.'
                : source === 'admin'
                  ? 'Admin training videos appear here once the catalog is seeded.'
                  : 'Field training videos appear here once the public catalog is seeded.'
            }
          />
        </Card>
      ) : (
        <div
          className={clsx(
            'grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4',
            videosQuery.isFetching && 'opacity-70 transition-opacity duration-200',
          )}
        >
          {items.map((v) => (
            <GuideCard
              key={v.slug}
              video={v}
              source={source}
              trackTotal={trackTotals.get(v.track)}
              progress={progress[v.slug]}
            />
          ))}
        </div>
      )}
    </div>
  );
}
