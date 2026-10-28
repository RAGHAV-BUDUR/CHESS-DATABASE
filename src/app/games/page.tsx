'use client';

import React, { useState, useEffect } from 'react';
import { Search, Filter, BookOpen, ChevronLeft, ChevronRight, X, Sparkles } from 'lucide-react';

export default function GamesPage() {
  const [games, setGames] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Filters
  const [player, setPlayer] = useState('');
  const [opening, setOpening] = useState('');
  const [eco, setEco] = useState('');
  const [result, setResult] = useState('');
  const [motif, setMotif] = useState('');
  const [minRating, setMinRating] = useState('');

  const fetchGames = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', page.toString());
      params.set('limit', '15');
      if (player) params.set('player', player);
      if (opening) params.set('opening', opening);
      if (eco) params.set('eco', eco);
      if (result) params.set('result', result);
      if (motif) params.set('motif', motif);
      if (minRating) params.set('minRating', minRating);

      const res = await fetch(`/api/games?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setGames(data.data);
        setTotalPages(data.pagination.totalPages || 1);
        setTotalCount(data.pagination.totalCount || 0);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGames();
  }, [page]);

  const handleFilterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchGames();
  };

  const clearFilters = () => {
    setPlayer('');
    setOpening('');
    setEco('');
    setResult('');
    setMotif('');
    setMinRating('');
    setPage(1);
    setTimeout(() => fetchGames(), 50);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center space-x-2">
            <BookOpen className="w-6 h-6 text-amber-400" />
            <span>Master Games Explorer</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Browse and filter historical games using relational parameters and tactical motifs ({totalCount} total games recorded).
          </p>
        </div>
      </div>

      {/* Filter Toolbar */}
      <form onSubmit={handleFilterSubmit} className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <div>
            <label className="text-xs font-semibold text-slate-400">Player Name</label>
            <input
              type="text"
              value={player}
              onChange={(e) => setPlayer(e.target.value)}
              placeholder="e.g. Fischer, Kasparov"
              className="mt-1 w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-400">Opening Name</label>
            <input
              type="text"
              value={opening}
              onChange={(e) => setOpening(e.target.value)}
              placeholder="e.g. Sicilian, Queen's Gambit"
              className="mt-1 w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-400">ECO Code</label>
            <input
              type="text"
              value={eco}
              onChange={(e) => setEco(e.target.value)}
              placeholder="e.g. B90, C41"
              maxLength={3}
              className="mt-1 w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 placeholder-slate-600 uppercase focus:outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-400">Result</label>
            <select
              value={result}
              onChange={(e) => setResult(e.target.value)}
              className="mt-1 w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
            >
              <option value="">All Results</option>
              <option value="1-0">1-0 (White Wins)</option>
              <option value="0-1">0-1 (Black Wins)</option>
              <option value="1/2-1/2">½-½ (Draw)</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-400">Tactical Motif</label>
            <select
              value={motif}
              onChange={(e) => setMotif(e.target.value)}
              className="mt-1 w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
            >
              <option value="">All Motifs</option>
              <option value="Queen Sacrifice">Queen Sacrifice</option>
              <option value="Checkmate Attack">Checkmate Attack</option>
              <option value="Knight Fork">Knight Fork</option>
              <option value="Exchange Sacrifice">Exchange Sacrifice</option>
              <option value="Minor Piece Sacrifice">Minor Piece Sacrifice</option>
              <option value="Pawn Storm Attack">Pawn Storm</option>
              <option value="Absolute Pin on King">Absolute Pin on King</option>
              <option value="Pawn Promotion">Pawn Promotion</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-400">Min FIDE Rating</label>
            <input
              type="number"
              value={minRating}
              onChange={(e) => setMinRating(e.target.value)}
              placeholder="e.g. 2600"
              className="mt-1 w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>

        <div className="flex justify-end space-x-2 pt-2 border-t border-slate-800">
          <button
            type="button"
            onClick={clearFilters}
            className="flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
          <button
            type="submit"
            className="flex items-center space-x-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 transition-colors"
          >
            <Search className="w-3.5 h-3.5" />
            <span>Filter Games</span>
          </button>
        </div>
      </form>

      {/* Results Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-12 text-center text-slate-400">Loading master games...</div>
        ) : games.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <p className="text-slate-300 font-semibold">No games match the current criteria.</p>
            <p className="text-xs text-slate-500">Try loosening your filters or resetting the form.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-950/60 border-b border-slate-800 text-slate-400 uppercase tracking-wider font-semibold">
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">White Player</th>
                  <th className="py-3 px-4">Black Player</th>
                  <th className="py-3 px-4 text-center">Result</th>
                  <th className="py-3 px-4">Opening</th>
                  <th className="py-3 px-4">Motifs</th>
                  <th className="py-3 px-4 text-center">Moves</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {games.map((g) => (
                  <tr key={g.game_id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 text-slate-400 font-mono">
                      {g.game_date ? new Date(g.game_date).toLocaleDateString() : 'N/A'}
                    </td>
                    <td className="py-3 px-4">
                      <a href={`/players/${g.white_player_id}`} className="font-semibold text-white hover:text-amber-400 transition-colors">
                        {g.white_player}
                      </a>
                      {g.white_rating && <span className="text-slate-500 ml-1.5 font-mono">({g.white_rating})</span>}
                    </td>
                    <td className="py-3 px-4">
                      <a href={`/players/${g.black_player_id}`} className="font-semibold text-white hover:text-amber-400 transition-colors">
                        {g.black_player}
                      </a>
                      {g.black_rating && <span className="text-slate-500 ml-1.5 font-mono">({g.black_rating})</span>}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="font-mono font-bold px-2 py-0.5 rounded bg-slate-950 text-amber-400 border border-slate-800">
                        {g.result}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-slate-200">{g.opening_name}</span>
                      <span className="text-slate-500 ml-1 font-mono text-[11px]">({g.eco_code})</span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1 max-w-[200px]">
                        {g.motifs && g.motifs.length > 0 ? (
                          g.motifs.slice(0, 2).map((m: any, mi: number) => (
                            <span key={mi} className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-300 border border-rose-500/20">
                              {m.name}
                            </span>
                          ))
                        ) : (
                          <span className="text-slate-600 text-[11px]">Positional</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center font-mono text-slate-400">
                      {g.move_count}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <a
                        href={`/games/${g.game_id}`}
                        className="inline-flex items-center space-x-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-slate-200 font-semibold transition-all text-xs"
                      >
                        <span>Replay</span>
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        <div className="p-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <div>
            Page <span className="font-semibold text-white">{page}</span> of <span className="font-semibold text-white">{totalPages}</span>
          </div>
          <div className="flex space-x-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="p-1.5 rounded bg-slate-800 disabled:opacity-40 hover:bg-slate-700 text-slate-200 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="p-1.5 rounded bg-slate-800 disabled:opacity-40 hover:bg-slate-700 text-slate-200 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

