import { useState } from 'react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { Clock, Film, Play } from 'lucide-react';
import { Pill } from '@/components/ui/StatusPill';
import { ProgressBar, ProgressRing } from '@/components/learn/ProgressRing';
import { durationLabel, formatDuration } from '@/lib/format';
import { progressPct } from '@/lib/learnProgress';
import type { VideoProgress } from '@/lib/learnProgress';
import type { LearnSource } from '@/api/learnClient';
import type { LearnVideoCard } from '@/api/types';

/** Poster with a graceful fallback — S3 posters can 404 before a re-render. */
export function GuidePoster({
  src,
  alt,
  className,
}: {
  src?: string | null;
  alt: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div
        className={clsx(
          'grid h-full w-full place-items-center bg-surface text-ink-faint',
          className,
        )}
      >
        <Film className="h-7 w-7" strokeWidth={1.25} />
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
      className={clsx('h-full w-full object-cover', className)}
    />
  );
}

export function GuideCard({
  video,
  source,
  trackTotal,
  progress,
}: {
  video: LearnVideoCard;
  source: LearnSource;
  trackTotal?: number;
  progress?: VideoProgress;
}) {
  const pct = progressPct(progress);
  const complete = Boolean(progress?.completed);
  const started = pct > 0 && !complete;

  return (
    <Link
      to={`/guides/${video.slug}?source=${source}`}
      className="group card flex flex-col overflow-hidden transition-[box-shadow,transform,border-color] duration-300 ease-brand hover:-translate-y-px hover:border-ink/20 hover:shadow-md"
    >
      {/* Poster */}
      <div className="relative aspect-video w-full overflow-hidden border-b border-line bg-surface">
        <GuidePoster
          src={video.poster_url}
          alt={video.title}
          className="transition-transform duration-500 ease-brand group-hover:scale-[1.02]"
        />
        <span className="absolute inset-0 grid place-items-center bg-ink/0 transition-colors duration-300 group-hover:bg-ink/25">
          <span className="grid h-11 w-11 place-items-center rounded-full bg-yellow text-ink opacity-0 shadow-oil transition-opacity duration-300 group-hover:opacity-100">
            <Play className="ml-0.5 h-5 w-5 fill-ink" strokeWidth={1.5} />
          </span>
        </span>
        <span className="absolute bottom-1.5 right-1.5 rounded-chip bg-ink/80 px-1.5 py-0.5 text-[11px] font-semibold text-paper tnum">
          {formatDuration(video.duration_sec)}
        </span>
        <ProgressBar pct={pct} complete={complete} className="absolute inset-x-0 bottom-0" />
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col p-3.5">
        <div className="mb-1 flex items-center justify-between gap-2">
          <span className="truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-gold-ink">
            {video.module || video.track}
          </span>
          <span className="shrink-0 text-[11px] text-ink-faint tnum">
            {trackTotal ? `Step ${video.sequence} of ${trackTotal}` : `Step ${video.sequence}`}
          </span>
        </div>

        <h3 className="font-display text-[15px] leading-snug text-ink">{video.title}</h3>
        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-ink-faint">{video.summary}</p>

        <div className="mt-auto flex items-center gap-2 pt-3">
          <Pill tone="neutral">{video.level}</Pill>
          <span className="inline-flex items-center gap-1 text-[11px] text-ink-faint tnum">
            <Clock className="h-3.5 w-3.5" strokeWidth={1.5} />
            {durationLabel(video.duration_sec)}
          </span>
          <span className="ml-auto flex items-center gap-1.5">
            {started && <span className="text-[11px] font-semibold text-gold-ink tnum">{Math.round(pct)}%</span>}
            {(started || complete) && <ProgressRing pct={pct} complete={complete} />}
          </span>
        </div>

        {video.tags.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-1 border-t border-line pt-2.5">
            {video.tags.slice(0, 4).map((t) => (
              <span
                key={t}
                className="rounded-chip bg-surface px-1.5 py-0.5 text-[10px] font-medium text-ink-muted"
              >
                {t}
              </span>
            ))}
            {video.tags.length > 4 && (
              <span className="px-1 py-0.5 text-[10px] text-ink-faint tnum">
                +{video.tags.length - 4}
              </span>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}

/** Loading placeholder that keeps the grid from jumping. */
export function GuideCardSkeleton() {
  return (
    <div className="card overflow-hidden">
      <div className="aspect-video w-full animate-pulse border-b border-line bg-surface" />
      <div className="space-y-2 p-3.5">
        <div className="h-2.5 w-1/3 animate-pulse rounded-chip bg-surface" />
        <div className="h-4 w-4/5 animate-pulse rounded-chip bg-surface" />
        <div className="h-3 w-full animate-pulse rounded-chip bg-surface" />
        <div className="h-3 w-2/3 animate-pulse rounded-chip bg-surface" />
      </div>
    </div>
  );
}
