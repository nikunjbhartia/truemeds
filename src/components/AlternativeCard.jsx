// src/components/AlternativeCard.jsx
import React from 'react';

export default function AlternativeCard({ sub, isSelected, onSelect }) {
  const status = sub.status || (sub.matchType === 'exact' ? 'Exact Match' : 'Different Strength');
  const isExact = status.toLowerCase().includes('exact');
  const isStrength = status.toLowerCase().includes('strength') || status.toLowerCase().includes('diff strength');
  
  return (
    <div 
      className={`glass-panel p-5 transition-all duration-300 hover:shadow-slate-950/60 flex flex-col gap-4 border
        ${isSelected ? 'border-cyan-400/40 shadow-lg shadow-cyan-400/5' : 'border-white/10 hover:border-white/20'}`}
    >
      <div className="flex justify-between items-center">
        <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded border
          ${isExact ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : ''}
          ${isStrength ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' : 'bg-blue-500/10 border-blue-500/20 text-blue-400'}`}
        >
          {status}
        </span>
        {sub.savings_percent > 0 && (
          <span className="bg-emerald-500 font-heading font-extrabold text-[10px] text-slate-950 px-2.5 py-0.5 rounded">
            Save {Math.round(sub.savings_percent)}%
          </span>
        )}
      </div>

      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div className="flex-1">
          <h4 className="font-heading text-lg font-bold text-slate-100">{sub.brand}</h4>
          <p className="text-slate-400 text-xs">{sub.manufacturer}</p>
          
          <div className="mt-2 text-xs text-slate-500 flex flex-wrap gap-2">
            <span>Ingredients:</span>
            <span className="text-slate-400">{sub.details || 'N/A'}</span>
          </div>

          {isStrength && (
            <div className="mt-2.5 text-[11px] text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded inline-block">
              ⚠️ Strength: {sub.details}
            </div>
          )}
        </div>

        <div className="flex flex-row sm:flex-col items-baseline sm:items-end justify-between sm:justify-center gap-2 sm:gap-0 bg-slate-955/20 sm:bg-transparent p-3 sm:p-0 rounded-xl">
          <div>
            <span className="sm:hidden text-[10px] text-slate-500 block uppercase font-semibold">Pricing</span>
            <span className="line-through text-slate-500 text-xs">MRP ₹{parseFloat(sub.mrp || 0).toFixed(2)}</span>
          </div>
          <div className="text-right">
            <span className="font-heading text-xl font-bold text-slate-50 block">₹{parseFloat(sub.price || 0).toFixed(2)}</span>
            <span className="text-[10px] text-slate-400">₹{parseFloat(sub.unit_price || 0).toFixed(2)} / Unit</span>
          </div>
        </div>
      </div>

      <div className="border-t border-white/5 pt-3.5 flex justify-between items-center">
        <button 
          onClick={onSelect}
          className={`text-xs font-bold px-4 py-2.5 rounded-xl transition-all border
            ${isSelected 
              ? 'accent-gradient-bg border-transparent text-slate-950 font-bold' 
              : 'bg-white/5 hover:bg-white/10 active:scale-95 border-white/10 text-slate-200'}`}
        >
          {isSelected ? 'Selected' : 'Select for Swap'}
        </button>
        {sub.link && (
          <a 
            href={sub.link} 
            target="_blank" 
            rel="noopener noreferrer" 
            className="text-xs text-cyan-400 font-semibold hover:underline flex items-center gap-1"
          >
            View on Truemeds <span>↗</span>
          </a>
        )}
      </div>
    </div>
  );
}
