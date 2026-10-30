'use client';

import React, { useState, useEffect } from 'react';
import { Crown, Search, BookOpen, ArrowRight, BarChart2, Filter } from 'lucide-react';

export default function OpeningsPage() {
  const [openings, setOpenings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [ecoFilter, setEcoFilter] = useState('');

  const fetchOpenings = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('q', search);
      if (ecoFilter) params.set('eco', ecoFilter);

      const res = await fetch(`/api/openings?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        setOpenings(json.data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOpenings();
  }, [ecoFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchOpenings();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center space-x-2">
            <Crown className="w-6 h-6 text-amber-400" />
            <span>Encyclopedia of Chess Openings (ECO) Explorer</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Browse opening systems, master repertoire frequencies, and statistical success rates by side.
          </p>
        </div>
      </div>

      {/* Search & ECO Filter Bar */}
      <form onSubmit={handleSearchSubmit} className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search opening by name or ECO code (e.g. Sicilian, B90, Queen's Gambit)..."
            className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500"
          />
        </div>

        <div className="flex items-center space-x-2">
          {['A', 'B', 'C', 'D', 'E'].map((letter) => (
            <button
              key={letter}
              type="button"
              onClick={() => setEcoFilter(ecoFilter === letter ? '' : letter)}
              className={`w-8 h-8 rounded-lg text-xs font-bold transition-colors ${
                ecoFilter === letter
                  ? 'bg-amber-500 text-slate-950'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {letter}
            </button>
          ))}
          <button
            type="submit"
            className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-semibold transition-colors"
          >
            Filter
          </button>
        </div>
      </form>

      {/* Openings Grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-3">
          <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm text-slate-400">Loading opening statistics from PostgreSQL...</p>
        </div>
      ) : openings.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center space-y-3">
          <Crown className="w-8 h-8 text-slate-600 mx-auto" />
          <h3 className="text-base font-bold text-slate-200">No openings found</h3>
          <p className="text-xs text-slate-400">Try searching with a different ECO code or keyword.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {openings.map((op: any) => {
            const total = parseInt(op.total_games || '0', 10);
            const wPct = parseFloat(op.white_win_pct || '0');
            const bPct = parseFloat(op.black_win_pct || '0');
            const dPct = parseFloat(op.draw_pct || '0');

            return (
              <div
                key={op.opening_id}
                className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl p-4 flex flex-col justify-between space-y-3 shadow-md transition-all"
              >
                <div>
                  <div className="flex justify-between items-start">
                    <span className="px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold font-mono">
                      {op.eco_code}
                    </span>
                    <span className="text-xs text-slate-500 font-mono">
                      {total} {total === 1 ? 'game' : 'games'}
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-white mt-2 line-clamp-1">
                    {op.opening_name}
                  </h3>
                  {op.description && (
                    <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                      {op.description}
                    </p>
                  )}
                </div>

                {/* Performance Progress Bar */}
                {total > 0 && (
                  <div className="space-y-1.5 pt-2 border-t border-slate-800">
                    <div className="flex justify-between text-[11px] font-mono text-slate-400">
                      <span className="text-emerald-400">White {wPct}%</span>
                      <span className="text-slate-400">Draw {dPct}%</span>
                      <span className="text-rose-400">Black {bPct}%</span>
                    </div>
                    <div className="w-full h-2 rounded-full overflow-hidden flex bg-slate-950">
                      <div style={{ width: `${wPct}%` }} className="bg-emerald-500 h-full" title={`White: ${wPct}%`}></div>
                      <div style={{ width: `${dPct}%` }} className="bg-slate-500 h-full" title={`Draw: ${dPct}%`}></div>
                      <div style={{ width: `${bPct}%` }} className="bg-rose-500 h-full" title={`Black: ${bPct}%`}></div>
                    </div>
                  </div>
                )}

                <div className="pt-2 flex justify-end">
                  <a
                    href={`/games?eco=${encodeURIComponent(op.eco_code)}&opening=${encodeURIComponent(op.opening_name)}`}
                    className="inline-flex items-center space-x-1 text-xs font-medium text-amber-400 hover:text-amber-300"
                  >
                    <span>View Games</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

