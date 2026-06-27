import React, { useState } from 'react';

export default function SearchInput({ onSearch, history, onSelectHistoryItem, onClearHistory }) {
  const [query, setQuery] = useState('');
  const [showHistory, setShowHistory] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    onSearch(query.trim());
    setShowHistory(false);
  };

  const handleFocus = () => {
    setShowHistory(true);
  };

  const handleBlur = () => {
    // Delay hiding to allow clicks on history items
    setTimeout(() => setShowHistory(false), 200);
  };

  return (
    <section className="bg-slate-900/90 border border-white/10 shadow-2xl rounded-2xl p-6 sm:p-10 flex flex-col items-center gap-4 text-center w-full mb-6 relative">
      <h2 className="font-heading text-2xl sm:text-3xl font-extrabold text-slate-50">Find Cheaper Medicine Substitutes</h2>
      <p className="text-slate-400 text-sm sm:text-base max-w-lg">
        Scan active compositions and view alternative recommendations with exact ingredients matching.
      </p>
      
      <div className="w-full max-w-2xl relative">
        <form 
          onSubmit={handleSubmit}
          className="flex flex-row items-center gap-2 bg-slate-955/40 border border-white/10 rounded-full p-1.5 focus-within:border-cyan-400 focus-within:ring-2 focus-within:ring-cyan-400/20 transition-all duration-200"
        >
          <span className="pl-4 text-slate-400 text-lg sm:text-xl select-none">🔍</span>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={handleFocus}
            onBlur={handleBlur}
            spellCheck="false"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            placeholder="Enter medicine name (e.g. Crocin, Dolo, Ecosprin)..."
            className="flex-1 bg-transparent border-none outline-none py-2 px-3 text-slate-50 font-body placeholder-slate-500 text-base"
          />
          <button type="submit" className="accent-gradient-bg font-heading font-semibold px-6 py-2.5 rounded-full hover:scale-105 active:scale-95 transition-all text-sm">
            Search
          </button>
        </form>

        {/* Search History & Auto-Suggestion Panel */}
        {showHistory && history && history.length > 0 && (
          <div className="absolute top-full left-0 right-0 z-50 bg-slate-900/98 border border-white/10 mt-2 p-4 text-left rounded-2xl shadow-2xl max-h-64 overflow-y-auto backdrop-blur-md">
            <div className="flex justify-between items-center mb-3">
              <span className="text-xs font-bold uppercase text-slate-400 tracking-wider">Recent Searches</span>
              <button 
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault(); // Prevent input blur from firing before clearing
                  onClearHistory();
                }}
                className="text-xs text-rose-400 hover:underline cursor-pointer"
              >
                Clear All
              </button>
            </div>
            <ul className="flex flex-col gap-1">
              {history.map((item, idx) => (
                <li 
                  key={idx} 
                  onMouseDown={() => {
                    setQuery(item);
                    onSelectHistoryItem(item);
                  }}
                  className="flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-white/5 text-slate-300 hover:text-cyan-400 cursor-pointer text-sm transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <span className="text-slate-500">🕒</span> {item}
                  </span>
                  <span className="text-xs text-slate-500 select-none">⏎</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
