import { countTokens } from '../utils/helpers.js';

/**
 * Simple seeded pseudo-random number generator (mulberry32).
 * Produces deterministic results for the same seed.
 */
function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Generate a deterministic embedding vector for a given input text.
 * Same text always produces the same vector.
 *
 * @param text - Input text to embed
 * @param dimensions - Number of embedding dimensions (default 1536)
 * @returns Normalized embedding vector
 */
export function generateEmbedding(text: string, dimensions: number = 1536): number[] {
  // Create a seed from the input text
  let seed = 0;
  for (let i = 0; i < text.length; i++) {
    seed = (seed * 31 + text.charCodeAt(i)) | 0;
  }

  const rng = mulberry32(seed);
  const vector: number[] = [];

  // Generate random values and normalize to unit length
  let sumSq = 0;
  for (let i = 0; i < dimensions; i++) {
    // Box-Muller transform for normal distribution
    const u1 = rng();
    const u2 = rng();
    const z = Math.sqrt(-2.0 * Math.log(u1 + 0.0001)) * Math.cos(2.0 * Math.PI * u2);
    vector.push(z);
    sumSq += z * z;
  }

  // L2 normalize
  const norm = Math.sqrt(sumSq);
  for (let i = 0; i < dimensions; i++) {
    vector[i] = vector[i] / norm;
  }

  return vector;
}

/**
 * Get the default embedding dimensions for a given model name.
 */
export function getEmbeddingDimensions(model: string): number {
  if (model.includes('3-large')) return 3072;
  return 1536; // default for text-embedding-3-small, text-embedding-ada-002, etc.
}

/**
 * Calculate prompt tokens for embeddings input.
 */
export function countEmbeddingTokens(input: string | string[]): number {
  if (Array.isArray(input)) {
    return input.reduce((sum, text) => sum + countTokens(text), 0);
  }
  return countTokens(input);
}
