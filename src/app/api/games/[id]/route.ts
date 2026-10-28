import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const gameId = parseInt(params.id, 10);
    if (isNaN(gameId)) {
      return NextResponse.json({ error: 'Invalid game ID' }, { status: 400 });
    }

    // 1. Fetch Game Record
    const gameRes = await query(`
      SELECT 
        g.game_id,
        g.game_date,
        g.result,
        g.round,
        g.pgn,
        g.move_count,
        g.white_rating,
        g.black_rating,
        g.termination,
        wp.player_id AS white_player_id,
        wp.name AS white_player,
        wp.country AS white_country,
        bp.player_id AS black_player_id,
        bp.name AS black_player,
        bp.country AS black_country,
        o.opening_id,
        o.opening_name,
        o.eco_code,
        o.description AS opening_description,
        t.tournament_id,
        t.name AS tournament_name,
        t.location AS tournament_location
      FROM games g
      JOIN players wp ON g.white_player_id = wp.player_id
      JOIN players bp ON g.black_player_id = bp.player_id
      LEFT JOIN openings o ON g.opening_id = o.opening_id
      LEFT JOIN tournaments t ON g.tournament_id = t.tournament_id
      WHERE g.game_id = $1
    `, [gameId]);

    if (gameRes.rows.length === 0) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }

    const game = gameRes.rows[0];

    // 2. Fetch Move List
    const movesRes = await query(`
      SELECT 
        move_id,
        move_number,
        color,
        san,
        uci,
        fen_after,
        evaluation,
        is_check,
        is_capture
      FROM moves
      WHERE game_id = $1
      ORDER BY move_number ASC, color DESC
    `, [gameId]);

    // 3. Fetch Game Motifs
    const motifsRes = await query(`
      SELECT 
        gm.id,
        gm.move_number,
        gm.color,
        gm.move_san,
        gm.fen_position,
        gm.material_change,
        gm.rationale,
        gm.confidence,
        tm.motif_name,
        tm.category,
        tm.description AS motif_description
      FROM game_motifs gm
      JOIN tactical_motifs tm ON gm.motif_id = tm.motif_id
      WHERE gm.game_id = $1
      ORDER BY gm.move_number ASC
    `, [gameId]);

    // 4. Fetch Annotations
    const annotationsRes = await query(`
      SELECT 
        annotation_id,
        move_id,
        comment,
        nag
      FROM game_annotations
      WHERE game_id = $1
    `, [gameId]);

    return NextResponse.json({
      success: true,
      game,
      moves: movesRes.rows,
      motifs: motifsRes.rows,
      annotations: annotationsRes.rows,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

