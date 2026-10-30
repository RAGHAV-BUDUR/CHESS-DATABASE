'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { 
  Search, 
  Filter, 
  BookOpen, 
  ChevronLeft, 
  ChevronRight, 
  X, 
  Sparkles, 
  Crown,
  Trash2,
  Edit3,
  Check,
  AlertCircle
} from 'lucide-react';

function GamesExplorerContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [games, setGames] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Filters initialized from URL query parameters
  const [player, setPlayer] = useState(searchParams.get('player') || '');
  const [opening, setOpening] = useState(searchParams.get('opening') || '');
  const [eco, setEco] = useState(searchParams.get('eco') || '');
  const [result, setResult] = useState(searchParams.get('result') || '');
  const [motif, setMotif] = useState(searchParams.get('motif') || '');
  const [minRating, setMinRating] = useState(searchParams.get('minRating') || '');

  // Edit Game Modal State
  const [editingGame, setEditingGame] = useState<any | null>(null);
  const [editWhite, setEditWhite] = useState('');
  const [editBlack, setEditBlack] = useState('');
  const [editWhiteRating, setEditWhiteRating] = useState('');
  const [editBlackRating, setEditBlackRating] = useState('');
  const [editEvent, setEditEvent] = useState('');
  const [editResult, setEditResult] = useState('1-0');
  const [editOpening, setEditOpening] = useState('');
  const [editEco, setEditEco] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Synchronize state when URL query parameters change (e.g. from Opening Tree "View Games")
  useEffect(() => {
    const qEco = searchParams.get('eco') || '';
    const qOpening = searchParams.get('opening') || '';
    const qPlayer = searchParams.get('player') || '';
    const qMotif = searchParams.get('motif') || '';
    const qResult = searchParams.get('result') || '';
    const qMinRating = searchParams.get('minRating') || '';

    setEco(qEco);
    setOpening(qOpening);
    setPlayer(qPlayer);
    setMotif(qMotif);
    setResult(qResult);
    setMinRating(qMinRating);
    setPage(1);
  }, [searchParams]);

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
  }, [page, eco, opening, player, motif, result, minRating]);

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
    router.push('/games');
  };

  // Delete Game handler
  const handleDeleteGame = async (gameId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Are you sure you want to permanently delete Game #${gameId}?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/games/${gameId}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok && data.success) {
        setGames(prev => prev.filter(g => g.game_id !== gameId));
        setTotalCount(prev => Math.max(0, prev - 1));
      } else {
        alert(data.error || 'Failed to delete game.');
      }
    } catch (err: any) {
      alert(err.message || 'Network error deleting game.');
    }
  };

  // Open Edit Modal
  const openEditModal = (g: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingGame(g);
    setEditWhite(g.white_player || '');
    setEditBlack(g.black_player || '');
    setEditWhiteRating(g.white_rating ? g.white_rating.toString() : '');
    setEditBlackRating(g.black_rating ? g.black_rating.toString() : '');
    setEditEvent(g.tournament_name || '');
    setEditResult(g.result || '1-0');
    setEditOpening(g.opening_name || '');
    setEditEco(g.eco_code || '');
    setEditError(null);
  };

  // Save Edit Game
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingGame) return;

    setEditSaving(true);
    setEditError(null);

    try {
      const res = await fetch(`/api/games/${editingGame.game_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          whitePlayer: editWhite,
          blackPlayer: editBlack,
          whiteRating: editWhiteRating,
          blackRating: editBlackRating,
          eventName: editEvent,
          result: editResult,
          openingName: editOpening,
          ecoCode: editEco,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        // Update local game record
        setGames(prev => prev.map(g => {
          if (g.game_id === editingGame.game_id) {
            return {
              ...g,
              white_player: editWhite,
              black_player: editBlack,
              white_rating: editWhiteRating ? parseInt(editWhiteRating, 10) : null,
              black_rating: editBlackRating ? parseInt(editBlackRating, 10) : null,
              tournament_name: editEvent,
              result: editResult,
              opening_name: editOpening,
              eco_code: editEco,
            };
          }
          return g;
        }));
        setEditingGame(null);
      } else {
        setEditError(data.error || 'Failed to update game details.');
      }
    } catch (err: any) {
      setEditError(err.message || 'Network error.');
    } finally {
      setEditSaving(false);
    }
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
            Browse, replay, edit, or delete games from the database ({totalCount} total games recorded).
          </p>
        </div>
      </div>

      {/* Active Filter Banner */}
      {(eco || opening || player || motif) && (
        <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-300">
          <div className="flex items-center space-x-2">
            <Crown className="w-4 h-4 text-amber-400" />
            <span>
              Active Filter: {eco && <span className="font-mono font-bold bg-amber-500/20 px-1.5 py-0.5 rounded text-amber-300 mr-1.5">{eco}</span>}
              {opening && <span className="font-semibold text-white mr-1.5">{opening}</span>}
              {player && <span className="text-slate-300 mr-1.5">Player: {player}</span>}
              {motif && <span className="text-slate-300">Motif: {motif}</span>}
            </span>
          </div>
          <button
            onClick={clearFilters}
            className="flex items-center space-x-1 px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 transition-colors font-medium"
          >
            <X className="w-3.5 h-3.5" />
            <span>Show All Games</span>
          </button>
        </div>
      )}

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
                  <th className="py-3 px-4 text-right">Actions</th>
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
                      <div className="inline-flex items-center space-x-1.5">
                        <a
                          href={`/games/${g.game_id}`}
                          className="px-2.5 py-1 rounded bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-slate-200 font-semibold transition-all text-xs"
                          title="Replay Game"
                        >
                          Replay
                        </a>
                        <button
                          onClick={(e) => openEditModal(g, e)}
                          className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-amber-400 transition-colors"
                          title="Edit Game Details"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => handleDeleteGame(g.game_id, e)}
                          className="p-1 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 transition-colors"
                          title="Delete Game"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
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

      {/* Edit Game Modal */}
      {editingGame && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-[#121820] border border-[#232f3e] rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#232f3e] pb-3">
              <h3 className="text-base font-bold text-white flex items-center space-x-2">
                <Edit3 className="w-4 h-4 text-amber-400" />
                <span>Modify Game Entry #{editingGame.game_id}</span>
              </h3>
              <button
                onClick={() => setEditingGame(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {editError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-400 text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{editError}</span>
              </div>
            )}

            <form onSubmit={handleSaveEdit} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-300">White Player</label>
                  <input
                    type="text"
                    value={editWhite}
                    onChange={(e) => setEditWhite(e.target.value)}
                    required
                    className="mt-1 w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-300">White Elo</label>
                  <input
                    type="number"
                    value={editWhiteRating}
                    onChange={(e) => setEditWhiteRating(e.target.value)}
                    placeholder="e.g. 2700"
                    className="mt-1 w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-300">Black Player</label>
                  <input
                    type="text"
                    value={editBlack}
                    onChange={(e) => setEditBlack(e.target.value)}
                    required
                    className="mt-1 w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-300">Black Elo</label>
                  <input
                    type="number"
                    value={editBlackRating}
                    onChange={(e) => setEditBlackRating(e.target.value)}
                    placeholder="e.g. 2700"
                    className="mt-1 w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-300">Tournament / Event</label>
                  <input
                    type="text"
                    value={editEvent}
                    onChange={(e) => setEditEvent(e.target.value)}
                    placeholder="e.g. FIDE Candidates"
                    className="mt-1 w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-300">Game Result</label>
                  <select
                    value={editResult}
                    onChange={(e) => setEditResult(e.target.value)}
                    className="mt-1 w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 focus:outline-none focus:border-amber-500"
                  >
                    <option value="1-0">1-0 (White Wins)</option>
                    <option value="0-1">0-1 (Black Wins)</option>
                    <option value="1/2-1/2">½-½ (Draw)</option>
                    <option value="*">* (In Progress / Unknown)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-300">Opening Name</label>
                  <input
                    type="text"
                    value={editOpening}
                    onChange={(e) => setEditOpening(e.target.value)}
                    placeholder="e.g. Sicilian Defense"
                    className="mt-1 w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-300">ECO Code</label>
                  <input
                    type="text"
                    value={editEco}
                    onChange={(e) => setEditEco(e.target.value)}
                    placeholder="e.g. B90"
                    maxLength={3}
                    className="mt-1 w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 uppercase focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-[#232f3e]">
                <button
                  type="button"
                  onClick={() => setEditingGame(null)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editSaving}
                  className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold transition-colors"
                >
                  {editSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function GamesPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-col items-center justify-center py-20 space-y-3">
        <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm text-slate-400">Loading games...</p>
      </div>
    }>
      <GamesExplorerContent />
    </Suspense>
  );
}
