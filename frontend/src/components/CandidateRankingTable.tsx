"use client";

import React, { useState, useMemo, useCallback } from 'react';
import {
  ChevronUp, ChevronDown, ChevronLeft, ChevronRight,
  ChevronsLeft, ChevronsRight, Check, MoreHorizontal,
} from 'lucide-react';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { Candidate, CandidateRow, SparklinePoint } from '../types/materials';

interface CandidateRankingTableProps {
  candidates: Candidate[];
  onSelectFormula: (formula: string) => void;
  onOracleSubmit: (candidateId: number, trueTc: number) => void;
}

// Generate synthetic sparkline data deterministically
function generateSparkline(id: number, tc: number): SparklinePoint[] {
  const points: SparklinePoint[] = [];
  let val = tc * 0.6;
  for (let i = 0; i < 8; i++) {
    // Deterministic pseudo-variation based on id and iteration
    const shift = Math.sin(id * 3.7 + i * 1.3) * tc * 0.15;
    val = Math.max(0, val + shift);
    points.push({ iteration: i, value: parseFloat(val.toFixed(1)) });
  }
  return points;
}

// Generate synthetic lattice params from candidate id
function syntheticLattice(id: number): { a: number; b: number; c: number } {
  const base = 3.5 + (id % 7) * 0.95;
  return {
    a: parseFloat(base.toFixed(2)),
    b: parseFloat((base + Math.sin(id) * 0.5).toFixed(2)),
    c: parseFloat((base * 1.1 + Math.cos(id) * 0.3).toFixed(2)),
  };
}

