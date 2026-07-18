// Trigger a browser file download from an in-memory Blob (used by CSV exports
// that must ride the auth Bearer header, so a plain <a href> won't do).
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke on the next tick so the click has time to start the download.
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
