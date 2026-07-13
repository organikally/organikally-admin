// Typed Learn/Guides client (LEARN_CONTRACT §3 public API + §4 admin API).
// Reuses the same request() core as the field-sales and store clients, so the
// bearer token, error envelope and base URL handling are identical. The public
// endpoints need no auth; sending the admin's token to them is harmless and
// keeps a single code path.
import { request } from './http';
import type {
  LearnAudience,
  LearnTrackSummary,
  LearnVideoCard,
  LearnVideoDetail,
  LearnVideoDetailResponse,
  LearnVideoList,
  LearnTrack,
} from './types';

export interface LearnVideoListQuery {
  q?: string;
  track?: LearnTrack | '';
  tag?: string;
  limit?: number;
  offset?: number;
  [k: string]: string | number | boolean | undefined;
}

// ---------- Normalizers ----------
// The catalog is generated (organikally-demo) and seeded; defend the render path
// against a missing list field exactly like the other clients do.
function toCard(raw: Partial<LearnVideoCard>): LearnVideoCard {
  return {
    slug: raw.slug ?? '',
    track: (raw.track ?? 'admin') as LearnTrack,
    module: raw.module ?? '',
    sequence: raw.sequence ?? 0,
    title: raw.title ?? '',
    summary: raw.summary ?? '',
    duration_sec: raw.duration_sec ?? 0,
    poster_url: raw.poster_url ?? null,
    tags: Array.isArray(raw.tags) ? raw.tags : [],
    level: raw.level ?? 'beginner',
  };
}

function toDetail(raw: Partial<LearnVideoDetail>): LearnVideoDetail {
  return {
    ...toCard(raw),
    description: raw.description ?? '',
    transcript: raw.transcript ?? '',
    chapters: Array.isArray(raw.chapters) ? raw.chapters : [],
    video_url: raw.video_url ?? null,
  };
}

async function listFrom(path: string, q?: LearnVideoListQuery): Promise<LearnVideoList> {
  const r = await request<{ items?: Partial<LearnVideoCard>[]; total?: number }>(path, { query: q });
  const items = (Array.isArray(r.items) ? r.items : []).map(toCard);
  return { items, total: r.total ?? items.length };
}

async function detailFrom(path: string): Promise<LearnVideoDetailResponse> {
  const r = await request<{
    video: Partial<LearnVideoDetail>;
    prev?: Partial<LearnVideoCard> | null;
    next?: Partial<LearnVideoCard> | null;
  }>(path);
  return {
    video: toDetail(r.video ?? {}),
    prev: r.prev ? toCard(r.prev) : null,
    next: r.next ? toCard(r.next) : null,
  };
}

async function tracksFrom(path: string): Promise<LearnTrackSummary[]> {
  const r = await request<LearnTrackSummary[]>(path);
  return Array.isArray(r) ? r : [];
}

// ---------- §4 Admin API (require_roles(admin, super_admin)) ----------
// video.video_url is a presigned S3 URL, TTL 6h, minted per request — re-call
// video() to re-mint when a <video> element rejects an expired URL.
export const learnAdmin = {
  tracks: () => tracksFrom('/learn/admin/tracks'),
  videos: (q?: LearnVideoListQuery) => listFrom('/learn/admin/videos', q),
  video: (slug: string) => detailFrom(`/learn/admin/videos/${encodeURIComponent(slug)}`),
};

// ---------- §3 Public API (no auth; "public" audience only) ----------
// Surfaced read-only in the portal so a manager can preview what a rep sees.
export const learnPublic = {
  tracks: () => tracksFrom('/learn/tracks'),
  videos: (q?: LearnVideoListQuery) => listFrom('/learn/videos', q),
  video: (slug: string) => detailFrom(`/learn/videos/${encodeURIComponent(slug)}`),
};

/** UI source selector: which half of the catalog a screen is reading. */
export type LearnSource = LearnAudience;

export function learnApi(source: LearnSource) {
  return source === 'admin' ? learnAdmin : learnPublic;
}

/** Presigned admin URLs live 6h (§1); re-mint before we get anywhere near that. */
export const PRESIGN_TTL_MS = 6 * 60 * 60 * 1000;
export const PRESIGN_REFRESH_MS = 5.5 * 60 * 60 * 1000;
