import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { query, withTransaction } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    await requireAdmin(req);

    await withTransaction(async (client) => {
      await client.query('DELETE FROM game_motifs;');
      await client.query('DELETE FROM game_embeddings;');
      await client.query('DELETE FROM user_favourites;');
      await client.query('DELETE FROM moves;');
      await client.query('DELETE FROM games;');
      await client.query('DELETE FROM pgn_import_jobs;');

      await client.query('ALTER SEQUENCE games_game_id_seq RESTART WITH 1;');
      await client.query('ALTER SEQUENCE moves_move_id_seq RESTART WITH 1;');
      await client.query('ALTER SEQUENCE game_motifs_id_seq RESTART WITH 1;');
      await client.query('ALTER SEQUENCE pgn_import_jobs_job_id_seq RESTART WITH 1;');
    });

    return NextResponse.json({
      success: true,
      message: 'All games, moves, tactical motifs, and embeddings cleared successfully.'
    });
  } catch (err: any) {
    if (err.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    if (err.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Administrative privileges required' }, { status: 403 });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
