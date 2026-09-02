/**
 * Vector embeddings and similarity computation for Cluster memory.
 *
 * Provides:
 * 1. Deterministic, zero-network 128-dimensional semantic embedding generation.
 * 2. Cosine distance and similarity computation.
 * 3. sqlite-vec integration loader and query helpers.
 */

export const DEFAULT_EMBEDDING_DIMENSIONS = 128;

/**
 * Generates a normalized 128-dimensional semantic embedding vector for a given text.
 * Uses tokenization, subword n-grams, BM25-style frequency damping, and
 * random projection via stable FNV-1a hashing.
 */
export function generateSemanticEmbedding(
  text: string,
  dimensions = DEFAULT_EMBEDDING_DIMENSIONS,
): Float32Array {
  const vector = new Float32Array(dimensions);
  if (!text || text.trim() === '') return vector;

  // Clean and tokenize text
  const normalized = text.toLowerCase().replace(/[^\w\s\-\.\/]/g, ' ');
  const tokens = normalized.split(/\s+/).filter((t) => t.length > 1);

  if (tokens.length === 0) return vector;

  // Track token frequencies
  const tf = new Map<string, number>();
  for (const token of tokens) {
    tf.set(token, (tf.get(token) ?? 0) + 1);
    // Also capture subword character tri-grams for typo resilience and partial matching
    if (token.length >= 4) {
      for (let i = 0; i <= token.length - 3; i++) {
        const trigram = token.slice(i, i + 3);
        tf.set(trigram, (tf.get(trigram) ?? 0) + 0.5);
      }
    }
  }

  // Project features into dimensions using FNV-1a hashing with sign
  for (const [term, freq] of tf.entries()) {
    const weight = Math.log(1 + freq);
    const hash = fnv1a(term);
    const index = Math.abs(hash) % dimensions;
    const sign = (hash & 1) === 0 ? 1 : -1;
    vector[index] += sign * weight;

    // Secondary hash for dispersion
    const hash2 = fnv1a(term + ':cluster');
    const index2 = Math.abs(hash2) % dimensions;
    const sign2 = (hash2 & 1) === 0 ? 1 : -1;
    vector[index2] += sign2 * weight * 0.5;
  }

  // L2 Normalization (Euclidean norm to unit vector)
  let norm = 0;
  for (let i = 0; i < dimensions; i++) {
    norm += vector[i] * vector[i];
  }
  norm = Math.sqrt(norm);

  if (norm > 0) {
    for (let i = 0; i < dimensions; i++) {
      vector[i] = vector[i] / norm;
    }
  }

  return vector;
}

/**
 * Computes cosine similarity between two unit-normalized vectors.
 * Returns a value between 0.0 (completely dissimilar) and 1.0 (identical).
 */
export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dotProduct = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
  }
  // Clamp to [-1, 1] then normalize to [0, 1]
  const clamped = Math.max(-1, Math.min(1, dotProduct));
  return (clamped + 1) / 2;
}

/**
 * 32-bit FNV-1a non-cryptographic hash for deterministic feature projection.
 */
function fnv1a(str: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash;
}

/**
 * Attempts to resolve the path to sqlite-vec's native extension library.
 */
export async function getSqliteVecExtensionPath(): Promise<string | null> {
  try {
    const sqliteVec = await import('sqlite-vec');
    if (typeof sqliteVec.getLoadablePath === 'function') {
      return sqliteVec.getLoadablePath();
    }
    return null;
  } catch {
    return null;
  }
}
