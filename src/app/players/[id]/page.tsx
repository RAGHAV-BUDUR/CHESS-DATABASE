'use client';

import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Trophy, 
  Award, 
  TrendingUp, 
  Calendar, 
  Globe, 
  ArrowLeft, 
  BookOpen, 
  CheckCircle, 
  XCircle, 
  MinusCircle, 
  ArrowRight,
  Star,
  X
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';

export default function PlayerDashboardPage({ params }: { params: { id: string } }) {
  const playerId = params.id;
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  // Bookmark / Favourites State
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [bookmarkNote, setBookmarkNote] = useState('');
  const [showBookmarkModal, setShowBookmarkModal] = useState(false);
  const [bookmarkSaving, setBookmarkSaving] = useState(false);

  const checkBookmark = () => {
    fetch(`/api/favourites?playerId=${playerId}`)
      .then((res) => {
        if (res.ok) return res.json();
        return null;
      })
      .then((json) => {
        if (json?.success) {
          setIsBookmarked(json.isFavourite);
          if (json.note) setBookmarkNote(json.note);
        }
      })
      .catch(() => {});
  };

  const handleSaveBookmark = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setBookmarkSaving(true);
    try {
      const res = await fetch('/api/favourites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId: parseInt(playerId, 10), note: bookmarkNote })
      });
      if (res.status === 401) {
        if (confirm('You must be signed in to favourite players. Go to login page?')) {
          window.location.href = '/login';
        }
        return;
      }
      const json = await res.json();
      if (json.success) {
        setIsBookmarked(true);
        setShowBookmarkModal(false);
      } else {
        alert(json.error || 'Failed to save favourite');
      }
    } catch (err: any) {
      alert(err.message || 'Error saving favourite');
    } finally {
      setBookmarkSaving(false);
    }
  };

  const handleRemoveBookmark = async () => {
    if (!confirm('Remove this player from your favourites?')) return;
    try {
      const res = await fetch(`/api/favourites?playerId=${playerId}`, { method: 'DELETE' });
      if (res.status === 401) {
        window.location.href = '/login';
        return;
      }
      const json = await res.json();
      if (json.success) {
        setIsBookmarked(false);
        setBookmarkNote('');
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    setIsMounted(true);
    checkBookmark();
    fetch(`/api/players/${playerId}`)
      .then((res) => {
        if (!res.ok) throw new Error('Player not found');
        return res.json();
      })
      .then((json) => {
        if (json.success) setData(json);
        else setError(json.error || 'Failed to load player');
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [playerId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[450px] space-y-4">
        <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm text-slate-400">Loading grandmaster statistics from stored functions...</p>
      </div>
    );
  }

  if (error || !data?.stats) {
    return (
      <div className="max-w-xl mx-auto my-12 p-8 bg-slate-900 border border-rose-500/30 rounded-2xl text-center space-y-4">
        <h2 className="text-xl font-bold text-rose-400">Player Not Found</h2>
        <p className="text-slate-400 text-sm">{error || 'Unable to retrieve statistics.'}</p>
        <a
          href="/players"
          className="inline-flex items-center space-x-2 px-4 py-2 rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700 text-sm font-medium"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Return to Players Directory</span>
        </a>
      </div>
    );
  }

  const { stats, ratingHistory = [], topOpenings = [], recentGames = [] } = data;

  const total = parseInt(stats.total_games || '0', 10);
  const wins = parseInt(stats.wins || '0', 10);
  const losses = parseInt(stats.losses || '0', 10);
  const draws = parseInt(stats.draws || '0', 10);
  const winRate = stats.win_rate !== null ? parseFloat(stats.win_rate) : (total > 0 ? ((wins / total) * 100).toFixed(1) : 0);

  // Format rating history for Recharts
  const chartData = ratingHistory.map((item: any) => ({
    date: new Date(item.recorded_date).toLocaleDateString(undefined, { year: 'numeric', month: 'short' }),
    rating: item.rating,
  }));

  return (
    <div className="space-y-8">
      {/* Top Header */}
      <div>
        <a
          href="/players"
          className="inline-flex items-center space-x-1.5 text-xs font-semibold text-amber-400 hover:text-amber-300 mb-2"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to All Players</span>
        </a>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-6">
          <div className="space-y-1">
            <h1 className="text-3xl font-extrabold text-white flex items-center space-x-3">
              <span>{stats.player_name}</span>
              {stats.country && (
                <span className="text-sm px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700 font-normal">
                  {stats.country}
                </span>
              )}
            </h1>
            <p className="text-sm text-slate-400">
              Aggregated career performance computed using PostgreSQL stored function <code className="text-amber-400">get_player_stats()</code>.
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => {
                if (isBookmarked) {
                  handleRemoveBookmark();
                } else {
                  setShowBookmarkModal(true);
                }
              }}
              className={`flex items-center space-x-2 px-4 py-2.5 rounded-2xl text-xs font-semibold transition-all border shadow-md ${
                isBookmarked
                  ? 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border-amber-500/40'
                  : 'bg-slate-900 hover:bg-slate-800 text-slate-200 border-slate-800'
              }`}
              title={isBookmarked ? "Remove from favourites" : "Follow / Bookmark Player"}
            >
              <Star className={`w-4 h-4 ${isBookmarked ? 'fill-amber-400 text-amber-400' : ''}`} />
              <span>{isBookmarked ? 'Favorited Player' : 'Favorite Player'}</span>
            </button>

            <div className="flex items-center space-x-4 bg-slate-900 border border-slate-800 px-5 py-3 rounded-2xl shadow-md">
              <div>
                <div className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Official FIDE</div>
                <div className="text-2xl font-black text-amber-400 font-mono">{stats.fide_rating || 'Unrated'}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Career Overview Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-1">
          <div className="text-xs text-slate-400 flex items-center space-x-1.5">
            <Trophy className="w-4 h-4 text-amber-500" />
            <span>Total Games</span>
          </div>
          <div className="text-2xl font-bold text-white font-mono">{total}</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-1">
          <div className="text-xs text-slate-400 flex items-center space-x-1.5">
            <CheckCircle className="w-4 h-4 text-emerald-400" />
            <span>Victories</span>
          </div>
          <div className="text-2xl font-bold text-emerald-400 font-mono">{wins}</div>
          <div className="text-[11px] text-slate-500 font-mono">{winRate}% win rate</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-1">
          <div className="text-xs text-slate-400 flex items-center space-x-1.5">
            <MinusCircle className="w-4 h-4 text-slate-400" />
            <span>Draws</span>
          </div>
          <div className="text-2xl font-bold text-slate-300 font-mono">{draws}</div>
          <div className="text-[11px] text-slate-500 font-mono">
            {total > 0 ? ((draws / total) * 100).toFixed(1) : 0}% draw rate
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-1">
          <div className="text-xs text-slate-400 flex items-center space-x-1.5">
            <XCircle className="w-4 h-4 text-rose-400" />
            <span>Defeats</span>
          </div>
          <div className="text-2xl font-bold text-rose-400 font-mono">{losses}</div>
          <div className="text-[11px] text-slate-500 font-mono">
            {total > 0 ? ((losses / total) * 100).toFixed(1) : 0}% loss rate
          </div>
        </div>
      </div>

      {/* Rating History Chart (Recharts) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200 flex items-center space-x-2">
            <TrendingUp className="w-4 h-4 text-amber-400" />
            <span>Historical Rating Trajectory</span>
          </h3>
          <span className="text-xs text-slate-500 font-mono">
            {chartData.length > 0 ? `${chartData.length} records in rating_history table` : 'No historical rating entries recorded'}
          </span>
        </div>

        {chartData.length > 1 && isMounted ? (
          <div className="h-64 w-full pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={11} domain={['dataMin - 30', 'dataMax + 30']} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }}
                  labelStyle={{ color: '#cbd5e1', fontWeight: 'bold' }}
                />
                <Line 
                  type="monotone" 
                  dataKey="rating" 
                  stroke="#f59e0b" 
                  strokeWidth={2.5} 
                  dot={{ r: 4, fill: '#f59e0b' }} 
                  activeDot={{ r: 6 }} 
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="p-8 text-center bg-slate-950/50 rounded-xl border border-slate-800 text-xs text-slate-400">
            Historical rating progression records are synchronized automatically on game imports. Current recorded rating: <strong className="text-amber-400 font-mono">{stats.fide_rating || 'N/A'}</strong>.
          </div>
        )}
      </div>

      {/* Split Grid: Top Repertoire Openings & Recent Games */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Openings */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200 flex items-center space-x-2">
            <BookOpen className="w-4 h-4 text-amber-400" />
            <span>Most Played Openings</span>
          </h3>

          {topOpenings.length === 0 ? (
            <p className="text-xs text-slate-500 py-6 text-center">No recorded openings for this player.</p>
          ) : (
            <div className="divide-y divide-slate-800/80">
              {topOpenings.map((op: any) => {
                const opTotal = parseInt(op.games_count, 10);
                const opWins = parseInt(op.wins, 10);
                const opRate = opTotal > 0 ? ((opWins / opTotal) * 100).toFixed(0) : 0;

                return (
                  <div key={op.opening_id} className="py-3 flex justify-between items-center text-xs">
                    <div>
                      <div className="font-bold text-white flex items-center space-x-2">
                        <span className="px-1.5 py-0.5 rounded bg-slate-800 text-amber-400 font-mono text-[10px]">
                          {op.eco_code}
                        </span>
                        <span>{op.opening_name}</span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {opTotal} {opTotal === 1 ? 'game' : 'games'} played
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-emerald-400 font-mono">{opRate}%</span>
                      <div className="text-[10px] text-slate-500">win rate</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent Games */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200 flex items-center space-x-2">
            <Calendar className="w-4 h-4 text-amber-400" />
            <span>Recent Tournament Games</span>
          </h3>

          {recentGames.length === 0 ? (
            <p className="text-xs text-slate-500 py-6 text-center">No recent games found.</p>
          ) : (
            <div className="divide-y divide-slate-800/80">
              {recentGames.map((g: any) => (
                <div key={g.game_id} className="py-3 flex justify-between items-center text-xs">
                  <div>
                    <a
                      href={`/games/${g.game_id}`}
                      className="font-bold text-white hover:text-amber-400 transition-colors"
                    >
                      {g.white_player} vs {g.black_player}
                    </a>
                    <div className="text-[11px] text-slate-400 mt-0.5 flex items-center space-x-2">
                      <span>{g.eco_code} • {g.opening_name}</span>
                      {g.game_date && <span>• {new Date(g.game_date).getFullYear()}</span>}
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <span className={`px-2 py-0.5 rounded text-[11px] font-bold font-mono ${
                      (g.white_player === stats.player_name && g.result === '1-0') ||
                      (g.black_player === stats.player_name && g.result === '0-1')
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : g.result === '1/2-1/2'
                        ? 'bg-slate-800 text-slate-300 border border-slate-700'
                        : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                    }`}>
                      {g.result}
                    </span>
                    <a
                      href={`/games/${g.game_id}`}
                      className="p-1 rounded text-slate-400 hover:text-amber-400 transition-colors"
                      title="Replay Game"
                    >
                      <ArrowRight className="w-4 h-4" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Bookmark / Notes Modal */}
      {showBookmarkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl relative space-y-4">
            <button
              onClick={() => setShowBookmarkModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="flex items-center space-x-2">
              <Star className="w-5 h-5 text-amber-400 fill-amber-400" />
              <h2 className="text-lg font-bold text-white">Save Player to Favourites</h2>
            </div>
            <p className="text-xs text-slate-400">
              Bookmark <span className="text-white font-semibold">{stats.player_name}</span> with personal notes to keep track of their games and career repertoire.
            </p>
            <form onSubmit={handleSaveBookmark} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Personal Note (Optional)
                </label>
                <textarea
                  value={bookmarkNote}
                  onChange={(e) => setBookmarkNote(e.target.value)}
                  placeholder="e.g. World champion repertoire, favorite Sicilian games..."
                  rows={3}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-500"
                />
              </div>
              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowBookmarkModal(false)}
                  className="px-3.5 py-2 rounded-xl text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={bookmarkSaving}
                  className="px-4 py-2 rounded-xl text-xs bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold transition-colors flex items-center space-x-1.5"
                >
                  <Star className="w-3.5 h-3.5 fill-slate-950" />
                  <span>{bookmarkSaving ? 'Saving...' : 'Follow Player'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

