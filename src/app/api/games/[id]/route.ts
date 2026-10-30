import { NextRequest, NextResponse } from 'next/server';
import { query, withTransaction } from '@/lib/db';
import { PGNParser } from '@/lib/chess/pgn-parser';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const gameId = parseInt(params.id, 10);
    if (isNaN(gameId)) {
      return NextResponse.json({ error: 'Invalid game ID' }, { status: 400 });
    }

    // 1. Fetch game details with joined player, opening, and tournament data
    const gameRes = await query(`
      SELECT 
        g.game_id,
        g.game_date,
        g.result,
        g.move_count,
        g.round,
        g.pgn,
        g.white_rating,
        g.black_rating,
        g.termination,
        g.imported_at,
        wp.player_id AS white_player_id,
        wp.name AS white_player,
        wp.fide_rating AS white_player_fide,
        wp.title AS white_player_title,
        bp.player_id AS black_player_id,
        bp.name AS black_player,
        bp.fide_rating AS black_player_fide,
        bp.title AS black_player_title,
        o.opening_id,
        o.opening_name,
        o.eco_code,
        t.tournament_id,
        t.name AS tournament_name,
        t.location AS tournament_location
      FROM games g
      JOIN players wp ON g.white_player_id = wp.player_id
      JOIN players bp ON g.black_player_id = bp.player_id
      LEFT JOIN openings o ON g.opening_id = o.opening_id
      LEFT JOIN tournaments t ON g.tournament_id = t.tournament_id
      WHERE g.game_id = $1;
    `, [gameId]);

    if (gameRes.rows.length === 0) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }

    const game = gameRes.rows[0];

    // 2. Fetch moves
    const movesRes = await query(`
      SELECT 
        move_id,
        game_id,
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
      ORDER BY move_number ASC, CASE WHEN color = 'white' THEN 1 ELSE 2 END ASC;
    `, [gameId]);

    // 3. Fetch tactical motifs
    const motifsRes = await query(`
      SELECT 
        gm.id,
        gm.game_id,
        gm.move_number,
        gm.color,
        gm.fen_position,
        gm.move_san,
        gm.material_change,
        gm.rationale,
        gm.confidence,
        tm.motif_name,
        tm.category,
        tm.description
      FROM game_motifs gm
      JOIN tactical_motifs tm ON gm.motif_id = tm.motif_id
      WHERE gm.game_id = $1
      ORDER BY gm.move_number ASC;
    `, [gameId]);

    return NextResponse.json({
      success: true,
      game,
      moves: movesRes.rows,
      motifs: motifsRes.rows,
      annotations: []
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const gameId = parseInt(params.id, 10);
    if (isNaN(gameId)) {
      return NextResponse.json({ error: 'Invalid game ID' }, { status: 400 });
    }

    return await withTransaction(async (client) => {
      // Delete child records explicitly or let cascade handle
      await client.query('DELETE FROM game_motifs WHERE game_id = $1', [gameId]);
      await client.query('DELETE FROM game_embeddings WHERE game_id = $1', [gameId]);
      await client.query('DELETE FROM rating_history WHERE game_id = $1', [gameId]);
      await client.query('DELETE FROM moves WHERE game_id = $1', [gameId]);
      const res = await client.query('DELETE FROM games WHERE game_id = $1 RETURNING game_id', [gameId]);

      if (res.rows.length === 0) {
        return NextResponse.json({ error: 'Game not found' }, { status: 404 });
      }

      return NextResponse.json({
        success: true,
        message: `Game #${gameId} successfully removed from database.`
      });
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const gameId = parseInt(params.id, 10);
    if (isNaN(gameId)) {
      return NextResponse.json({ error: 'Invalid game ID' }, { status: 400 });
    }

    const body = await req.json();
    const {
      whitePlayer,
      blackPlayer,
      whiteRating,
      blackRating,
      eventName,
      openingName,
      ecoCode,
      result,
      gameDate
    } = body;

    return await withTransaction(async (client) => {
      // 1. Resolve white player if updated
      let whitePlayerId: number | undefined;
      if (whitePlayer && typeof whitePlayer === 'string' && whitePlayer.trim()) {
        const wpRes = await client.query(`
          INSERT INTO players (name, fide_rating)
          VALUES ($1, $2::int)
          ON CONFLICT (name) DO UPDATE SET fide_rating = COALESCE(EXCLUDED.fide_rating, players.fide_rating)
          RETURNING player_id;
        `, [whitePlayer.trim(), whiteRating ? parseInt(whiteRating, 10) : null]);
        whitePlayerId = wpRes.rows[0].player_id;
      }

      // 2. Resolve black player if updated
      let blackPlayerId: number | undefined;
      if (blackPlayer && typeof blackPlayer === 'string' && blackPlayer.trim()) {
        const bpRes = await client.query(`
          INSERT INTO players (name, fide_rating)
          VALUES ($1, $2::int)
          ON CONFLICT (name) DO UPDATE SET fide_rating = COALESCE(EXCLUDED.fide_rating, players.fide_rating)
          RETURNING player_id;
        `, [blackPlayer.trim(), blackRating ? parseInt(blackRating, 10) : null]);
        blackPlayerId = bpRes.rows[0].player_id;
      }

      // 3. Resolve tournament if updated
      let tournamentId: number | undefined;
      if (eventName && typeof eventName === 'string' && eventName.trim()) {
        const tRes = await client.query(`
          INSERT INTO tournaments (name)
          VALUES ($1)
          ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
          RETURNING tournament_id;
        `, [eventName.trim()]);
        tournamentId = tRes.rows[0].tournament_id;
      }

      // 4. Resolve opening if updated
      let openingId: number | undefined;
      if (openingName || ecoCode) {
        const oRes = await client.query(`
          SELECT opening_id FROM openings 
          WHERE (eco_code = $1 AND eco_code IS NOT NULL) OR opening_name ILIKE $2
          LIMIT 1;
        `, [ecoCode || '', openingName || '']);
        if (oRes.rows.length > 0) {
          openingId = oRes.rows[0].opening_id;
        } else if (ecoCode && openingName) {
          const newORes = await client.query(`
            INSERT INTO openings (eco_code, opening_name)
            VALUES ($1, $2)
            RETURNING opening_id;
          `, [ecoCode.trim().toUpperCase(), openingName.trim()]);
          openingId = newORes.rows[0].opening_id;
        }
      }

      // 5. Build dynamic update query
      const updates: string[] = [];
      const values: any[] = [];
      let idx = 1;

      if (whitePlayerId !== undefined) {
        updates.push(`white_player_id = $${idx++}`);
        values.push(whitePlayerId);
      }
      if (blackPlayerId !== undefined) {
        updates.push(`black_player_id = $${idx++}`);
        values.push(blackPlayerId);
      }
      if (tournamentId !== undefined) {
        updates.push(`tournament_id = $${idx++}`);
        values.push(tournamentId);
      }
      if (openingId !== undefined) {
        updates.push(`opening_id = $${idx++}`);
        values.push(openingId);
      }
      if (whiteRating !== undefined) {
        updates.push(`white_rating = $${idx++}`);
        values.push(whiteRating ? parseInt(whiteRating, 10) : null);
      }
      if (blackRating !== undefined) {
        updates.push(`black_rating = $${idx++}`);
        values.push(blackRating ? parseInt(blackRating, 10) : null);
      }
      if (result !== undefined && ['1-0', '0-1', '1/2-1/2', '*'].includes(result)) {
        updates.push(`result = $${idx++}`);
        values.push(result);
      }
      if (gameDate !== undefined) {
        updates.push(`game_date = $${idx++}`);
        values.push(gameDate || null);
      }

      if (updates.length === 0) {
        return NextResponse.json({ error: 'No valid fields provided to update.' }, { status: 400 });
      }

      values.push(gameId);
      const updateSql = `
        UPDATE games 
        SET ${updates.join(', ')}
        WHERE game_id = $${idx}
        RETURNING game_id;
      `;

      const res = await client.query(updateSql, values);
      if (res.rows.length === 0) {
        return NextResponse.json({ error: 'Game not found' }, { status: 404 });
      }

      return NextResponse.json({
        success: true,
        message: `Game #${gameId} updated successfully.`
      });
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
