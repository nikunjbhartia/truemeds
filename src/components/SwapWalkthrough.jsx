// src/components/SwapWalkthrough.jsx
import React, { useState } from 'react';

export default function SwapWalkthrough({ prescribedName, saltsString, substituteName }) {
  const [activeStep, setActiveStep] = useState(1);

  const handleNext = () => {
    if (activeStep < 3) {
      setActiveStep(activeStep + 1);
    }
  };

  const handleBack = () => {
    if (activeStep > 1) {
      setActiveStep(activeStep - 1);
    }
  };

  const handleReset = () => {
    setActiveStep(1);
  };

  return (
    <div className="glass-panel p-5 w-full flex flex-col gap-4">
      <div className="flex justify-between items-center">
        <h3 className="font-heading text-sm font-bold text-slate-300 uppercase tracking-widest">Interactive Swap Pathway</h3>
        {activeStep > 1 && (
          <button 
            onClick={handleReset}
            className="text-[10px] text-cyan-400 hover:underline font-semibold uppercase tracking-wider cursor-pointer"
          >
            Reset Pathway
          </button>
        )}
      </div>

      {/* Timeline view */}
      <div className="flex flex-row items-center justify-between gap-2 py-4 relative">
        
        {/* Step 1 */}
        <button 
          onClick={() => setActiveStep(1)}
          className="flex-1 flex flex-col items-center gap-2 relative z-10 focus:outline-none group cursor-pointer"
        >
          <div className={`h-10 w-10 rounded-full flex items-center justify-center font-heading font-extrabold text-sm transition-all duration-300
            ${activeStep >= 1 
              ? 'success-gradient-bg text-slate-50 scale-105 shadow-md shadow-emerald-500/20' 
              : 'bg-white/5 border border-white/10 text-slate-400'}`}
          >
            1
          </div>
          <div className="text-center">
            <h5 className={`text-xs font-bold transition-colors ${activeStep === 1 ? 'text-slate-200' : 'text-slate-500'}`}>Select Substitute</h5>
            <p className="text-[9px] text-slate-500 truncate max-w-[120px] font-medium mt-0.5">{substituteName}</p>
          </div>
        </button>
        
        {/* Connection Line 1-2 */}
        <div className="absolute top-[24px] left-[16%] right-[50%] h-0.5 -z-0 bg-white/5">
          <div className="h-full success-gradient-bg transition-all duration-500" style={{ width: activeStep >= 2 ? '100%' : '0%' }}></div>
        </div>

        {/* Step 2 */}
        <button 
          onClick={() => setActiveStep(2)}
          className="flex-1 flex flex-col items-center gap-2 relative z-10 focus:outline-none group cursor-pointer"
        >
          <div className={`h-10 w-10 rounded-full flex items-center justify-center font-heading font-extrabold text-sm transition-all duration-300
            ${activeStep >= 2 
              ? 'success-gradient-bg text-slate-50 scale-105 shadow-md shadow-emerald-500/20' 
              : 'bg-white/5 border border-white/10 text-slate-400'}`}
          >
            2
          </div>
          <div className="text-center">
            <h5 className={`text-xs font-bold transition-colors ${activeStep === 2 ? 'text-slate-200' : 'text-slate-500'}`}>Consult Doctor</h5>
            <p className="text-[9px] text-slate-500 truncate max-w-[120px] font-medium mt-0.5">{saltsString}</p>
          </div>
        </button>
        
        {/* Connection Line 2-3 */}
        <div className="absolute top-[24px] left-[50%] right-[16%] h-0.5 -z-0 bg-white/5">
          <div className="h-full success-gradient-bg transition-all duration-500" style={{ width: activeStep >= 3 ? '100%' : '0%' }}></div>
        </div>

        {/* Step 3 */}
        <button 
          onClick={() => setActiveStep(3)}
          className="flex-1 flex flex-col items-center gap-2 relative z-10 focus:outline-none group cursor-pointer"
        >
          <div className={`h-10 w-10 rounded-full flex items-center justify-center font-heading font-extrabold text-sm transition-all duration-300 relative
            ${activeStep === 3 
              ? 'accent-gradient-bg text-slate-950 scale-110 shadow-lg shadow-cyan-400/20' 
              : activeStep > 3 
                ? 'success-gradient-bg text-slate-50 shadow-md shadow-emerald-500/20'
                : 'bg-white/5 border border-white/10 text-slate-400'}`}
          >
            3
            {activeStep === 3 && (
              <div className="absolute inset-0 rounded-full border border-cyan-400 animate-pulse-ring"></div>
            )}
          </div>
          <div className="text-center">
            <h5 className={`text-xs font-bold transition-colors ${activeStep === 3 ? 'text-cyan-400' : 'text-slate-500'}`}>Add to Cart</h5>
            <p className="text-[9px] text-slate-500 truncate max-w-[120px] font-medium mt-0.5">Ready to order</p>
          </div>
        </button>

      </div>

      {/* Step Panel Details & Instructions */}
      <div className="glass-panel-nested p-4 mt-2 flex flex-col gap-4 bg-white/2">
        {activeStep === 1 && (
          <div className="flex flex-col gap-2">
            <h4 className="text-sm font-bold text-slate-200">Step 1: Confirm Substitute Selection</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              You have selected <span className="font-semibold text-slate-200">{substituteName}</span> as a substitute for <span className="font-semibold text-slate-200">{prescribedName}</span>. 
              The active ingredient salts (<span className="text-cyan-400 font-medium">{saltsString}</span>) are identical in composition.
            </p>
            <div className="flex justify-end mt-2">
              <button 
                onClick={handleNext}
                className="accent-gradient-bg text-slate-950 font-bold text-xs px-4 py-2 rounded-lg hover:scale-105 active:scale-95 transition-all cursor-pointer"
              >
                Initiate Swap →
              </button>
            </div>
          </div>
        )}

        {activeStep === 2 && (
          <div className="flex flex-col gap-2">
            <h4 className="text-sm font-bold text-slate-200">Step 2: Consult Your Doctor</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Please check with your general practitioner or consulting physician to confirm that switching from <span className="font-semibold text-slate-200">{prescribedName}</span> to <span className="font-semibold text-slate-200">{substituteName}</span> is suitable for your specific therapy regimen.
            </p>
            <div className="flex justify-between mt-2">
              <button 
                onClick={handleBack}
                className="text-xs font-semibold px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 transition-colors cursor-pointer"
              >
                ← Back
              </button>
              <button 
                onClick={handleNext}
                className="accent-gradient-bg text-slate-950 font-bold text-xs px-4 py-2 rounded-lg hover:scale-105 active:scale-95 transition-all cursor-pointer"
              >
                Consulted & Approved →
              </button>
            </div>
          </div>
        )}

        {activeStep === 3 && (
          <div className="flex flex-col gap-2">
            <h4 className="text-sm font-bold text-emerald-400 flex items-center gap-1.5">
              <span>🎉</span> Step 3: Add Substitute to Cart
            </h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              All set! You can now proceed to purchase <span className="font-semibold text-slate-200">{substituteName}</span> on Truemeds with up to 72% savings compared to the brand-name equivalent.
            </p>
            <div className="flex justify-between mt-2">
              <button 
                onClick={handleBack}
                className="text-xs font-semibold px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 transition-colors cursor-pointer"
              >
                ← Back
              </button>
              <button 
                onClick={() => alert(`Added ${substituteName} to cart!`)}
                className="success-gradient-bg text-slate-50 font-bold text-xs px-4 py-2 rounded-lg hover:scale-105 active:scale-95 transition-all cursor-pointer"
              >
                Add to Cart 🛒
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
