import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { VectorEngine } from '@/lib/chess/vector-search';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      prompt = '',
      motif,
      openingEco,
      playerName,
      result,
      minRating,
      maxRating,
      limit = 15,
      page = 1,
    } = body;

    const offset = (Math.max(1, page) - 1) * limit;

    // Check if pgvector extension is available in PostgreSQL
    let hasPgVector = false;
    try {
      const extCheck = await query("SELECT extname FROM pg_extension WHERE extname = 'vector';");
      hasPgVector = extCheck.rows.length > 0;
    } catch {
      hasPgVector = false;
    }

    const hasPrompt = prompt && prompt.trim().length > 0;
    const queryVec = hasPrompt ? VectorEngine.generateEmbedding(prompt) : null;
    const queryVectorStr = queryVec ? VectorEngine.toPgVectorString(queryVec) : null;

    if (hasPgVector && queryVectorStr) {
      // Branch 1: PostgreSQL Native pgvector Cosine Hybrid Search
      const sql = `
        SELECT 
          g.game_id,
          g.game_date,
          g.result,
          g.move_count,
          wp.player_id AS white_player_id,
          wp.name AS white_player,
          g.white_rating,
          bp.player_id AS black_player_id,
          bp.name AS black_player,
          g.black_rating,
          o.opening_name,
          o.eco_code,
          t.name AS tournament_name,
          ge.source_text,
          ROUND((ge.embedding <=> $1::vector)::NUMERIC, 4) AS cosine_distance,
          ROUND((1.0 - (ge.embedding <=> $1::vector))::NUMERIC, 4) AS similarity_score,
          COALESCE(
            json_agg(
              DISTINCT jsonb_build_object('name', tm.motif_name, 'rationale', gm.rationale)
            ) FILTER (WHERE tm.motif_name IS NOT NULL), '[]'
          ) AS matched_motifs,
          (
            ROUND(((1.0 - (ge.embedding <=> $1::vector)) * 0.6)::NUMERIC, 4) +
            CASE 
              WHEN $2::TEXT IS NOT NULL AND bool_or(tm.motif_name = $2) THEN 0.25 
              ELSE 0.0 
            END +
            ROUND((LEAST(COALESCE((g.white_rating + g.black_rating) / 2, 2200), 2800) / 2800.0 * 0.15)::NUMERIC, 4)
          ) AS hybrid_score
        FROM games g
        JOIN players wp ON g.white_player_id = wp.player_id
        JOIN players bp ON g.black_player_id = bp.player_id
        LEFT JOIN openings o ON g.opening_id = o.opening_id
        LEFT JOIN tournaments t ON g.tournament_id = t.tournament_id
        JOIN game_embeddings ge ON g.game_id = ge.game_id
        LEFT JOIN game_motifs gm ON g.game_id = gm.game_id
        LEFT JOIN tactical_motifs tm ON gm.motif_id = tm.motif_id
        WHERE 
          ($2::TEXT IS NULL OR EXISTS (
            SELECT 1 FROM game_motifs gm3 
            JOIN tactical_motifs tm3 ON gm3.motif_id = tm3.motif_id 
            WHERE gm3.game_id = g.game_id AND tm3.motif_name = $2
          )) AND
          ($3::TEXT IS NULL OR o.eco_code = $3) AND
          ($4::TEXT IS NULL OR wp.name ILIKE '%' || $4 || '%' OR bp.name ILIKE '%' || $4 || '%') AND
          ($5::TEXT IS NULL OR g.result = $5) AND
          ($6::INT IS NULL OR (g.white_rating >= $6 AND g.black_rating >= $6)) AND
          ($7::INT IS NULL OR (g.white_rating <= $7 AND g.black_rating <= $7))
        GROUP BY g.game_id, wp.player_id, wp.name, bp.player_id, bp.name, o.opening_name, o.eco_code, t.name, ge.source_text, ge.embedding
        ORDER BY hybrid_score DESC, similarity_score DESC
        LIMIT $8 OFFSET $9;
      `;

      const res = await query(sql, [
        queryVectorStr,
        motif || null,
        openingEco || null,
        playerName || null,
        result || null,
        minRating ? parseInt(minRating, 10) : null,
        maxRating ? parseInt(maxRating, 10) : null,
        limit,
        offset,
      ]);

      return NextResponse.json({
        success: true,
        mode: 'POSTGRES_PGVECTOR_HYBRID',
        dimensions: VectorEngine.DIMENSIONS,
        modelName: VectorEngine.MODEL_NAME,
        data: res.rows,
        searchExplanation: {
          prompt,
          retrievalMetric: 'pgvector <=> Cosine Operator',
          scoreFormula: '0.6 * SemanticSimilarity + 0.25 * MotifBonus + 0.15 * RatingWeight',
        },
      });
    }

    // Branch 2: Fast In-Memory Cosine Vector Search & Tactical Motif Matching
    // Retrieves candidate games and computes high-speed 384-dimensional cosine similarity
    const fetchSql = `
      SELECT 
        g.game_id,
        g.game_date,
        g.result,
        g.move_count,
        wp.player_id AS white_player_id,
        wp.name AS white_player,
        g.white_rating,
        bp.player_id AS black_player_id,
        bp.name AS black_player,
        g.black_rating,
        o.opening_name,
        o.eco_code,
        t.name AS tournament_name,
        ge.source_text,
        ge.embedding,
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object('name', tm.motif_name, 'rationale', gm.rationale)
          ) FILTER (WHERE tm.motif_name IS NOT NULL), '[]'
        ) AS matched_motifs
      FROM games g
      JOIN players wp ON g.white_player_id = wp.player_id
      JOIN players bp ON g.black_player_id = bp.player_id
      LEFT JOIN openings o ON g.opening_id = o.opening_id
      LEFT JOIN tournaments t ON g.tournament_id = t.tournament_id
      LEFT JOIN game_embeddings ge ON g.game_id = ge.game_id
      LEFT JOIN game_motifs gm ON g.game_id = gm.game_id
      LEFT JOIN tactical_motifs tm ON gm.motif_id = tm.motif_id
      WHERE 
        ($1::TEXT IS NULL OR EXISTS (
          SELECT 1 FROM game_motifs gm2 
          JOIN tactical_motifs tm2 ON gm2.motif_id = tm2.motif_id 
          WHERE gm2.game_id = g.game_id AND tm2.motif_name ILIKE '%' || $1 || '%'
        )) AND
        ($2::TEXT IS NULL OR o.eco_code = $2) AND
        ($3::TEXT IS NULL OR wp.name ILIKE '%' || $3 || '%' OR bp.name ILIKE '%' || $3 || '%') AND
        ($4::TEXT IS NULL OR g.result = $4) AND
        ($5::INT IS NULL OR (COALESCE(g.white_rating, 0) >= $5 AND COALESCE(g.black_rating, 0) >= $5)) AND
        ($6::INT IS NULL OR (COALESCE(g.white_rating, 9999) <= $6 AND COALESCE(g.black_rating, 9999) <= $6))
      GROUP BY g.game_id, wp.player_id, wp.name, bp.player_id, bp.name, o.opening_name, o.eco_code, t.name, ge.source_text, ge.embedding;
    `;

    const res = await query(fetchSql, [
      motif || null,
      openingEco || null,
      playerName || null,
      result || null,
      minRating ? parseInt(minRating, 10) : null,
      maxRating ? parseInt(maxRating, 10) : null,
    ]);

    const promptTokens = prompt.toLowerCase().split(/\s+/).filter((t: string) => t.length > 2);

    const scoredGames = res.rows.map((row: any) => {
      let sim = 0;
      if (queryVec && row.embedding) {
        try {
          const embArr = typeof row.embedding === 'string' ? JSON.parse(row.embedding) : row.embedding;
          if (Array.isArray(embArr)) {
            sim = VectorEngine.cosineSimilarity(queryVec, embArr);
          }
        } catch {
          sim = 0;
        }
      }

      // Keyword match bonus in source text
      let keywordBonus = 0;
      const lowerSource = (row.source_text || '').toLowerCase();
      for (const token of promptTokens) {
        if (lowerSource.includes(token)) {
          keywordBonus += 0.05;
        }
      }

      // Exact motif match bonus
      const matchedList = Array.isArray(row.matched_motifs) ? row.matched_motifs : [];
      const hasSelectedMotif = motif && matchedList.some((m: any) => m.name.toLowerCase().includes(motif.toLowerCase()));
      const motifBonus = hasSelectedMotif ? 0.25 : 0;

      // Rating quality score
      const avgRating = ((row.white_rating || 1500) + (row.black_rating || 1500)) / 2;
      const ratingWeight = (Math.min(avgRating, 2800) / 2800) * 0.15;

      // Composite hybrid score (0 to 1.0)
      const baseSim = queryVec ? sim : 0.5;
      const hybridScore = Number(Math.min(1.0, (baseSim * 0.6) + motifBonus + keywordBonus + ratingWeight).toFixed(4));
      const cosineDist = Number((1.0 - Math.max(0, sim)).toFixed(4));

      return {
        game_id: row.game_id,
        game_date: row.game_date,
        result: row.result,
        move_count: row.move_count,
        white_player_id: row.white_player_id,
        white_player: row.white_player,
        white_rating: row.white_rating,
        black_player_id: row.black_player_id,
        black_player: row.black_player,
        black_rating: row.black_rating,
        opening_name: row.opening_name,
        eco_code: row.eco_code,
        tournament_name: row.tournament_name,
        source_text: row.source_text,
        cosine_distance: cosineDist,
        similarity_score: Number(Math.max(0, sim).toFixed(4)),
        hybrid_score: hybridScore,
        matched_motifs: matchedList,
      };
    });

    // Rank by composite hybrid score descending
    scoredGames.sort((a: any, b: any) => b.hybrid_score - a.hybrid_score);

    const paginated = scoredGames.slice(offset, offset + limit);

    return NextResponse.json({
      success: true,
      mode: 'HYBRID_VECTOR_SEMANTIC_SEARCH',
      dimensions: VectorEngine.DIMENSIONS,
      modelName: VectorEngine.MODEL_NAME,
      totalCount: scoredGames.length,
      data: paginated,
      searchExplanation: {
        prompt: prompt || 'All Games',
        retrievalMetric: 'VectorEngine Cosine Similarity (384-dim) + Motif Exact Match',
        scoreFormula: '0.6 * VectorSimilarity + 0.25 * MotifBonus + 0.15 * RatingWeight',
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
