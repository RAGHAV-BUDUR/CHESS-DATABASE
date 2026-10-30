'use client';

import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  UploadCloud, 
  FileText, 
  Database, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  RefreshCw,
  Sparkles,
  ArrowRight,
  Trash2
} from 'lucide-react';

export default function AdminPage() {
  const [pgnText, setPgnText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const [jobs, setJobs] = useState<any[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const handleClearGames = async () => {
    if (!confirm('Are you sure you want to purge all stored games, moves, tactical motifs, and embeddings from the database? Users and master motifs will be preserved.')) {
      return;
    }
    setClearing(true);
    try {
      const res = await fetch('/api/admin/clear-games', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        alert(data.message || 'All games cleared successfully.');
        fetchJobs();
      } else {
        alert(data.error || 'Failed to clear games.');
      }
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setClearing(false);
    }
  };

  const fetchJobs = async () => {
    try {
      const res = await fetch('/api/admin/jobs');
      if (res.status === 401 || res.status === 403) {
        setAuthError('You must be signed in as an ADMIN to access this management dashboard.');
        setLoadingJobs(false);
        return;
      }
      const data = await res.json();
      if (data.success) {
        setJobs(data.data || []);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoadingJobs(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, []);

  const handleImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploading(true);
    setImportResult(null);

    try {
      let res;
      if (file) {
        const formData = new FormData();
        formData.append('file', file);
        res = await fetch('/api/admin/import', {
          method: 'POST',
          body: formData,
        });
      } else if (pgnText.trim()) {
        res = await fetch('/api/admin/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pgnText, filename: 'web_paste.pgn' }),
        });
      } else {
        alert('Please either select a PGN file or paste PGN text');
        setUploading(false);
        return;
      }

      const data = await res.json();
      if (res.ok && data.success) {
        setImportResult(data);
        setPgnText('');
        setFile(null);
        fetchJobs();
      } else {
        setImportResult({ error: data.error || 'Import failed.' });
      }
    } catch (err: any) {
      setImportResult({ error: err.message });
    } finally {
      setUploading(false);
    }
  };

  if (authError) {
    return (
      <div className="max-w-xl mx-auto my-16 bg-slate-900 border border-red-500/30 rounded-2xl p-8 text-center space-y-4 shadow-2xl">
        <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center mx-auto">
          <ShieldCheck className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-white">Administrator Access Required</h2>
        <p className="text-sm text-slate-400">{authError}</p>
        <div className="pt-2">
          <a
            href="/login"
            className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-lg font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 text-sm transition-colors"
          >
            <span>Sign In as Admin</span>
            <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold uppercase tracking-wider mb-2">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Admin Management Panel</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            PGN Dataset Ingestion & Job Monitor
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Bulk import multi-game PGN datasets with automatic player/opening normalization, tactical motif indexing, and pgvector embeddings.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleClearGames}
            disabled={clearing}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-950/40 hover:bg-red-900/60 text-red-300 transition-colors border border-red-800/50"
            title="Purge all games while preserving users and motifs"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{clearing ? 'Clearing...' : 'Clear All Games'}</span>
          </button>
          <button
            onClick={fetchJobs}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors border border-slate-700"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh Jobs</span>
          </button>
        </div>
      </div>

      {/* Import Form Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Upload / Paste */}
        <div className="lg:col-span-6 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200 flex items-center space-x-2">
            <UploadCloud className="w-4 h-4 text-amber-400" />
            <span>Import PGN Games</span>
          </h3>

          <form onSubmit={handleImportSubmit} className="space-y-4">
            {/* File Upload Area */}
            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1.5">
                Upload PGN File (.pgn or .txt)
              </label>
              <input
                type="file"
                accept=".pgn,.txt"
                onChange={(e) => setFile(e.target.files ? e.target.files[0] : null)}
                className="w-full text-xs text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-800 file:text-amber-400 hover:file:bg-slate-700 cursor-pointer bg-slate-950 p-2 rounded-xl border border-slate-800"
              />
            </div>

            <div className="text-center text-xs text-slate-600 font-semibold">— OR PASTE RAW PGN —</div>

            {/* Raw PGN Text Area */}
            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1.5">
                Paste PGN Move Sequences
              </label>
              <textarea
                rows={7}
                value={pgnText}
                onChange={(e) => setPgnText(e.target.value)}
                placeholder={'[Event "World Championship"]\n[White "Fischer, Robert J."]\n[Black "Spassky, Boris V."]\n[Result "1-0"]\n\n1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 1-0'}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs font-mono text-slate-200 placeholder-slate-700 focus:outline-none focus:border-amber-500"
              />
            </div>

            <button
              type="submit"
              disabled={uploading}
              className="w-full py-2.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 transition-colors shadow-md flex items-center justify-center space-x-2"
            >
              {uploading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></div>
                  <span>Processing Games & Generating Embeddings...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Execute ACID Ingestion Job</span>
                </>
              )}
            </button>
          </form>

          {/* Feedback banner */}
          {importResult && (
            <div className={`p-4 rounded-xl border text-xs space-y-1 ${
              importResult.error
                ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
            }`}>
              {importResult.error ? (
                <div className="flex items-center space-x-2 font-bold">
                  <XCircle className="w-4 h-4" />
                  <span>Error: {importResult.error}</span>
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="flex items-center space-x-2 font-bold">
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                    <span>Import Completed Successfully!</span>
                  </div>
                  <div className="font-mono text-[11px] pt-1">
                    Processed {importResult.total} games: {importResult.imported} imported, {importResult.skipped} skipped, {importResult.failed} failed.
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: Ingestion Architecture Guidelines */}
        <div className="lg:col-span-6 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4 text-xs text-slate-300">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200 flex items-center space-x-2">
            <Database className="w-4 h-4 text-amber-400" />
            <span>Database Pipeline Architecture</span>
          </h3>

          <div className="space-y-3 leading-relaxed">
            <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 space-y-1">
              <span className="font-bold text-amber-400">1. ACID Transaction Isolation:</span>
              <p className="text-slate-400">
                Each game, its move sequence, tactical fingerprints, and embeddings are wrapped in explicit database transactions (<code className="text-amber-300">withTransaction</code>). Failed games roll back without corrupting relational state.
              </p>
            </div>

            <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 space-y-1">
              <span className="font-bold text-amber-400">2. Deterministic Motif Extraction:</span>
              <p className="text-slate-400">
                During ingestion, board states are verified via <code className="text-amber-300">chess.js</code> and passed through the Tactical Fingerprint Engine to flag Queen Sacrifices, Forks, and Mating Attacks.
              </p>
            </div>

            <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 space-y-1">
              <span className="font-bold text-amber-400">3. pgvector Vector Generation:</span>
              <p className="text-slate-400">
                Game move context, annotations, and opening profiles are mapped into 384-dimensional normalized vectors and stored directly into the <code className="text-amber-300">game_embeddings</code> table with HNSW cosine indexes.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Import History Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl space-y-3 p-6">
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200 flex items-center space-x-2">
          <Clock className="w-4 h-4 text-amber-400" />
          <span>PGN Import History (Audit Table: pgn_import_jobs)</span>
        </h3>

        {loadingJobs ? (
          <p className="text-xs text-slate-500 py-4">Loading audit logs...</p>
        ) : jobs.length === 0 ? (
          <p className="text-xs text-slate-500 py-4">No import jobs recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800 uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-2.5 px-3">Job ID</th>
                  <th className="py-2.5 px-3">Filename</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-center">Total</th>
                  <th className="py-2.5 px-3 text-center">Imported</th>
                  <th className="py-2.5 px-3 text-center">Failed</th>
                  <th className="py-2.5 px-3 text-right">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {jobs.map((j) => (
                  <tr key={j.job_id} className="hover:bg-slate-800/40">
                    <td className="py-2.5 px-3 text-slate-500">#{j.job_id}</td>
                    <td className="py-2.5 px-3 text-white font-sans">{j.filename}</td>
                    <td className="py-2.5 px-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        j.status === 'COMPLETED' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                        j.status === 'PROCESSING' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                        'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                      }`}>
                        {j.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center text-slate-300">{j.total_games}</td>
                    <td className="py-2.5 px-3 text-center text-emerald-400">{j.imported_games}</td>
                    <td className="py-2.5 px-3 text-center text-rose-400">{j.failed_games}</td>
                    <td className="py-2.5 px-3 text-right text-slate-500 font-sans text-[11px]">
                      {new Date(j.started_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

