// src/components/TableFilters.jsx
import React, { useState, useRef, useEffect } from 'react';

export default function TableFilters({
  searchQuery,
  onSearchChange,
  selectedManufacturers = [],
  onManufacturersChange,
  manufacturers = [],
  selectedStatus,
  onStatusChange,
  statuses = [],
  activeFilter
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchMfg, setSearchMfg] = useState('');
  const popoverRef = useRef(null);

  // Close popover on click outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (popoverRef.current && !popoverRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleManufacturer = (mfg) => {
    if (selectedManufacturers.includes(mfg)) {
      onManufacturersChange(selectedManufacturers.filter(item => item !== mfg));
    } else {
      onManufacturersChange([...selectedManufacturers, mfg]);
    }
  };

  const handleSelectAll = () => {
    const filtered = manufacturers.filter(m => m.toLowerCase().includes(searchMfg.toLowerCase()));
    const newSelection = Array.from(new Set([...selectedManufacturers, ...filtered]));
    onManufacturersChange(newSelection);
  };

  const handleClearAll = () => {
    const filtered = manufacturers.filter(m => m.toLowerCase().includes(searchMfg.toLowerCase()));
    onManufacturersChange(selectedManufacturers.filter(m => !filtered.includes(m)));
  };

  const filteredMfgs = manufacturers.filter(m =>
    m.toLowerCase().includes(searchMfg.toLowerCase())
  );

  // Determine button text
  let btnText = 'All Manufacturers';
  if (selectedManufacturers.length === 1) {
    btnText = selectedManufacturers[0];
  } else if (selectedManufacturers.length > 1) {
    btnText = `${selectedManufacturers.length} Selected`;
  }

  return (
    <div className="bg-slate-900/60 border border-white/10 p-4 rounded-xl flex flex-col md:flex-row gap-4 items-center w-full">
      {/* Search Input */}
      <div className="relative w-full md:flex-1">
        <span className="absolute left-3.5 top-2.5 text-slate-500 text-sm select-none">🔍</span>
        <input
          type="text"
          placeholder="Search alternatives by brand..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full bg-slate-950/40 border border-white/10 rounded-lg pl-10 pr-4 py-2 text-sm text-slate-200 placeholder-slate-500 outline-none focus:border-cyan-400/50 transition-all duration-200"
        />
        {searchQuery && (
          <button
            onClick={() => onSearchChange('')}
            className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-200 text-xs"
          >
            Clear
          </button>
        )}
      </div>

      {/* Manufacturer Checklist Popover */}
      <div className="relative w-full md:w-60" ref={popoverRef}>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="w-full bg-slate-950/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-350 outline-none hover:border-white/20 focus:border-cyan-400/50 flex justify-between items-center transition-all duration-200 cursor-pointer"
        >
          <span className="truncate">{btnText}</span>
          <span className="text-slate-500 text-[10px] ml-1 select-none">▼</span>
        </button>

        {isOpen && (
          <div className="absolute left-0 right-0 mt-2 bg-slate-950 border border-white/10 rounded-lg shadow-xl z-50 p-3 flex flex-col gap-2 max-h-72">
            {/* Search Input for Manufacturers */}
            <input
              type="text"
              placeholder="Search manufacturers..."
              value={searchMfg}
              onChange={(e) => setSearchMfg(e.target.value)}
              className="w-full bg-slate-900 border border-white/10 rounded px-2 py-1 text-xs text-slate-250 placeholder-slate-500 outline-none focus:border-cyan-400/30"
            />

            {/* Quick Actions */}
            <div className="flex justify-between text-[11px] text-cyan-400/80 font-medium px-1">
              <button type="button" onClick={handleSelectAll} className="hover:text-cyan-300">
                Select All
              </button>
              <button type="button" onClick={handleClearAll} className="hover:text-cyan-300">
                Clear
              </button>
            </div>

            {/* Scrollable list of checkboxes */}
            <div className="overflow-y-auto flex flex-col gap-1.5 max-h-48 pr-1 select-none scrollbar-thin">
              {filteredMfgs.length > 0 ? (
                filteredMfgs.map((mfg, idx) => {
                  const isChecked = selectedManufacturers.includes(mfg);
                  return (
                    <label
                      key={idx}
                      className="flex items-center gap-2 text-xs text-slate-300 hover:text-white cursor-pointer hover:bg-slate-900/60 p-1 rounded"
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleManufacturer(mfg)}
                        className="rounded border-white/10 bg-slate-900 text-cyan-500 focus:ring-0 cursor-pointer w-3.5 h-3.5"
                      />
                      <span className="truncate">{mfg}</span>
                    </label>
                  );
                })
              ) : (
                <div className="text-slate-500 text-xs text-center py-4">No results</div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Status Details Dropdown */}
      {(activeFilter === 'all' || activeFilter === 'partial') && statuses.length > 1 && (
        <div className="w-full md:w-64">
          <select
            value={selectedStatus}
            onChange={(e) => onStatusChange(e.target.value)}
            className="w-full bg-slate-950/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-300 outline-none focus:border-cyan-400/50 transition-all duration-200 cursor-pointer"
          >
            <option value="">All Match Details</option>
            {statuses.map((s, idx) => (
              <option key={idx} value={s} className="bg-slate-900 text-slate-300">
                {s}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
