'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/navigation';
import { usePathname, useRouter } from 'next/navigation';
import { 
  Crown, 
  Search, 
  Sparkles, 
  BarChart3, 
  BookOpen, 
  Users, 
  ShieldCheck, 
  Star, 
  LogIn, 
  LogOut 
} from 'lucide-react';

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<{ username: string; role: string } | null>(null);

  useEffect(() => {
    fetch('/api/auth/me')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.authenticated) setUser(data.user);
        else setUser(null);
      })
      .catch(() => setUser(null));
  }, [pathname]);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
    router.push('/');
  };

  const navLinks = [
    { href: '/games', label: 'Game Explorer', icon: BookOpen },
    { href: '/search', label: 'Pattern Search', icon: Sparkles },
    { href: '/openings', label: 'Opening Tree', icon: Crown },
    { href: '/players', label: 'Players', icon: Users },
    { href: '/reports', label: 'Analytics & SQL', icon: BarChart3 },
  ];

  return (
    <header className="sticky top-0 z-50 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 text-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <a href="/" className="flex items-center space-x-2 text-xl font-bold tracking-tight text-white hover:text-amber-400 transition-colors">
          <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30">
            <Crown className="w-5 h-5" />
          </div>
          <span>Chess<span className="text-amber-400">Base</span></span>
          <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700 ml-1">DBMS L3</span>
        </a>

        {/* Navigation Links */}
        <nav className="hidden md:flex items-center space-x-1">
          {navLinks.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            return (
              <a
                key={item.href}
                href={item.href}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  active 
                    ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' 
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </a>
            );
          })}
          {user?.role === 'ADMIN' && (
            <a
              href="/admin"
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                pathname === '/admin'
                  ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                  : 'text-red-300 hover:text-red-200 hover:bg-slate-800'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Admin</span>
            </a>
          )}
        </nav>

        {/* User Auth Info */}
        <div className="flex items-center space-x-3">
          {user ? (
            <div className="flex items-center space-x-3">
              <a 
                href="/favourites" 
                className="p-1.5 text-slate-400 hover:text-amber-400 transition-colors"
                title="Saved Favourites"
              >
                <Star className="w-5 h-5" />
              </a>
              <span className="text-xs bg-slate-800 border border-slate-700 px-2 py-1 rounded text-slate-300">
                {user.username} <span className="text-amber-400">({user.role})</span>
              </span>
              <button
                onClick={handleLogout}
                className="p-1.5 text-slate-400 hover:text-rose-400 transition-colors"
                title="Log Out"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          ) : (
            <a
              href="/login"
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-sm font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 transition-colors shadow-sm"
            >
              <LogIn className="w-4 h-4" />
              <span>Sign In</span>
            </a>
          )}
        </div>
      </div>
    </header>
  );
}

