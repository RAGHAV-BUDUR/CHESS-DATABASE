import React from 'react';

export default function Footer() {
  return (
    <footer className="bg-slate-950 border-t border-slate-900 text-slate-400 py-8 text-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row justify-between items-center space-y-4 sm:space-y-0">
        <div>
          <p className="font-semibold text-slate-200">ChessBase — DBMS Experiential Learning (Level 3 Project)</p>
          <p className="text-slate-500 mt-0.5">PostgreSQL 16 + pgvector • Next.js App Router • Deterministic Tactical Fingerprint Engine</p>
        </div>
        <div className="text-right">
          <p className="text-slate-300">Team: Raghav Budur (PES1UG23AM225) & Prithviraj K (PES1UG24AM204)</p>
          <p className="text-slate-500 mt-0.5">PES University • Department of Computer Science & Engineering</p>
        </div>
      </div>
    </footer>
  );
}

