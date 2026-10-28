import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('q');
    const sortBy = searchParams.get('sortBy') || 'rating';
    const sortOrder = searchParams.get('sortOrder')?.toLowerCase() === 'asc' ? 'ASC' : 'DESC';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
    const offset = (page - 1) * limit;

    let whereClause = '';
    const params: any[] = [];
    if (search) {
      whereClause = 'WHERE p.name ILIKE $1 OR p.country ILIKE $1';
      params.push(`%${search}%`);
    }

    let orderClause = 'ORDER BY p.fide_rating DESC NULLS LAST';
    if (sortBy === 'games') orderClause = `ORDER BY p.total_games ${sortOrder}`;
    else if (sortBy === 'name') orderClause = `ORDER BY p.name ${sortOrder}`;
    else if (sortBy === 'wins') orderClause = `ORDER BY p.total_wins ${sortOrder}`;

    const countRes = await query(`SELECT COUNT(*) AS total FROM players p ${whereClause}`, params);
    const totalCount = parseInt(countRes.rows[0]?.total || '0', 10);

    const dataSql = `
      SELECT 
        p.player_id,
        p.name,
        p.fide_rating,
        p.title,
        p.country,
        p.total_games,
        p.total_wins,
        p.total_losses,
        p.total_draws,
        ROUND((p.total_wins::NUMERIC / NULLIF(p.total_games, 0)) * 100, 1) AS win_rate,
        DENSE_RANK() OVER (ORDER BY p.fide_rating DESC NULLS LAST) as rating_rank
      FROM players p
      ${whereClause}
      ${orderClause}
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    const dataRes = await query(dataSql, [...params, limit, offset]);

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

