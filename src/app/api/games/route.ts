import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
    const offset = (page - 1) * limit;

    const white = searchParams.get('white');
    const black = searchParams.get('black');
    const player = searchParams.get('player');
    const opening = searchParams.get('opening');
    const eco = searchParams.get('eco');
    const tournament = searchParams.get('tournament');
    const result = searchParams.get('result');
    const minRating = searchParams.get('minRating');
    const maxRating = searchParams.get('maxRating');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const motif = searchParams.get('motif');
    const sortBy = searchParams.get('sortBy') || 'date';
    const sortOrder = searchParams.get('sortOrder')?.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    const conditions: string[] = [];
    const values: any[] = [];
    let pIdx = 1;

    if (white) {
      conditions.push(`wp.name ILIKE $${pIdx}`);
      values.push(`%${white}%`);
      pIdx++;
    }

    if (black) {
      conditions.push(`bp.name ILIKE $${pIdx}`);
      values.push(`%${black}%`);
      pIdx++;
    }

    if (player) {
      conditions.push(`(wp.name ILIKE $${pIdx} OR bp.name ILIKE $${pIdx})`);
      values.push(`%${player}%`);
      pIdx++;
    }

    if (opening) {
      conditions.push(`o.opening_name ILIKE $${pIdx}`);
      values.push(`%${opening}%`);
      pIdx++;
    }

    if (eco) {
      conditions.push(`o.eco_code = $${pIdx}`);
      values.push(eco.toUpperCase());
      pIdx++;
    }

    if (tournament) {
      conditions.push(`t.name ILIKE $${pIdx}`);
      values.push(`%${tournament}%`);
      pIdx++;
    }

    if (result && ['1-0', '0-1', '1/2-1/2'].includes(result)) {
      conditions.push(`g.result = $${pIdx}`);
      values.push(result);
      pIdx++;
    }

    if (minRating) {
      conditions.push(`(g.white_rating >= $${pIdx} AND g.black_rating >= $${pIdx})`);
      values.push(parseInt(minRating, 10));
      pIdx++;
    }

    if (maxRating) {
      conditions.push(`(g.white_rating <= $${pIdx} AND g.black_rating <= $${pIdx})`);
      values.push(parseInt(maxRating, 10));
      pIdx++;
    }

    if (startDate) {
      conditions.push(`g.game_date >= $${pIdx}`);
      values.push(startDate);
      pIdx++;
    }

    if (endDate) {
      conditions.push(`g.game_date <= $${pIdx}`);
      values.push(endDate);
      pIdx++;
    }

    if (motif) {
      conditions.push(`EXISTS (
        SELECT 1 FROM game_motifs gm2 
        JOIN tactical_motifs tm2 ON gm2.motif_id = tm2.motif_id 
        WHERE gm2.game_id = g.game_id AND tm2.motif_name = $${pIdx}
      )`);
      values.push(motif);
      pIdx++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    let orderClause = 'ORDER BY g.game_date DESC NULLS LAST, g.game_id DESC';
    if (sortBy === 'moves') {
      orderClause = `ORDER BY g.move_count ${sortOrder}`;
    } else if (sortBy === 'rating') {
      orderClause = `ORDER BY ((COALESCE(g.white_rating, 0) + COALESCE(g.black_rating, 0)) / 2) ${sortOrder}`;
    }

    // Count query
    const countSql = `
      SELECT COUNT(DISTINCT g.game_id) AS total
      FROM games g
      JOIN players wp ON g.white_player_id = wp.player_id
      JOIN players bp ON g.black_player_id = bp.player_id
      LEFT JOIN openings o ON g.opening_id = o.opening_id
      LEFT JOIN tournaments t ON g.tournament_id = t.tournament_id
      ${whereClause}
    `;

    const countRes = await query(countSql, values);
    const totalCount = parseInt(countRes.rows[0]?.total || '0', 10);

    // Data query with aggregated motifs
    const dataSql = `
      SELECT 
        g.game_id,
        g.game_date,
        g.result,
        g.move_count,
        g.round,
        wp.player_id AS white_player_id,
        wp.name AS white_player,
        g.white_rating,
        bp.player_id AS black_player_id,
        bp.name AS black_player,
        g.black_rating,
        o.opening_id,
        o.opening_name,
        o.eco_code,
        t.tournament_id,
        t.name AS tournament_name,
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object('name', tm.motif_name, 'category', tm.category)
          ) FILTER (WHERE tm.motif_name IS NOT NULL), '[]'
        ) AS motifs
      FROM games g
      JOIN players wp ON g.white_player_id = wp.player_id
      JOIN players bp ON g.black_player_id = bp.player_id
      LEFT JOIN openings o ON g.opening_id = o.opening_id
      LEFT JOIN tournaments t ON g.tournament_id = t.tournament_id
      LEFT JOIN game_motifs gm ON g.game_id = gm.game_id
      LEFT JOIN tactical_motifs tm ON gm.motif_id = tm.motif_id
      ${whereClause}
      GROUP BY g.game_id, wp.player_id, wp.name, bp.player_id, bp.name, o.opening_id, o.opening_name, o.eco_code, t.tournament_id, t.name
      ${orderClause}
      LIMIT $${pIdx} OFFSET $${pIdx + 1}
    `;

    const dataRes = await query(dataSql, [...values, limit, offset]);

    return NextResponse.json({
      success: true,
      data: dataRes.rows,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

