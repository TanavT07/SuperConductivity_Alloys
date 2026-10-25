"use client";

import React, { useState, useEffect } from 'react';
import { Search, User } from 'lucide-react';

interface TopBarProps {
  apiStatus: 'connected' | 'disconnected';
  currentIteration: number;
  isRetraining: boolean;
}

const TopBar = ({ apiStatus, currentIteration, isRetraining }: TopBarProps) => {
  return (
    <header className="w-full h-12 bg-white border-b border-slate-200 flex items-center justify-between px-4 flex-shrink-0">
      {/* Left: Logo + Title */}
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20M2 12h20" />
          </svg>
        </div>
        <span className="font-semibold text-slate-800 text-sm tracking-tight">SC Workbench</span>
        {isRetraining && (
          <span className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full font-medium border border-amber-200 animate-pulse">
            Retraining…
          </span>
        )}
      </div>

      {/* Center: Iteration badge */}
      <div className="hidden sm:flex items-center gap-2">
        <span className="text-xs text-slate-400 font-mono">Iteration</span>
        <span className="text-xs font-mono font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
          {currentIteration}
        </span>
      </div>

      {/* Right: Status + Search + Avatar */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <div className={`w-2 h-2 rounded-full ${apiStatus === 'connected' ? 'bg-emerald-500' : 'bg-red-500'}`} />
          <span className="text-xs text-slate-500 hidden sm:inline">
            {apiStatus === 'connected' ? 'API Online' : 'Offline'}
          </span>
        </div>
        <button className="p-1.5 text-slate-400 hover:text-slate-600 transition-colors rounded-lg hover:bg-slate-50">
          <Search className="w-4 h-4" />
        </button>
        <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center">
          <User className="w-3.5 h-3.5 text-slate-500" />
        </div>
      </div>
    </header>
  );
};

export default TopBar;
