import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth(req);
    const { searchParams } = new URL(req.url);
    const gameId = searchParams.get('gameId');
    const playerId = searchParams.get('playerId');

    // Single game or player favorite status check
    if (gameId) {
      const res = await query(
        'SELECT id, note, created_at FROM user_favourites WHERE user_id = $1 AND game_id = $2',
        [session.userId, parseInt(gameId, 10)]
      );
      const isFavourite = (res.rowCount ?? 0) > 0;
      return NextResponse.json({
        success: true,
        isFavourite,
        favId: isFavourite ? res.rows[0].id : null,
        note: isFavourite ? res.rows[0].note : null,
      });
    }

    if (playerId) {
      const res = await query(
        'SELECT id, note, created_at FROM user_favourites WHERE user_id = $1 AND player_id = $2',
        [session.userId, parseInt(playerId, 10)]
      );
      const isFavourite = (res.rowCount ?? 0) > 0;
      return NextResponse.json({
        success: true,
        isFavourite,
        favId: isFavourite ? res.rows[0].id : null,
        note: isFavourite ? res.rows[0].note : null,
      });
    }

    // Default: Return all favourites for the authenticated user
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

    let res;
    if (gameId) {
      res = await query(`
        INSERT INTO user_favourites (user_id, game_id, player_id, note)
        VALUES ($1, $2, NULL, $3)
        ON CONFLICT (user_id, game_id) 
        DO UPDATE SET note = COALESCE(EXCLUDED.note, user_favourites.note)
        RETURNING id;
      `, [session.userId, parseInt(gameId, 10), note || null]);
    } else {
      res = await query(`
        INSERT INTO user_favourites (user_id, game_id, player_id, note)
        VALUES ($1, NULL, $2, $3)
        ON CONFLICT (user_id, player_id) 
        DO UPDATE SET note = COALESCE(EXCLUDED.note, user_favourites.note)
        RETURNING id;
      `, [session.userId, parseInt(playerId, 10), note || null]);
    }

    const favId = res.rows[0]?.id;
    return NextResponse.json({ success: true, inserted: true, favId });
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
    const gameId = parseInt(searchParams.get('gameId') || '0', 10);
    const playerId = parseInt(searchParams.get('playerId') || '0', 10);

    if (id) {
      await query('DELETE FROM user_favourites WHERE id = $1 AND user_id = $2', [id, session.userId]);
      return NextResponse.json({ success: true });
    } else if (gameId) {
      await query('DELETE FROM user_favourites WHERE game_id = $1 AND user_id = $2', [gameId, session.userId]);
      return NextResponse.json({ success: true });
    } else if (playerId) {
      await query('DELETE FROM user_favourites WHERE player_id = $1 AND user_id = $2', [playerId, session.userId]);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Favorite ID, gameId, or playerId is required' }, { status: 400 });
  } catch (err: any) {
    if (err.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

