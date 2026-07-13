// Watch progress for the Guides library. Client-only by design (LEARN_CONTRACT
// has no progress endpoint): last position + completed flag per slug, kept in
// localStorage and shared across tabs. No backend writes.
import { useSyncExternalStore } from 'react';

const KEY = 'organikaly.admin.learn.progress';
/** Watched to within the last 5% (or the last 10s) counts as complete. */
const COMPLETE_RATIO = 0.95;
const COMPLETE_TAIL_SEC = 10;
/** Re-watching from the very start should not read as "resume". */
const RESUME_FLOOR_SEC = 5;

export interface VideoProgress {
  position_sec: number;
  duration_sec: number;
  completed: boolean;
  updated_at: string;
}

export type ProgressMap = Record<string, VideoProgress>;

const EMPTY: ProgressMap = {};

let cache: ProgressMap | null = null;
const listeners = new Set<() => void>();
let wired = false;

function read(): ProgressMap {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return EMPTY;
    return parsed as ProgressMap;
  } catch {
    return EMPTY;
  }
}

function snapshot(): ProgressMap {
  if (!cache) cache = read();
  return cache;
}

function emit(): void {
  for (const l of listeners) l();
}

function commit(next: ProgressMap): void {
  cache = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // quota / private mode — progress is a nicety, never a blocker
  }
  emit();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (!wired) {
    wired = true;
    window.addEventListener('storage', (e) => {
      if (e.key !== null && e.key !== KEY) return;
      cache = read();
      emit();
    });
  }
  return () => {
    listeners.delete(listener);
  };
}

// ---------- Reads ----------
export function getAllProgress(): ProgressMap {
  return snapshot();
}

export function getProgress(slug: string): VideoProgress | undefined {
  return snapshot()[slug];
}

/** 0–100. A completed video always reads 100 even if the tail was skipped. */
export function progressPct(p: VideoProgress | undefined): number {
  if (!p) return 0;
  if (p.completed) return 100;
  if (!p.duration_sec) return 0;
  return Math.min(100, Math.max(0, (p.position_sec / p.duration_sec) * 100));
}

/** Where playback should resume from — 0 when finished or barely started. */
export function resumeAt(p: VideoProgress | undefined): number {
  if (!p || p.completed) return 0;
  if (p.position_sec < RESUME_FLOOR_SEC) return 0;
  // Never resume into the last few seconds; that just replays the outro.
  if (p.duration_sec && p.position_sec > p.duration_sec - COMPLETE_TAIL_SEC) return 0;
  return p.position_sec;
}

export function isComplete(p: VideoProgress | undefined): boolean {
  return Boolean(p?.completed);
}

/** "3 of 9 watched" for a track. */
export function countCompleted(map: ProgressMap, slugs: string[]): number {
  return slugs.reduce((n, s) => (map[s]?.completed ? n + 1 : n), 0);
}

// ---------- Writes ----------
export function saveProgress(slug: string, positionSec: number, durationSec: number): void {
  if (!slug || !Number.isFinite(positionSec)) return;
  const current = snapshot()[slug];
  const duration = Number.isFinite(durationSec) && durationSec > 0 ? durationSec : (current?.duration_sec ?? 0);
  const nearEnd =
    duration > 0 &&
    (positionSec >= duration * COMPLETE_RATIO || positionSec >= duration - COMPLETE_TAIL_SEC);
  commit({
    ...snapshot(),
    [slug]: {
      position_sec: Math.max(0, positionSec),
      duration_sec: duration,
      completed: Boolean(current?.completed) || nearEnd,
      updated_at: new Date().toISOString(),
    },
  });
}

export function markCompleted(slug: string, durationSec?: number): void {
  const current = snapshot()[slug];
  const duration = durationSec ?? current?.duration_sec ?? 0;
  commit({
    ...snapshot(),
    [slug]: {
      position_sec: duration,
      duration_sec: duration,
      completed: true,
      updated_at: new Date().toISOString(),
    },
  });
}

export function clearProgress(slug: string): void {
  const next = { ...snapshot() };
  delete next[slug];
  commit(next);
}

// ---------- React binding ----------
/** Subscribes to the shared map so cards and rings update as playback advances. */
export function useLearnProgress(): ProgressMap {
  return useSyncExternalStore(subscribe, snapshot, () => EMPTY);
}
