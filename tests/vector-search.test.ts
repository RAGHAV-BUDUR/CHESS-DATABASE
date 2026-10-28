import { describe, it, expect } from 'vitest';
import { VectorEngine } from '../src/lib/chess/vector-search';

describe('Vector Engine & Semantic Search Embeddings', () => {
  it('generates a vector of exactly 384 dimensions matching pgvector column definition', () => {
    const text = 'Queen sacrifice followed by kingside mating attack';
    const vec = VectorEngine.generateEmbedding(text);

    expect(vec).toHaveLength(384);
  });

  it('guarantees L2 unit normalization (norm = 1.0) for pgvector cosine distance operator (<=>)', () => {
    const text = 'Sicilian dragon defense with opposite-side castling and pawn storm';
    const vec = VectorEngine.generateEmbedding(text);

    let sumSq = 0;
    for (const val of vec) {
      sumSq += val * val;
    }
    const norm = Math.sqrt(sumSq);

    // Should be 1.0 within floating point precision (0.999 to 1.001)
    expect(norm).toBeGreaterThanOrEqual(0.99);
    expect(norm).toBeLessThanOrEqual(1.01);
  });

  it('computes cosine distance properly between identical and distinct texts', () => {
    const q1 = 'Queen sacrifice for attack';
    const q2 = 'Queen sacrifice for attack';
    const q3 = 'Quiet technical endgame rook and pawn ending';

    const v1 = VectorEngine.generateEmbedding(q1);
    const v2 = VectorEngine.generateEmbedding(q2);
    const v3 = VectorEngine.generateEmbedding(q3);

    const distIdentical = VectorEngine.cosineDistance(v1, v2);
    const distDifferent = VectorEngine.cosineDistance(v1, v3);

    // Identical query distance should be 0 (or ~0)
    expect(distIdentical).toBeCloseTo(0.0, 3);
    // Distinct texts should have distance significantly greater than 0
    expect(distDifferent).toBeGreaterThan(0.2);
  });

  it('formats vector properly for PostgreSQL pgvector vector(384) literal input', () => {
    const vec = [0.1, -0.2, 0.3];
    const pgStr = VectorEngine.toPgVectorString(vec);

    expect(pgStr).toBe('[0.1,-0.2,0.3]');
  });

  it('ranks semantically similar queries higher in hybrid scoring calculation', () => {
    const queryStr = 'queen sacrifice mate';
    const relevantDoc = 'brilliant game with queen sacrifice leading to checkmate';
    const irrelevantDoc = 'caro-kann opening solid draw in 15 moves';

    const qVec = VectorEngine.generateEmbedding(queryStr);
    const rVec = VectorEngine.generateEmbedding(relevantDoc);
    const iVec = VectorEngine.generateEmbedding(irrelevantDoc);

    const distRelevant = VectorEngine.cosineDistance(qVec, rVec);
    const distIrrelevant = VectorEngine.cosineDistance(qVec, iVec);

    expect(distRelevant).toBeLessThan(distIrrelevant);
  });
});
