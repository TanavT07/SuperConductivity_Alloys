"use client";

import React, { useState, useEffect } from 'react';
import { ChevronDown, Loader2, Check, AlertTriangle } from 'lucide-react';
import { Polymorph } from '../types/materials';

interface PolymorphSelectorProps {
  polymorphs: Polymorph[];
  selectedPolymorph: Polymorph | null;
  onSelectPolymorph: (polymorph: Polymorph) => void;
  isLoading: boolean;
}

export default function PolymorphSelector({
  polymorphs,
  selectedPolymorph,
  onSelectPolymorph,
  isLoading
}: PolymorphSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const safePolymorphs = Array.isArray(polymorphs) ? polymorphs : [];

  const filteredPolymorphs = searchTerm
    ? safePolymorphs.filter((p) =>
        p.mp_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.space_group?.symbol?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.crystal_system?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : safePolymorphs;

  const handleSelect = (polymorph: Polymorph) => {
    onSelectPolymorph(polymorph);
    setIsOpen(false);
    setSearchTerm('');
  };

  const getStabilityColor = (energy: number) => {
    if (energy < 0.01) return 'text-emerald-600';
    if (energy < 0.1) return 'text-amber-600';
    return 'text-red-600';
  };

  const displayText = selectedPolymorph
    ? `${selectedPolymorph.mp_id} — ${selectedPolymorph.space_group.symbol}`
    : 'Select a polymorph';

  return (
    <div className="w-full">
      <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">
        Polymorph
      </label>
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          disabled={isLoading}
          className="w-full flex items-center justify-between px-3 py-2 bg-white border border-slate-200 rounded-lg text-left focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition-colors hover:border-slate-300 text-sm"
        >
          <span className={`font-mono ${selectedPolymorph ? 'text-slate-900' : 'text-slate-400'}`}>
            {displayText}
          </span>
          {isLoading ? (
            <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />
          ) : (
            <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          )}
        </button>

        {isOpen && (
          <div className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-72 overflow-hidden">
            <div className="p-2 border-b border-slate-100">
              <input
                type="text"
                placeholder="Search by mp-id, space group…"
                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                autoFocus
              />
            </div>
            <ul className="overflow-y-auto max-h-56">
              {filteredPolymorphs.length === 0 ? (
                <li className="px-3 py-3 text-slate-400 text-sm text-center">No polymorphs found</li>
              ) : (
                filteredPolymorphs.map((polymorph) => (
                  <li key={polymorph.mp_id}>
                    <button
                      onClick={() => handleSelect(polymorph)}
                      className={`w-full px-3 py-2.5 text-left hover:bg-slate-50 transition-colors flex items-start justify-between ${
                        selectedPolymorph?.mp_id === polymorph.mp_id ? 'bg-emerald-50' : ''
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-medium text-slate-900">{polymorph.mp_id}</span>
                          <span className="text-xs text-slate-400">•</span>
                          <span className="text-xs text-slate-600">{polymorph.crystal_system}</span>
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-500">
                          <span>SG: <span className="font-mono">{polymorph.space_group.symbol}</span></span>
                          <span>
                            E<sub>hull</sub>:{' '}
                            <span className={`font-mono ${getStabilityColor(polymorph.energy_above_hull)}`}>
                              {polymorph.energy_above_hull.toFixed(4)}
                            </span>
                            {' '}eV
                          </span>
                        </div>
                      </div>
                      {selectedPolymorph?.mp_id === polymorph.mp_id && (
                        <Check className="w-4 h-4 text-emerald-600 mt-1 flex-shrink-0" />
                      )}
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
