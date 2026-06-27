import React from 'react';

export default function HistoryList({ history, onSelectHistoryItem, onClearHistory }) {
  if (!history || history.length === 0) return null;

  return (
    <div className="glass-panel p-5 w-full flex flex-col gap-4">
      <div className="flex justify-between items-center">
        <h3 className="font-heading text-sm font-bold text-slate-300 uppercase tracking-widest">Search History</h3>
        <button 
          onClick={onClearHistory}
          className="text-xs text-rose-400 hover:underline cursor-pointer"
        >
          Clear All
        </button>
      </div>
      <ul className="flex flex-col gap-2">
        {history.map((item, idx) => (
          <li 
            key={idx}
            onClick={() => onSelectHistoryItem(item)}
            className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/3 border border-white/5 text-slate-300 hover:text-cyan-400 cursor-pointer text-sm transition-all hover:bg-white/5"
          >
            <span className="flex items-center gap-2">
              <span className="text-slate-500">🕒</span> {item}
            </span>
            <span className="text-xs text-slate-500 select-none">→</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
