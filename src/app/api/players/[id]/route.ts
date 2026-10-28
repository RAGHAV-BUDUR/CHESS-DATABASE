import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const playerId = parseInt(params.id, 10);
    if (isNaN(playerId)) {
      return NextResponse.json({ error: 'Invalid player ID' }, { status: 400 });
    }

    // 1. Fetch Player Stats using Stored Function get_player_stats()
    let stats: any = null;
    try {
      const statsRes = await query('SELECT * FROM get_player_stats($1)', [playerId]);
      stats = statsRes.rows[0];
    } catch {
      // Fallback direct query if stored function not compiled
      const fbRes = await query(`
        SELECT 
          player_id, name AS player_name, fide_rating, country,
          total_games, total_wins AS wins, total_losses AS losses, total_draws AS draws,
          ROUND((total_wins::NUMERIC / NULLIF(total_games, 0)) * 100, 2) AS win_rate
        FROM players WHERE player_id = $1
      `, [playerId]);
      stats = fbRes.rows[0];
    }

    if (!stats) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 });
    }

    // 2. Rating History for charting
    const ratingHistRes = await query(`
      SELECT recorded_date, rating
      FROM rating_history
      WHERE player_id = $1
      ORDER BY recorded_date ASC
    `, [playerId]);

    // 3. Most Played Openings
    const openingsRes = await query(`
      SELECT 
        o.opening_id,
        o.opening_name,
        o.eco_code,
        COUNT(g.game_id) AS games_count,
        COUNT(g.game_id) FILTER (
          WHERE (g.white_player_id = $1 AND g.result = '1-0') OR 
                (g.black_player_id = $1 AND g.result = '0-1')
        ) AS wins
      FROM games g
      JOIN openings o ON g.opening_id = o.opening_id
      WHERE g.white_player_id = $1 OR g.black_player_id = $1
      GROUP BY o.opening_id, o.opening_name, o.eco_code
      ORDER BY games_count DESC
      LIMIT 8
    `, [playerId]);

    // 4. Recent Games
    const recentGamesRes = await query(`
      SELECT 
        g.game_id,
        g.game_date,
        g.result,
        g.move_count,
        wp.name AS white_player,
        bp.name AS black_player,
        o.opening_name,
        o.eco_code,
        t.name AS tournament_name
      FROM games g
      JOIN players wp ON g.white_player_id = wp.player_id
      JOIN players bp ON g.black_player_id = bp.player_id
      LEFT JOIN openings o ON g.opening_id = o.opening_id
      LEFT JOIN tournaments t ON g.tournament_id = t.tournament_id
      WHERE g.white_player_id = $1 OR g.black_player_id = $1
      ORDER BY g.game_date DESC NULLS LAST, g.game_id DESC
      LIMIT 10
    `, [playerId]);

    return NextResponse.json({
      success: true,
      stats,
      ratingHistory: ratingHistRes.rows,
      topOpenings: openingsRes.rows,
      recentGames: recentGamesRes.rows,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

