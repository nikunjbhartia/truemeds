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
import TableFilters from './components/TableFilters';
import SideBySideCompare from './components/SideBySideCompare';

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
  const [comparedSub, setComparedSub] = useState(null);

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
        setComparedSub(null);
        setLocalError('No results found.');
        return;
      }
      setMedicine(data.queried_medicine);
      setComparedSub(null);
      setLocalError(null);

      const exacts = (data.alternatives?.exact || [])
        .map(a => ({ ...a, matchType: 'exact' }))
        .filter(a => a.brand !== "" && a.status !== "No matches found under this category");
      const strengths = (data.alternatives?.different_strength || [])
        .map(a => ({ ...a, matchType: 'strength' }))
        .filter(a => a.brand !== "" && a.status !== "No matches found under this category");
      const partials = (data.alternatives?.partial || [])
        .map(a => ({ ...a, matchType: 'partial' }))
        .filter(a => a.brand !== "" && a.status !== "No matches found under this category");
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

  // Sub-filtering states for the alternatives table/stack
  const [subSearchQuery, setSubSearchQuery] = useState("");
  const [selectedManufacturer, setSelectedManufacturer] = useState("");
  const [selectedStatusDetail, setSelectedStatusDetail] = useState("");

  const handleFilterChange = (filter) => {
    setActiveFilter(filter);
    setSubSearchQuery("");
    setSelectedManufacturer("");
    setSelectedStatusDetail("");
  };

  const handleSearch = (queryStr) => {
    if (!queryStr.trim()) return;
    
    // Add to history list (max 5 items, unique)
    const updated = [queryStr, ...history.filter(item => item !== queryStr)].slice(0, 5);
    setHistory(updated);
    window.localStorage.setItem('tm_search_history', JSON.stringify(updated));
    
    setSearched(true);
    setLocalError(null);
    setSearchQuery(queryStr);
    setComparedSub(null);
    
    // Reset sub-filters on new search
    setSubSearchQuery("");
    setSelectedManufacturer("");
    setSelectedStatusDetail("");
  };

  const handleClearHistory = () => {
    setHistory([]);
    window.localStorage.removeItem('tm_search_history');
  };

  // 1. First filter by active category
  const categorySubstitutes = substitutes.filter(sub => {
    if (activeFilter === 'all') return true;
    return sub.matchType === activeFilter;
  });

  // 2. Extract unique lists of options for dropdowns based on the active category
  const uniqueManufacturers = [...new Set(categorySubstitutes.map(s => s.manufacturer))].filter(Boolean).sort();
  const uniqueStatusDetails = [...new Set(categorySubstitutes.map(s => s.status))].filter(Boolean).sort();

  // 3. Apply the search query and dropdown sub-filters
  const finalFilteredSubstitutes = categorySubstitutes.filter(sub => {
    if (subSearchQuery && !sub.brand.toLowerCase().includes(subSearchQuery.toLowerCase())) {
      return false;
    }
    if (selectedManufacturer && sub.manufacturer !== selectedManufacturer) {
      return false;
    }
    if (selectedStatusDetail && sub.status !== selectedStatusDetail) {
      return false;
    }
    return true;
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
        <div className="flex flex-col gap-6 w-full">
          
          {/* Top Panel: Prescribed Med Info and History side-by-side on desktop */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full">
            {/* Reference Medicine Info Card */}
            <div className="md:col-span-2 glass-panel border-cyan-400/30 overflow-hidden flex flex-col">
              <div 
                onClick={() => setIsAccordionOpen(prev => ({ ...prev, ref: !prev.ref }))}
                className="px-5 py-4 flex justify-between items-center bg-white/5 cursor-pointer md:cursor-default"
              >
                <span className="text-xs font-bold text-cyan-400 uppercase tracking-widest bg-cyan-400/10 px-2.5 py-1 rounded">Prescribed</span>
                <span className="md:hidden text-slate-400 text-xs">{isAccordionOpen.ref ? '▲' : '▼'}</span>
              </div>
              
              <div className={`px-5 pb-5 pt-2 flex flex-col gap-4 flex-1 ${isAccordionOpen.ref ? 'block' : 'hidden md:block'}`}>
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
                    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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
            <div className="md:col-span-1">
              <HistoryList 
                history={history}
                onSelectHistoryItem={handleSearch}
                onClearHistory={handleClearHistory}
              />
            </div>
          </div>

          {/* Side-by-Side Detailed Comparison Card if active */}
          {comparedSub && (
            <div className="w-full">
              <SideBySideCompare
                refInfo={medicine}
                refSalts={(() => {
                  const refSalts = {};
                  if (medicine.ingredients) {
                    medicine.ingredients.forEach(ing => {
                      const match = ing.match(/^([^\(]+)\s*\(([^)]+)\)/);
                      if (match) {
                        refSalts[match[1].trim()] = match[2].trim();
                      }
                    });
                  }
                  return refSalts;
                })()}
                compItem={comparedSub}
                onClose={() => setComparedSub(null)}
                onSelect={(sub) => setSelectedSub(sub)}
                isSelected={selectedSub?.brand === comparedSub.brand}
              />
            </div>
          )}

          {/* Bottom Panel: Alternatives Table (Full Width) */}
          <div className="flex flex-col gap-6 w-full">
            {/* Filter Options Bar */}
            <MatchFilters 
              activeFilter={activeFilter}
              onFilterChange={handleFilterChange}
            />

            {/* Sub-Filters: Search and Dropdowns */}
            {categorySubstitutes.length > 0 && (
              <TableFilters
                searchQuery={subSearchQuery}
                onSearchChange={setSubSearchQuery}
                selectedManufacturer={selectedManufacturer}
                onManufacturerChange={setSelectedManufacturer}
                manufacturers={uniqueManufacturers}
                selectedStatus={selectedStatusDetail}
                onStatusChange={setSelectedStatusDetail}
                statuses={uniqueStatusDetails}
                activeFilter={activeFilter}
              />
            )}

            {/* Substitutes List */}
            <div className="w-full">
              {finalFilteredSubstitutes.length > 0 ? (
                isDesktop ? (
                  <DesktopComparisonTable 
                    subs={finalFilteredSubstitutes}
                    selectedSub={selectedSub}
                    onSelect={setSelectedSub}
                    comparedSub={comparedSub}
                    onCompare={setComparedSub}
                  />
                ) : (
                  <MobileAlternativeStack 
                    subs={finalFilteredSubstitutes}
                    selectedSub={selectedSub}
                    onSelect={setSelectedSub}
                    comparedSub={comparedSub}
                    onCompare={setComparedSub}
                  />
                )
              ) : (
                <p className="glass-panel p-5 text-center text-slate-400 text-sm">
                  {categorySubstitutes.length > 0 
                    ? "No alternatives match the current search or dropdown filter criteria."
                    : `No alternatives found matching category "${activeFilter.toUpperCase()}".`
                  }
                </p>
              )}
            </div>
          </div>

        </div>
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
