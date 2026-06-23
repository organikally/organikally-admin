import { HttpError } from '@/api/http';

export function errorMessage(e: unknown): string {
  if (e instanceof HttpError) {
    if (typeof e.detail === 'string') return e.detail;
    if (Array.isArray(e.detail)) {
      return e.detail.map((d) => `${d.loc?.slice(-1)?.[0] ?? ''} ${d.msg}`.trim()).join('; ');
    }
    return e.message;
  }
  if (e instanceof Error) return e.message;
  return 'Unexpected error';
}
