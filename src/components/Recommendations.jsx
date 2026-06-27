import React from 'react';

export default function Recommendations({ recommendations, onCompare, comparedSub }) {
  if (!recommendations || recommendations.length === 0) return null;

  const hasCheapestSwap = recommendations.some(rec => rec.category.includes('Cheapest Swap'));
  const filteredRecs = hasCheapestSwap
    ? recommendations.filter(rec => !rec.category.includes('Standalone'))
    : recommendations;

  return (
    <div className="w-full flex flex-col gap-3">
      <h3 className="font-heading text-sm font-bold text-slate-350 uppercase tracking-widest">Recommended Actions</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
        {filteredRecs.slice(0, 4).map((rec, idx) => {
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
                <div className="flex flex-wrap gap-2 items-center">
                  <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border self-start ${categoryBadgeColor}`}>
                    {rec.category}
                  </span>
                  {rec.match_percent !== undefined && !rec.category.includes('Standalone') && !rec.category.includes('Cheapest Swap') && (
                    <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
                      {rec.match_percent}% Match
                    </span>
                  )}
                </div>
                <div>
                  <h4 className="font-heading text-base font-bold text-slate-100 break-words leading-snug">{rec.brand}</h4>
                  <p className="text-[10px] text-slate-500 font-medium">Unit Price: ₹{parseFloat(rec.unit_price || 0).toFixed(2)}</p>
                </div>
                {rec.details && (
                  <p className="text-[10px] text-slate-400 bg-white/5 border border-white/5 px-2.5 py-1.5 rounded-lg leading-relaxed mt-1">
                    {rec.details.replace(/\*\*/g, '')}
                  </p>
                )}
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
                ) : rec.savings_percent < 0 ? (
                  <span className="bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[10px] font-bold px-2 py-0.5 rounded">
                    +{Math.abs(Math.round(rec.savings_percent))}% Cost
                  </span>
                ) : (
                  <span className="text-slate-500 text-xs font-semibold">0%</span>
                )}
              </div>

              <div className="flex gap-2 mt-2">
                {onCompare && rec.category !== 'Queried Brand (Standalone)' && (
                  <button
                    onClick={() => onCompare({
                      brand: rec.brand,
                      manufacturer: rec.manufacturer || 'N/A',
                      mrp: rec.mrp,
                      price: rec.price,
                      unit_price: rec.unit_price,
                      savings_vs_mrp: rec.savings_percent,
                      link: rec.link,
                      details: rec.details,
                      salts: rec.salts
                    })}
                    className={`flex-1 text-xs font-semibold py-1.5 rounded-lg border transition-all duration-150
                      ${comparedSub?.brand === rec.brand
                        ? 'bg-cyan-500/25 border-cyan-400/50 text-cyan-300 shadow-[0_0_12px_rgba(34,211,238,0.15)] font-bold'
                        : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'}`}
                  >
                    {comparedSub?.brand === rec.brand ? 'Comparing' : 'Compare'}
                  </button>
                )}

                {rec.link && (
                  <a 
                    href={rec.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 text-center text-xs font-bold bg-white/5 border border-white/10 hover:bg-white/10 text-slate-200 py-1.5 rounded-lg transition-all"
                  >
                    {isCheapestSwap ? 'Order Swap ↗' : 'Order ↗'}
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
