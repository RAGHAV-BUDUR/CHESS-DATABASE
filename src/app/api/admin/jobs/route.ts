import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { query } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);

    const res = await query(`
      SELECT 
        job_id,
        filename,
        status,
        total_games,
        imported_games,
        skipped_games,
        failed_games,
        error_log,
        started_at,
        completed_at
      FROM pgn_import_jobs
      ORDER BY started_at DESC
      LIMIT 50;
    `);

    return NextResponse.json({ success: true, data: res.rows });
  } catch (err: any) {
    if (err.message === 'UNAUTHORIZED') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    if (err.message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

