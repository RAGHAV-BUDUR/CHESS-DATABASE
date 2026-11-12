'use client';

import React, { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/navigation';
import { useRouter } from 'next/navigation';
import { 
  ChevronLeft, 
  ChevronRight, 
  ChevronsLeft, 
  ChevronsRight, 
  RotateCcw, 
  Download, 
  Copy, 
  Check, 
  Sparkles, 
  User, 
  Calendar, 
  Trophy, 
  BookOpen, 
  Share2, 
  ArrowLeft,
  Volume2,
  Trash2,
  Edit3,
  AlertCircle,
  X,
  Star
} from 'lucide-react';
import { Chess } from 'chess.js';

// Dynamically import Chessboard with SSR disabled to prevent hydration errors
const Chessboard = dynamic(
  () => import('react-chessboard').then((mod) => mod.Chessboard),
  { ssr: false }
);

export default function GameExplorerPage({ params }: { params: { id: string } }) {
  const gameId = params.id;
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Board & Replay State
  const [currentMoveIdx, setCurrentMoveIdx] = useState<number>(-1); // -1 = start position
  const [boardOrientation, setBoardOrientation] = useState<'white' | 'black'>('white');
  const [fen, setFen] = useState<string>('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
  const [copied, setCopied] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  // Edit Modal State
  const [showEditModal, setShowEditModal] = useState(false);
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

  // Bookmark / Favourites State
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [bookmarkNote, setBookmarkNote] = useState('');
  const [showBookmarkModal, setShowBookmarkModal] = useState(false);
  const [bookmarkSaving, setBookmarkSaving] = useState(false);

  const checkBookmark = () => {
    fetch(`/api/favourites?gameId=${gameId}`)
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
        body: JSON.stringify({ gameId: parseInt(gameId, 10), note: bookmarkNote })
      });
      if (res.status === 401) {
        if (confirm('You must be signed in to bookmark games. Go to login page?')) {
          router.push('/login');
        }
        return;
      }
      const json = await res.json();
      if (json.success) {
        setIsBookmarked(true);
        setShowBookmarkModal(false);
      } else {
        alert(json.error || 'Failed to save bookmark');
      }
    } catch (err: any) {
      alert(err.message || 'Error saving bookmark');
    } finally {
      setBookmarkSaving(false);
    }
  };

  const handleRemoveBookmark = async () => {
    if (!confirm('Remove this game from your saved favourites?')) return;
    try {
      const res = await fetch(`/api/favourites?gameId=${gameId}`, { method: 'DELETE' });
      if (res.status === 401) {
        router.push('/login');
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

  const fetchGame = () => {
    fetch(`/api/games/${gameId}`)
      .then((res) => {
        if (!res.ok) throw new Error('Game not found or failed to load');
        return res.json();
      })
      .then((json) => {
        if (json.success) {
          setData(json);
          setFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
          setCurrentMoveIdx(-1);
        } else {
          setError(json.error || 'Failed to fetch game details');
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    setIsMounted(true);
    fetchGame();
    checkBookmark();
  }, [gameId]);

  const handleDeleteGame = async () => {
    if (!confirm(`Are you sure you want to permanently delete Game #${gameId}?`)) return;

    try {
      const res = await fetch(`/api/games/${gameId}`, { method: 'DELETE' });
      const json = await res.json();
      if (res.ok && json.success) {
        alert(json.message || 'Game deleted.');
        router.push('/games');
      } else {
        alert(json.error || 'Failed to delete game.');
      }
    } catch (err: any) {
      alert(err.message || 'Network error deleting game.');
    }
  };

  const openEdit = () => {
    if (!data?.game) return;
    setEditWhite(data.game.white_player || '');
    setEditBlack(data.game.black_player || '');
    setEditWhiteRating(data.game.white_rating ? data.game.white_rating.toString() : '');
    setEditBlackRating(data.game.black_rating ? data.game.black_rating.toString() : '');
    setEditEvent(data.game.tournament_name || '');
    setEditResult(data.game.result || '1-0');
    setEditOpening(data.game.opening_name || '');
    setEditEco(data.game.eco_code || '');
    setEditError(null);
    setShowEditModal(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditSaving(true);
    setEditError(null);

    try {
      const res = await fetch(`/api/games/${gameId}`, {
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

      const json = await res.json();
      if (res.ok && json.success) {
        setShowEditModal(false);
        fetchGame();
      } else {
        setEditError(json.error || 'Failed to update game.');
      }
    } catch (err: any) {
      setEditError(err.message || 'Network error.');
    } finally {
      setEditSaving(false);
    }
  };

  // Navigate to specific move index
  const goToMove = (idx: number) => {
    if (!data?.moves) return;
    if (idx < -1) idx = -1;
    if (idx >= data.moves.length) idx = data.moves.length - 1;

    setCurrentMoveIdx(idx);
    if (idx === -1) {
      setFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
    } else {
      setFen(data.moves[idx].fen_after);
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) return;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goToMove(currentMoveIdx - 1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        goToMove(currentMoveIdx + 1);
      } else if (e.key === 'Home') {
        e.preventDefault();
        goToMove(-1);
      } else if (e.key === 'End') {
        e.preventDefault();
        if (data?.moves) goToMove(data.moves.length - 1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentMoveIdx, data]);

  const copyPgn = () => {
    if (data?.game?.pgn) {
      navigator.clipboard.writeText(data.game.pgn);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const downloadPgn = () => {
    if (!data?.game?.pgn) return;
    const blob = new Blob([data.game.pgn], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `game_${data.game.white_player}_vs_${data.game.black_player}_${data.game.game_id}.pgn`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px] space-y-4">
        <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm text-slate-400">Loading game and verifying moves...</p>
      </div>
    );
  }

  if (error || !data?.game) {
    return (
      <div className="max-w-xl mx-auto my-12 p-8 bg-slate-900 border border-rose-500/30 rounded-2xl text-center space-y-4">
        <h2 className="text-xl font-bold text-rose-400">Unable to load game</h2>
        <p className="text-slate-400 text-sm">{error || 'Game does not exist.'}</p>
        <a
          href="/games"
          className="inline-flex items-center space-x-2 px-4 py-2 rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700 text-sm font-medium"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Return to Games List</span>
        </a>
      </div>
    );
  }

  const { game, moves = [], motifs = [], annotations = [] } = data;

  // Active motif for current move
  const activeMotif = motifs.find((m: any) => {
    if (currentMoveIdx < 0) return false;
    const curMove = moves[currentMoveIdx];
    return m.move_number === curMove?.move_number && m.color === curMove?.color;
  });

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-4">
        <div>
          <a
            href="/games"
            className="inline-flex items-center space-x-1.5 text-xs font-semibold text-amber-400 hover:text-amber-300 mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Explorer</span>
          </a>
          <h1 className="text-2xl font-bold text-white flex items-center space-x-3">
            <span>{game.white_player}</span>
            <span className="text-slate-500 text-lg">vs</span>
            <span>{game.black_player}</span>
            <span className={`text-sm px-2.5 py-0.5 rounded-full font-bold ml-2 ${
              game.result === '1-0' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
              game.result === '0-1' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' :
              'bg-slate-800 text-slate-300 border border-slate-700'
            }`}>
              {game.result}
            </span>
          </h1>
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 mt-1.5">
            {game.opening_name && (
              <a 
                href={`/openings?search=${encodeURIComponent(game.eco_code)}`}
                className="hover:text-amber-400 flex items-center space-x-1"
              >
                <BookOpen className="w-3 h-3 text-amber-500" />
                <span>{game.eco_code} • {game.opening_name}</span>
              </a>
            )}
            {game.tournament_name && (
              <span className="flex items-center space-x-1">
                <Trophy className="w-3 h-3 text-slate-500" />
                <span>{game.tournament_name}</span>
              </span>
            )}
            {game.game_date && (
              <span className="flex items-center space-x-1">
                <Calendar className="w-3 h-3 text-slate-500" />
                <span>{new Date(game.game_date).toLocaleDateString()}</span>
              </span>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-2">
          <button
            onClick={() => {
              if (isBookmarked) {
                handleRemoveBookmark();
              } else {
                setShowBookmarkModal(true);
              }
            }}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
              isBookmarked
                ? 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border-amber-500/40 shadow-sm'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
            }`}
            title={isBookmarked ? "Click to remove bookmark" : "Save to Favourites"}
          >
            <Star className={`w-3.5 h-3.5 ${isBookmarked ? 'fill-amber-400 text-amber-400' : ''}`} />
            <span>{isBookmarked ? 'Saved' : 'Bookmark'}</span>
          </button>
          <button
            onClick={openEdit}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-amber-300 hover:text-amber-200 transition-colors border border-slate-700"
            title="Edit Game Entry"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Edit</span>
          </button>
          <button
            onClick={handleDeleteGame}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 transition-colors border border-rose-500/30"
            title="Delete Game from Database"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete</span>
          </button>
          <button
            onClick={copyPgn}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors border border-slate-700"
            title="Copy PGN"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied' : 'Copy PGN'}</span>
          </button>
          <button
            onClick={downloadPgn}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors border border-slate-700"
            title="Download PGN"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download</span>
          </button>
          <button
            onClick={() => setBoardOrientation(prev => prev === 'white' ? 'black' : 'white')}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 transition-colors border border-amber-500/30"
            title="Flip Board"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Flip ({boardOrientation})</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Board + Move List & Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Interactive Chessboard */}
        <div className="lg:col-span-7 flex flex-col items-center">
          <div className="w-full max-w-[500px] bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl">
            {/* Opponent Info (Top) */}
            <div className="flex justify-between items-center pb-3 text-sm">
              <div className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full ${boardOrientation === 'white' ? 'bg-slate-700 border border-slate-500' : 'bg-slate-200'}`}></div>
                <a 
                  href={`/players/${boardOrientation === 'white' ? game.black_player_id : game.white_player_id}`}
                  className="font-semibold text-white hover:text-amber-400 transition-colors"
                >
                  {boardOrientation === 'white' ? game.black_player : game.white_player}
                </a>
              </div>
              <span className="text-xs text-slate-400">
                Rating: {boardOrientation === 'white' ? (game.black_rating || 'Unrated') : (game.white_rating || 'Unrated')}
              </span>
            </div>

            {/* Chessboard */}
            <div className="relative aspect-square w-full rounded-lg overflow-hidden border border-slate-700 shadow-inner">
              {isMounted && (
                <Chessboard
                  position={fen}
                  boardOrientation={boardOrientation}
                  arePiecesDraggable={false}
                  customBoardStyle={{
                    borderRadius: '4px',
                    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4)',
                  }}
                  customDarkSquareStyle={{ backgroundColor: '#475569' }}
                  customLightSquareStyle={{ backgroundColor: '#cbd5e1' }}
                />
              )}
            </div>

            {/* Player Info (Bottom) */}
            <div className="flex justify-between items-center pt-3 text-sm">
              <div className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full ${boardOrientation === 'white' ? 'bg-slate-200' : 'bg-slate-700 border border-slate-500'}`}></div>
                <a 
                  href={`/players/${boardOrientation === 'white' ? game.white_player_id : game.black_player_id}`}
                  className="font-semibold text-white hover:text-amber-400 transition-colors"
                >
                  {boardOrientation === 'white' ? game.white_player : game.black_player}
                </a>
              </div>
              <span className="text-xs text-slate-400">
                Rating: {boardOrientation === 'white' ? (game.white_rating || 'Unrated') : (game.black_rating || 'Unrated')}
              </span>
            </div>

            {/* Navigation Controls */}
            <div className="mt-4 pt-4 border-t border-slate-800 flex items-center justify-between">
              <div className="text-xs text-slate-400 font-mono">
                Move {currentMoveIdx < 0 ? '0' : Math.floor(currentMoveIdx / 2) + 1} of {Math.ceil(moves.length / 2)}
              </div>
              <div className="flex items-center space-x-1">
                <button
                  onClick={() => goToMove(-1)}
                  disabled={currentMoveIdx === -1}
                  className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-slate-800 text-slate-200 transition-colors"
                  title="First Move (Home)"
                >
                  <ChevronsLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => goToMove(currentMoveIdx - 1)}
                  disabled={currentMoveIdx === -1}
                  className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-slate-800 text-slate-200 transition-colors"
                  title="Previous Move (Left Arrow)"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => goToMove(currentMoveIdx + 1)}
                  disabled={currentMoveIdx >= moves.length - 1}
                  className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-slate-800 text-slate-200 transition-colors"
                  title="Next Move (Right Arrow)"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button
                  onClick={() => goToMove(moves.length - 1)}
                  disabled={currentMoveIdx >= moves.length - 1}
                  className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-slate-800 text-slate-200 transition-colors"
                  title="Last Move (End)"
                >
                  <ChevronsRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Move Notation List & Motif Detection Panel */}
        <div className="lg:col-span-5 space-y-4">
          {/* Active Motif Callout */}
          {activeMotif ? (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 space-y-2 animate-fadeIn">
              <div className="flex items-center justify-between">
                <span className="flex items-center space-x-1.5 text-xs font-bold uppercase tracking-wider text-amber-400">
                  <Sparkles className="w-4 h-4" />
                  <span>Tactical Motif Detected: {activeMotif.motif_name}</span>
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono">
                  {activeMotif.confidence}
                </span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                {activeMotif.rationale}
              </p>
              <div className="text-[11px] text-slate-400 flex items-center space-x-3 pt-1 border-t border-amber-500/20">
                <span>Move {activeMotif.move_number}. {activeMotif.move_san}</span>
                <span>Material Impact: {activeMotif.material_change > 0 ? `+${activeMotif.material_change}` : activeMotif.material_change}</span>
              </div>
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 text-xs text-slate-400 flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-slate-600" />
              <span>Step through moves or click on highlighted moves below to inspect tactical motifs.</span>
            </div>
          )}

          {/* Move Sequence List */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
            <div className="bg-slate-950 px-4 py-3 border-b border-slate-800 flex justify-between items-center">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Move List ({moves.length} Half-Moves)
              </h3>
              <span className="text-[11px] text-slate-500 font-mono">Algebraic SAN</span>
            </div>

            <div className="max-h-[360px] overflow-y-auto p-2 divide-y divide-slate-800/40 text-xs font-mono">
              {Array.from({ length: Math.ceil(moves.length / 2) }).map((_, moveRowIdx) => {
                const moveNum = moveRowIdx + 1;
                const whiteMove = moves[moveRowIdx * 2];
                const blackMove = moves[moveRowIdx * 2 + 1];

                const isWhiteActive = currentMoveIdx === moveRowIdx * 2;
                const isBlackActive = currentMoveIdx === moveRowIdx * 2 + 1;

                const whiteHasMotif = motifs.some((m: any) => m.move_number === moveNum && m.color === 'white');
                const blackHasMotif = motifs.some((m: any) => m.move_number === moveNum && m.color === 'black');

                return (
                  <div key={moveRowIdx} className="grid grid-cols-12 py-1 px-2 items-center hover:bg-slate-800/30 rounded transition-colors">
                    <span className="col-span-2 text-slate-500">{moveNum}.</span>

                    {/* White Move */}
                    <button
                      onClick={() => goToMove(moveRowIdx * 2)}
                      className={`col-span-5 text-left px-2 py-1 rounded transition-colors flex items-center justify-between ${
                        isWhiteActive 
                          ? 'bg-amber-500 text-slate-950 font-bold' 
                          : 'text-slate-200 hover:bg-slate-800'
                      }`}
                    >
                      <span>{whiteMove ? whiteMove.san : ''}</span>
                      {whiteHasMotif && (
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" title="Motif Detected"></span>
                      )}
                    </button>

                    {/* Black Move */}
                    {blackMove ? (
                      <button
                        onClick={() => goToMove(moveRowIdx * 2 + 1)}
                        className={`col-span-5 text-left px-2 py-1 rounded transition-colors flex items-center justify-between ${
                          isBlackActive 
                            ? 'bg-amber-500 text-slate-950 font-bold' 
                            : 'text-slate-200 hover:bg-slate-800'
                        }`}
                      >
                        <span>{blackMove.san}</span>
                        {blackHasMotif && (
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" title="Motif Detected"></span>
                        )}
                      </button>
                    ) : (
                      <span className="col-span-5"></span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* All Detected Motifs In Game */}
          {motifs.length > 0 && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center space-x-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>All Engine-Detected Motifs in Game ({motifs.length})</span>
              </h4>
              <div className="flex flex-wrap gap-2">
                {motifs.map((m: any, idx: number) => {
                  const targetMoveIdx = moves.findIndex((mv: any) => mv.move_number === m.move_number && mv.color === m.color);
                  return (
                    <button
                      key={idx}
                      onClick={() => targetMoveIdx >= 0 && goToMove(targetMoveIdx)}
                      className="px-2.5 py-1 rounded-md text-xs font-medium bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 hover:border-amber-500/50 transition-colors flex items-center space-x-1.5"
                    >
                      <span>{m.move_number}. {m.move_san}</span>
                      <span className="text-slate-400">• {m.motif_name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Edit Game Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-[#121820] border border-[#232f3e] rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#232f3e] pb-3">
              <h3 className="text-base font-bold text-white flex items-center space-x-2">
                <Edit3 className="w-4 h-4 text-amber-400" />
                <span>Modify Game Entry #{gameId}</span>
              </h3>
              <button
                onClick={() => setShowEditModal(false)}
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
                  onClick={() => setShowEditModal(false)}
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
              <h2 className="text-lg font-bold text-white">Save Game to Favourites</h2>
            </div>
            <p className="text-xs text-slate-400">
              Bookmark <span className="text-white font-semibold">{game.white_player} vs {game.black_player}</span> with an optional study note for future review.
            </p>
            <form onSubmit={handleSaveBookmark} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Study Note (Optional)
                </label>
                <textarea
                  value={bookmarkNote}
                  onChange={(e) => setBookmarkNote(e.target.value)}
                  placeholder="e.g. Masterclass in queen sacrifices, key endgame ideas..."
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
                  <span>{bookmarkSaving ? 'Saving...' : 'Save Bookmark'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

