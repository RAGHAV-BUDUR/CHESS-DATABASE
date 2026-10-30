import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { Chess } from 'chess.js';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { fen, moveHistory = [], quickSearch = '' } = body;

    const chess = new Chess();
    if (fen) {
      try {
        chess.load(fen);
      } catch {
        chess.reset();
      }
    }

    const currentFen = chess.fen();
    // Normalize FEN for position matching (board pieces and active color)
    const piecePlacement = currentFen.split(' ')[0];
    const activeColor = currentFen.split(' ')[1];
    const isStartPos = currentFen === 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

    let moveStats: any[] = [];
    let matchingGames: any[] = [];

    if (isStartPos) {
      // 1. Move Statistics from Starting Position (First moves played in DB)
      const statsRes = await query(`
        SELECT 
          m.san AS move,
          COUNT(DISTINCT g.game_id) AS games,
          ROUND(
            (COUNT(DISTINCT g.game_id) FILTER (WHERE g.result = '1-0')::NUMERIC / NULLIF(COUNT(DISTINCT g.game_id), 0)) * 100, 
            0
          ) AS white_win_pct,
          ROUND(
            COALESCE(AVG((COALESCE(g.white_rating, 2200) + COALESCE(g.black_rating, 2200)) / 2), 2200), 
            0
          ) AS avg_elo,
          ROUND(
            (COUNT(DISTINCT g.game_id)::NUMERIC / (SELECT NULLIF(COUNT(*), 0) FROM games)) * 100, 
            0
          ) AS pct
        FROM moves m
        JOIN games g ON m.game_id = g.game_id
        WHERE m.move_number = 1 AND m.color = 'white'
        GROUP BY m.san
        ORDER BY games DESC
        LIMIT 15;
      `);
      moveStats = statsRes.rows;

      // 2. Sample/Search Games
      const gamesRes = await query(`
        SELECT 
          g.game_id,
          wp.name AS white,
          g.white_rating AS white_elo,
          bp.name AS black,
          g.black_rating AS black_elo,
          g.result,
          g.move_count AS moves,
          g.game_date AS date,
          o.opening_name,
          o.eco_code,
          t.name AS event,
          g.pgn
        FROM games g
        JOIN players wp ON g.white_player_id = wp.player_id
        JOIN players bp ON g.black_player_id = bp.player_id
        LEFT JOIN openings o ON g.opening_id = o.opening_id
        LEFT JOIN tournaments t ON g.tournament_id = t.tournament_id
        WHERE 
          ($1::TEXT = '' OR 
           wp.name ILIKE '%' || $1 || '%' OR 
           bp.name ILIKE '%' || $1 || '%' OR 
           o.opening_name ILIKE '%' || $1 || '%' OR 
           t.name ILIKE '%' || $1 || '%')
        ORDER BY g.game_id DESC
        LIMIT 100;
      `, [quickSearch || '']);
      matchingGames = gamesRes.rows;
    } else {
      // 1. Find all game_ids that reached this position
      // Using fen_after match on board piece placement and active color
      const matchingRes = await query(`
        SELECT DISTINCT m.game_id, m.move_number, m.color
        FROM moves m
        WHERE split_part(m.fen_after, ' ', 1) = $1
          AND split_part(m.fen_after, ' ', 2) = $2;
      `, [piecePlacement, activeColor]);

      const gameIds = matchingRes.rows.map(r => r.game_id);

      if (gameIds.length > 0) {
        // Find next candidate moves in these games
        const statsRes = await query(`
          WITH target_moves AS (
            SELECT m.game_id, m.move_number, m.color,
                   CASE WHEN m.color = 'white' THEN m.move_number ELSE m.move_number + 1 END as next_move_num,
                   CASE WHEN m.color = 'white' THEN 'black' ELSE 'white' END as next_color
            FROM moves m
            WHERE m.game_id = ANY($1::int[])
              AND split_part(m.fen_after, ' ', 1) = $2
              AND split_part(m.fen_after, ' ', 2) = $3
          )
          SELECT 
            next_m.san AS move,
            COUNT(DISTINCT g.game_id) AS games,
            ROUND(
              (COUNT(DISTINCT g.game_id) FILTER (WHERE g.result = '1-0')::NUMERIC / NULLIF(COUNT(DISTINCT g.game_id), 0)) * 100, 
              0
            ) AS white_win_pct,
            ROUND(
              COALESCE(AVG((COALESCE(g.white_rating, 2200) + COALESCE(g.black_rating, 2200)) / 2), 2200), 
              0
            ) AS avg_elo,
            ROUND(
              (COUNT(DISTINCT g.game_id)::NUMERIC / $4::NUMERIC) * 100, 
              0
            ) AS pct
          FROM target_moves tm
          JOIN moves next_m ON next_m.game_id = tm.game_id 
                           AND next_m.move_number = tm.next_move_num 
                           AND next_m.color = tm.next_color
          JOIN games g ON next_m.game_id = g.game_id
          GROUP BY next_m.san
          ORDER BY games DESC
          LIMIT 15;
        `, [gameIds, piecePlacement, activeColor, gameIds.length]);
        moveStats = statsRes.rows;

        // Fetch games matching this position
        const gamesRes = await query(`
          SELECT 
            g.game_id,
            wp.name AS white,
            g.white_rating AS white_elo,
            bp.name AS black,
            g.black_rating AS black_elo,
            g.result,
            g.move_count AS moves,
            g.game_date AS date,
            o.opening_name,
            o.eco_code,
            t.name AS event,
            g.pgn
          FROM games g
          JOIN players wp ON g.white_player_id = wp.player_id
          JOIN players bp ON g.black_player_id = bp.player_id
          LEFT JOIN openings o ON g.opening_id = o.opening_id
          LEFT JOIN tournaments t ON g.tournament_id = t.tournament_id
          WHERE g.game_id = ANY($1::int[]) AND
            ($2::TEXT = '' OR 
             wp.name ILIKE '%' || $2 || '%' OR 
             bp.name ILIKE '%' || $2 || '%' OR 
             o.opening_name ILIKE '%' || $2 || '%')
          ORDER BY g.game_id DESC
          LIMIT 100;
        `, [gameIds, quickSearch || '']);
        matchingGames = gamesRes.rows;
      } else {
        // Fallback: If no exact transposition matched, show games filtered by search
        const gamesRes = await query(`
          SELECT 
            g.game_id,
            wp.name AS white,
            g.white_rating AS white_elo,
            bp.name AS black,
            g.black_rating AS black_elo,
            g.result,
            g.move_count AS moves,
            g.game_date AS date,
            o.opening_name,
            o.eco_code,
            t.name AS event,
            g.pgn
          FROM games g
          JOIN players wp ON g.white_player_id = wp.player_id
          JOIN players bp ON g.black_player_id = bp.player_id
          LEFT JOIN openings o ON g.opening_id = o.opening_id
          LEFT JOIN tournaments t ON g.tournament_id = t.tournament_id
          WHERE 
            ($1::TEXT = '' OR 
             wp.name ILIKE '%' || $1 || '%' OR 
             bp.name ILIKE '%' || $1 || '%' OR 
             o.opening_name ILIKE '%' || $1 || '%')
          ORDER BY g.game_id DESC
          LIMIT 100;
        `, [quickSearch || '']);
        matchingGames = gamesRes.rows;
      }
    }

    return NextResponse.json({
      success: true,
      fen: currentFen,
      moveStats,
      matchingGames,
      totalMatching: matchingGames.length
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
