'use client';

import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  Search, 
  Filter, 
  BookOpen, 
  Layers, 
  ArrowRight, 
  CheckCircle, 
  Info, 
  SlidersHorizontal,
  ChevronRight,
  Database
} from 'lucide-react';

const SUGGESTED_QUERIES = [
  'Games featuring a kingside pawn storm.',
  'Queen sacrifice followed by a mating attack.',
  'Minor-piece sacrifice for an attack on the king.',
  'Opposite-side castling with aggressive pawn advances.',
  'Knight fork attacking king and queen.',
  'Exchange sacrifice destroying pawn structure.'
];

const MASTER_MOTIFS = [
  'Checkmate Attack',
  'Queen Sacrifice',
  'Exchange Sacrifice',
  'Minor Piece Sacrifice',
  'Knight Fork',
  'Absolute Pin on King',
  'Relative Pin on Queen',
  'Skewer Attack',
  'Pawn Storm Attack',
  'Promotion Threat'
];

export default function PatternSearchPage() {
  const [prompt, setPrompt] = useState('Queen sacrifice followed by a mating attack.');
  const [motif, setMotif] = useState('');
  const [openingEco, setOpeningEco] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [result, setResult] = useState('');
  const [minRating, setMinRating] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const [results, setResults] = useState<any[]>([]);
  const [meta, setMeta] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = async (e?: React.FormEvent, customPrompt?: string) => {
    if (e) e.preventDefault();
    const queryText = customPrompt !== undefined ? customPrompt : prompt;
    if (!queryText && !motif && !openingEco && !playerName) return;

    setLoading(true);
    setSearched(true);

    try {
      const res = await fetch('/api/search/semantic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: queryText,
          motif: motif || undefined,
          openingEco: openingEco || undefined,
          playerName: playerName || undefined,
          result: result || undefined,
          minRating: minRating || undefined,
          limit: 25
        }),
      });

      const data = await res.json();
      if (data.success) {
        setResults(data.data || []);
        setMeta(data);
      } else {
        setResults([]);
      }
    } catch (err) {
      console.error(err);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    handleSearch();
  }, []);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="max-w-3xl">
        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold uppercase tracking-wider mb-3">
          <Sparkles className="w-3.5 h-3.5" />
          <span>pgvector Cosine Search + Deterministic Motif Hybrid</span>
        </div>
        <h1 className="text-3xl font-bold text-white tracking-tight">
          Tactical Pattern & Semantic Search
        </h1>
        <p className="text-slate-400 text-sm mt-1.5 leading-relaxed">
          Search chess games by strategic intent, tactical motif, and move-sequence descriptions using PostgreSQL with pgvector embeddings (384 dimensions) combined with deterministic motif filters.
        </p>
      </div>

      {/* Main Search Bar */}
      <form onSubmit={handleSearch} className="space-y-4">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Sparkles className="w-5 h-5 text-amber-400" />
          </div>
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Search tactical ideas, e.g. 'Queen sacrifice followed by mating attack' or 'pawn storm'"
            className="w-full pl-12 pr-32 py-4 bg-slate-900 border border-slate-800 rounded-2xl text-slate-100 placeholder-slate-500 text-base shadow-xl focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all"
          />
          <div className="absolute inset-y-0 right-2 flex items-center space-x-2">
            <button
              type="button"
              onClick={() => setShowFilters(!showFilters)}
              className={`p-2 rounded-xl text-xs font-medium border transition-colors flex items-center space-x-1 ${
                showFilters || motif || openingEco || playerName
                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
              }`}
            >
              <SlidersHorizontal className="w-4 h-4" />
              <span className="hidden sm:inline">Filters</span>
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 rounded-xl font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 transition-colors shadow-md text-sm flex items-center space-x-1.5"
            >
              <Search className="w-4 h-4" />
              <span>{loading ? 'Searching...' : 'Search'}</span>
            </button>
          </div>
        </div>

        {/* Suggested Queries */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-xs text-slate-500 font-medium mr-1">Try:</span>
          {SUGGESTED_QUERIES.map((q, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                setPrompt(q);
                handleSearch(undefined, q);
              }}
              className="px-2.5 py-1 rounded-full text-xs bg-slate-800/80 hover:bg-slate-800 text-slate-300 border border-slate-700 hover:border-amber-500/40 transition-colors"
            >
              {q}
            </button>
          ))}
        </div>

        {/* Expanded Filters Drawer */}
        {showFilters && (
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 animate-fadeIn">
            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">Tactical Motif Match</label>
              <select
                value={motif}
                onChange={(e) => setMotif(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
              >
                <option value="">Any Motif</option>
                {MASTER_MOTIFS.map((m, idx) => (
                  <option key={idx} value={m}>{m}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">ECO Opening Code</label>
              <input
                type="text"
                value={openingEco}
                onChange={(e) => setOpeningEco(e.target.value.toUpperCase())}
                placeholder="e.g. B90, E60"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500 uppercase"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">Player Name</label>
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="e.g. Kasparov"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">Game Result</label>
              <select
                value={result}
                onChange={(e) => setResult(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
              >
                <option value="">Any Result</option>
                <option value="1-0">1-0 (White Wins)</option>
                <option value="0-1">0-1 (Black Wins)</option>
                <option value="1/2-1/2">1/2-1/2 (Draw)</option>
              </select>
            </div>
          </div>
        )}
      </form>

      {/* Search Metadata Banner */}
      {meta && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <span className="font-semibold text-white">Execution Mode: </span>
              <span className="text-amber-400 font-mono">{meta.mode}</span>
              {meta.searchExplanation && (
                <div className="text-slate-400 text-[11px] mt-0.5">
                  Formula: {meta.searchExplanation.scoreFormula}
                </div>
              )}
            </div>
          </div>
          <div className="text-slate-400 font-mono">
            Retrieved {results.length} ranked games
          </div>
        </div>
      )}

      {/* Results List */}
      <div className="space-y-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 space-y-3">
            <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-sm text-slate-400">Computing vector embeddings & querying pgvector HNSW index...</p>
          </div>
        ) : searched && results.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center space-y-3">
            <Sparkles className="w-8 h-8 text-slate-600 mx-auto" />
            <h3 className="text-base font-bold text-slate-200">No matching tactical games found</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Try adjusting your prompt or clearing exact relational filters.
            </p>
          </div>
        ) : (
          results.map((game, idx) => (
            <div
              key={idx}
              className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 shadow-lg transition-all space-y-4"
            >
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-800/80 pb-3">
                <div className="flex items-center space-x-3">
                  <span className="w-6 h-6 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-mono text-slate-400">
                    {idx + 1}
                  </span>
                  <div>
                    <a
                      href={`/games/${game.game_id}`}
                      className="text-base font-bold text-white hover:text-amber-400 transition-colors flex items-center space-x-2"
                    >
                      <span>{game.white_player}</span>
                      <span className="text-slate-500 font-normal">vs</span>
                      <span>{game.black_player}</span>
                    </a>
                    <div className="text-xs text-slate-400 mt-0.5 flex items-center space-x-3">
                      <span>{game.opening_name ? `${game.eco_code} • ${game.opening_name}` : 'Custom Opening'}</span>
                      {game.tournament_name && <span>• {game.tournament_name}</span>}
                    </div>
                  </div>
                </div>

                {/* Score & Replay CTA */}
                <div className="flex items-center space-x-3">
                  <div className="text-right">
                    <div className="text-xs text-slate-400">Match Score</div>
                    <div className="text-sm font-bold text-amber-400 font-mono">
                      {game.hybrid_score ? (game.hybrid_score * 100).toFixed(1) + '%' : (game.similarity_score ? (game.similarity_score * 100).toFixed(1) + '%' : 'N/A')}
                    </div>
                  </div>
                  <a
                    href={`/games/${game.game_id}`}
                    className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 transition-colors"
                  >
                    <span>Replay</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>

              {/* Matched Motifs & Semantic Context */}
              <div className="space-y-2">
                {game.matched_motifs && Array.isArray(game.matched_motifs) && game.matched_motifs.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {game.matched_motifs.map((m: any, mIdx: number) => (
                      <span
                        key={mIdx}
                        className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] bg-amber-500/10 text-amber-300 border border-amber-500/20 font-medium"
                      >
                        <Sparkles className="w-3 h-3 text-amber-400" />
                        <span>{m.name || m}</span>
                      </span>
                    ))}
                  </div>
                )}

                {game.source_text && (
                  <p className="text-xs text-slate-300 leading-relaxed font-mono bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/60 line-clamp-2">
                    {game.source_text}
                  </p>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

