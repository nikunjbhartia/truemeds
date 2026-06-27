import React from 'react';

export default function DesktopComparisonTable({ subs, comparedSub, onCompare }) {
  return (
    <div data-testid="desktop-table" className="glass-panel overflow-x-auto w-full">
      <table className="min-w-full text-slate-200 border-collapse text-sm">
        <thead>
          <tr className="border-b border-white/10 text-slate-400 text-left uppercase text-[10px] tracking-wider bg-white/3">
            <th className="px-3 py-3">Status</th>
            <th className="px-3 py-3">Alternative Brand</th>
            <th className="px-3 py-3">Manufacturer</th>
            <th className="px-3 py-3">Pack Price</th>
            <th className="px-3 py-3">Unit Price</th>
            <th className="px-3 py-3">Savings</th>
            <th className="px-3 py-3 text-center">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {subs.map((sub, idx) => {
            const status = sub.status || (sub.matchType === 'exact' ? 'Exact Match' : 'Different Strength');
            const isExact = status.toLowerCase().includes('exact');
            const isStrength = status.toLowerCase().includes('strength') || status.toLowerCase().includes('diff strength');

            return (
              <tr 
                key={idx}
                className="transition-colors hover:bg-white/3"
              >
                <td className="px-3 py-3 whitespace-nowrap">
                  <div className="flex flex-col gap-1 items-start">
                    <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border
                      ${isExact ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : ''}
                      ${isStrength ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' : 'bg-blue-500/10 border-blue-500/20 text-blue-400'}`}
                    >
                      {status}
                    </span>
                    {sub.status !== 'Queried Brand' && sub.match_percent !== undefined && (
                      <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
                        {sub.match_percent}% Match
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-3 py-3">
                  <div className="font-semibold text-slate-100">{sub.brand}</div>
                  <div className="text-[10px] text-slate-500 truncate max-w-xs" title={sub.details}>
                    {(sub.details && sub.details.replace(/\*\*/g, '')) || 'N/A'}
                  </div>
                </td>
                <td className="px-3 py-3 text-slate-400 text-xs break-words max-w-[180px] leading-relaxed">
                  {sub.manufacturer}
                </td>
                <td className="px-3 py-3 whitespace-nowrap font-medium">
                  <span className="line-through text-slate-500 text-xs mr-2">₹{parseFloat(sub.mrp || 0).toFixed(2)}</span>
                  <span className="font-semibold text-slate-200">₹{parseFloat(sub.price || 0).toFixed(2)}</span>
                </td>
                <td className="px-3 py-3 text-slate-300 whitespace-nowrap">
                  ₹{parseFloat(sub.unit_price || 0).toFixed(2)} / Unit
                </td>
                <td className="px-3 py-3 whitespace-nowrap">
                  <div className="flex flex-col gap-1 py-1">
                    {/* vs Retail MRP */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-[9px] text-slate-500 uppercase tracking-wider font-semibold w-28">vs Retail MRP:</span>
                      {sub.savings_vs_mrp > 0 ? (
                        <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold px-2 py-0.5 rounded">
                          Save {Math.round(sub.savings_vs_mrp)}%
                        </span>
                      ) : sub.savings_vs_mrp < 0 ? (
                        <span className="bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[10px] font-bold px-2 py-0.5 rounded">
                          +{Math.abs(Math.round(sub.savings_vs_mrp))}% Cost
                        </span>
                      ) : (
                        <span className="text-slate-500 text-[10px] font-medium">0%</span>
                      )}
                    </div>

                    {/* vs Queried Price */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-[9px] text-slate-500 uppercase tracking-wider font-semibold w-28">vs Queried Price:</span>
                      {sub.savings_vs_price > 0 ? (
                        <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold px-2 py-0.5 rounded">
                          Save {Math.round(sub.savings_vs_price)}%
                        </span>
                      ) : sub.savings_vs_price < 0 ? (
                        <span className="bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[10px] font-bold px-2 py-0.5 rounded">
                          +{Math.abs(Math.round(sub.savings_vs_price))}% Cost
                        </span>
                      ) : (
                        <span className="text-slate-500 text-[10px] font-medium">0%</span>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-3 py-3 whitespace-nowrap text-center">
                  <div className="flex items-center justify-center gap-3">
                    {sub.status !== 'Queried Brand' && (
                      <button
                        onClick={() => onCompare(sub)}
                        className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all duration-150
                          ${comparedSub?.brand === sub.brand
                            ? 'bg-cyan-500/25 border-cyan-400/50 text-cyan-300 shadow-[0_0_12px_rgba(34,211,238,0.15)] font-bold'
                            : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'}`}
                      >
                        Compare
                      </button>
                    )}

                    {sub.link && (
                      <a 
                        href={sub.link} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="text-slate-400 hover:text-cyan-400 transition-colors"
                        title="View on Truemeds"
                      >
                        ↗
                      </a>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
