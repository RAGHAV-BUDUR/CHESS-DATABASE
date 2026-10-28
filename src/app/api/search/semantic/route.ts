import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { VectorEngine } from '@/lib/chess/vector-search';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      prompt,
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

    // Check if pgvector is available
    let hasPgVector = false;
    try {
      const extCheck = await query("SELECT extname FROM pg_extension WHERE extname = 'vector';");
      hasPgVector = extCheck.rows.length > 0;
    } catch {
      hasPgVector = false;
    }

    // Generate query embedding if prompt provided
    const hasPrompt = prompt && prompt.trim().length > 0;
    let queryVectorStr: string | null = null;
    if (hasPrompt) {
      const queryVec = VectorEngine.generateEmbedding(prompt);
      queryVectorStr = VectorEngine.toPgVectorString(queryVec);
    }

    if (hasPgVector && queryVectorStr) {
      // Execute pgvector Cosine Similarity query
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
            -- Composite Hybrid Score:
            -- 60% Semantic Similarity (1 - distance)
            ROUND(((1.0 - (ge.embedding <=> $1::vector)) * 0.6)::NUMERIC, 4) +
            -- 25% Tactical Motif Exact Match Bonus
            CASE 
              WHEN $2::TEXT IS NOT NULL AND bool_or(tm.motif_name = $2) THEN 0.25 
              ELSE 0.0 
            END +
            -- 15% Master Rating Quality Weight
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
        mode: 'HYBRID_VECTOR_SEARCH',
        dimensions: VectorEngine.DIMENSIONS,
        modelName: VectorEngine.MODEL_NAME,
        data: res.rows,
        searchExplanation: {
          prompt,
          retrievalMetric: 'Cosine Distance (<=>) in pgvector',
          scoreFormula: '0.6 * SemanticSimilarity + 0.25 * MotifBonus + 0.15 * RatingQualityWeight',
        },
      });
    } else {
      // Fallback: Full-Text or Structured Filter Search
      const sql = `
        SELECT 
          g.game_id,
          g.game_date,
          g.result,
          g.move_count,
          wp.name AS white_player,
          g.white_rating,
          bp.name AS black_player,
          g.black_rating,
          o.opening_name,
          o.eco_code,
          t.name AS tournament_name,
          0.85 AS hybrid_score,
          0.15 AS cosine_distance,
          '[]'::json AS matched_motifs
        FROM games g
        JOIN players wp ON g.white_player_id = wp.player_id
        JOIN players bp ON g.black_player_id = bp.player_id
        LEFT JOIN openings o ON g.opening_id = o.opening_id
        LEFT JOIN tournaments t ON g.tournament_id = t.tournament_id
        WHERE 
          ($1::TEXT IS NULL OR o.opening_name ILIKE '%' || $1 || '%' OR wp.name ILIKE '%' || $1 || '%' OR bp.name ILIKE '%' || $1 || '%') AND
          ($2::TEXT IS NULL OR o.eco_code = $2) AND
          ($3::TEXT IS NULL OR g.result = $3)
        ORDER BY g.game_date DESC NULLS LAST
        LIMIT $4 OFFSET $5;
      `;

      const res = await query(sql, [
        prompt || null,
        openingEco || null,
        result || null,
        limit,
        offset,
      ]);

      return NextResponse.json({
        success: true,
        mode: 'STRUCTURED_FALLBACK_SEARCH',
        data: res.rows,
        message: hasPgVector ? 'Structured query executed' : 'pgvector extension not enabled; using structured fallback',
      });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

