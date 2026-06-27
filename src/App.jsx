// src/App.jsx
import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import SearchInput from './components/SearchBar/SearchInput';
import HistoryList from './components/SearchBar/HistoryList';
import MatchFilters from './components/MatchFilters';
import AlternativeCard from './components/AlternativeCard';

import ResponsiveLayout from './components/ResponsiveLayout';
import { useSubstituteFinder } from './hooks/useSubstituteFinder';
import { useIsMobile, useIsTablet, useIsDesktop } from './hooks/useMediaQuery';
import MobileAlternativeStack from './components/MobileAlternativeStack';
import DesktopComparisonTable from './components/DesktopComparisonTable';

export default function App({ initialQuery = '' } = {}) {
  const [history, setHistory] = useState([]);
  const [searched, setSearched] = useState(!!initialQuery);
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const { data, loading, error } = useSubstituteFinder(searchQuery);
  const [localError, setLocalError] = useState(null);

  const [activeFilter, setActiveFilter] = useState('all');
  const [selectedSub, setSelectedSub] = useState(null);
  const [medicine, setMedicine] = useState(null);
  const [substitutes, setSubstitutes] = useState([]);

  const isMobile = useIsMobile();
  const isTablet = useIsTablet();
  const isDesktop = useIsDesktop();

  const [isAccordionOpen, setIsAccordionOpen] = useState({
    ref: true,
  });

  // Load history from localStorage on mount
  useEffect(() => {
    const saved = window.localStorage.getItem('tm_search_history');
    if (saved) {
      try {
        setHistory(JSON.parse(saved));
      } catch (e) {
        if (e instanceof SyntaxError) {
          window.localStorage.removeItem('tm_search_history');
        }
        console.error('Failed to parse search history:', e);
        setHistory([]);
      }
    }
  }, []);

  // Sync data from hook
  useEffect(() => {
    if (data) {
      if (!data.queried_medicine) {
        setMedicine(null);
        setSubstitutes([]);
        setSelectedSub(null);
        setLocalError('No results found.');
        return;
      }
      setMedicine(data.queried_medicine);
      setLocalError(null);

      const exacts = (data.alternatives?.exact || []).map(a => ({ ...a, matchType: 'exact' }));
      const strengths = (data.alternatives?.different_strength || []).map(a => ({ ...a, matchType: 'strength' }));
      const partials = (data.alternatives?.partial || []).map(a => ({ ...a, matchType: 'partial' }));
      const allSubs = [...exacts, ...strengths, ...partials];

      setSubstitutes(allSubs);
      
      // Auto-select recommended (cheapest) or first alternative
      if (data.recommendations && data.recommendations.length > 0) {
        const recBrand = data.recommendations[0].brand;
        const match = allSubs.find(s => s.brand === recBrand);
        setSelectedSub(match || allSubs[0] || null);
      } else {
        setSelectedSub(allSubs[0] || null);
      }
    } else if (searchQuery) {
      setMedicine(null);
      setSubstitutes([]);
      setSelectedSub(null);
      setLocalError('No results found.');
    }
  }, [data, searchQuery]);

  // Handle URL parameters search trigger on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const query = params.get('search') || params.get('q');
    if (query) {
      handleSearch(query);
    }
  }, []);

  const handleSearch = (queryStr) => {
    if (!queryStr.trim()) return;
    
    // Add to history list (max 5 items, unique)
    const updated = [queryStr, ...history.filter(item => item !== queryStr)].slice(0, 5);
    setHistory(updated);
    window.localStorage.setItem('tm_search_history', JSON.stringify(updated));
    
    setSearched(true);
    setLocalError(null);
    setSearchQuery(queryStr);
  };

  const handleClearHistory = () => {
    setHistory([]);
    window.localStorage.removeItem('tm_search_history');
  };

  const filteredSubstitutes = substitutes.filter(sub => {
    if (activeFilter === 'all') return true;
    return sub.matchType === activeFilter;
  });

  const displayError = error ? 'Failed to fetch results. Please try again.' : localError;

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 flex flex-col gap-6">
      
      {/* Decorative Orbs */}
      <div className="bg-orb orb-primary"></div>
      <div className="bg-orb orb-secondary"></div>

      {/* App Header */}
      <Header />

      {/* Search Input Box */}
      <SearchInput 
        onSearch={handleSearch} 
        history={history}
        onSelectHistoryItem={handleSearch}
        onClearHistory={handleClearHistory}
      />

      {loading && (
        <section className="glass-panel py-16 px-4 flex flex-col items-center justify-center text-center gap-4">
          <div className="animate-spin text-5xl select-none">🔄</div>
          <h3 className="font-heading text-xl font-bold text-slate-200">Searching...</h3>
        </section>
      )}

      {displayError && !loading && (
        <section className="glass-panel py-16 px-4 flex flex-col items-center justify-center text-center gap-4 border-rose-500/20">
          <div className="text-5xl opacity-40 select-none">⚠️</div>
          <h3 className="font-heading text-xl font-bold text-rose-400">Error</h3>
          <p className="text-slate-400 text-sm max-w-sm">{displayError}</p>
        </section>
      )}

      {searched && !loading && !displayError && medicine && (
        <ResponsiveLayout>
          
          {/* Left Side: Reference Med details & Savings Calculator */}
          <aside className="lg:col-span-4 flex flex-col gap-6">
            
            {/* Reference Medicine Info Card */}
            <div className="glass-panel border-cyan-400/30 overflow-hidden">
              <div 
                onClick={() => setIsAccordionOpen(prev => ({ ...prev, ref: !prev.ref }))}
                className="px-5 py-4 flex justify-between items-center bg-white/5 cursor-pointer lg:cursor-default"
              >
                <span className="text-xs font-bold text-cyan-400 uppercase tracking-widest bg-cyan-400/10 px-2.5 py-1 rounded">Prescribed</span>
                <span className="lg:hidden text-slate-400 text-xs">{isAccordionOpen.ref ? '▲' : '▼'}</span>
              </div>
              
              <div className={`px-5 pb-5 pt-2 flex flex-col gap-4 ${isAccordionOpen.ref ? 'block' : 'hidden lg:block'}`}>
                <div>
                  <h3 className="font-heading text-xl font-bold text-slate-50">{medicine.name}</h3>
                  {medicine.manufacturer && <p className="text-slate-400 text-xs">{medicine.manufacturer}</p>}
                </div>
                
                <div className="flex justify-between items-baseline">
                  <div>
                    <span className="block text-[10px] text-slate-500 uppercase tracking-wider">Price</span>
                    <span className="font-heading text-lg font-bold">₹{parseFloat(medicine.price || 0).toFixed(2)}</span>
                  </div>
                  <div className="text-right">
                    <span className="block text-[10px] text-slate-500 uppercase tracking-wider">Unit Price</span>
                    <span className="text-sm font-semibold text-slate-300">₹{parseFloat(medicine.unit_price || 0).toFixed(2)} / Unit</span>
                  </div>
                </div>

                {medicine.ingredients && medicine.ingredients.length > 0 && (
                  <div className="border-t border-white/5 pt-4">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Composition</h4>
                    <ul className="flex flex-col gap-1.5">
                      {medicine.ingredients.map((ing, idx) => (
                        <li key={idx} className="flex justify-between items-center text-sm bg-white/5 border border-white/5 px-3 py-2 rounded-lg text-slate-200 font-medium">
                          {ing}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>

            {/* Sidebar Search History */}
            <HistoryList 
              history={history}
              onSelectHistoryItem={handleSearch}
              onClearHistory={handleClearHistory}
            />

          </aside>

          {/* Right Side: Step Walkthrough, Filters, Alternative list */}
          <main className="lg:col-span-8 flex flex-col gap-6">
            


            {/* Filter Options Bar */}
            <MatchFilters 
              activeFilter={activeFilter}
              onFilterChange={setActiveFilter}
            />

            {/* Substitutes List */}
            <div className="w-full">
              {filteredSubstitutes.length > 0 ? (
                isDesktop ? (
                  <DesktopComparisonTable 
                    subs={filteredSubstitutes}
                    selectedSub={selectedSub}
                    onSelect={setSelectedSub}
                  />
                ) : (
                  <MobileAlternativeStack 
                    subs={filteredSubstitutes}
                    selectedSub={selectedSub}
                    onSelect={setSelectedSub}
                  />
                )
              ) : (
                <p className="glass-panel p-5 text-center text-slate-400 text-sm">
                  No alternatives found matching filter "{activeFilter.toUpperCase()}".
                </p>
              )}
            </div>

          </main>

        </ResponsiveLayout>
      )}

      {searched && !loading && !displayError && !medicine && (
        <section className="glass-panel py-16 px-4 flex flex-col items-center justify-center text-center gap-4">
          <div className="text-5xl opacity-40 select-none">🔍</div>
          <h3 className="font-heading text-xl font-bold text-slate-200">No Medicine Found</h3>
          <p className="text-slate-400 text-sm max-w-sm">
            We couldn't parse the search response. Try a different query.
          </p>
        </section>
      )}

      {!searched && (
        <section className="glass-panel py-16 px-4 flex flex-col items-center justify-center text-center gap-4">
          <div className="text-5xl opacity-40 select-none">🔍</div>
          <h3 className="font-heading text-xl font-bold text-slate-200">No Medicine Searched Yet</h3>
          <p className="text-slate-400 text-sm max-w-sm">
            Type in a medicine name above (e.g. try searching "Ecosprin 75") to check matches, price differences, and pathways.
          </p>
        </section>
      )}

      {/* Footer */}
      <footer className="text-center py-8 text-xs text-slate-500 border-t border-white/5 mt-10">
        <p>&copy; 2026 Medicine Substitute Portal. Data retrieved from Truemeds API.</p>
      </footer>

    </div>
  );
}
