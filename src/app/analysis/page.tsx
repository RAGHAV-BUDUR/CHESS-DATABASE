'use client';

import React, { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { Chess } from 'chess.js';
import { 
  Play, 
  RotateCcw, 
  ChevronLeft, 
  ChevronRight, 
  ChevronsLeft, 
  ChevronsRight, 
  Save, 
  Upload, 
  FileText, 
  Copy, 
  Check, 
  Sparkles, 
  AlertCircle, 
  CheckCircle2, 
  Swords, 
  BookOpen, 
  ArrowRight,
  RefreshCw,
  PlusCircle
} from 'lucide-react';
import { TacticalFingerprintEngine, DetectedMotif } from '@/lib/chess/tactical-fingerprint';

// Dynamically import react-chessboard with SSR disabled
const Chessboard = dynamic(
  () => import('react-chessboard').then((mod) => mod.Chessboard),
  { ssr: false }
);

interface MoveHistoryItem {
  san: string;
  fen: string;
  color: 'w' | 'b';
  moveNumber: number;
  motifs: string[];
}

export default function AnalysisBoardPage() {
  const [chess] = useState<Chess>(() => new Chess());
  const [fen, setFen] = useState<string>(chess.fen());
  const [boardOrientation, setBoardOrientation] = useState<'white' | 'black'>('white');
  const [history, setHistory] = useState<MoveHistoryItem[]>([]);
  const [currentStep, setCurrentStep] = useState<number>(-1); // -1 = initial position
  const [isMounted, setIsMounted] = useState<boolean>(false);

  // Input modes & modals
  const [pgnInput, setPgnInput] = useState<string>('');
  const [fenInput, setFenInput] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'moves' | 'pgn' | 'fen'>('moves');
  const [copied, setCopied] = useState<boolean>(false);

  // Live Tactical Motif for current position
  const [liveMotifs, setLiveMotifs] = useState<string[]>([]);

  // Save Game Modal State
  const [showSaveModal, setShowSaveModal] = useState<boolean>(false);
  const [whitePlayer, setWhitePlayer] = useState<string>('Player 1');
  const [blackPlayer, setBlackPlayer] = useState<string>('Player 2');
  const [event, setEvent] = useState<string>('Casual Game');
  const [result, setResult] = useState<string>('1-0');
  const [whiteRating, setWhiteRating] = useState<string>('1500');
  const [blackRating, setBlackRating] = useState<string>('1500');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<{ gameId: number } | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const currentStepRef = useRef(currentStep);
  currentStepRef.current = currentStep;

  const historyRef = useRef(history);
  historyRef.current = history;

  useEffect(() => {
    setIsMounted(true);
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

  // Update current board position based on history index
  const goToStep = (stepIdx: number) => {
    const hist = historyRef.current;
    if (hist.length === 0) return;
    if (stepIdx < -1) stepIdx = -1;
    if (stepIdx >= hist.length) stepIdx = hist.length - 1;

    setCurrentStep(stepIdx);
    currentStepRef.current = stepIdx;

    if (stepIdx === -1) {
      chess.reset();
      setFen(chess.fen());
      setLiveMotifs([]);
    } else {
      const item = hist[stepIdx];
      // Replay moves up to stepIdx
      const tempChess = new Chess();
      for (let i = 0; i <= stepIdx; i++) {
        if (hist[i]) tempChess.move(hist[i].san);
      }
      setFen(tempChess.fen());
      setLiveMotifs(item?.motifs || []);
    }
  };

  // Handle piece drop on board
  const onDrop = (sourceSquare: string, targetSquare: string): boolean => {
    try {
      // Create temporary chess instance at current position
      const tempChess = new Chess();
      const hist = historyRef.current;
      const step = currentStepRef.current;
      for (let i = 0; i <= step; i++) {
        if (hist[i]) tempChess.move(hist[i].san);
      }

      const prevFen = tempChess.fen();
      const move = tempChess.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: 'q', // Auto-promote to Queen for quick analysis
      });

      if (!move) return false;

      // Analyze motifs using TacticalFingerprintEngine
      const pgnSoFar = tempChess.pgn();
      const analysis = TacticalFingerprintEngine.analyzeGame(pgnSoFar);

      const moveNumber = Math.floor((step + 1) / 2) + 1;
      const colorStr = move.color === 'w' ? 'white' : 'black';
      const motifNames = analysis.detectedMotifs
        .filter(m => m.moveNumber === moveNumber && m.color === colorStr)
        .map(m => m.motifName);

      const newItem: MoveHistoryItem = {
        san: move.san,
        fen: tempChess.fen(),
        color: move.color,
        moveNumber,
        motifs: motifNames,
      };

      // Truncate future history if branching from an earlier move
      const newHistory = [...hist.slice(0, step + 1), newItem];
      historyRef.current = newHistory;
      currentStepRef.current = newHistory.length - 1;
      setHistory(newHistory);
      setCurrentStep(newHistory.length - 1);
      setFen(tempChess.fen());
      setLiveMotifs(motifNames);

      return true;
    } catch {
      return false;
    }
  };

  // Load PGN text into board
  const handleLoadPgn = () => {
    if (!pgnInput.trim()) return;
    try {
      const tempChess = new Chess();
      tempChess.loadPgn(pgnInput.trim());

      // Extract moves and build history
      const analysis = TacticalFingerprintEngine.analyzeGame(pgnInput.trim());
      const moves = tempChess.history({ verbose: true });
      const replayChess = new Chess();
      const newHistory: MoveHistoryItem[] = [];

      for (let i = 0; i < moves.length; i++) {
        const m = moves[i];
        replayChess.move(m.san);
        const moveNumber = Math.floor(i / 2) + 1;
        const colorStr = m.color === 'w' ? 'white' : 'black';
        const moveMotifs = analysis.detectedMotifs
          .filter(dm => dm.moveNumber === moveNumber && dm.color === colorStr)
          .map(dm => dm.motifName);

        newHistory.push({
          san: m.san,
          fen: replayChess.fen(),
          color: m.color,
          moveNumber,
          motifs: moveMotifs,
        });
      }

      // Try extracting headers
      const headers = tempChess.header();
      if (headers['White'] && headers['White'] !== '?') setWhitePlayer(headers['White']);
      if (headers['Black'] && headers['Black'] !== '?') setBlackPlayer(headers['Black']);
      if (headers['Event'] && headers['Event'] !== '?') setEvent(headers['Event']);
      if (headers['Result'] && headers['Result'] !== '?') setResult(headers['Result']);
      if (headers['WhiteElo'] && headers['WhiteElo'] !== '?') setWhiteRating(headers['WhiteElo']);
      if (headers['BlackElo'] && headers['BlackElo'] !== '?') setBlackRating(headers['BlackElo']);

      historyRef.current = newHistory;
      currentStepRef.current = newHistory.length - 1;
      setHistory(newHistory);
      setCurrentStep(newHistory.length - 1);
      setFen(replayChess.fen());
      setActiveTab('moves');
    } catch (err: any) {
      alert('Error loading PGN: ' + (err.message || 'Unknown error'));
    }
  };

  // Load FEN position
  const handleLoadFen = () => {
    if (!fenInput.trim()) return;
    try {
      const tempChess = new Chess(fenInput.trim());
      chess.load(fenInput.trim());
      setFen(tempChess.fen());
      setHistory([]);
      setCurrentStep(-1);
      setLiveMotifs([]);
      setActiveTab('moves');
    } catch {
      alert('Invalid FEN string.');
    }
  };

  // Handle File Upload (.pgn)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        setPgnInput(text);
        setActiveTab('pgn');
      }
    };
    reader.readAsText(file);
  };

  // Reset Board to initial state
  const handleReset = () => {
    chess.reset();
    setFen(chess.fen());
    setHistory([]);
    setCurrentStep(-1);
    setLiveMotifs([]);
    setSaveSuccess(null);
    setSaveError(null);
  };

  // Copy current FEN or PGN
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Save current game into the database via POST /api/games
  const handleSaveGame = async (e: React.FormEvent) => {
    e.preventDefault();
    if (history.length === 0) {
      setSaveError('Cannot save an empty game. Please make or load at least one move.');
      return;
    }

    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(null);

    try {
      // Reconstruct PGN
      const replayChess = new Chess();
      for (const item of history) {
        replayChess.move(item.san);
      }
      const rawMoves = replayChess.pgn();

      const payload = {
        whitePlayer,
        blackPlayer,
        event,
        result,
        whiteRating: whiteRating ? parseInt(whiteRating, 10) : undefined,
        blackRating: blackRating ? parseInt(blackRating, 10) : undefined,
        moves: rawMoves,
        pgn: `[Event "${event}"]\n[Site "ChessBase Analysis"]\n[Date "${new Date().toISOString().split('T')[0]}"]\n[Round "1"]\n[White "${whitePlayer}"]\n[Black "${blackPlayer}"]\n[Result "${result}"]\n${whiteRating ? `[WhiteElo "${whiteRating}"]\n` : ''}${blackRating ? `[BlackElo "${blackRating}"]\n` : ''}\n${rawMoves}`
      };

      const res = await fetch('/api/games', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to save game to database');
      }

      setSaveSuccess({ gameId: data.gameId });
    } catch (err: any) {
      setSaveError(err.message || 'Error occurred while saving game');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center space-x-2">
            <Swords className="w-6 h-6 text-amber-400" />
            <span>Interactive Analysis & Game Input Board</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Play moves directly, paste PGN / FEN, inspect real-time tactical motifs, and add your own games to the database.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <label className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer transition-colors border border-slate-700">
            <Upload className="w-3.5 h-3.5" />
            <span>Upload .PGN</span>
            <input type="file" accept=".pgn,.txt" onChange={handleFileUpload} className="hidden" />
          </label>

          <button
            onClick={() => setBoardOrientation(prev => prev === 'white' ? 'black' : 'white')}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors border border-slate-700"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Flip ({boardOrientation})</span>
          </button>

          <button
            onClick={() => setShowSaveModal(true)}
            className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 transition-colors shadow-sm"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Add to Database</span>
          </button>
        </div>
      </div>

      {/* Main Analysis Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Interactive Chessboard */}
        <div className="lg:col-span-7 flex flex-col items-center">
          <div className="w-full max-w-[520px] bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-4">
            {/* Live Tactical Alert Banner */}
            {liveMotifs.length > 0 && (
              <div className="flex items-center space-x-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-medium">
                <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                <span>
                  Tactical Motif Detected: <strong>{liveMotifs.join(', ')}</strong>
                </span>
              </div>
            )}

            {/* Chessboard Container */}
            <div className="relative aspect-square w-full rounded-lg overflow-hidden border border-slate-700 shadow-inner">
              {isMounted && (
                <Chessboard
                  position={fen}
                  boardOrientation={boardOrientation}
                  onPieceDrop={onDrop}
                  arePiecesDraggable={true}
                  customBoardStyle={{
                    borderRadius: '4px',
                    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4)',
                  }}
                  customDarkSquareStyle={{ backgroundColor: '#475569' }}
                  customLightSquareStyle={{ backgroundColor: '#cbd5e1' }}
                />
              )}
            </div>

            {/* Navigation & Step Controls */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-800">
              <div className="text-xs text-slate-400 font-mono">
                {currentStep < 0 ? 'Start Position' : `Move ${Math.floor(currentStep / 2) + 1} (${currentStep + 1}/${history.length})`}
              </div>

              <div className="flex items-center space-x-1">
                <button
                  onClick={() => goToStep(-1)}
                  disabled={currentStep === -1}
                  className="p-1.5 rounded hover:bg-slate-800 disabled:opacity-30 text-slate-300 transition-colors"
                  title="First move"
                >
                  <ChevronsLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => goToStep(currentStep - 1)}
                  disabled={currentStep === -1}
                  className="p-1.5 rounded hover:bg-slate-800 disabled:opacity-30 text-slate-300 transition-colors"
                  title="Previous move"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => goToStep(currentStep + 1)}
                  disabled={currentStep >= history.length - 1}
                  className="p-1.5 rounded hover:bg-slate-800 disabled:opacity-30 text-slate-300 transition-colors"
                  title="Next move"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button
                  onClick={() => goToStep(history.length - 1)}
                  disabled={currentStep >= history.length - 1}
                  className="p-1.5 rounded hover:bg-slate-800 disabled:opacity-30 text-slate-300 transition-colors"
                  title="Last move"
                >
                  <ChevronsRight className="w-4 h-4" />
                </button>
                <div className="h-4 w-px bg-slate-800 mx-1"></div>
                <button
                  onClick={handleReset}
                  className="p-1.5 rounded hover:bg-slate-800 text-rose-400 hover:text-rose-300 transition-colors"
                  title="Reset board"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* FEN Box */}
            <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800/80 flex items-center justify-between text-xs font-mono text-slate-400">
              <span className="truncate mr-2 select-all">{fen}</span>
              <button
                onClick={() => copyToClipboard(fen)}
                className="p-1 hover:text-white transition-colors shrink-0"
                title="Copy FEN"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Move Notation & Input Panels */}
        <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
          {/* Tabs */}
          <div className="flex border-b border-slate-800 pb-2">
            <button
              onClick={() => setActiveTab('moves')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors mr-2 ${
                activeTab === 'moves'
                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Move List ({history.length})
            </button>
            <button
              onClick={() => setActiveTab('pgn')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors mr-2 ${
                activeTab === 'pgn'
                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Paste / Import PGN
            </button>
            <button
              onClick={() => setActiveTab('fen')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                activeTab === 'fen'
                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Set FEN
            </button>
          </div>

          {/* Tab 1: Moves List */}
          {activeTab === 'moves' && (
            <div className="space-y-4">
              <div className="h-80 overflow-y-auto bg-slate-950 rounded-xl p-3 border border-slate-800/80 font-mono text-xs">
                {history.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-2">
                    <Swords className="w-6 h-6 opacity-40" />
                    <p>No moves played yet.</p>
                    <p className="text-[11px] text-slate-600">Drag pieces on the board or paste a PGN.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-x-2 gap-y-1">
                    {Array.from({ length: Math.ceil(history.length / 2) }).map((_, movePairIdx) => {
                      const whiteIdx = movePairIdx * 2;
                      const blackIdx = whiteIdx + 1;
                      const whiteMove = history[whiteIdx];
                      const blackMove = history[blackIdx];

                      return (
                        <React.Fragment key={movePairIdx}>
                          {/* White Move */}
                          <div
                            onClick={() => goToStep(whiteIdx)}
                            className={`flex items-center justify-between px-2 py-1.5 rounded cursor-pointer transition-colors ${
                              currentStep === whiteIdx
                                ? 'bg-amber-500 text-slate-950 font-bold'
                                : 'hover:bg-slate-900 text-slate-300'
                            }`}
                          >
                            <span>
                              <span className="text-slate-500 mr-2">{movePairIdx + 1}.</span>
                              {whiteMove?.san}
                            </span>
                            {whiteMove?.motifs && whiteMove.motifs.length > 0 && (
                              <span className={`text-[10px] px-1 rounded ${currentStep === whiteIdx ? 'bg-slate-900 text-amber-400' : 'bg-amber-500/20 text-amber-400'}`}>
                                {whiteMove.motifs[0]}
                              </span>
                            )}
                          </div>

                          {/* Black Move */}
                          {blackMove ? (
                            <div
                              onClick={() => goToStep(blackIdx)}
                              className={`flex items-center justify-between px-2 py-1.5 rounded cursor-pointer transition-colors ${
                                currentStep === blackIdx
                                  ? 'bg-amber-500 text-slate-950 font-bold'
                                  : 'hover:bg-slate-900 text-slate-300'
                              }`}
                            >
                              <span>{blackMove.san}</span>
                              {blackMove?.motifs && blackMove.motifs.length > 0 && (
                                <span className={`text-[10px] px-1 rounded ${currentStep === blackIdx ? 'bg-slate-900 text-amber-400' : 'bg-amber-500/20 text-amber-400'}`}>
                                  {blackMove.motifs[0]}
                                </span>
                              )}
                            </div>
                          ) : (
                            <div></div>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Action Toolbar */}
              <div className="flex items-center justify-between pt-2">
                <button
                  onClick={() => setShowSaveModal(true)}
                  disabled={history.length === 0}
                  className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 font-semibold text-sm transition-colors shadow-lg"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>Save This Game to Database</span>
                </button>
              </div>
            </div>
          )}

          {/* Tab 2: Paste PGN */}
          {activeTab === 'pgn' && (
            <div className="space-y-3">
              <p className="text-xs text-slate-400">
                Paste any PGN text from Lichess, Chess.com, CaissaBase, or your own games:
              </p>
              <textarea
                value={pgnInput}
                onChange={(e) => setPgnInput(e.target.value)}
                placeholder="[Event &quot;Fischer vs Spassky&quot;]&#10;1. e4 e5 2. Nf3 Nc6 3. Bb5..."
                rows={10}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-500"
              />
              <div className="flex justify-between items-center">
                <button
                  onClick={() => setPgnInput('')}
                  className="text-xs text-slate-500 hover:text-slate-300"
                >
                  Clear
                </button>
                <button
                  onClick={handleLoadPgn}
                  className="flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs transition-colors"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Load & Analyze PGN</span>
                </button>
              </div>
            </div>
          )}

          {/* Tab 3: Set FEN */}
          {activeTab === 'fen' && (
            <div className="space-y-3">
              <p className="text-xs text-slate-400">
                Paste a Forsyth–Edwards Notation (FEN) position to inspect:
              </p>
              <input
                type="text"
                value={fenInput}
                onChange={(e) => setFenInput(e.target.value)}
                placeholder="r1bqk2r/pp2bppp/2n1pn2/2pp4/2PP4/2N1PN2/PP2BPPP/R1BQK2R w KQkq - 4 7"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-500"
              />
              <button
                onClick={handleLoadFen}
                className="w-full flex items-center justify-center space-x-1.5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs transition-colors"
              >
                <span>Load Position</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Save Game Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-white flex items-center space-x-2">
                <Save className="w-5 h-5 text-amber-400" />
                <span>Save Game to ChessBase</span>
              </h3>
              <button
                onClick={() => setShowSaveModal(false)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            {saveSuccess ? (
              <div className="space-y-4 py-4 text-center">
                <div className="w-12 h-12 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-white">Game Saved Successfully!</h4>
                  <p className="text-xs text-slate-400 mt-1">
                    Your game was committed to PostgreSQL with tactical motifs and vector embeddings.
                  </p>
                </div>
                <div className="flex justify-center space-x-3 pt-2">
                  <a
                    href={`/games/${saveSuccess.gameId}`}
                    className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs transition-colors"
                  >
                    <span>View in Game Explorer</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </a>
                  <button
                    onClick={() => {
                      setShowSaveModal(false);
                      setSaveSuccess(null);
                    }}
                    className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium"
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSaveGame} className="space-y-4 text-xs">
                {saveError && (
                  <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 flex items-center space-x-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{saveError}</span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-slate-400 font-semibold">White Player Name</label>
                    <input
                      type="text"
                      required
                      value={whitePlayer}
                      onChange={(e) => setWhitePlayer(e.target.value)}
                      className="mt-1 w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 font-semibold">White Rating (Optional)</label>
                    <input
                      type="number"
                      value={whiteRating}
                      onChange={(e) => setWhiteRating(e.target.value)}
                      placeholder="e.g. 1500"
                      className="mt-1 w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-slate-400 font-semibold">Black Player Name</label>
                    <input
                      type="text"
                      required
                      value={blackPlayer}
                      onChange={(e) => setBlackPlayer(e.target.value)}
                      className="mt-1 w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 font-semibold">Black Rating (Optional)</label>
                    <input
                      type="number"
                      value={blackRating}
                      onChange={(e) => setBlackRating(e.target.value)}
                      placeholder="e.g. 1500"
                      className="mt-1 w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-slate-400 font-semibold">Event / Tournament</label>
                    <input
                      type="text"
                      value={event}
                      onChange={(e) => setEvent(e.target.value)}
                      placeholder="e.g. Club Championship"
                      className="mt-1 w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 font-semibold">Game Result</label>
                    <select
                      value={result}
                      onChange={(e) => setResult(e.target.value)}
                      className="mt-1 w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 focus:outline-none focus:border-amber-500"
                    >
                      <option value="1-0">1-0 (White Wins)</option>
                      <option value="0-1">0-1 (Black Wins)</option>
                      <option value="1/2-1/2">1/2-1/2 (Draw)</option>
                      <option value="*">* (Ongoing / Unfinished)</option>
                    </select>
                  </div>
                </div>

                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800/80 text-slate-400 space-y-1">
                  <div className="flex justify-between">
                    <span>Total Moves to Record:</span>
                    <strong className="text-white">{history.length} half-moves</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Tactical Motifs Identified:</span>
                    <strong className="text-amber-400">
                      {history.reduce((acc, h) => acc + (h.motifs?.length || 0), 0)} motifs
                    </strong>
                  </div>
                </div>

                <div className="flex justify-end space-x-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowSaveModal(false)}
                    className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold transition-colors"
                  >
                    {isSaving ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Saving Game...</span>
                      </>
                    ) : (
                      <>
                        <Save className="w-3.5 h-3.5" />
                        <span>Confirm & Save</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
