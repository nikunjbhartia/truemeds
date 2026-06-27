// src/components/TableFilters.jsx
import React from 'react';

export default function TableFilters({
  searchQuery,
  onSearchChange,
  selectedManufacturer,
  onManufacturerChange,
  manufacturers,
  selectedStatus,
  onStatusChange,
  statuses,
  activeFilter
}) {
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

      {/* Manufacturer Dropdown */}
      <div className="w-full md:w-60">
        <select
          value={selectedManufacturer}
          onChange={(e) => onManufacturerChange(e.target.value)}
          className="w-full bg-slate-950/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-300 outline-none focus:border-cyan-400/50 transition-all duration-200 cursor-pointer"
        >
          <option value="">All Manufacturers</option>
          {manufacturers.map((m, idx) => (
            <option key={idx} value={m} className="bg-slate-900 text-slate-300">
              {m}
            </option>
          ))}
        </select>
      </div>

      {/* Status Details Dropdown (mainly relevant for Partial Matches or All) */}
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
