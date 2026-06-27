// src/components/SideBySideCompare.jsx
import React from 'react';

export default function SideBySideCompare({
  refInfo,
  refSalts,
  compItem,
  onClose,
  onSelect,
  isSelected
}) {
  if (!refInfo || !compItem) return null;

  // Extract all unique salt keys from both reference and compared items
  const refKeys = Object.keys(refSalts || {});
  const compSalts = compItem.salts || {};
  const compKeys = Object.keys(compSalts);
  const allSalts = [...new Set([...refKeys, ...compKeys])].sort();

  return (
    <section className="bg-slate-900/95 border-2 border-cyan-500/30 rounded-2xl p-6 relative w-full flex flex-col gap-5 shadow-2xl backdrop-blur-md">
      {/* Header */}
      <div className="flex justify-between items-center border-b border-white/10 pb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl select-none">📊</span>
          <h3 className="font-heading text-lg font-bold text-slate-100">Side-by-Side Comparison</h3>
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-slate-100 bg-white/5 hover:bg-white/10 p-1.5 rounded-full transition-all text-xs"
          title="Close Comparison"
        >
          ✕
        </button>
      </div>

      {/* Grid Comparison */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left Column: Prescribed Brand */}
        <div className="bg-slate-950/40 border border-white/5 p-4 rounded-xl flex flex-col gap-3">
          <div className="flex flex-col">
            <span className="text-[10px] text-cyan-400 uppercase tracking-widest font-bold mb-1">Prescribed Brand</span>
            <h4 className="font-heading text-base font-bold text-slate-100">{refInfo.name}</h4>
            <span className="text-xs text-slate-400 font-medium mt-1">{refInfo.manufacturer}</span>
          </div>

          <div className="grid grid-cols-2 gap-4 text-xs border-y border-white/5 py-3">
            <div>
              <span className="block text-slate-500 uppercase tracking-wider text-[9px] mb-1">Form Factor</span>
              <span className="text-slate-200 font-medium">{refInfo.pack_form || 'N/A'}</span>
            </div>
            <div>
              <span className="block text-slate-500 uppercase tracking-wider text-[9px] mb-1">Pricing Details</span>
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-slate-500">Retail MRP:</span>
                  <span className="line-through text-slate-500">₹{parseFloat(refInfo.mrp || 0).toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">Truemeds Price:</span>
                  <span className="text-slate-200 font-bold">₹{parseFloat(refInfo.price || 0).toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between text-[10px] border-t border-white/5 pt-1 mt-1">
                  <span className="text-slate-500">Unit Price:</span>
                  <span className="text-cyan-400 font-semibold">₹{parseFloat(refInfo.unit_price || 0).toFixed(2)} / Unit</span>
                </div>
              </div>
            </div>
          </div>

          {/* Salts List for Ref */}
          <div>
            <span className="block text-[10px] text-slate-500 uppercase tracking-wider mb-2 font-bold">Active Ingredients</span>
            <div className="flex flex-col gap-2">
              {allSalts.map((salt, idx) => {
                const hasRef = refSalts[salt] !== undefined;
                return (
                  <div key={idx} className="flex justify-between items-center text-xs p-2 rounded bg-white/5 border border-white/5">
                    <span className="text-slate-300 font-medium">{salt}</span>
                    <span className={`font-bold ${hasRef ? 'text-slate-100' : 'text-slate-500'}`}>
                      {hasRef ? refSalts[salt] : 'Not Present'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Compared Substitute */}
        <div className="bg-slate-950/60 border border-white/10 p-4 rounded-xl flex flex-col gap-3 relative">
          <div className="flex flex-col">
            <div className="flex justify-between items-start">
              <span className="text-[10px] text-emerald-400 uppercase tracking-widest font-bold mb-1">Compared Substitute</span>
              <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                {compItem.status}
              </span>
            </div>
            <h4 className="font-heading text-base font-bold text-slate-100">{compItem.brand}</h4>
            <span className="text-xs text-slate-400 font-medium mt-1">{compItem.manufacturer}</span>
          </div>

          <div className="grid grid-cols-2 gap-4 text-xs border-y border-white/5 py-3">
            <div>
              <span className="block text-slate-500 uppercase tracking-wider text-[9px] mb-1">Form Factor</span>
              <span className="text-slate-200 font-medium">{compItem.pack_form || 'N/A'}</span>
            </div>
            <div>
              <span className="block text-slate-500 uppercase tracking-wider text-[9px] mb-1">Pricing Details</span>
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-slate-500">Retail MRP:</span>
                  <span className="line-through text-slate-500">₹{parseFloat(compItem.mrp || 0).toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">Truemeds Price:</span>
                  <span className="text-slate-200 font-bold">₹{parseFloat(compItem.price || 0).toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between text-[10px] border-t border-white/5 pt-1 mt-1">
                  <span className="text-slate-500">Unit Price:</span>
                  <span className="text-emerald-400 font-semibold">₹{parseFloat(compItem.unit_price || 0).toFixed(2)} / Unit</span>
                </div>
              </div>
            </div>
          </div>

          {/* Salts List for Alt */}
          <div>
            <span className="block text-[10px] text-slate-500 uppercase tracking-wider mb-2 font-bold">Active Ingredients Comparison</span>
            <div className="flex flex-col gap-2">
              {allSalts.map((salt, idx) => {
                const hasRef = refSalts[salt] !== undefined;
                const hasComp = compSalts[salt] !== undefined;
                
                let strengthLabel = '';
                let colorClass = '';
                
                if (hasRef && hasComp) {
                  if (refSalts[salt] === compSalts[salt]) {
                    strengthLabel = `${compSalts[salt]} (Match) ✓`;
                    colorClass = 'text-emerald-400';
                  } else {
                    strengthLabel = `${compSalts[salt]} (vs ${refSalts[salt]}) ⚠️`;
                    colorClass = 'text-amber-400 font-bold';
                  }
                } else if (!hasRef && hasComp) {
                  strengthLabel = `${compSalts[salt]} (Extra) +`;
                  colorClass = 'text-blue-400';
                } else {
                  strengthLabel = `Missing (Prescribed: ${refSalts[salt]}) ✕`;
                  colorClass = 'text-rose-400';
                }

                return (
                  <div key={idx} className="flex justify-between items-center text-xs p-2 rounded bg-white/5 border border-white/5">
                    <span className="text-slate-300 font-medium">{salt}</span>
                    <span className={`font-bold ${colorClass}`}>
                      {strengthLabel}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Savings Summary Banner */}
      <div className="bg-slate-950/80 border border-white/5 p-4 rounded-xl flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="flex flex-row gap-6 w-full sm:w-auto">
          <div className="flex flex-col">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">vs Retail MRP (Offline)</span>
            {compItem.savings_vs_mrp > 0 ? (
              <span className="text-emerald-400 text-lg font-bold">Save {Math.round(compItem.savings_vs_mrp)}%</span>
            ) : compItem.savings_vs_mrp < 0 ? (
              <span className="text-rose-400 text-lg font-bold">+{Math.abs(Math.round(compItem.savings_vs_mrp))}% Cost</span>
            ) : (
              <span className="text-slate-400 text-lg font-bold">0%</span>
            )}
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">vs Truemeds Price</span>
            {compItem.savings_vs_price > 0 ? (
              <span className="text-emerald-400 text-lg font-bold">Save {Math.round(compItem.savings_vs_price)}%</span>
            ) : compItem.savings_vs_price < 0 ? (
              <span className="text-rose-400 text-lg font-bold">+{Math.abs(Math.round(compItem.savings_vs_price))}% Cost</span>
            ) : (
              <span className="text-slate-400 text-lg font-bold">0%</span>
            )}
          </div>
        </div>

        <div className="flex gap-3 w-full sm:w-auto justify-end">
          <button
            onClick={() => onSelect(compItem)}
            className={`w-full sm:w-auto text-sm font-bold px-6 py-2.5 rounded-full border transition-all hover:scale-105 active:scale-95 duration-150
              ${isSelected
                ? 'accent-gradient-bg border-transparent text-slate-950 font-bold'
                : 'bg-white/5 border-white/10 text-slate-200 hover:bg-white/10'}`}
          >
            {isSelected ? 'Selected' : 'Swap to this Substitute'}
          </button>
        </div>
      </div>
    </section>
  );
}
