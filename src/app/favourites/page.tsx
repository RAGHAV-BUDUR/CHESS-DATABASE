'use client';

import React, { useState, useEffect } from 'react';
import { Star, Trash2, ArrowRight, BookOpen, Users, AlertCircle } from 'lucide-react';

export default function FavouritesPage() {
  const [favourites, setFavourites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [authRequired, setAuthRequired] = useState(false);

  const fetchFavourites = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/favourites');
      if (res.status === 401) {
        setAuthRequired(true);
        setLoading(false);
        return;
      }
      const json = await res.json();
      if (json.success) setFavourites(json.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFavourites();
  }, []);

  const removeFavourite = async (id: number) => {
    try {
      const res = await fetch(`/api/favourites?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        setFavourites(prev => prev.filter(f => f.fav_id !== id));
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (authRequired) {
    return (
      <div className="max-w-md mx-auto my-16 bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center space-y-4 shadow-2xl">
        <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
          <Star className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-white">Sign In Required</h2>
        <p className="text-xs text-slate-400">
          Please log in to your account to view and manage your saved master games and favorite players.
        </p>
        <div className="pt-2">
          <a
            href="/login"
            className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs transition-colors shadow-md"
          >
            <span>Go to Sign In</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center space-x-2">
          <Star className="w-6 h-6 text-amber-400" />
          <span>My Saved Favourites</span>
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Your bookmarked games and grandmaster players stored in PostgreSQL table <code className="text-amber-400">user_favourites</code>.
        </p>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-3">
          <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm text-slate-400">Loading your saved items...</p>
        </div>
      ) : favourites.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center space-y-3">
          <Star className="w-8 h-8 text-slate-600 mx-auto" />
          <h3 className="text-base font-bold text-slate-200">No favourites saved yet</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Browse the Master Games Explorer or Players Leaderboard and click bookmark to save items here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {favourites.map((fav) => (
            <div
              key={fav.fav_id}
              className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl p-4 flex flex-col justify-between space-y-3 shadow-md"
            >
              {fav.game_id ? (
                <div>
                  <div className="flex justify-between items-start">
                    <span className="px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-bold font-mono">
                      GAME #{fav.game_id}
                    </span>
                    <button
                      onClick={() => removeFavourite(fav.fav_id)}
                      className="text-slate-500 hover:text-rose-400 transition-colors p-1"
                      title="Remove"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <h3 className="text-sm font-bold text-white mt-2">
                    {fav.white_player} vs {fav.black_player}
                  </h3>
                  <div className="text-xs text-slate-400 mt-1">
                    {fav.eco_code} • {fav.opening_name} ({fav.result})
                  </div>
                  <div className="pt-3">
                    <a
                      href={`/games/${fav.game_id}`}
                      className="inline-flex items-center space-x-1 text-xs text-amber-400 hover:text-amber-300 font-medium"
                    >
                      <span>Replay Game</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex justify-between items-start">
                    <span className="px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] font-bold font-mono">
                      PLAYER
                    </span>
                    <button
                      onClick={() => removeFavourite(fav.fav_id)}
                      className="text-slate-500 hover:text-rose-400 transition-colors p-1"
                      title="Remove"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <h3 className="text-sm font-bold text-white mt-2">
                    {fav.player_name}
                  </h3>
                  <div className="text-xs text-slate-400 mt-1">
                    Rating: {fav.fide_rating || 'N/A'} • {fav.country || 'International'}
                  </div>
                  <div className="pt-3">
                    <a
                      href={`/players/${fav.player_id}`}
                      className="inline-flex items-center space-x-1 text-xs text-amber-400 hover:text-amber-300 font-medium"
                    >
                      <span>View Profile</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

