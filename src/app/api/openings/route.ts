import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('q');
    const eco = searchParams.get('eco');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '25', 10)));
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const params: any[] = [];
    let pIdx = 1;

    if (search) {
      conditions.push(`(o.opening_name ILIKE $${pIdx} OR o.eco_code ILIKE $${pIdx})`);
      params.push(`%${search}%`);
      pIdx++;
    }

    if (eco) {
      conditions.push(`o.eco_code = $${pIdx}`);
      params.push(eco.toUpperCase());
      pIdx++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRes = await query(`SELECT COUNT(*) AS total FROM openings o ${whereClause}`, params);
    const totalCount = parseInt(countRes.rows[0]?.total || '0', 10);

    const sql = `
      SELECT 
        o.opening_id,
        o.eco_code,
        o.opening_name,
        o.description,
        COUNT(g.game_id) AS total_games,
        COUNT(g.game_id) FILTER (WHERE g.result = '1-0') AS white_wins,
        COUNT(g.game_id) FILTER (WHERE g.result = '0-1') AS black_wins,
        COUNT(g.game_id) FILTER (WHERE g.result = '1/2-1/2') AS draws,
        ROUND((COUNT(g.game_id) FILTER (WHERE g.result = '1-0')::NUMERIC / NULLIF(COUNT(g.game_id), 0)) * 100, 1) AS white_win_pct,
        ROUND((COUNT(g.game_id) FILTER (WHERE g.result = '0-1')::NUMERIC / NULLIF(COUNT(g.game_id), 0)) * 100, 1) AS black_win_pct,
        ROUND((COUNT(g.game_id) FILTER (WHERE g.result = '1/2-1/2')::NUMERIC / NULLIF(COUNT(g.game_id), 0)) * 100, 1) AS draw_pct
      FROM openings o
      LEFT JOIN games g ON o.opening_id = g.opening_id
      ${whereClause}
      GROUP BY o.opening_id, o.eco_code, o.opening_name, o.description
      ORDER BY total_games DESC, o.eco_code ASC
      LIMIT $${pIdx} OFFSET $${pIdx + 1}
    `;

    const dataRes = await query(sql, [...params, limit, offset]);

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

