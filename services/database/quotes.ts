import { getDb } from './db';
import { fetchTodaysQuote } from '../quoteApi';
import { CachedQuote } from './types';
import { getDefaultArchive, getDefaultTodayQuote } from './defaultQuotes';

export async function listQuotes(limit = 30): Promise<CachedQuote[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<CachedQuote>(
    'SELECT * FROM cached_quotes ORDER BY date DESC LIMIT ?',
    [limit],
  );
  if (rows.length >= limit) return rows;

  // Fill remaining slots with bundled fallbacks for dates the cache doesn't
  // already cover — real cached entries always win for their date.
  const haveDates = new Set(rows.map(r => r.date));
  const bundled = getDefaultArchive(limit).filter(q => !haveDates.has(q.date));
  const merged = [...rows, ...bundled].slice(0, limit);
  merged.sort((a, b) => (a.date < b.date ? 1 : -1));
  return merged;
}

export async function getQuoteForDate(date: string): Promise<CachedQuote | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<CachedQuote>('SELECT * FROM cached_quotes WHERE date = ?', [
    date,
  ]);
  return row ?? null;
}

export async function getTodaysQuote(): Promise<CachedQuote | null> {
  const today = new Date().toISOString().slice(0, 10);
  const todays = await getQuoteForDate(today);
  if (todays) return todays;

  const fetched = await fetchTodaysQuote();
  if (fetched) {
    await upsertQuote({ text: fetched.text, author: fetched.author, date: today });
    const stored = await getQuoteForDate(today);
    if (stored) return stored;
  }

  const db = await getDb();
  const latest = await db.getFirstAsync<CachedQuote>(
    'SELECT * FROM cached_quotes ORDER BY date DESC LIMIT 1',
  );
  return latest ?? getDefaultTodayQuote();
}

export async function upsertQuote(quote: Omit<CachedQuote, 'id'>): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO cached_quotes (text, author, date) VALUES (?, ?, ?)
     ON CONFLICT(date) DO UPDATE SET text = excluded.text, author = excluded.author`,
    [quote.text, quote.author, quote.date],
  );
}
