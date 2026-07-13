import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import {
  AlertTriangle,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Clock,
  ListVideo,
  RotateCw,
  Truck,
} from 'lucide-react';
import { learnApi, PRESIGN_REFRESH_MS } from '@/api/learnClient';
import type { LearnSource } from '@/api/learnClient';
import type { LearnChapter, LearnVideoCard } from '@/api/types';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button, Card, CardHeader, ErrorState, LoadingState } from '@/components/ui/primitives';
import { Pill } from '@/components/ui/StatusPill';
import { ProgressRing } from '@/components/learn/ProgressRing';
import { errorMessage } from '@/lib/errors';
import { durationLabel, formatDuration } from '@/lib/format';
import {
  clearProgress,
  countCompleted,
  getProgress,
  markCompleted,
  progressPct,
  resumeAt,
  saveProgress,
  useLearnProgress,
} from '@/lib/learnProgress';

/** Write to localStorage at most this often while playing. */
const SAVE_EVERY_SEC = 5;

export function GuidePlayerPage() {
  const { slug = '' } = useParams<{ slug: string }>();
  const [params] = useSearchParams();
  const tab = params.get('source');
  const source: LearnSource = tab === 'field' || tab === 'public' ? 'public' : 'admin';
  const backTo = `/guides?tab=${source === 'public' ? 'field' : 'admin'}`;

  const progressMap = useLearnProgress();

  const detail = useQuery({
    queryKey: ['learn', source, 'video', slug],
    queryFn: () => learnApi(source).video(slug),
    enabled: Boolean(slug),
    // The admin URL is a presigned S3 link (TTL 6h, §1/§4). Hold it well inside
    // that window, then let a refetch mint a fresh one.
    staleTime: PRESIGN_REFRESH_MS,
  });

  const video = detail.data?.video;
  const prev = detail.data?.prev ?? null;
  const next = detail.data?.next ?? null;

  // The whole track, to render "3 of 9" and the completed-count for this track.
  const trackList = useQuery({
    queryKey: ['learn', source, 'videos', { track: video?.track ?? '' }],
    queryFn: () => learnApi(source).videos({ track: video?.track, limit: 100 }),
    enabled: Boolean(video?.track),
    staleTime: 5 * 60 * 1000,
  });

  const trackItems: LearnVideoCard[] = useMemo(() => trackList.data?.items ?? [], [trackList.data]);
  const position = trackItems.findIndex((v) => v.slug === slug) + 1;
  const trackTotal = trackItems.length;
  const trackWatched = countCompleted(progressMap, trackItems.map((v) => v.slug));

  // ---------- Playback ----------
  const videoRef = useRef<HTMLVideoElement>(null);
  const restoreRef = useRef<number | null>(null); // seek target for the next loadedmetadata
  const autoplayRef = useRef(false);
  const retriedRef = useRef(false); // one presign re-mint per playback failure
  const lastSaveRef = useRef(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [fatalError, setFatalError] = useState<string | null>(null);
  const [reminting, setReminting] = useState(false);

  const videoUrl = video?.video_url ?? null;
  const chapters = useMemo<LearnChapter[]>(() => video?.chapters ?? [], [video]);

  // New slug -> reset the transient playback state.
  useEffect(() => {
    restoreRef.current = null;
    autoplayRef.current = false;
    retriedRef.current = false;
    lastSaveRef.current = 0;
    setCurrentTime(0);
    setFatalError(null);
  }, [slug]);

  const activeChapter = useMemo(() => {
    if (chapters.length === 0) return -1;
    let idx = -1;
    for (let i = 0; i < chapters.length; i += 1) {
      if (currentTime + 0.25 >= chapters[i].start_sec) idx = i;
      else break;
    }
    return idx;
  }, [chapters, currentTime]);

  const persist = useCallback(
    (t: number, force = false) => {
      const el = videoRef.current;
      if (!el || !slug) return;
      const duration = Number.isFinite(el.duration) ? el.duration : (video?.duration_sec ?? 0);
      if (!force && Math.abs(t - lastSaveRef.current) < SAVE_EVERY_SEC) return;
      lastSaveRef.current = t;
      saveProgress(slug, t, duration);
    },
    [slug, video?.duration_sec],
  );

  function onLoadedMetadata() {
    const el = videoRef.current;
    if (!el) return;
    const target = restoreRef.current ?? resumeAt(getProgress(slug));
    restoreRef.current = null;
    if (target > 0 && Number.isFinite(el.duration) && target < el.duration - 1) {
      el.currentTime = target;
      setCurrentTime(target);
    }
    if (autoplayRef.current) {
      autoplayRef.current = false;
      void el.play().catch(() => undefined);
    }
  }

  function onTimeUpdate() {
    const el = videoRef.current;
    if (!el) return;
    setCurrentTime(el.currentTime);
    persist(el.currentTime);
  }

  function onEnded() {
    if (!slug) return;
    markCompleted(slug, videoRef.current?.duration ?? video?.duration_sec);
  }

  function onPause() {
    const el = videoRef.current;
    if (el && !el.ended) persist(el.currentTime, true);
  }

  function onPlaying() {
    // A frame is decoding: the URL is good again, so re-arm the one-shot retry.
    retriedRef.current = false;
    setFatalError(null);
  }

  /**
   * A presigned URL that has aged past its 6h TTL comes back 403 and the element
   * raises MEDIA_ERR_SRC_NOT_SUPPORTED / MEDIA_ERR_NETWORK (the DOM never exposes
   * the status code). Re-fetch the detail endpoint once to mint a fresh URL and
   * resume from where playback stopped; a second failure is real.
   */
  async function onVideoError() {
    const el = videoRef.current;
    const position_sec = el?.currentTime ?? 0;

    if (source !== 'admin' || retriedRef.current || !slug) {
      setFatalError(
        source === 'admin'
          ? 'The playback link could not be refreshed. Reload the page, or check that the video exists in S3.'
          : 'This video could not be played. The file may have moved.',
      );
      return;
    }

    retriedRef.current = true;
    restoreRef.current = position_sec;
    autoplayRef.current = !el?.paused;
    setReminting(true);
    const before = videoUrl;
    try {
      const fresh = await detail.refetch();
      const url = fresh.data?.video.video_url ?? null;
      if (!url) {
        setFatalError('No playable source was returned for this guide.');
      } else if (url === before) {
        // Same URL came back — force the element to re-request it.
        videoRef.current?.load();
      }
      // A different URL swaps the element key below, which reloads it for us.
    } catch (e) {
      setFatalError(errorMessage(e));
    } finally {
      setReminting(false);
    }
  }

  function seekTo(sec: number) {
    const el = videoRef.current;
    if (!el) return;
    el.currentTime = Math.max(0, sec + 0.05);
    setCurrentTime(sec);
    void el.play().catch(() => undefined);
  }

  // Flush the last position when leaving the page (or when a re-minted URL
  // swaps the element out). Re-runs on videoUrl so it always holds the live node.
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    return () => {
      if (slug && el.currentTime > 0) {
        saveProgress(slug, el.currentTime, Number.isFinite(el.duration) ? el.duration : 0);
      }
    };
  }, [slug, videoUrl]);

  // Keep the active chapter in view in the rail.
  const chapterRefs = useRef<(HTMLButtonElement | null)[]>([]);
  useEffect(() => {
    if (activeChapter < 0) return;
    chapterRefs.current[activeChapter]?.scrollIntoView({ block: 'nearest' });
  }, [activeChapter]);

  if (detail.isLoading) return <LoadingState label="Loading guide…" />;
  if (detail.isError || !video) {
    return (
      <Card>
        <ErrorState
          message={detail.isError ? errorMessage(detail.error) : 'Guide not found.'}
          onRetry={() => detail.refetch()}
        />
      </Card>
    );
  }

  const p = progressMap[slug];
  const pct = progressPct(p);

  return (
    <div>
      <div className="mb-3">
        <Link
          to={backTo}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-faint transition-colors hover:text-ink"
        >
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.5} />
          All guides
        </Link>
      </div>

      <PageHeader
        eyebrow={video.module || video.track}
        title={video.title}
        description={video.summary}
        actions={
          <div className="flex items-center gap-2">
            {source === 'public' && (
              <Pill tone="info">
                <Truck className="h-3 w-3" strokeWidth={2} /> field guide
              </Pill>
            )}
            <Pill tone="neutral">{video.level}</Pill>
            <span className="inline-flex items-center gap-1 text-xs text-ink-faint tnum">
              <Clock className="h-3.5 w-3.5" strokeWidth={1.5} />
              {durationLabel(video.duration_sec)}
            </span>
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* ---------- Player column ---------- */}
        <div className="min-w-0 space-y-4">
          <Card pad={false} className="overflow-hidden">
            <div className="relative aspect-video w-full bg-ink">
              {videoUrl ? (
                <video
                  // The key swaps when a fresh presigned URL is minted, which
                  // reloads the element with the new source.
                  key={videoUrl}
                  ref={videoRef}
                  src={videoUrl}
                  poster={video.poster_url ?? undefined}
                  controls
                  controlsList="nodownload"
                  preload="metadata"
                  playsInline
                  className="h-full w-full bg-ink"
                  onLoadedMetadata={onLoadedMetadata}
                  onTimeUpdate={onTimeUpdate}
                  onEnded={onEnded}
                  onPause={onPause}
                  onPlaying={onPlaying}
                  onError={() => void onVideoError()}
                />
              ) : (
                <div className="grid h-full w-full place-items-center text-sm text-paper/70">
                  No playable source for this guide.
                </div>
              )}

              {reminting && (
                <div className="absolute inset-0 grid place-items-center bg-ink/70 text-sm text-paper">
                  <span className="inline-flex items-center gap-2">
                    <RotateCw className="h-4 w-4 animate-spin" strokeWidth={1.5} />
                    Refreshing playback link…
                  </span>
                </div>
              )}
            </div>

            {fatalError && (
              <div className="flex items-start gap-2 border-t border-line bg-danger/8 px-3 py-2.5 text-xs text-danger">
                <AlertTriangle className="mt-px h-4 w-4 shrink-0" strokeWidth={1.5} />
                <span className="flex-1">{fatalError}</span>
                <button
                  onClick={() => {
                    retriedRef.current = false;
                    setFatalError(null);
                    void detail.refetch();
                  }}
                  className="cursor-pointer font-semibold underline underline-offset-2"
                >
                  Retry
                </button>
              </div>
            )}

            {/* Sequenced course nav — prev/next walk the track by `sequence`. */}
            <div className="flex items-stretch justify-between gap-2 border-t border-line p-2">
              <NavStep dir="prev" video={prev} source={source} />
              <NavStep dir="next" video={next} source={source} />
            </div>
          </Card>

          {/* Description */}
          <Card>
            <CardHeader title="About this guide" eyebrow="Overview" />
            <p className="whitespace-pre-line text-sm leading-relaxed text-ink-muted">
              {video.description || video.summary}
            </p>
            {video.tags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1 border-t border-line pt-3">
                {video.tags.map((t) => (
                  <span
                    key={t}
                    className="rounded-chip bg-surface px-2 py-0.5 text-[11px] font-medium text-ink-muted"
                  >
                    {t}
                  </span>
                ))}
              </div>
            )}
          </Card>

          {/* Transcript */}
          <TranscriptCard transcript={video.transcript} />
        </div>

        {/* ---------- Rail: track progress + chapters ---------- */}
        <div className="min-w-0 space-y-4 lg:sticky lg:top-4 lg:self-start">
          <Card>
            <CardHeader
              eyebrow="Track"
              title={trackLabel(video.track)}
              subtitle={
                trackTotal > 0
                  ? `Step ${position > 0 ? position : video.sequence} of ${trackTotal} · ${trackWatched} watched`
                  : `Step ${video.sequence}`
              }
              action={<ProgressRing pct={pct} complete={p?.completed} size={30} stroke={3} />}
            />
            {trackTotal > 0 && (
              <div className="mb-3 h-1.5 w-full overflow-hidden rounded-pill bg-surface">
                <div
                  className="h-full rounded-pill bg-success transition-[width] duration-300 ease-brand"
                  style={{ width: `${(trackWatched / trackTotal) * 100}%` }}
                />
              </div>
            )}
            <div className="flex gap-2">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => markCompleted(slug, video.duration_sec)}
                disabled={Boolean(p?.completed)}
              >
                {p?.completed ? 'Watched' : 'Mark as watched'}
              </Button>
              {p && (
                <Button variant="ghost" onClick={() => clearProgress(slug)} title="Reset progress">
                  <RotateCw className="h-4 w-4" strokeWidth={1.5} />
                </Button>
              )}
            </div>
          </Card>

          <Card pad={false}>
            <div className="flex items-center justify-between gap-2 border-b border-line p-3">
              <div className="flex items-center gap-2">
                <ListVideo className="h-4 w-4 text-gold-ink" strokeWidth={1.5} />
                <h3 className="font-display text-base leading-tight text-ink">Chapters</h3>
              </div>
              <span className="text-[11px] text-ink-faint tnum">{chapters.length}</span>
            </div>

            {chapters.length === 0 ? (
              <p className="p-3 text-xs text-ink-faint">No chapters for this guide.</p>
            ) : (
              <div className="max-h-[32rem] divide-y divide-line overflow-y-auto">
                {chapters.map((ch, i) => {
                  const active = i === activeChapter;
                  return (
                    <button
                      key={`${ch.start_sec}-${i}`}
                      ref={(el) => {
                        chapterRefs.current[i] = el;
                      }}
                      onClick={() => seekTo(ch.start_sec)}
                      className={clsx(
                        'flex w-full cursor-pointer gap-2.5 px-3 py-2.5 text-left transition-colors duration-200',
                        active ? 'bg-yellow/10' : 'hover:bg-surface',
                      )}
                    >
                      <span
                        className={clsx(
                          'mt-px w-11 shrink-0 text-[11px] font-semibold tnum',
                          active ? 'text-gold-ink' : 'text-ink-faint',
                        )}
                      >
                        {formatDuration(ch.start_sec)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span
                          className={clsx(
                            'flex items-center gap-1.5 text-[13px] font-semibold leading-snug',
                            active ? 'text-ink' : 'text-ink-muted',
                          )}
                        >
                          {active && (
                            <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-pill bg-gold-ink" />
                          )}
                          {ch.title}
                        </span>
                        <span className="mt-0.5 block text-xs leading-relaxed text-ink-faint">
                          {ch.narration}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

// ---------- Pieces ----------
function NavStep({
  dir,
  video,
  source,
}: {
  dir: 'prev' | 'next';
  video: LearnVideoCard | null;
  source: LearnSource;
}) {
  if (!video) {
    return (
      <div
        className={clsx(
          'flex-1 rounded-chip px-3 py-2 text-[11px] text-ink-faint',
          dir === 'next' && 'text-right',
        )}
      >
        {dir === 'prev' ? 'Start of track' : 'End of track'}
      </div>
    );
  }
  return (
    <Link
      to={`/guides/${video.slug}?source=${source}`}
      className={clsx(
        'group flex flex-1 items-center gap-2 rounded-chip px-3 py-2 transition-colors duration-200 hover:bg-surface',
        dir === 'next' && 'flex-row-reverse text-right',
      )}
    >
      {dir === 'prev' ? (
        <ChevronLeft className="h-4 w-4 shrink-0 text-ink-faint group-hover:text-ink" strokeWidth={1.5} />
      ) : (
        <ChevronRight className="h-4 w-4 shrink-0 text-ink-faint group-hover:text-ink" strokeWidth={1.5} />
      )}
      <span className="min-w-0">
        <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-faint">
          {dir === 'prev' ? 'Previous' : 'Next'}
        </span>
        <span className="block truncate text-[13px] font-semibold text-ink">{video.title}</span>
      </span>
    </Link>
  );
}

function TranscriptCard({ transcript }: { transcript: string }) {
  const [expanded, setExpanded] = useState(false);
  if (!transcript.trim()) return null;
  return (
    <Card>
      <CardHeader
        eyebrow="Reference"
        title="Transcript"
        subtitle="Every narration line, in order. Searchable from the library."
        action={
          <Button variant="ghost" onClick={() => setExpanded((e) => !e)}>
            {expanded ? 'Collapse' : 'Expand'}
          </Button>
        }
      />
      <div className="relative">
        <p
          className={clsx(
            'whitespace-pre-line text-sm leading-relaxed text-ink-muted',
            !expanded && 'max-h-40 overflow-hidden',
          )}
        >
          {transcript}
        </p>
        {!expanded && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-paper to-transparent" />
        )}
      </div>
    </Card>
  );
}

const TRACK_LABELS: Record<string, string> = {
  admin: 'Admin portal',
  field: 'Field app',
  store: 'Store',
};

function trackLabel(track: string): string {
  return TRACK_LABELS[track] ?? track;
}