const CandidateRankingTable = ({
  candidates,
  onSelectFormula,
  onOracleSubmit,
}: CandidateRankingTableProps) => {
  const [sortKey, setSortKey] = useState<keyof Candidate>('ucb_score');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [approvedIds, setApprovedIds] = useState<Set<number>>(new Set());
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [oracleInputs, setOracleInputs] = useState<Record<number, string>>({});

  const safeCandidates = Array.isArray(candidates) ? candidates : [];

  // Build enriched rows
  const rows = useMemo<CandidateRow[]>(() => {
    return safeCandidates.map((c) => {
      const lattice = syntheticLattice(c.id);
      return {
        ...c,
        lattice_a: lattice.a,
        lattice_b: lattice.b,
        lattice_c: lattice.c,
        sparkline: generateSparkline(c.id, c.predicted_tc),
        approved: approvedIds.has(c.id),
      };
    });
  }, [safeCandidates, approvedIds]);

  // Sort
  const sortedRows = useMemo(() => {
    const sorted = [...rows];
    sorted.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [rows, sortKey, sortDir]);

  // Paginate
  const totalPages = Math.max(1, Math.ceil(sortedRows.length / rowsPerPage));
  const visibleRows = sortedRows.slice(page * rowsPerPage, (page + 1) * rowsPerPage);

  const handleSort = (key: keyof Candidate) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === visibleRows.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(visibleRows.map((r) => r.id)));
    }
  };

  const toggleApproval = (id: number) => {
    setApprovedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleOracleInputChange = (id: number, value: string) => {
    setOracleInputs((prev) => ({ ...prev, [id]: value }));
  };

  const handleInlineOracleSubmit = (id: number) => {
    const val = parseFloat(oracleInputs[id] || '');
    if (!isNaN(val)) {
      onOracleSubmit(id, val);
      setOracleInputs((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  };

  const SortIcon = ({ col }: { col: keyof Candidate }) => {
    if (sortKey !== col) return <ChevronDown className="w-3 h-3 text-slate-300" />;
    return sortDir === 'asc' ? (
      <ChevronUp className="w-3 h-3 text-emerald-600" />
    ) : (
      <ChevronDown className="w-3 h-3 text-emerald-600" />
    );
  };

  const getStatusDot = (status: string) => {
    if (status === 'synthesized') return 'bg-emerald-500';
    if (status === 'failed') return 'bg-red-400';
    return 'bg-amber-400';
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-slate-700">Candidate Triage</h3>
          <span className="text-xs text-slate-400 font-mono">{safeCandidates.length} materials</span>
        </div>
        <button className="p-1 text-slate-400 hover:text-slate-600 transition-colors rounded">
          <MoreHorizontal className="w-4 h-4" />
        </button>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto custom-scrollbar">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur-sm">
            <tr className="border-b border-slate-200">
              <th className="px-3 py-2 w-8">
                <input
                  type="checkbox"
                  checked={selectedIds.size === visibleRows.length && visibleRows.length > 0}
                  onChange={toggleSelectAll}
                  className="w-3.5 h-3.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500/30"
                />
              </th>
              {([
                ['formula', 'Formula'],
                ['predicted_tc', 'Tc (K)'],
                ['uncertainty', 'GP Variance'],
                ['ucb_score', 'UCB'],
              ] as [keyof Candidate, string][]).map(([key, label]) => (
                <th
                  key={key}
                  onClick={() => handleSort(key)}
                  className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider cursor-pointer hover:text-slate-700 transition-colors select-none"
                >
                  <div className="flex items-center gap-1">
                    {label}
                    <SortIcon col={key} />
                  </div>
                </th>
              ))}
              <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Lattice (a, b, c) Å
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Trend
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Oracle Input
              </th>
              <th className="px-3 py-2 w-8" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visibleRows.map((row) => (
              <tr
                key={row.id}
                className={`hover:bg-slate-50 transition-colors ${selectedIds.has(row.id) ? 'bg-emerald-50/50' : ''}`}
              >
                {/* Checkbox */}
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(row.id)}
                    onChange={() => toggleSelect(row.id)}
                    className="w-3.5 h-3.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500/30"
                  />
                </td>

                {/* Formula */}
                <td className="px-3 py-2">
                  <button
                    onClick={() => onSelectFormula(row.formula)}
                    className="font-mono text-sm text-slate-900 hover:text-emerald-600 transition-colors font-medium"
                  >
                    {row.formula}
                  </button>
                </td>

                {/* Predicted Tc */}
                <td className="px-3 py-2 font-mono text-sm text-slate-900 font-semibold">
                  {row.predicted_tc.toFixed(1)}
                </td>

                {/* GP Variance as progress bar */}
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden max-w-[60px]">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400 transition-all"
                        style={{ width: `${Math.min(100, row.uncertainty * 100)}%` }}
                      />
                    </div>
                    <span className="font-mono text-xs text-slate-600 w-10 text-right">
                      {row.uncertainty.toFixed(3)}
                    </span>
                  </div>
                </td>

                {/* UCB */}
                <td className="px-3 py-2 font-mono text-sm text-slate-700">
                  {row.ucb_score.toFixed(3)}
                </td>

                {/* Lattice params */}
                <td className="px-3 py-2 font-mono text-xs text-slate-500">
                  {row.lattice_a} {row.lattice_b} {row.lattice_c}
                </td>

                {/* Sparkline */}
                <td className="px-3 py-2">
                  <div className="sparkline-container">
                    <ResponsiveContainer width="100%" height={24}>
                      <LineChart data={row.sparkline}>
                        <Line
                          type="monotone"
                          dataKey="value"
                          stroke={row.approved ? '#059669' : '#94a3b8'}
                          strokeWidth={1.5}
                          dot={{ r: 1.5, fill: row.approved ? '#059669' : '#94a3b8' }}
                          isAnimationActive={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </td>

                {/* Status dot */}
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1.5">
                    <div className={`w-2 h-2 rounded-full ${getStatusDot(row.status)}`} />
                    <span className="text-xs text-slate-500 capitalize">{row.status}</span>
                  </div>
                </td>

                {/* Inline oracle input */}
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      step="0.1"
                      placeholder="Tc"
                      value={oracleInputs[row.id] || ''}
                      onChange={(e) => handleOracleInputChange(row.id, e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleInlineOracleSubmit(row.id); }}
                      className="w-14 px-1.5 py-0.5 text-xs font-mono bg-slate-50 border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-emerald-500/30 focus:border-emerald-400"
                    />
                    <button
                      onClick={() => handleInlineOracleSubmit(row.id)}
                      disabled={!oracleInputs[row.id]}
                      className="p-0.5 text-slate-400 hover:text-emerald-600 disabled:opacity-30 transition-colors"
                      title="Submit oracle feedback"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 2L11 13" /><path d="M22 2l-7 20-4-9-9-4 20-7z" />
                      </svg>
                    </button>
                  </div>
                </td>

                {/* Approval checkmark */}
                <td className="px-3 py-2">
                  <button
                    onClick={() => toggleApproval(row.id)}
                    className={`w-5 h-5 rounded-full flex items-center justify-center transition-colors ${
                      approvedIds.has(row.id)
                        ? 'bg-emerald-100 text-emerald-600'
                        : 'bg-slate-100 text-slate-300 hover:text-slate-500'
                    }`}
                  >
                    <Check className="w-3 h-3" />
                  </button>
                </td>
              </tr>
            ))}

            {visibleRows.length === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-slate-400 text-sm">
                  No candidates loaded. Connect to the FastAPI backend.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination footer */}
      <div className="flex items-center justify-between px-4 py-2 border-t border-slate-100 bg-slate-50/50 flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Rows per page</span>
          <select
            value={rowsPerPage}
            onChange={(e) => { setRowsPerPage(Number(e.target.value)); setPage(0); }}
            className="text-xs bg-white border border-slate-200 rounded px-1.5 py-0.5 text-slate-700 focus:outline-none"
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
          </select>
        </div>

        <div className="flex items-center gap-1">
          <span className="text-xs text-slate-500 mr-2">
            {page * rowsPerPage + 1}–{Math.min((page + 1) * rowsPerPage, sortedRows.length)} of {sortedRows.length}
          </span>
          <button
            onClick={() => setPage(0)}
            disabled={page === 0}
            className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-30 transition-colors"
          >
            <ChevronsLeft className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-30 transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-30 transition-colors"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setPage(totalPages - 1)}
            disabled={page >= totalPages - 1}
            className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-30 transition-colors"
          >
            <ChevronsRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default CandidateRankingTable;
