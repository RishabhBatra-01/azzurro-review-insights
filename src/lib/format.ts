import type { DateRange } from '../insights/weeks';

const dayMonth = new Intl.DateTimeFormat('en-AU', {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC', // ranges are plain calendar dates, not instants
});

/** "16 Nov – 22 Nov" — stated in full so nobody has to guess the week. */
export function formatRange(range: DateRange): string {
  const start = new Date(`${range.start}T00:00:00Z`);
  const end = new Date(`${range.end}T00:00:00Z`);
  return `${dayMonth.format(start)} – ${dayMonth.format(end)}`;
}

export function formatDateLong(iso: string): string {
  return new Intl.DateTimeFormat('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${iso}T00:00:00Z`));
}

/**
 * "today" / "yesterday" / "3 days ago" / a date once it is far enough back.
 *
 * Both sides are plain Sydney calendar dates, so this is day arithmetic, not
 * instant arithmetic — no timezone conversion happens here.
 */
export function formatRelativeDay(iso: string, today: string): string {
  const days = Math.round(
    (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${iso}T00:00:00Z`)) / 86_400_000,
  );
  if (!Number.isFinite(days) || days < 0) return formatDateLong(iso);
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  return formatDateLong(iso);
}

/** "Olympic Hotel Paddington" -> "Paddington"; "Potts Point" -> "Potts". */
export function shortLabel(name: string): string {
  const words = name.split(/\s+/).filter(Boolean);
  if (words.length >= 3) return words[words.length - 1] ?? name;
  return words[0] ?? name;
}

/**
 * "just now" / "12 min ago" / "3 h ago" / "2 days ago", for instants such as a
 * collection run finishing. Unlike formatRelativeDay this is instant
 * arithmetic, because a run happens at a moment, not on a calendar day.
 */
export function formatRelativeTime(iso: string, now: Date): string {
  const minutes = Math.floor((now.getTime() - Date.parse(iso)) / 60_000);
  if (!Number.isFinite(minutes)) return 'unknown';
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}
