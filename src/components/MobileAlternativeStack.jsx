import React, { useState } from 'react';

export default function MobileAlternativeStack({ subs, selectedSub, onSelect }) {
  const [expandedIndex, setExpandedIndex] = useState(null);

  return (
    <div data-testid="mobile-stack" className="flex flex-col gap-4 w-full">
      {subs.map((sub, idx) => {
        const isSelected = selectedSub?.brand === sub.brand;
        const isExpanded = expandedIndex === idx;
        const status = sub.status || (sub.matchType === 'exact' ? 'Exact Match' : 'Different Strength');
        const isExact = status.toLowerCase().includes('exact');
        const isStrength = status.toLowerCase().includes('strength') || status.toLowerCase().includes('diff strength');
        
        return (
          <div key={idx} className={`glass-panel border rounded-xl overflow-hidden transition-all duration-300
            ${isSelected ? 'border-cyan-400/40 shadow-lg' : 'border-white/10'}`}
          >
            {/* Header: Brand Name, Savings, select button */}
            <div className="p-4 flex justify-between items-center bg-white/3">
              <div className="flex-1 cursor-pointer" onClick={() => setExpandedIndex(isExpanded ? null : idx)}>
                <h4 className="font-heading text-base font-bold text-slate-100 flex items-center gap-2">
                  {sub.brand}
                  <span className="text-xs text-slate-400">{isExpanded ? '▲' : '▼'}</span>
                </h4>
                <div className="flex gap-2 mt-1">
                  <span className={`text-[9px] px-1.5 py-0.5 rounded border font-semibold uppercase
                    ${isExact ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : ''}
                    ${isStrength ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' : 'bg-blue-500/10 border-blue-500/20 text-blue-400'}`}
                  >
                    {status}
                  </span>
                  {sub.savings_percent > 0 && (
                    <span className="text-[9px] bg-emerald-500 text-slate-950 px-1.5 py-0.5 rounded font-bold">
                      Save {Math.round(sub.savings_percent)}%
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-heading font-bold text-slate-100">₹{parseFloat(sub.price || 0).toFixed(2)}</span>
                <button
                  onClick={() => onSelect(sub)}
                  className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition-all
                    ${isSelected 
                      ? 'accent-gradient-bg border-transparent text-slate-950 font-bold' 
                      : 'bg-white/5 border-white/10 text-slate-200 hover:bg-white/10'}`}
                >
                  {isSelected ? 'Selected' : 'Swap'}
                </button>
              </div>
            </div>

            {/* Collapsible Details */}
            {isExpanded && (
              <div className="p-4 border-t border-white/5 bg-slate-950/20 flex flex-col gap-3 text-sm text-slate-300">
                <div className="flex justify-between">
                  <span className="text-slate-400 text-xs">Manufacturer:</span>
                  <span>{sub.manufacturer}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 text-xs">MRP:</span>
                  <span className="line-through text-slate-500">₹{parseFloat(sub.mrp || 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 text-xs">Unit Price:</span>
                  <span>₹{parseFloat(sub.unit_price || 0).toFixed(2)} / Unit</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-slate-400 text-xs">Ingredients:</span>
                  <span className="text-xs bg-white/5 p-2 rounded">{sub.details || 'N/A'}</span>
                </div>
                {sub.link && (
                  <div className="mt-2 text-right">
                    <a
                      href={sub.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-cyan-400 font-semibold hover:underline"
                    >
                      View on Truemeds ↗
                    </a>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
