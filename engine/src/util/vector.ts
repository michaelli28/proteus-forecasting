/**
 * Cosine similarity between two equal-length vectors, in [-1, 1].
 *
 * Returns 0 — not NaN, and not a thrown error — for mismatched lengths, empty
 * input, or a zero vector. Agreement metrics average this across many pairs, and
 * a single NaN silently poisons the whole average; 0 says "these two tell us
 * nothing about each other", which is the honest reading of a degenerate pair.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] ** 2;
    normB += b[i] ** 2;
  }
  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;
  return dotProduct / denominator;
}
