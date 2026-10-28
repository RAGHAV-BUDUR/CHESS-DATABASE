import React from 'react';
import { 
  Search, 
  Sparkles, 
  BookOpen, 
  BarChart3, 
  ShieldCheck, 
  Zap, 
  Database, 
  Cpu, 
  ChevronRight,
  Trophy,
  Activity,
  Layers
} from 'lucide-react';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

async function getHomeStats() {
  try {
    const statsRes = await query(`
      SELECT 
        (SELECT COUNT(*) FROM games) AS games_count,
        (SELECT COUNT(*) FROM players) AS players_count,
        (SELECT COUNT(*) FROM openings) AS openings_count,
        (SELECT COUNT(*) FROM game_motifs) AS motifs_count,
        (SELECT COUNT(*) FROM game_embeddings) AS embeddings_count;
    `);

    const recentGamesRes = await query(`
      SELECT 
        g.game_id,
        g.game_date,
        g.result,
        g.move_count,
        wp.name AS white_player,
        g.white_rating,
        bp.name AS black_player,
        g.black_rating,
        o.opening_name,
        o.eco_code,
        t.name AS tournament_name,
        COALESCE(
          json_agg(DISTINCT tm.motif_name) FILTER (WHERE tm.motif_name IS NOT NULL), '[]'
        ) AS motifs
      FROM games g
      JOIN players wp ON g.white_player_id = wp.player_id
      JOIN players bp ON g.black_player_id = bp.player_id
      LEFT JOIN openings o ON g.opening_id = o.opening_id
      LEFT JOIN tournaments t ON g.tournament_id = t.tournament_id
      LEFT JOIN game_motifs gm ON g.game_id = gm.game_id
      LEFT JOIN tactical_motifs tm ON gm.motif_id = tm.motif_id
      GROUP BY g.game_id, wp.name, g.white_rating, bp.name, g.black_rating, o.opening_name, o.eco_code, t.name
      ORDER BY g.game_date DESC NULLS LAST, g.game_id DESC
      LIMIT 4;
    `);

    return {
      stats: statsRes.rows[0] || {},
      recentGames: recentGamesRes.rows || [],
    };
  } catch {
    return {
      stats: { games_count: 0, players_count: 0, openings_count: 0, motifs_count: 0, embeddings_count: 0 },
      recentGames: [],
    };
  }
}

