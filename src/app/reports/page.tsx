'use client';

import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  Database, 
  Code2, 
  Clock, 
  Layers, 
  Download, 
  Copy, 
  Check, 
  Sparkles, 
  TrendingUp, 
  Trophy, 
  Users, 
  Crown, 
  ShieldAlert, 
  Zap,
  Info
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';

const REPORTS = [
  { id: 'opening_popularity', label: '1. Opening Popularity', icon: Crown, desc: 'Most frequently played openings ranked by game count with DENSE_RANK().' },
  { id: 'opening_success_rates', label: '2. Opening Success Rates', icon: BarChart3, desc: 'White vs Black win percentages across opening systems using FILTER.' },
  { id: 'player_performance', label: '3. Player Performance', icon: Users, desc: 'Career wins, losses, draws, and win rate across White & Black sides.' },
  { id: 'rating_band_analysis', label: '4. Rating-Band Analysis', icon: TrendingUp, desc: 'Game outcomes across player rating bands using CTE & Analytical View.' },
  { id: 'color_advantage', label: '5. Color Advantage', icon: Zap, desc: 'Global White vs Black victory ratio assessing first-move empirical edge.' },
  { id: 'tournament_leaderboard', label: '6. Tournament Leaderboard', icon: Trophy, desc: 'Standings with international chess points (W=1, D=0.5, L=0) partitioned by tournament.' },
  { id: 'country_performance', label: '7. Country Demographics', icon: Users, desc: 'Average and peak FIDE ratings grouped by country of origin.' },
  { id: 'rating_vs_performance', label: '8. Rating vs Empirical Win Rate', icon: TrendingUp, desc: 'Elo rating delta bins vs actual game outcome controlling for piece color.' },
  { id: 'tactical_motif_report', label: '9. Tactical Motif Distribution', icon: Sparkles, desc: 'Frequency of engine-detected motifs and victory correlation.' },
  { id: 'semantic_search_evaluation', label: '10. Semantic vs Motif Benchmark', icon: Layers, desc: 'Precision@K, Recall@K, and latency benchmark results.' },
  { id: 'data_quality_report', label: '11. Data Quality & Integrity Audit', icon: ShieldAlert, desc: 'Missing foreign keys, unindexed games, and import audit status.' },
  { id: 'database_performance_report', label: '12. Query Plan (EXPLAIN ANALYZE)', icon: Database, desc: 'Execution plans and index scanning proof on complex multi-table joins.' },
];

const PIE_COLORS = ['#10b981', '#f59e0b', '#f43f5e', '#6366f1', '#8b5cf6'];

