import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth(req);

    const res = await query(`
      SELECT 
        uf.id AS fav_id,
        uf.created_at,
        uf.note,
        g.game_id,
        g.game_date,
        g.result,
        wp.name AS white_player,
        bp.name AS black_player,
        o.opening_name,
        o.eco_code,
        p.player_id,
        p.name AS player_name,
        p.fide_rating,
        p.country
      FROM user_favourites uf
      LEFT JOIN games g ON uf.game_id = g.game_id
      LEFT JOIN players wp ON g.white_player_id = wp.player_id
      LEFT JOIN players bp ON g.black_player_id = bp.player_id
      LEFT JOIN openings o ON g.opening_id = o.opening_id
      LEFT JOIN players p ON uf.player_id = p.player_id
      WHERE uf.user_id = $1
      ORDER BY uf.created_at DESC;
    `, [session.userId]);

    return NextResponse.json({ success: true, data: res.rows });
  } catch (err: any) {
    if (err.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth(req);
    const { gameId, playerId, note } = await req.json();

    if (!gameId && !playerId) {
      return NextResponse.json({ error: 'Either gameId or playerId must be specified' }, { status: 400 });
    }

    const res = await query(`
      INSERT INTO user_favourites (user_id, game_id, player_id, note)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT DO NOTHING
      RETURNING id;
    `, [session.userId, gameId || null, playerId || null, note || null]);

    return NextResponse.json({ success: true, inserted: res.rowCount && res.rowCount > 0 });
  } catch (err: any) {
    if (err.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await requireAuth(req);
    const { searchParams } = new URL(req.url);
    const id = parseInt(searchParams.get('id') || '0', 10);

    if (!id) {
      return NextResponse.json({ error: 'Favorite ID is required' }, { status: 400 });
    }

    await query('DELETE FROM user_favourites WHERE id = $1 AND user_id = $2', [id, session.userId]);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    if (err.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

