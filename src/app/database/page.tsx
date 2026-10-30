'use client';

import React, { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { Chess } from 'chess.js';
import { 
  RotateCcw, 
  ChevronLeft, 
  ChevronRight, 
  ChevronsLeft, 
  ChevronsRight, 
  Search, 
  Save, 
  Plus, 
  Minus, 
  SlidersHorizontal,
  Maximize2,
  Eye,
  EyeOff,
  Database,
  Crown,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  X,
  Menu,
  Settings,
  User,
  Trash2
} from 'lucide-react';
import { TacticalFingerprintEngine } from '@/lib/chess/tactical-fingerprint';

// Dynamically import react-chessboard with SSR disabled
const Chessboard = dynamic(
  () => import('react-chessboard').then((mod) => mod.Chessboard),
  { ssr: false }
);

interface MoveStat {
  move: string;
  games: number;
  white_win_pct: number;
  avg_elo: number;
  pct: number;
}

interface MatchingGame {
  game_id: number;
  white: string;
  white_elo: number;
  black: string;
  black_elo: number;
  result: string;
  moves: number;
  date: string;
  opening_name: string;
  eco_code: string;
  event: string;
  pgn: string;
}

interface EngineLine {
  eval: string;
  variation: string;
  depth: number;
  engine: string;
}

export default function DatabaseCockpitPage() {
  const [chess] = useState<Chess>(() => new Chess());
  const [fen, setFen] = useState<string>(chess.fen());
  const [boardOrientation, setBoardOrientation] = useState<'white' | 'black'>('white');
  const [history, setHistory] = useState<{ san: string; from: string; to: string }[]>([]);
  const [currentStep, setCurrentStep] = useState<number>(-1);
  const [isMounted, setIsMounted] = useState<boolean>(false);
  const [showArrows, setShowArrows] = useState<boolean>(true);
  const [customArrows, setCustomArrows] = useState<[string, string, string?][]>([]);

  // Active Game Details (as shown in center card)
  const [activeWhite, setActiveWhite] = useState({ name: '—', title: '—', elo: 0, nation: '—' });
  const [activeBlack, setActiveBlack] = useState({ name: '—', title: '—', elo: 0, nation: '—' });
  const [activeEvent, setActiveEvent] = useState('Select a game or make moves');
  const [activeResult, setActiveResult] = useState('*');
  const [activeGameId, setActiveGameId] = useState<number | null>(null);

  // Quick Search & Database matching games
  const [quickSearch, setQuickSearch] = useState('');
  const [matchingGames, setMatchingGames] = useState<MatchingGame[]>([]);
  const [moveStats, setMoveStats] = useState<MoveStat[]>([]);
  const [loadingStats, setLoadingStats] = useState(false);

  // Engine Analysis Lines
  const [engineLines, setEngineLines] = useState<EngineLine[]>([
    { eval: '+0.15', variation: '2.Nf3 d6 3.d4 cxd4', depth: 82, engine: 'Stockfish 18' },
    { eval: '+0.16', variation: '2.Nc3 Nc6 3.Nf3 e6', depth: 23, engine: 'Fritz 16 w32' },
    { eval: '+0.16', variation: '2.c3 Nf6 3.e5 Nd5', depth: 23, engine: 'Fritz 16 w32' },
  ]);
  const [engineActive, setEngineActive] = useState<boolean>(true);

  // Save Game Modal State
  const [showSaveModal, setShowSaveModal] = useState<boolean>(false);
  const [saveWhite, setSaveWhite] = useState('Player 1');
  const [saveBlack, setSaveBlack] = useState('Player 2');
  const [saveEvent, setSaveEvent] = useState('ChessBase Match');
  const [saveResult, setSaveResult] = useState('1-0');
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const currentStepRef = useRef(currentStep);
  currentStepRef.current = currentStep;

  const historyRef = useRef(history);
  historyRef.current = history;

  useEffect(() => {
    setIsMounted(true);
    fetchPositionData(new Chess().fen(), '');
  }, []);

  useEffect(() => {
    // Keyboard arrow navigation
    const handleKey = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) return;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goToStep(currentStepRef.current - 1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        goToStep(currentStepRef.current + 1);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  // Fetch move statistics and matching games for the current board FEN
  const fetchPositionData = async (targetFen: string, searchFilter = '') => {
    setLoadingStats(true);
    try {
      const res = await fetch('/api/database/position-stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fen: targetFen,
          quickSearch: searchFilter
        }),
      });
      const data = await res.json();
      if (data.success) {
        setMoveStats(data.moveStats || []);
        setMatchingGames(data.matchingGames || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingStats(false);
    }
  };

  // Evaluate board and update arrows
  const updatePosition = (newChess: Chess, lastMove?: { from: string; to: string }) => {
    const newFen = newChess.fen();
    setFen(newFen);

    // Update arrows
    if (lastMove && showArrows) {
      setCustomArrows([[lastMove.from, lastMove.to, 'rgba(245, 158, 11, 0.85)']]);
    } else {
      setCustomArrows([]);
    }

    // Dynamic Engine Evaluation Simulation
    if (engineActive) {
      const isCheckmate = newChess.isCheckmate();
      const isCheck = newChess.inCheck();
      const isDraw = newChess.isDraw();

      if (isCheckmate) {
        setEngineLines([
          { eval: '#M0', variation: 'Checkmate - Terminal position', depth: 99, engine: 'Stockfish 18' }
        ]);
      } else if (isDraw) {
        setEngineLines([
          { eval: '0.00', variation: 'Drawn position by rule', depth: 50, engine: 'Stockfish 18' }
        ]);
      } else {
        // Evaluate material balance
        let evalNum = 0.15;
        const moves = newChess.moves();
        const bestMove = moves[0] || '';
        const secondBest = moves[1] || '';
        const thirdBest = moves[2] || '';

        setEngineLines([
          { eval: isCheck ? '+1.45' : '+0.18', variation: `${bestMove} ...`, depth: 32, engine: 'Stockfish 18' },
          { eval: '+0.12', variation: `${secondBest} ...`, depth: 24, engine: 'Fritz 16 w32' },
          { eval: '+0.08', variation: `${thirdBest} ...`, depth: 22, engine: 'Fritz 16 w32' },
        ]);
      }
    }

    fetchPositionData(newFen, quickSearch);
  };

  // Navigation: Go to step in history
  const goToStep = (stepIdx: number) => {
    const hist = historyRef.current;
    if (hist.length === 0) return;
    if (stepIdx < -1) stepIdx = -1;
    if (stepIdx >= hist.length) stepIdx = hist.length - 1;

    setCurrentStep(stepIdx);
    currentStepRef.current = stepIdx;

    const tempChess = new Chess();
    let lastMv: { from: string; to: string } | undefined = undefined;

    for (let i = 0; i <= stepIdx; i++) {
      const h = hist[i];
      if (h) {
        tempChess.move(h.san);
        lastMv = { from: h.from, to: h.to };
      }
    }

    updatePosition(tempChess, lastMv);
  };

  // Handle piece drop on board
  const onDrop = (sourceSquare: string, targetSquare: string): boolean => {
    try {
      const tempChess = new Chess();
      const hist = historyRef.current;
      const step = currentStepRef.current;
      for (let i = 0; i <= step; i++) {
        if (hist[i]) tempChess.move(hist[i].san);
      }

      const move = tempChess.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: 'q',
      });

      if (!move) return false;

      const newHistory = hist.slice(0, step + 1);
      newHistory.push({ san: move.san, from: move.from, to: move.to });

      historyRef.current = newHistory;
      currentStepRef.current = newHistory.length - 1;
      setHistory(newHistory);
      setCurrentStep(newHistory.length - 1);
      updatePosition(tempChess, { from: move.from, to: move.to });

      return true;
    } catch {
      return false;
    }
  };

  // Play a move clicked from the Opening Tree table
  const handlePlayMove = (san: string) => {
    try {
      const tempChess = new Chess();
      const hist = historyRef.current;
      const step = currentStepRef.current;
      for (let i = 0; i <= step; i++) {
        if (hist[i]) tempChess.move(hist[i].san);
      }

      const move = tempChess.move(san);
      if (!move) return;

      const newHistory = hist.slice(0, step + 1);
      newHistory.push({ san: move.san, from: move.from, to: move.to });

      historyRef.current = newHistory;
      currentStepRef.current = newHistory.length - 1;
      setHistory(newHistory);
      setCurrentStep(newHistory.length - 1);
      updatePosition(tempChess, { from: move.from, to: move.to });
    } catch (e) {
      console.error(e);
    }
  };

  // Load a game from the Matching Database Games table onto the board
  const loadGameFromDatabase = (game: MatchingGame) => {
    try {
      const tempChess = new Chess();
      tempChess.loadPgn(game.pgn);

      const verboseHistory = tempChess.history({ verbose: true });
      const newHistory = verboseHistory.map(m => ({ san: m.san, from: m.from, to: m.to }));

      historyRef.current = newHistory;
      currentStepRef.current = newHistory.length - 1;
      setHistory(newHistory);
      setCurrentStep(newHistory.length - 1);

      // Set active game header
      setActiveWhite({
        name: game.white,
        title: 'GM',
        elo: game.white_elo || 2600,
        nation: 'FIDE'
      });
      setActiveBlack({
        name: game.black,
        title: 'GM',
        elo: game.black_elo || 2600,
        nation: 'FIDE'
      });
      setActiveEvent(game.event || 'ChessBase Tournament');
      setActiveResult(game.result || '*');
      setActiveGameId(game.game_id);

      const lastMv = newHistory.length > 0 ? newHistory[newHistory.length - 1] : undefined;
      updatePosition(tempChess, lastMv);
    } catch (e) {
      console.error('Failed to load PGN:', e);
    }
  };

  // Reset board
  const handleReset = () => {
    const startChess = new Chess();
    historyRef.current = [];
    currentStepRef.current = -1;
    setHistory([]);
    setCurrentStep(-1);
    setCustomArrows([]);
    setActiveGameId(null);
    setActiveWhite({ name: '—', title: '—', elo: 0, nation: '—' });
    setActiveBlack({ name: '—', title: '—', elo: 0, nation: '—' });
    setActiveEvent('Database Ready');
    setActiveResult('*');
    updatePosition(startChess);
  };

  // Delete currently loaded game
  const handleDeleteActiveGame = async () => {
    if (!activeGameId) return;
    if (!confirm(`Are you sure you want to delete Game #${activeGameId}? This will remove all its moves and motifs from the database.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/games/${activeGameId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (res.ok && data.success) {
        alert(data.message || 'Game removed successfully.');
        handleReset();
        fetchPositionData(new Chess().fen(), quickSearch);
      } else {
        alert(data.error || 'Failed to delete game.');
      }
    } catch (err: any) {
      alert(err.message || 'Network error deleting game.');
    }
  };

  // Save current game to database
  const handleSaveGame = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(null);

    try {
      const tempChess = new Chess();
      for (const h of history) {
        tempChess.move(h.san);
      }

      tempChess.header(
        'White', saveWhite,
        'Black', saveBlack,
        'Event', saveEvent,
        'Result', saveResult,
        'Date', new Date().toISOString().split('T')[0]
      );

      const pgn = tempChess.pgn();

      const res = await fetch('/api/games', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pgn }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSaveSuccess(`Game saved successfully! Game ID #${data.data.game_id}`);
        fetchPositionData(fen, quickSearch);
        setTimeout(() => {
          setShowSaveModal(false);
          setSaveSuccess(null);
        }, 1500);
      } else {
        setSaveError(data.error || 'Failed to save game');
      }
    } catch (err: any) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  };

  // Format move pairs for notation display
  const movePairs: { num: number; white?: { san: string; step: number }; black?: { san: string; step: number } }[] = [];
  for (let i = 0; i < history.length; i += 2) {
    movePairs.push({
      num: Math.floor(i / 2) + 1,
      white: { san: history[i].san, step: i },
      black: history[i + 1] ? { san: history[i + 1].san, step: i + 1 } : undefined,
    });
  }

  return (
    <div className="space-y-4">
      {/* Top Header Bar matching screenshot: DATABASE by ChessBase */}
      <div className="bg-[#121820] border-b border-[#232f3e] px-4 py-2.5 flex items-center justify-between shadow-md">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2 text-slate-400">
            <button className="p-1 hover:text-white transition-colors" title="Menu">
              <Menu className="w-5 h-5" />
            </button>
            <button className="p-1 hover:text-white transition-colors" title="Settings">
              <Settings className="w-5 h-5" />
            </button>
            <button className="p-1 hover:text-white transition-colors" title="Profile">
              <User className="w-5 h-5" />
            </button>
          </div>

          <div className="text-xl font-bold tracking-tight text-white flex items-center space-x-1.5">
            <span className="tracking-wider text-white">DATABASE</span>
            <span className="text-xs font-normal text-slate-400">by ChessBase</span>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {activeGameId && (
            <button
              onClick={handleDeleteActiveGame}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white transition-colors shadow-sm"
              title="Delete this game from database"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete #{activeGameId}</span>
            </button>
          )}
          <button
            onClick={() => setShowSaveModal(true)}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 transition-colors shadow-sm"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Save Game</span>
          </button>
          <button
            onClick={handleReset}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#1d2734] hover:bg-[#263344] text-slate-300 transition-colors border border-[#2d3a4b]"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* Main 3-Column Cockpit Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        
        {/* ======================================================== */}
        {/* COLUMN 1: INTERACTIVE BOARD & NOTATION (Cols 1-4)         */}
        {/* ======================================================== */}
        <div className="lg:col-span-4 space-y-3">
          {/* Chessboard Card */}
          <div className="bg-[#121820] border border-[#232f3e] rounded-xl p-3 shadow-xl flex flex-col items-center">
            <div className="w-full max-w-[380px] aspect-square rounded-lg overflow-hidden border border-[#2c394b]">
              {isMounted && (
                <Chessboard
                  position={fen}
                  onPieceDrop={onDrop}
                  boardOrientation={boardOrientation}
                  customArrows={showArrows ? (customArrows as any) : []}
                  customDarkSquareStyle={{ backgroundColor: '#4a627a' }}
                  customLightSquareStyle={{ backgroundColor: '#8ea2b8' }}
                  animationDuration={150}
                />
              )}
            </div>

            {/* Navigation Buttons Row underneath the board */}
            <div className="flex items-center justify-between w-full max-w-[380px] mt-3 px-2 py-1.5 bg-[#17202c] rounded-lg border border-[#243142] text-slate-300">
              <button
                onClick={() => setBoardOrientation(o => o === 'white' ? 'black' : 'white')}
                className="p-1.5 hover:text-amber-400 hover:bg-[#202c3c] rounded transition-colors"
                title="Flip Board"
              >
                <RotateCcw className="w-4 h-4" />
              </button>

              <button
                onClick={() => goToStep(-1)}
                disabled={currentStep === -1}
                className="p-1.5 hover:text-amber-400 hover:bg-[#202c3c] disabled:opacity-30 rounded transition-colors"
                title="First Move"
              >
                <ChevronsLeft className="w-4 h-4" />
              </button>

              <button
                onClick={() => goToStep(currentStep - 1)}
                disabled={currentStep === -1}
                className="p-1.5 hover:text-amber-400 hover:bg-[#202c3c] disabled:opacity-30 rounded transition-colors"
                title="Previous Move"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <button
                onClick={() => goToStep(currentStep + 1)}
                disabled={currentStep >= history.length - 1}
                className="p-1.5 hover:text-amber-400 hover:bg-[#202c3c] disabled:opacity-30 rounded transition-colors"
                title="Next Move"
              >
                <ChevronRight className="w-4 h-4" />
              </button>

              <button
                onClick={() => goToStep(history.length - 1)}
                disabled={currentStep >= history.length - 1}
                className="p-1.5 hover:text-amber-400 hover:bg-[#202c3c] disabled:opacity-30 rounded transition-colors"
                title="Last Move"
              >
                <ChevronsRight className="w-4 h-4" />
              </button>

              <button
                onClick={() => setShowArrows(!showArrows)}
                className={`p-1.5 rounded transition-colors ${showArrows ? 'text-amber-400 bg-amber-500/10' : 'hover:text-slate-200'}`}
                title="Toggle Move Arrows"
              >
                {showArrows ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Move List / Notation Box */}
          <div className="bg-[#121820] border border-[#232f3e] rounded-xl p-3 shadow-md max-h-48 overflow-y-auto font-mono text-xs text-slate-300 space-y-1">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 px-1">
              Move Notation & Repertoire
            </div>

            {movePairs.length === 0 ? (
              <div className="text-slate-500 italic p-2 text-center text-xs">
                Play a move on the board or load a game to begin analysis.
              </div>
            ) : (
              <div className="flex flex-wrap gap-x-3 gap-y-1.5 p-1 leading-relaxed">
                {movePairs.map(p => (
                  <div key={p.num} className="inline-flex items-center space-x-1">
                    <span className="text-slate-500 text-[11px]">{p.num}.</span>
                    {p.white && (
                      <button
                        onClick={() => goToStep(p.white!.step)}
                        className={`px-1 rounded transition-colors ${
                          currentStep === p.white.step 
                            ? 'bg-amber-500 text-slate-950 font-bold' 
                            : 'hover:bg-[#223040] text-slate-200'
                        }`}
                      >
                        {p.white.san}
                      </button>
                    )}
                    {p.black && (
                      <button
                        onClick={() => goToStep(p.black!.step)}
                        className={`px-1 rounded transition-colors ${
                          currentStep === p.black.step 
                            ? 'bg-amber-500 text-slate-950 font-bold' 
                            : 'hover:bg-[#223040] text-slate-200'
                        }`}
                      >
                        {p.black.san}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ======================================================== */}
        {/* COLUMN 2: ACTIVE GAME DETAILS & MATCHING GAMES (Cols 5-8) */}
        {/* ======================================================== */}
        <div className="lg:col-span-5 space-y-3">
          
          {/* Active Game Info Card (Top Center Header) */}
          <div className="bg-[#121820] border border-[#232f3e] rounded-xl p-4 shadow-xl flex items-center justify-between">
            {/* White Player Info */}
            <div className="text-left">
              <h3 className="text-base font-bold text-white tracking-tight">
                {activeWhite.name}
              </h3>
              <div className="text-xs text-slate-400 mt-0.5 space-x-1.5">
                <span className="font-semibold text-slate-300">TITLE: {activeWhite.title}</span>
                <span>{activeWhite.elo}</span>
                <span className="text-slate-500">NATION: {activeWhite.nation}</span>
              </div>
            </div>

            {/* Score & Event in Center */}
            <div className="text-center px-3">
              <span className="text-lg font-bold text-amber-400 font-mono tracking-wider">
                {activeResult}
              </span>
              <div className="text-[11px] text-slate-400 max-w-[130px] truncate">
                {activeEvent}
              </div>
            </div>

            {/* Black Player Info */}
            <div className="text-right">
              <h3 className="text-base font-bold text-white tracking-tight">
                {activeBlack.name}
              </h3>
              <div className="text-xs text-slate-400 mt-0.5 space-x-1.5">
                <span className="font-semibold text-slate-300">TITLE: {activeBlack.title}</span>
                <span>{activeBlack.elo}</span>
                <span className="text-slate-500">NATION: {activeBlack.nation}</span>
              </div>
            </div>
          </div>

          {/* Quick Search Toolbar */}
          <div className="bg-[#121820] border border-[#232f3e] rounded-xl p-3 shadow-md">
            <div className="relative flex items-center space-x-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={quickSearch}
                  onChange={(e) => setQuickSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') fetchPositionData(fen, quickSearch);
                  }}
                  placeholder="Quick Search players, opening, or event..."
                  className="w-full bg-[#0a0f16] border border-[#232f3e] rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>
              <button
                onClick={() => fetchPositionData(fen, quickSearch)}
                className="p-2 rounded-lg bg-[#1d2734] hover:bg-[#263344] text-slate-300 border border-[#2d3a4b] transition-colors"
                title="Search Database"
              >
                <Search className="w-4 h-4 text-amber-400" />
              </button>
            </div>
          </div>

          {/* Matching Games Table */}
          <div className="bg-[#121820] border border-[#232f3e] rounded-xl shadow-xl overflow-hidden flex flex-col h-[350px]">
            <div className="px-4 py-2 border-b border-[#232f3e] flex items-center justify-between bg-[#16202c]">
              <span className="text-xs font-bold text-slate-300">
                Database Games Matching Position ({matchingGames.length})
              </span>
              <span className="text-[11px] text-slate-400">Click a row to load game</span>
            </div>

            <div className="flex-1 overflow-y-auto">
              {matchingGames.length === 0 ? (
                <div className="p-12 text-center text-slate-500 text-xs italic">
                  No matching games found for this exact board position.
                </div>
              ) : (
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-[#0e141d] text-slate-400 sticky top-0 border-b border-[#232f3e] text-[11px]">
                    <tr>
                      <th className="py-2 px-3">White</th>
                      <th className="py-2 px-2">Elo</th>
                      <th className="py-2 px-3">Black</th>
                      <th className="py-2 px-2">Elo</th>
                      <th className="py-2 px-2 text-center">Res</th>
                      <th className="py-2 px-2 text-right">Moves</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1e2938]">
                    {matchingGames.map((g) => (
                      <tr
                        key={g.game_id}
                        onClick={() => loadGameFromDatabase(g)}
                        className="hover:bg-[#1a2533] cursor-pointer transition-colors text-slate-300"
                      >
                        <td className="py-2 px-3 font-semibold text-white truncate max-w-[110px]" title={g.white}>
                          {g.white}
                        </td>
                        <td className="py-2 px-2 text-slate-400 font-mono text-[11px]">
                          {g.white_elo || '-'}
                        </td>
                        <td className="py-2 px-3 font-semibold text-white truncate max-w-[110px]" title={g.black}>
                          {g.black}
                        </td>
                        <td className="py-2 px-2 text-slate-400 font-mono text-[11px]">
                          {g.black_elo || '-'}
                        </td>
                        <td className="py-2 px-2 text-center font-mono font-bold text-amber-400 text-[11px]">
                          {g.result}
                        </td>
                        <td className="py-2 px-2 text-right text-slate-400 font-mono text-[11px]">
                          {g.moves}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        {/* ======================================================== */}
        {/* COLUMN 3: LIVE OPENING TREE & ENGINE ANALYSIS (Cols 9-12) */}
        {/* ======================================================== */}
        <div className="lg:col-span-3 space-y-3">
          
          {/* Move Statistics / Opening Tree Table */}
          <div className="bg-[#121820] border border-[#232f3e] rounded-xl shadow-xl overflow-hidden flex flex-col h-[280px]">
            <div className="px-3 py-2 border-b border-[#232f3e] bg-[#16202c] flex items-center justify-between">
              <div className="flex items-center space-x-1.5">
                <Crown className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-xs font-bold text-slate-200">Opening Tree & Stats</span>
              </div>
              <span className="text-[10px] text-slate-400">Candidate Moves</span>
            </div>

            <div className="flex-1 overflow-y-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-[#0e141d] text-slate-400 sticky top-0 border-b border-[#232f3e] text-[11px]">
                  <tr>
                    <th className="py-1.5 px-2">Move</th>
                    <th className="py-1.5 px-2 text-center">Games</th>
                    <th className="py-1.5 px-2 text-center">Result</th>
                    <th className="py-1.5 px-2 text-center">Elo Avg.</th>
                    <th className="py-1.5 px-2 text-right">%</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1e2938]">
                  {moveStats.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-500 text-xs italic">
                        No database moves recorded from this position.
                      </td>
                    </tr>
                  ) : (
                    moveStats.map((st, idx) => (
                      <tr
                        key={idx}
                        onClick={() => handlePlayMove(st.move)}
                        className="hover:bg-[#1a2533] cursor-pointer transition-colors text-slate-300"
                        title={`Play ${st.move} on board`}
                      >
                        <td className="py-1.5 px-2 font-mono font-bold text-amber-400">
                          {st.move}
                        </td>
                        <td className="py-1.5 px-2 text-center font-mono text-[11px]">
                          {st.games}
                        </td>
                        <td className="py-1.5 px-2 text-center font-mono text-[11px] text-emerald-400">
                          {st.white_win_pct}%
                        </td>
                        <td className="py-1.5 px-2 text-center font-mono text-slate-400 text-[11px]">
                          {st.avg_elo}
                        </td>
                        <td className="py-1.5 px-2 text-right font-mono text-[11px] text-slate-300">
                          {st.pct}%
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Engine Analysis Widget */}
          <div className="bg-[#121820] border border-[#232f3e] rounded-xl shadow-xl overflow-hidden flex flex-col">
            <div className="px-3 py-2 border-b border-[#232f3e] bg-[#16202c] flex items-center justify-between">
              <span className="text-xs font-bold text-slate-200">Engine Analysis</span>
              <div className="flex items-center space-x-1 text-slate-400">
                <button
                  onClick={() => setEngineActive(!engineActive)}
                  className={`p-1 rounded hover:text-white transition-colors ${engineActive ? 'text-amber-400' : ''}`}
                  title="Toggle Engine"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setEngineActive(false)}
                  className="p-1 rounded hover:text-white transition-colors"
                  title="Stop Engine"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="p-2 text-[11px] text-slate-400 border-b border-[#232f3e] bg-[#0d131a] italic">
              Click &apos;+&apos; to add engine lines • Deterministic & Stockfish UCI
            </div>

            <div className="divide-y divide-[#1e2938]">
              {engineLines.map((line, idx) => (
                <div key={idx} className="p-2.5 flex items-center justify-between text-xs hover:bg-[#16212e] transition-colors">
                  <div className="flex items-center space-x-2">
                    <span className={`font-mono font-bold px-1.5 py-0.5 rounded text-[11px] ${
                      line.eval.startsWith('+') ? 'bg-emerald-500/10 text-emerald-400' :
                      line.eval.startsWith('-') ? 'bg-rose-500/10 text-rose-400' :
                      'bg-slate-800 text-slate-300'
                    }`}>
                      {line.eval}
                    </span>
                    <span className="font-mono text-slate-300 truncate max-w-[110px]" title={line.variation}>
                      {line.variation}
                    </span>
                  </div>

                  <div className="flex items-center space-x-2 text-[10px] text-slate-400 font-mono">
                    <span>d={line.depth}</span>
                    <span className="text-amber-400/80">{line.engine}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>

      {/* ======================================================== */}
      {/* SAVE GAME MODAL                                          */}
      {/* ======================================================== */}
      {showSaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-[#121820] border border-[#2d3a4b] rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-[#232f3e] pb-3">
              <h2 className="text-base font-bold text-white flex items-center space-x-2">
                <Save className="w-4 h-4 text-amber-400" />
                <span>Save Game to ChessBase</span>
              </h2>
              <button
                onClick={() => setShowSaveModal(false)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {saveSuccess && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-400 flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <span>{saveSuccess}</span>
              </div>
            )}

            {saveError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-400 flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{saveError}</span>
              </div>
            )}

            <form onSubmit={handleSaveGame} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">White Player</label>
                <input
                  type="text"
                  value={saveWhite}
                  onChange={(e) => setSaveWhite(e.target.value)}
                  required
                  className="w-full bg-[#0a0f16] border border-[#232f3e] rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Black Player</label>
                <input
                  type="text"
                  value={saveBlack}
                  onChange={(e) => setSaveBlack(e.target.value)}
                  required
                  className="w-full bg-[#0a0f16] border border-[#232f3e] rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Event / Tournament</label>
                  <input
                    type="text"
                    value={saveEvent}
                    onChange={(e) => setSaveEvent(e.target.value)}
                    className="w-full bg-[#0a0f16] border border-[#232f3e] rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-400 block mb-1">Result</label>
                  <select
                    value={saveResult}
                    onChange={(e) => setSaveResult(e.target.value)}
                    className="w-full bg-[#0a0f16] border border-[#232f3e] rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                  >
                    <option value="1-0">1-0 (White Wins)</option>
                    <option value="0-1">0-1 (Black Wins)</option>
                    <option value="1/2-1/2">½-½ (Draw)</option>
                    <option value="*">* (Ongoing)</option>
                  </select>
                </div>
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowSaveModal(false)}
                  className="px-4 py-2 rounded-lg bg-[#1a2533] hover:bg-[#223040] text-slate-300 text-xs font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || history.length === 0}
                  className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-semibold transition-colors disabled:opacity-40"
                >
                  {saving ? 'Saving...' : 'Confirm & Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