export default function ReportsPage() {
  const [activeReport, setActiveReport] = useState('opening_popularity');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [showSqlPanel, setShowSqlPanel] = useState(true);
  const [isMounted, setIsMounted] = useState(false);

  const fetchReport = async (reportId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/reports/${reportId}`);
      const json = await res.json();
      if (json.success) setData(json);
      else setData(null);
    } catch (err) {
      console.error(err);
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setIsMounted(true);
    fetchReport(activeReport);
  }, [activeReport]);

  const copySql = () => {
    if (data?.sql) {
      navigator.clipboard.writeText(data.sql);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="max-w-3xl">
        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold uppercase tracking-wider mb-3">
          <Database className="w-3.5 h-3.5" />
          <span>DBMS Academic Reports & Analytical Engine</span>
        </div>
        <h1 className="text-3xl font-bold text-white tracking-tight">
          SQL Reports & Database Analytics
        </h1>
        <p className="text-slate-400 text-sm mt-1.5 leading-relaxed">
          Real PostgreSQL analytical queries executing on historical master games. Demonstrates views, triggers, window functions, conditional aggregations (FILTER), CTEs, and query planner execution.
        </p>
      </div>

      {/* Reports Selector Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
        {REPORTS.map((rep) => {
          const Icon = rep.icon;
          const isActive = activeReport === rep.id;
          return (
            <button
              key={rep.id}
              onClick={() => setActiveReport(rep.id)}
              className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between space-y-2 ${
                isActive
                  ? 'bg-amber-500/10 border-amber-500/40 text-amber-400 shadow-md shadow-amber-500/5'
                  : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <Icon className={`w-4 h-4 ${isActive ? 'text-amber-400' : 'text-slate-400'}`} />
                {isActive && <div className="w-1.5 h-1.5 rounded-full bg-amber-400"></div>}
              </div>
              <div className="text-xs font-bold leading-tight">{rep.label}</div>
            </button>
          );
        })}
      </div>

      {/* Active Report View Area */}
      {loading ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-16 flex flex-col items-center justify-center space-y-3">
          <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xs text-slate-400 font-mono">Executing query plan in PostgreSQL...</p>
        </div>
      ) : !data ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-400">
          Failed to load report data.
        </div>
      ) : (
        <div className="space-y-6">
          {/* Query Summary & Execution Metric Bar */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-lg">
            <div className="space-y-1">
              <h2 className="text-base font-bold text-white flex items-center space-x-2">
                <span>{REPORTS.find(r => r.id === activeReport)?.label}</span>
              </h2>
              <p className="text-xs text-slate-400">{data.explanation}</p>
            </div>

            <div className="flex items-center space-x-3 text-xs">
              <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 font-mono">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <span>{data.durationMs}ms query time</span>
              </div>
              {data.rowCount !== undefined && (
                <div className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 font-mono">
                  <span>{data.rowCount} rows</span>
                </div>
              )}
            </div>
          </div>

          {/* Graphical Visualization (if applicable) */}
          {activeReport === 'opening_popularity' && isMounted && data.data?.length > 0 && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Opening Popularity Chart</h3>
              <div className="h-64 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.data.slice(0, 8)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="opening_name" stroke="#94a3b8" fontSize={10} tickLine={false} />
                    <YAxis stroke="#94a3b8" fontSize={10} />
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }} />
                    <Bar dataKey="game_count" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Games Played" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {activeReport === 'color_advantage' && isMounted && data.data?.length > 0 && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl space-y-1">
                <div className="text-xs text-slate-400">White Victories</div>
                <div className="text-3xl font-black text-emerald-400 font-mono">{data.data[0].white_win_pct}%</div>
                <div className="text-[11px] text-slate-500 font-mono">{data.data[0].white_wins} wins</div>
              </div>
              <div className="p-4 bg-slate-800/60 border border-slate-700 rounded-xl space-y-1">
                <div className="text-xs text-slate-400">Drawn Games</div>
                <div className="text-3xl font-black text-slate-300 font-mono">{data.data[0].draw_pct}%</div>
                <div className="text-[11px] text-slate-500 font-mono">{data.data[0].draws} draws</div>
              </div>
              <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl space-y-1">
                <div className="text-xs text-slate-400">Black Victories</div>
                <div className="text-3xl font-black text-rose-400 font-mono">{data.data[0].black_win_pct}%</div>
                <div className="text-[11px] text-slate-500 font-mono">{data.data[0].black_wins} wins</div>
              </div>
            </div>
          )}

          {/* Tabular Output */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto max-h-[420px]">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800 uppercase tracking-wider sticky top-0 text-[11px]">
                  <tr>
                    {data.data && data.data[0] && Object.keys(data.data[0]).map((col) => (
                      <th key={col} className="py-3 px-4">{col.replace(/_/g, ' ')}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {data.data?.map((row: any, rIdx: number) => (
                    <tr key={rIdx} className="hover:bg-slate-800/40 transition-colors">
                      {Object.values(row).map((val: any, cIdx: number) => (
                        <td key={cIdx} className="py-3 px-4">
                          {typeof val === 'object' && val !== null ? JSON.stringify(val) : String(val ?? 'NULL')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* SQL Concept & Source Inspector Panel */}
          {data.sql && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
              <div className="bg-slate-950 px-5 py-3 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Code2 className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
                    Evaluator SQL Source & Concept Proof
                  </span>
                </div>
                <button
                  onClick={copySql}
                  className="flex items-center space-x-1.5 px-3 py-1 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors border border-slate-700"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied' : 'Copy SQL'}</span>
                </button>
              </div>

              {/* Concepts Tags */}
              {data.sqlConcepts && data.sqlConcepts.length > 0 && (
                <div className="px-5 py-3 bg-slate-950/40 border-b border-slate-800/60 flex flex-wrap items-center gap-2">
                  <span className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider mr-1">
                    Demonstrated PostgreSQL Concepts:
                  </span>
                  {data.sqlConcepts.map((concept: string, idx: number) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5 rounded text-[11px] font-mono bg-amber-500/10 text-amber-300 border border-amber-500/20"
                    >
                      {concept}
                    </span>
                  ))}
                </div>
              )}

              {/* Formatted SQL Code Box */}
              <div className="p-5 overflow-x-auto bg-slate-950/90 text-amber-300 font-mono text-xs leading-relaxed">
                <pre>{data.sql}</pre>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

