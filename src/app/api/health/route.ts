import { NextResponse } from 'next/server';
import { query, checkDatabaseHealth } from '@/lib/db';

export async function GET() {
  const health = await checkDatabaseHealth();

  if (!health.connected) {
    return NextResponse.json({
      status: 'DEGRADED',
      database: 'DISCONNECTED',
      error: health.error,
      timestamp: new Date().toISOString(),
    }, { status: 503 });
  }

  // Count tables
  const countsRes = await query(`
    SELECT 
      (SELECT COUNT(*) FROM players) AS players_count,
      (SELECT COUNT(*) FROM games) AS games_count,
      (SELECT COUNT(*) FROM openings) AS openings_count,
      (SELECT COUNT(*) FROM moves) AS moves_count,
      (SELECT COUNT(*) FROM game_motifs) AS motifs_count,
      (SELECT COUNT(*) FROM game_embeddings) AS embeddings_count;
  `);

  return NextResponse.json({
    status: 'HEALTHY',
    database: 'CONNECTED',
    pgversion: health.version,
    pgvectorInstalled: health.hasPgVector,
    counts: countsRes.rows[0],
    timestamp: new Date().toISOString(),
  });
}

