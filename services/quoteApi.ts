// ZenQuotes returns one "quote of the day" per calendar day, no API key required.
// Free tier: 5 requests / 30s per IP. Docs: https://docs.zenquotes.io/zenquotes-documentation/
const TODAY_URL = 'https://zenquotes.io/api/today';
const RANDOM_URL = 'https://zenquotes.io/api/random';

interface ZenQuote {
  q: string;
  a: string;
}

export interface FetchedQuote {
  text: string;
  author: string;
}

async function fetchFrom(url: string): Promise<FetchedQuote | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = (await res.json()) as ZenQuote[] | undefined;
    const first = Array.isArray(data) ? data[0] : undefined;
    if (!first?.q) return null;
    return { text: first.q.trim(), author: (first.a || 'Unknown').trim() };
  } catch {
    return null;
  }
}

export async function fetchTodaysQuote(): Promise<FetchedQuote | null> {
  return (await fetchFrom(TODAY_URL)) ?? (await fetchFrom(RANDOM_URL));
}

export async function fetchRandomQuote(): Promise<FetchedQuote | null> {
  return fetchFrom(RANDOM_URL);
}
