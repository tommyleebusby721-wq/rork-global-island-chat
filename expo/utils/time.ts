export function formatTime(timestamp: number): string {
  const d = new Date(timestamp);
  let h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m.toString().padStart(2, '0')} ${ampm}`;
}

export function formatRemaining(expiresAt: number, now: number): string {
  const diff = Math.max(0, expiresAt - now);
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (h > 0) return `${h}h left`;
  return `${m}m left`;
}
