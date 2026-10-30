'use client';

import React, { useState, useEffect } from 'react';
import { Users, Search, Trophy, ArrowRight, ArrowUpDown } from 'lucide-react';

export default function PlayersPage() {
  const [players, setPlayers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('rating');

  const fetchPlayers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('q', search);
      params.set('sortBy', sortBy);

      const res = await fetch(`/api/players?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        setPlayers(json.data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlayers();
  }, [sortBy]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchPlayers();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center space-x-2">
            <Users className="w-6 h-6 text-amber-400" />
            <span>Master Players Directory & Leaderboard</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Browse grandmasters, FIDE ratings, performance records, and historical game archives.
          </p>
        </div>
      </div>

      {/* Controls */}
      <form onSubmit={handleSearchSubmit} className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search player name or country (e.g. Fischer, Kasparov, United States)..."
            className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500"
          />
        </div>

        <div className="flex items-center space-x-2">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
          >
            <option value="rating">Sort by FIDE Rating</option>
            <option value="games">Sort by Total Games</option>
            <option value="wins">Sort by Wins</option>
            <option value="name">Sort by Name</option>
          </select>
          <button
            type="submit"
            className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-semibold transition-colors"
          >
            Search
          </button>
        </div>
      </form>

      {/* Players Table */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-3">
          <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm text-slate-400">Loading grandmaster records from PostgreSQL...</p>
        </div>
      ) : players.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center space-y-3">
          <Users className="w-8 h-8 text-slate-600 mx-auto" />
          <h3 className="text-base font-bold text-slate-200">No players found</h3>
          <p className="text-xs text-slate-400">Try a different name or search query.</p>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/80 text-slate-400 font-semibold border-b border-slate-800 uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4">Rank</th>
                  <th className="py-3 px-4">Player</th>
                  <th className="py-3 px-4">Country</th>
                  <th className="py-3 px-4 text-right">FIDE Rating</th>
                  <th className="py-3 px-4 text-center">Games</th>
                  <th className="py-3 px-4 text-center">Score (W / D / L)</th>
                  <th className="py-3 px-4 text-right">Win Rate</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {players.map((p, idx) => (
                  <tr key={p.player_id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 text-slate-500">#{p.rating_rank || idx + 1}</td>
                    <td className="py-3 px-4 font-sans font-bold text-white">
                      <a href={`/players/${p.player_id}`} className="hover:text-amber-400 transition-colors flex items-center space-x-1.5">
                        <span>{p.name}</span>
                        {p.title && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-400 font-mono">
                            {p.title}
                          </span>
                        )}
                      </a>
                    </td>
                    <td className="py-3 px-4 font-sans text-slate-400">{p.country || 'International'}</td>
                    <td className="py-3 px-4 text-right font-bold text-amber-400">{p.fide_rating || 'N/A'}</td>
                    <td className="py-3 px-4 text-center text-slate-300">{p.total_games}</td>
                    <td className="py-3 px-4 text-center">
                      <span className="text-emerald-400">{p.total_wins}</span>
                      <span className="text-slate-500"> / </span>
                      <span className="text-slate-400">{p.total_draws}</span>
                      <span className="text-slate-500"> / </span>
                      <span className="text-rose-400">{p.total_losses}</span>
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-emerald-400">
                      {p.win_rate !== null ? `${p.win_rate}%` : 'N/A'}
                    </td>
                    <td className="py-3 px-4 text-right font-sans">
                      <a
                        href={`/players/${p.player_id}`}
                        className="inline-flex items-center space-x-1 text-xs text-amber-400 hover:text-amber-300 font-medium"
                      >
                        <span>Dashboard</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

