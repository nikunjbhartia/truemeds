import React from 'react';

export default function Recommendations({ recommendations }) {
  if (!recommendations || recommendations.length === 0) return null;

  return (
    <div className="w-full flex flex-col gap-3">
      <h3 className="font-heading text-sm font-bold text-slate-350 uppercase tracking-widest">Recommended Actions</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
        {recommendations.slice(0, 3).map((rec, idx) => {
          const isCheapestSwap = rec.category.includes('Cheapest Swap');
          const isStandalone = rec.category.includes('Standalone');
          
          let categoryBadgeColor = 'bg-slate-500/10 border-slate-500/20 text-slate-400';
          if (isCheapestSwap) {
            categoryBadgeColor = 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400';
          } else if (isStandalone) {
            categoryBadgeColor = 'bg-amber-500/10 border-amber-500/20 text-amber-400';
          } else {
            categoryBadgeColor = 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400';
          }

          return (
            <div 
              key={idx} 
              className="glass-panel p-4 flex flex-col justify-between gap-3 border border-white/10 hover:border-white/20 transition-all duration-200"
            >
              <div className="flex flex-col gap-1.5">
                <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border self-start ${categoryBadgeColor}`}>
                  {rec.category}
                </span>
                <div>
                  <h4 className="font-heading text-base font-bold text-slate-100 line-clamp-1">{rec.brand}</h4>
                  <p className="text-[10px] text-slate-500 font-medium">Unit Price: ₹{parseFloat(rec.unit_price || 0).toFixed(2)}</p>
                </div>
              </div>

              <div className="flex items-center justify-between mt-1">
                <div>
                  <span className="line-through text-slate-500 text-[10px] mr-2">₹{parseFloat(rec.mrp || 0).toFixed(2)}</span>
                  <span className="font-heading font-extrabold text-slate-200">₹{parseFloat(rec.price || 0).toFixed(2)}</span>
                </div>
                
                {rec.savings_percent > 0 ? (
                  <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold px-2 py-0.5 rounded">
                    Save {Math.round(rec.savings_percent)}%
                  </span>
                ) : (
                  <span className="text-slate-500 text-xs font-semibold">0%</span>
                )}
              </div>

              {rec.link && (
                <a 
                  href={rec.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-center text-xs font-bold bg-white/5 border border-white/10 hover:bg-white/10 text-slate-200 py-2 rounded-lg transition-all mt-1"
                >
                  {isCheapestSwap ? 'Order Parent & Swap ↗' : 'Order Product ↗'}
                </a>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
