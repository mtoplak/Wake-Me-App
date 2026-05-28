import type { CachedQuote } from './types';

/**
 * Bundled fallback quotes. Surfaced only when the SQLite cache is empty AND
 * the ZenQuotes fetch fails — typical of a fresh install with no network. Once
 * the device gets online and getTodaysQuote() persists a real quote for the
 * date, the bundled entry is filtered out (real cache wins, see listQuotes).
 */
const DEFAULT_QUOTES: readonly { text: string; author: string }[] = [
  { text: 'The secret of getting ahead is getting started.', author: 'Mark Twain' },
  {
    text: 'What you do every day matters more than what you do once in a while.',
    author: 'Gretchen Rubin',
  },
  { text: 'Either you run the day, or the day runs you.', author: 'Jim Rohn' },
  {
    text: 'Lose an hour in the morning, and you will spend all day looking for it.',
    author: 'Richard Whately',
  },
  { text: 'The way to get started is to quit talking and begin doing.', author: 'Walt Disney' },
  { text: 'Small daily improvements over time lead to stunning results.', author: 'Robin Sharma' },
  {
    text: 'You don’t have to be great to start, but you have to start to be great.',
    author: 'Zig Ziglar',
  },
  {
    text: 'Discipline is choosing between what you want now and what you want most.',
    author: 'Abraham Lincoln',
  },
  { text: 'An early-morning walk is a blessing for the whole day.', author: 'Henry David Thoreau' },
  { text: 'Don’t count the days, make the days count.', author: 'Muhammad Ali' },
];

function dayIndex(d: Date): number {
  // Days since UTC epoch. Stable across timezone shifts within a day so the
  // displayed "today" quote doesn't flip after midnight in DST edge cases.
  return Math.floor(d.getTime() / 86_400_000);
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function pick(slot: number, date: Date): CachedQuote {
  const len = DEFAULT_QUOTES.length;
  const q = DEFAULT_QUOTES[((slot % len) + len) % len];
  // Negative synthetic ids derived from the day index — unique per date, won't
  // collide with AUTOINCREMENT rows (always positive), and stay distinct across
  // an archive longer than DEFAULT_QUOTES (avoids React duplicate-key errors).
  return {
    id: -(slot + 1),
    text: q.text,
    author: q.author,
    date: isoDate(date),
  };
}

export function getDefaultTodayQuote(): CachedQuote {
  const today = new Date();
  return pick(dayIndex(today), today);
}

export function getDefaultArchive(count: number): CachedQuote[] {
  const today = new Date();
  const todayIdx = dayIndex(today);
  const out: CachedQuote[] = [];
  for (let i = 1; i <= count; i++) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    out.push(pick(todayIdx - i, d));
  }
  return out;
}
