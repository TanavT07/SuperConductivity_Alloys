"use client";

import React from 'react';
import { LayoutGrid, Atom, BarChart3, Upload, Settings, User } from 'lucide-react';
import { NavView } from '../types/materials';

interface NavigationRailProps {
  activeView: NavView;
  onViewChange: (view: NavView) => void;
}

interface NavItem {
  view: NavView;
  icon: React.ReactNode;
  label: string;
}

const topItems: NavItem[] = [
  { view: 'dashboard', icon: <LayoutGrid className="w-5 h-5" />, label: 'Dashboard' },
  { view: 'crystallography', icon: <Atom className="w-5 h-5" />, label: 'Crystallography' },
  { view: 'analytics', icon: <BarChart3 className="w-5 h-5" />, label: 'Feature Analytics' },
  { view: 'data', icon: <Upload className="w-5 h-5" />, label: 'Data Upload/Export' },
];

const bottomItems: NavItem[] = [
  { view: 'settings', icon: <Settings className="w-5 h-5" />, label: 'Settings' },
  { view: 'profile', icon: <User className="w-5 h-5" />, label: 'Profile' },
];

const NavigationRail = ({ activeView, onViewChange }: NavigationRailProps) => {
  return (
    <nav className="w-16 bg-white border-r border-slate-200 flex flex-col items-center py-4 flex-shrink-0">
      {/* Top nav items */}
      <div className="flex flex-col items-center gap-1">
        {topItems.map((item) => {
          const isActive = activeView === item.view;
          return (
            <button
              key={item.view}
              onClick={() => onViewChange(item.view)}
              title={item.label}
              className={`relative w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-200 ${
                isActive
                  ? 'bg-emerald-50 text-emerald-600'
                  : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
              }`}
            >
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-emerald-600 rounded-r" />
              )}
              {item.icon}
            </button>
          );
        })}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Bottom nav items */}
      <div className="flex flex-col items-center gap-1">
        {bottomItems.map((item) => {
          const isActive = activeView === item.view;
          return (
            <button
              key={item.view}
              onClick={() => onViewChange(item.view)}
              title={item.label}
              className={`relative w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-200 ${
                isActive
                  ? 'bg-emerald-50 text-emerald-600'
                  : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
              }`}
            >
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-emerald-600 rounded-r" />
              )}
              {item.icon}
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default NavigationRail;
