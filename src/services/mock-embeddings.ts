import { countTokens } from '../utils/helpers.js';

/**
 * 基于种子的伪随机数生成器 (mulberry32)。
 * 相同的种子产生相同的随机序列。
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
 * 为指定文本生成确定性 embedding 向量。
 * 相同输入始终产生相同的向量。
 *
 * @param text - 输入文本
 * @param dimensions - embedding 向量维度（默认 1536）
 * @returns L2 归一化的 embedding 向量
 */
export function generateEmbedding(text: string, dimensions: number = 1536): number[] {
  // 从输入文本创建种子
  let seed = 0;
  for (let i = 0; i < text.length; i++) {
    seed = (seed * 31 + text.charCodeAt(i)) | 0;
  }

  const rng = mulberry32(seed);
  const vector: number[] = [];

  // 生成随机值并归一化到单位长度
  let sumSq = 0;
  for (let i = 0; i < dimensions; i++) {
    // Box-Muller 变换：将均匀分布转换为正态分布
    const u1 = rng();
    const u2 = rng();
    const z = Math.sqrt(-2.0 * Math.log(u1 + 0.0001)) * Math.cos(2.0 * Math.PI * u2);
    vector.push(z);
    sumSq += z * z;
  }

  // L2 归一化
  const norm = Math.sqrt(sumSq);
  for (let i = 0; i < dimensions; i++) {
    vector[i] = vector[i] / norm;
  }

  return vector;
}

/**
 * 根据模型名称返回默认的 embedding 维度。
 */
export function getEmbeddingDimensions(model: string): number {
  if (model.includes('3-large')) return 3072;
  return 1536; // text-embedding-3-small / text-embedding-ada-002 等默认值
}

/**
 * 计算 embedding 输入的 prompt token 数。
 */
export function countEmbeddingTokens(input: string | string[]): number {
  if (Array.isArray(input)) {
    return input.reduce((sum, text) => sum + countTokens(text), 0);
  }
  return countTokens(input);
}
