"use client";

import React, { useMemo } from 'react';
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceArea, Legend, ZAxis,
} from 'recharts';
import { BarChart3 } from 'lucide-react';
import { Candidate } from '../types/materials';

interface PhaseSpacePlotProps {
  candidates: Candidate[];
}

interface ScatterPoint {
  x: number;
  y: number;
  ucb: number;
  formula: string;
  z: number;
}

// Seeded pseudo-random for deterministic demo data
function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: ScatterPoint }> }) => {
  if (!active || !payload || payload.length === 0) return null;
  const data = payload[0].payload;
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-3 text-xs">
      <p className="font-semibold text-slate-900 mb-1">{data.formula}</p>
      <div className="space-y-0.5 font-mono">
        <p className="text-slate-600">T<sub>c</sub>: <span className="text-slate-900">{data.x.toFixed(1)} K</span></p>
        <p className="text-slate-600">σ²: <span className="text-slate-900">{data.y.toFixed(3)}</span></p>
        <p className="text-slate-600">UCB: <span className="text-emerald-600">{data.ucb.toFixed(3)}</span></p>
      </div>
    </div>
  );
};

const PhaseSpacePlot = ({ candidates }: PhaseSpacePlotProps) => {
  const scatterData = useMemo<ScatterPoint[]>(() => {
    const safeCandidates = Array.isArray(candidates) ? candidates : [];

    if (safeCandidates.length > 0) {
      return safeCandidates.map((c) => ({
        x: c.predicted_tc,
        y: c.uncertainty,
        ucb: c.ucb_score,
        formula: c.formula,
        z: 60,
      }));
    }

    // Generate demo data for compelling visualization
    const rand = seededRandom(42);
    const demoPoints: ScatterPoint[] = [];
    const formulas = [
      'YBa₂Cu₃O₇', 'La₂CuO₄', 'Bi₂Sr₂CaCu₂O₈', 'MgB₂', 'Nb₃Sn',
      'NbN', 'V₃Si', 'Nb₃Ge', 'FeSe', 'LaFeAsO', 'BaFe₂As₂',
      'SmFeAsO', 'PbMo₆S₈', 'K₃C₆₀', 'CeCoIn₅', 'UPt₃',
      'Sr₂RuO₄', 'NaxCoO₂', 'Li₀.₅(NH₂)₀.₅', 'H₃S',
      'LaH₁₀', 'CaH₆', 'YH₉', 'ThH₁₀', 'PrNi₂B₂C',
      'LuNi₂B₂C', 'MgCNi₃', 'CuxBi₂Se₃', 'Bi₂Te₃',
      'TlBiSe₂', 'SnSe', 'InSnBa₄Cu₅', 'TlBa₂Ca₂Cu₃',
      'HgBa₂Ca₂Cu₃', 'Tl₂Ba₂CuO₆',
    ];

    for (let i = 0; i < 35; i++) {
      demoPoints.push({
        x: rand() * 180 + 5,
        y: rand() * 0.8 + 0.02,
        ucb: rand() * 0.9 + 0.1,
        formula: formulas[i % formulas.length],
        z: 50 + rand() * 30,
      });
    }
    return demoPoints;
  }, [candidates]);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3 px-1">
        <BarChart3 className="w-4 h-4 text-slate-500" />
        <span className="text-sm font-semibold text-slate-700">Phase Space Explorer</span>
      </div>

      {/* Chart */}
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 10, right: 20, bottom: 30, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />

            {/* Phase regions */}
            <ReferenceArea x1={0} x2={50} y1={0} y2={0.35} fill="rgba(59,130,246,0.08)" />
            <ReferenceArea x1={50} x2={100} y1={0} y2={0.5} fill="rgba(249,115,22,0.08)" />
            <ReferenceArea x1={100} x2={200} y1={0} y2={0.3} fill="rgba(16,185,129,0.08)" />
            <ReferenceArea x1={100} x2={200} y1={0.3} y2={0.85} fill="rgba(6,182,212,0.08)" />
            <ReferenceArea x1={0} x2={200} y1={0.6} y2={0.85} fill="rgba(168,85,247,0.06)" />

            <XAxis
              dataKey="x"
              type="number"
              domain={[0, 200]}
              tick={{ fontSize: 10, fill: '#64748b' }}
              stroke="#cbd5e1"
              label={{ value: 'Predicted Tc (K)', position: 'insideBottom', offset: -15, fontSize: 11, fill: '#64748b' }}
            />
            <YAxis
              dataKey="y"
              type="number"
              domain={[0, 0.85]}
              tick={{ fontSize: 10, fill: '#64748b' }}
              stroke="#cbd5e1"
              label={{ value: 'GP Variance (σ²)', angle: -90, position: 'insideLeft', offset: 5, fontSize: 11, fill: '#64748b' }}
            />
            <ZAxis dataKey="z" range={[40, 120]} />

            <Tooltip content={<CustomTooltip />} />

            <Legend
              verticalAlign="top"
              align="right"
              wrapperStyle={{ fontSize: 10, paddingBottom: 8 }}
            />

            <Scatter
              name="Candidates"
              data={scatterData}
              fill="#059669"
              stroke="#047857"
              strokeWidth={1}
              fillOpacity={0.7}
            />
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      {/* Phase legend */}
      <div className="flex flex-wrap gap-3 mt-2 px-1">
        {[
          { color: 'bg-blue-400/30', label: 'Low Tc' },
          { color: 'bg-orange-400/30', label: 'Moderate' },
          { color: 'bg-emerald-400/30', label: 'High Tc / Confident' },
          { color: 'bg-cyan-400/30', label: 'High Tc / Uncertain' },
          { color: 'bg-purple-400/20', label: 'Exploration Zone' },
        ].map((phase) => (
          <div key={phase.label} className="flex items-center gap-1">
            <div className={`w-2.5 h-2.5 rounded-sm ${phase.color}`} />
            <span className="text-[10px] text-slate-500">{phase.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PhaseSpacePlot;
