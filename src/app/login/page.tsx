'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogIn, Crown, Lock, Mail, AlertCircle, ArrowRight } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        if (data.user?.role === 'ADMIN') {
          router.push('/admin');
        } else {
          router.push('/games');
        }
      } else {
        setError(data.error || 'Invalid credentials');
      }
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickFill = (role: 'admin' | 'player') => {
    if (role === 'admin') {
      setEmail('admin@chessbase.local');
      setPassword('AdminPassword123!');
    } else {
      setEmail('player@chessbase.local');
      setPassword('PlayerPassword123!');
    }
  };

  return (
    <div className="max-w-md mx-auto my-12 p-8 bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl space-y-6">
      {/* Brand Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex p-3 rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20 mb-2">
          <Crown className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Sign In to ChessBase</h1>
        <p className="text-xs text-slate-400">
          Enter your credentials to access saved favourites, game replay, and administration.
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
          <label className="text-xs font-semibold text-slate-400 block mb-1">Email Address</label>
          <div className="relative">
            <Mail className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. admin@chessbase.local"
              className="w-full pl-9 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-400 block mb-1">Password</label>
          <div className="relative">
            <Lock className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
            <input
              type="password"
              required
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
              <LogIn className="w-4 h-4" />
              <span>Authenticate</span>
            </>
          )}
        </button>
      </form>

      {/* Quick Fill / Demo Accounts for Evaluator */}
      <div className="pt-4 border-t border-slate-800/80 space-y-2">
        <span className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold block">
          Demo Evaluator Credentials:
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => handleQuickFill('admin')}
            className="flex-1 py-1.5 px-2 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-[11px] text-amber-400 font-mono transition-colors"
          >
            Admin Account
          </button>
          <button
            type="button"
            onClick={() => handleQuickFill('player')}
            className="flex-1 py-1.5 px-2 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-[11px] text-slate-300 font-mono transition-colors"
          >
            Player Account
          </button>
        </div>
      </div>

      <div className="text-center text-xs text-slate-400">
        Don&apos;t have an account?{' '}
        <a href="/register" className="text-amber-400 hover:underline font-semibold">
          Register here
        </a>
      </div>
    </div>
  );
}

