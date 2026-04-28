import { getDb } from './db';
import { CachedQuote } from './types';

export async function listQuotes(limit = 30): Promise<CachedQuote[]> {
  const db = await getDb();
  return db.getAllAsync<CachedQuote>(
    'SELECT * FROM cached_quotes ORDER BY date DESC LIMIT ?',
    [limit],
  );
}

export async function getQuoteForDate(date: string): Promise<CachedQuote | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<CachedQuote>(
    'SELECT * FROM cached_quotes WHERE date = ?',
    [date],
  );
  return row ?? null;
}

export async function getTodaysQuote(): Promise<CachedQuote | null> {
  const today = new Date().toISOString().slice(0, 10);
  const todays = await getQuoteForDate(today);
  if (todays) return todays;
  const db = await getDb();
  return (
    (await db.getFirstAsync<CachedQuote>(
      'SELECT * FROM cached_quotes ORDER BY date DESC LIMIT 1',
    )) ?? null
  );
}

export async function upsertQuote(quote: Omit<CachedQuote, 'id'>): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO cached_quotes (text, author, date) VALUES (?, ?, ?)
     ON CONFLICT(date) DO UPDATE SET text = excluded.text, author = excluded.author`,
    [quote.text, quote.author, quote.date],
  );
}
