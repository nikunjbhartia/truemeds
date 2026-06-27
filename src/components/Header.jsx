import React from 'react';

export default function Header() {
  return (
    <header className="glass-panel px-6 py-4 flex flex-row justify-between items-center w-full mb-6">
      <div className="flex items-center gap-3">
        <span className="text-2xl select-none" role="img" aria-label="pill">💊</span>
        <h1 className="font-heading text-lg sm:text-xl font-bold tracking-tight">
          Truemeds <span className="accent-gradient-text">Substitute Finder</span>
        </h1>
      </div>
      <div className="flex items-center">
        <div className="flex items-center gap-2 text-xs sm:text-sm bg-white/5 border border-white/5 px-3 py-1.5 rounded-full">
          <span className="text-slate-400">Status:</span>
          <span className="font-semibold text-emerald-400 flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping"></span>
            Online
          </span>
        </div>
      </div>
    </header>
  );
}
