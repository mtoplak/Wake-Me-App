/**
 * Helpers for comparing speech recognition text to the expected phrase.
 * ASR is imperfect — we avoid requiring an exact string match.
 */

/** Lowercase, strip most punctuation, collapse spaces. */
export function normalizeForVoiceMatch(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^\p{L}\p{N}\s'-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const MIN_TOKEN_LEN = 2;

/**
 * True if `transcript` likely contains the same content as `expectedPhrase`.
 * Strategy: every "significant" word in the expected phrase must appear as a
 * substring of the normalized transcript (handles reordering and extra words).
 */
export function transcriptMatchesPhrase(transcript: string, expectedPhrase: string): boolean {
  const t = normalizeForVoiceMatch(transcript);
  const e = normalizeForVoiceMatch(expectedPhrase);
  if (!e.length) return false;
  if (t.includes(e)) return true;

  const tokens = e.split(' ').filter(w => w.length >= MIN_TOKEN_LEN);
  if (tokens.length === 0) return t.includes(e.replace(/\s/g, ''));

  return tokens.every(word => t.includes(word));
}
