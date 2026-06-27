// src/components/SideBySideCompare.jsx
import React from 'react';
import { areIngredientsMatching } from '../js/substitute-finder';

export default function SideBySideCompare({
  refInfo,
  refSalts,
  compItem,
  onClose
}) {
  if (!refInfo || !compItem) return null;

  const refPackSize = refInfo.pack_size || refInfo.units || 1;
  const refUnitPrice = refInfo.unit_price || (refInfo.price / refPackSize);
  const refMrpPerUnit = (refInfo.mrp / refPackSize) || refUnitPrice;
  
  const compPackSize = compItem.pack_size || compItem.units || 1;
  const compUnitPrice = compItem.unit_price || (compItem.price / compPackSize);
  
  const savingsVsMrp = refMrpPerUnit > 0 ? ((refMrpPerUnit - compUnitPrice) / refMrpPerUnit) * 100 : 0;
  const savingsVsPrice = refUnitPrice > 0 ? ((refUnitPrice - compUnitPrice) / refUnitPrice) * 100 : 0;

  const refKeys = Object.keys(refSalts || {});
  const compSalts = compItem.salts || {};
  const compKeys = Object.keys(compSalts);

  // Group and match active ingredients between Prescribed and Compared
  const comparisonList = [];
  const matchedCompKeys = new Set();

  refKeys.forEach(rk => {
    const ck = compKeys.find(k => areIngredientsMatching(rk, k));
    if (ck) {
      matchedCompKeys.add(ck);
      comparisonList.push({
        name: rk,
        hasRef: true,
        refStrength: refSalts[rk],
        hasComp: true,
        compName: ck,
        compStrength: compSalts[ck]
      });
    } else {
      comparisonList.push({
        name: rk,
        hasRef: true,
        refStrength: refSalts[rk],
        hasComp: false
      });
    }
  });

  compKeys.forEach(ck => {
    if (!matchedCompKeys.has(ck)) {
      comparisonList.push({
        name: ck,
        hasRef: false,
        hasComp: true,
        compStrength: compSalts[ck]
      });
    }
  });

  comparisonList.sort((a, b) => a.name.localeCompare(b.name));

  const isProbiotic = refKeys.some(k => /probiotic|microbe/i.test(k)) || 
                      compKeys.some(k => /probiotic|microbe/i.test(k));

  return (
    <section className="bg-slate-900/95 border-2 border-cyan-500/30 rounded-2xl p-6 relative w-full flex flex-col gap-5 shadow-2xl backdrop-blur-md">
      {/* Header */}
      <div className="flex justify-between items-center border-b border-white/10 pb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl select-none">📊</span>
          <h3 className="font-heading text-lg font-bold text-slate-100">Detailed Comparison</h3>
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
            <div className="flex justify-between items-start">
              <span className="text-[10px] text-cyan-400 uppercase tracking-widest font-bold mb-1">Prescribed Brand</span>
              {refInfo.link && (
                <a
                  href={refInfo.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] font-bold text-cyan-400 hover:underline shrink-0"
                  title="View Prescribed Brand on Truemeds"
                >
                  View Product ↗
                </a>
              )}
            </div>
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
              {comparisonList.map((item, idx) => {
                return (
                  <div key={idx} className="flex justify-between items-center text-xs p-2 rounded bg-white/5 border border-white/5">
                    <span className="text-slate-300 font-medium">{item.name}</span>
                    <span className={`font-bold ${item.hasRef ? 'text-slate-100' : 'text-slate-500'}`}>
                      {item.hasRef ? item.refStrength : 'Not Present'}
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
            <div className="flex justify-between items-start gap-4">
              <span className="text-[10px] text-emerald-400 uppercase tracking-widest font-bold mb-1">Compared Substitute</span>
              <div className="flex flex-col items-end gap-1.5">
                <div className="flex gap-1.5">
                  <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                    {compItem.status}
                  </span>
                  <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
                    {compItem.match_percent}% Match
                  </span>
                </div>
                {compItem.link && (
                  <a
                    href={compItem.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] font-bold text-cyan-400 hover:underline shrink-0"
                    title="View Compared Substitute on Truemeds"
                  >
                    View Product ↗
                  </a>
                )}
              </div>
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
              {comparisonList.map((item, idx) => {
                let strengthLabel = '';
                let colorClass = '';
                
                if (item.hasRef && item.hasComp) {
                  if (item.refStrength === item.compStrength) {
                    strengthLabel = `${item.compStrength} (Match) ✓`;
                    colorClass = 'text-emerald-400';
                  } else {
                    strengthLabel = `${item.compStrength} (vs ${item.refStrength}) ⚠️`;
                    colorClass = 'text-amber-400 font-bold';
                  }
                } else if (!item.hasRef && item.hasComp) {
                  strengthLabel = `${item.compStrength} (Extra) +`;
                  colorClass = 'text-blue-400';
                } else {
                  strengthLabel = `Missing (Prescribed: ${item.refStrength}) ✕`;
                  colorClass = 'text-rose-400';
                }

                return (
                  <div key={idx} className="flex justify-between items-center text-xs p-2 rounded bg-white/5 border border-white/5">
                    <span className="text-slate-300 font-medium">{item.compName || item.name}</span>
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

      {/* Probiotic Warning */}
      {isProbiotic && (
        <div className="bg-amber-500/10 border border-amber-500/25 p-3.5 rounded-xl flex gap-3 items-start text-xs text-amber-300">
          <span className="text-base select-none mt-0.5">⚠️</span>
          <div>
            <strong className="block font-bold mb-0.5 text-amber-200">Probiotic Strain Warning</strong>
            Probiotic products contain different bacterial strains (e.g. Lactobacillus, Bifidobacterium, Bacillus clausii) targeting different health concerns (e.g., gut health vs. urogenital/vaginal flora) and are generally **not interchangeable**. Consult a doctor before swapping.
          </div>
        </div>
      )}

      {/* Savings Summary Banner */}
      <div className="bg-slate-950/80 border border-white/5 p-4 rounded-xl flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="flex flex-row gap-6 w-full sm:w-auto">
          <div className="flex flex-col">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">vs Retail MRP (Offline)</span>
            {savingsVsMrp > 0 ? (
              <span className="text-emerald-400 text-lg font-bold">Save {Math.round(savingsVsMrp)}%</span>
            ) : savingsVsMrp < 0 ? (
              <span className="text-rose-400 text-lg font-bold">+{Math.abs(Math.round(savingsVsMrp))}% Cost</span>
            ) : (
              <span className="text-slate-400 text-lg font-bold">0%</span>
            )}
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">vs Queried Price</span>
            {savingsVsPrice > 0 ? (
              <span className="text-emerald-400 text-lg font-bold">Save {Math.round(savingsVsPrice)}%</span>
            ) : savingsVsPrice < 0 ? (
              <span className="text-rose-400 text-lg font-bold">+{Math.abs(Math.round(savingsVsPrice))}% Cost</span>
            ) : (
              <span className="text-slate-400 text-lg font-bold">0%</span>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
