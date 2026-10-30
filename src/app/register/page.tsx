'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Crown, Lock, Mail, User, AlertCircle, ArrowRight, CheckCircle2 } from 'lucide-react';

export default function RegisterPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        router.push('/games');
      } else {
        setError(data.error || 'Registration failed');
      }
    } catch (err: any) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto my-12 p-8 bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl space-y-6">
      {/* Brand Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex p-3 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20 mb-2">
          <Crown className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Create Player Account</h1>
        <p className="text-xs text-slate-400">
          Register to save favorite grandmaster games, track openings, and run pattern queries.
        </p>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-xs font-semibold text-slate-400 block mb-1">Username</label>
          <div className="relative">
            <User className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. MagnusFan2026"
              className="w-full pl-9 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-400 block mb-1">Email Address</label>
          <div className="relative">
            <Mail className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. player@chessbase.local"
              className="w-full pl-9 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-400 block mb-1">Password (min 8 characters)</label>
          <div className="relative">
            <Lock className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full pl-9 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 rounded-xl font-bold bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 text-xs transition-colors shadow-md flex items-center justify-center space-x-1.5"
        >
          {loading ? (
            <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></div>
          ) : (
            <>
              <CheckCircle2 className="w-4 h-4" />
              <span>Create Account</span>
            </>
          )}
        </button>
      </form>

      <div className="text-center text-xs text-slate-400">
        Already have an account?{' '}
        <a href="/login" className="text-amber-400 hover:underline font-semibold">
          Sign In
        </a>
      </div>
    </div>
  );
}

