"use client";

import React from 'react';

export const SkeletonCard = () => (
  <div className="bg-white rounded-xl border border-slate-200 p-4 h-64">
    <div className="skeleton h-4 w-32 mb-4" />
    <div className="skeleton h-full w-full rounded-lg" />
  </div>
);

export const SkeletonTable = () => (
  <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
    <div className="border-b border-slate-200 p-3">
      <div className="flex gap-4">
        {[80, 120, 60, 80, 60, 80, 60].map((w, i) => (
          <div key={i} className="skeleton h-4" style={{ width: w }} />
        ))}
      </div>
    </div>
    {Array.from({ length: 6 }).map((_, i) => (
      <div key={i} className="border-b border-slate-100 p-3">
        <div className="flex gap-4 items-center">
          <div className="skeleton h-4 w-4 rounded" />
          <div className="skeleton h-4 w-24" />
          <div className="skeleton h-4 w-16" />
          <div className="skeleton h-3 w-20 rounded-full" />
          <div className="skeleton h-4 w-14" />
          <div className="skeleton h-4 w-32" />
          <div className="skeleton h-4 w-16" />
        </div>
      </div>
    ))}
  </div>
);

export const SkeletonChart = () => (
  <div className="bg-white rounded-xl border border-slate-200 p-4">
    <div className="skeleton h-4 w-40 mb-4" />
    <div className="skeleton h-80 w-full rounded-lg" />
  </div>
);
