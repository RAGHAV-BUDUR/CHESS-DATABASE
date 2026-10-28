/**
 * ChessBase Vector Embedding & Semantic Search Engine
 * DBMS Experiential Learning - Level 3 Project
 * Authors: Raghav Budur (PES1UG23AM225) & Prithviraj K (PES1UG24AM204)
 * 
 * Implements deterministic 384-dimensional text embeddings for pgvector,
 * cosine similarity calculation, and hybrid search ranking.
 */

export class VectorEngine {
  public static readonly DIMENSIONS = 384;
  public static readonly MODEL_NAME = 'ChessBase-Semantic-384-Deterministic';

  /**
   * Deterministic semantic embedding generator.
   * Produces a unit-normalized (L2 norm = 1.0) 384-dimensional vector
   * utilizing token-frequency, subword character n-grams, and domain-specific
   * chess semantic feature projections.
   */
  public static generateEmbedding(text: string): number[] {
    const vector = new Array(this.DIMENSIONS).fill(0);
    if (!text || text.trim().length === 0) {
      return vector;
    }

    const cleaned = text.toLowerCase().replace(/[^a-z0-9\s-]/g, ' ');
    const tokens = cleaned.split(/\s+/).filter(t => t.length > 0);

    // Chess domain vocabulary weights
    const domainWeights: Record<string, number> = {
      queen: 2.5,
      sacrifice: 3.0,
      mate: 3.5,
      checkmate: 4.0,
      attack: 2.0,
      kingside: 2.2,
      queenside: 2.2,
      storm: 2.8,
      pawn: 1.5,
      fork: 3.0,
      knight: 2.0,
      pin: 2.8,
      skewer: 2.8,
      castling: 1.8,
      sicilian: 2.0,
      defense: 1.5,
      gambit: 2.5,
      endgame: 2.0,
      blunder: 2.5,
      brilliancy: 3.0,
      tactical: 2.0,
      discovered: 2.5
    };

    // 1. Unigram feature projection
    for (const token of tokens) {
      const weight = domainWeights[token] || 1.0;
      const hash1 = this.hashString(token, 1337);
      const hash2 = this.hashString(token, 7331);
      
      const idx1 = Math.abs(hash1) % this.DIMENSIONS;
      const idx2 = Math.abs(hash2) % this.DIMENSIONS;
      const sign1 = (hash1 & 1) === 0 ? 1 : -1;
      const sign2 = (hash2 & 1) === 0 ? 1 : -1;

      vector[idx1] += sign1 * weight;
      vector[idx2] += sign2 * (weight * 0.5);
    }

    // 2. Bigram context projection (captures phrases like "queen sacrifice", "pawn storm")
    for (let i = 0; i < tokens.length - 1; i++) {
      const bigram = `${tokens[i]}_${tokens[i + 1]}`;
      const hash = this.hashString(bigram, 4242);
      const idx = Math.abs(hash) % this.DIMENSIONS;
      const sign = (hash & 1) === 0 ? 1 : -1;
      vector[idx] += sign * 2.0;
    }

    // 3. Trigram character n-grams for typo resilience
    for (const token of tokens) {
      if (token.length >= 3) {
        for (let i = 0; i <= token.length - 3; i++) {
          const tri = token.slice(i, i + 3);
          const hash = this.hashString(tri, 9999);
          const idx = Math.abs(hash) % this.DIMENSIONS;
          const sign = (hash & 1) === 0 ? 0.2 : -0.2;
          vector[idx] += sign;
        }
      }
    }

    // 4. L2 Normalization (ensures cosine distance <=> works accurately in pgvector)
    let sumSq = 0;
    for (let i = 0; i < this.DIMENSIONS; i++) {
      sumSq += vector[i] * vector[i];
    }
    const norm = Math.sqrt(sumSq);

    if (norm > 0) {
      for (let i = 0; i < this.DIMENSIONS; i++) {
        vector[i] = parseFloat((vector[i] / norm).toFixed(6));
      }
    }

    return vector;
  }

  /**
   * Format vector as PostgreSQL pgvector string: '[0.123, -0.456, ...]'
   */
  public static toPgVectorString(vec: number[]): string {
    return `[${vec.join(',')}]`;
  }

  /**
   * Calculate local cosine similarity between two vectors (for client-side fallback or testing)
   */
  public static cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length) return 0;
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < vecA.length; i++) {
      dot += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Calculate cosine distance (1 - similarity) matching PostgreSQL pgvector <=> operator
   */
  public static cosineDistance(vecA: number[], vecB: number[]): number {
    return Math.max(0, 1 - this.cosineSimilarity(vecA, vecB));
  }

  /**
   * 32-bit FNV-1a hash variant with seed
   */
  private static hashString(str: string, seed: number): number {
    let h = 0x811c9dc5 ^ seed;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return h;
  }
}