export default async function HomePage() {
  const { stats, recentGames } = await getHomeStats();

  return (
    <div className="space-y-12">
      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-amber-950/30 border border-slate-800 p-8 sm:p-12 shadow-2xl">
        <div className="max-w-3xl space-y-4">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold uppercase tracking-wider">
            <Zap className="w-3.5 h-3.5" />
            <span>DBMS Level 3 Project • Dual-Paradigm Architecture</span>
          </div>

          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
            A Chess Game Database & Move-Based <span className="text-amber-400">Search Platform</span>
          </h1>

          <p className="text-lg text-slate-300 leading-relaxed">
            Move beyond metadata filtering. Query historical master games by tactical motif, board position fingerprint, and pgvector semantic similarity across PostgreSQL.
          </p>

          {/* Quick Action Buttons */}
          <div className="pt-2 flex flex-wrap gap-4">
            <a
              href="/games"
              className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-lg font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 transition-all shadow-md shadow-amber-500/20"
            >
              <BookOpen className="w-4 h-4" />
              <span>Explore Master Games</span>
            </a>
            <a
              href="/search"
              className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-lg font-semibold bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 transition-all"
            >
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>Pattern & Semantic Search</span>
            </a>
            <a
              href="/reports"
              className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-lg font-semibold bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 transition-all"
            >
              <BarChart3 className="w-4 h-4 text-sky-400" />
              <span>12 SQL Reports</span>
            </a>
          </div>
        </div>
      </div>

      {/* Live System Database Stats Counter */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        {[
          { label: 'Master Games', value: stats.games_count || '0', icon: Trophy, color: 'text-amber-400' },
          { label: 'Grandmasters', value: stats.players_count || '0', icon: Activity, color: 'text-sky-400' },
          { label: 'ECO Openings', value: stats.openings_count || '0', icon: Layers, color: 'text-emerald-400' },
          { label: 'Tactical Motifs', value: stats.motifs_count || '0', icon: Cpu, color: 'text-rose-400' },
          { label: 'pgvector Embeddings', value: stats.embeddings_count || '0', icon: Database, color: 'text-purple-400' },
        ].map((item, idx) => {
          const Icon = item.icon;
          return (
            <div key={idx} className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-medium uppercase tracking-wider">{item.label}</span>
                <Icon className={`w-4 h-4 ${item.color}`} />
              </div>
              <div className="text-2xl font-bold text-white">{item.value}</div>
            </div>
          );
        })}
      </div>

      {/* 4 Architectural Pillars Grid */}
      <div>
        <h2 className="text-xl font-bold text-white mb-4">Core System Architecture</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-2 hover:border-slate-700 transition-colors">
            <div className="w-8 h-8 rounded-lg bg-sky-500/10 text-sky-400 flex items-center justify-center font-bold text-sm">
              SQL
            </div>
            <h3 className="font-semibold text-white">PostgreSQL 16 Engine</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Normalized DDL schema with 13 tables, foreign keys, CHECK constraints, stored procedures, triggers, views, and B-tree/GIN indexes.
            </p>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-2 hover:border-slate-700 transition-colors">
            <div className="w-8 h-8 rounded-lg bg-rose-500/10 text-rose-400 flex items-center justify-center font-bold text-sm">
              ENG
            </div>
            <h3 className="font-semibold text-white">Tactical Fingerprint Engine</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              100% deterministic chess rules novelty engine. Detects queen sacrifices, knight forks, pins, skewers, discovered attacks, and pawn storms.
            </p>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-2 hover:border-slate-700 transition-colors">
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center font-bold text-sm">
              VEC
            </div>
            <h3 className="font-semibold text-white">pgvector Semantic Search</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              384-dimensional dense vectors stored directly in PostgreSQL with cosine distance operator (<code className="text-amber-400">&lt;=&gt;</code>) and HNSW index.
            </p>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-2 hover:border-slate-700 transition-colors">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold text-sm">
              ANL
            </div>
            <h3 className="font-semibold text-white">12 Analytical SQL Reports</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Comprehensive analytics: opening win rates, player performance, rating bands, color advantage, EXPLAIN ANALYZE query inspection.
            </p>
          </div>
        </div>
      </div>

      {/* Featured Master Games */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white">Featured Master Games</h2>
          <a href="/games" className="text-xs text-amber-400 hover:text-amber-300 font-semibold flex items-center">
            View All Games <ChevronRight className="w-4 h-4 ml-0.5" />
          </a>
        </div>

        {recentGames.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center text-slate-400">
            No games seeded yet. Run <code className="text-amber-400">npm run db:seed</code> to populate historical master games.
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            {recentGames.map((g: any) => (
              <a
                key={g.game_id}
                href={`/games/${g.game_id}`}
                className="bg-slate-900 border border-slate-800 hover:border-amber-500/50 rounded-xl p-5 block transition-all group"
              >
                <div className="flex justify-between items-start text-xs text-slate-400 mb-2">
                  <span className="font-medium text-slate-300">{g.tournament_name || 'World Championship'}</span>
                  <span className="font-mono bg-slate-800 px-2 py-0.5 rounded text-amber-400 font-semibold">{g.result}</span>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between font-semibold text-white group-hover:text-amber-400 transition-colors">
                    <span>⚪ {g.white_player}</span>
                    <span className="text-slate-400 text-xs font-mono">{g.white_rating || ''}</span>
                  </div>
                  <div className="flex justify-between font-semibold text-white group-hover:text-amber-400 transition-colors">
                    <span>⚫ {g.black_player}</span>
                    <span className="text-slate-400 text-xs font-mono">{g.black_rating || ''}</span>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                  <span>{g.opening_name} ({g.eco_code})</span>
                  <span>{g.move_count} moves</span>
                </div>

                {g.motifs && g.motifs.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {g.motifs.slice(0, 3).map((m: string, i: number) => (
                      <span key={i} className="text-[10px] px-2 py-0.5 bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded">
                        {m}
                      </span>
                    ))}
                  </div>
                )}
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

