// src/components/MatchFilters.jsx
import React from 'react';

export default function MatchFilters({ activeFilter, onFilterChange }) {
  return (
    <div className="glass-panel px-6 py-3.5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 w-full">
      <span className="text-sm font-bold text-slate-400 uppercase tracking-wider">Filter Alternatives:</span>
      <div className="flex flex-wrap gap-2 w-full sm:w-auto">
        {['all', 'exact', 'strength', 'partial'].map((type) => (
          <button 
            key={type}
            onClick={() => onFilterChange(type)}
            className={`flex-1 sm:flex-none text-xs font-semibold px-4 py-2 rounded-full border transition-all duration-200
              ${activeFilter === type 
                ? 'accent-gradient-bg border-transparent text-slate-950 font-bold' 
                : 'bg-white/5 border-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-200'}`}
          >
            {type.toUpperCase()} MATCH
          </button>
        ))}
      </div>
    </div>
  );
}
