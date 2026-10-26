"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, Cell,
} from 'recharts';
import {
  Upload, Download, RefreshCw, Search, Database, BarChart3,
  Check, Layers, Sliders, User, FileText,
} from 'lucide-react';
import { Candidate, Polymorph, NavView, ModelMetrics } from '../types/materials';
import { createApiClient } from '../lib/api';
import TopBar from '../components/TopBar';
import NavigationRail from '../components/NavigationRail';
import CrystalViewer3D from '../components/CrystalViewer3D';
import PolymorphSelector from '../components/PolymorphSelector';
import PhaseSpacePlot from '../components/PhaseSpacePlot';
import CandidateRankingTable from '../components/CandidateRankingTable';
import ToastContainer, { useToast } from '../components/ToastNotification';
import { SkeletonCard, SkeletonTable, SkeletonChart } from '../components/SkeletonLoader';

const API_BASE_URL = 'http://localhost:8000';

export default function WorkbenchPage() {
  const apiClient = useMemo(() => createApiClient(), []);
  const { toasts, addToast, dismissToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Core data state
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [polymorphs, setPolymorphs] = useState<Polymorph[]>([]);
  const [selectedPolymorph, setSelectedPolymorph] = useState<Polymorph | null>(null);
  const [selectedFormula, setSelectedFormula] = useState<string | null>(null);
  const [modelMetrics, setModelMetrics] = useState<ModelMetrics | null>(null);
  const [activeView, setActiveView] = useState<NavView>('dashboard');

  // Interactive view states
  const [formulaQuery, setFormulaQuery] = useState('');
  const [dataSearchQuery, setDataSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'unlabeled' | 'synthesized' | 'failed'>('all');
  const [oracleQuickInputs, setOracleQuickInputs] = useState<Record<number, string>>({});
  const [candidateLimit, setCandidateLimit] = useState<number>(200);
  const [kappaParam, setKappaParam] = useState<number>(1.96);

  // Loading states
  const [isLoadingCandidates, setIsLoadingCandidates] = useState(true);
  const [isLoadingPolymorphs, setIsLoadingPolymorphs] = useState(false);
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(false);
  const [isRetraining, setIsRetraining] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // API health
  const [apiStatus, setApiStatus] = useState<'connected' | 'disconnected'>('disconnected');
  const [currentIteration, setCurrentIteration] = useState(0);

  // API health check
  useEffect(() => {
    const checkApi = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/candidates?limit=1`, { method: 'GET' });
        setApiStatus(response.ok ? 'connected' : 'disconnected');
      } catch {
        setApiStatus('disconnected');
      }
    };
    checkApi();
    const interval = setInterval(checkApi, 10000);
    return () => clearInterval(interval);
  }, []);

  // Load candidates
  const loadCandidates = useCallback(async (limitOverride?: number) => {
    setIsLoadingCandidates(true);
    try {
      const limitToUse = limitOverride ?? candidateLimit;
      const response = await fetch(`${API_BASE_URL}/candidates?limit=${limitToUse}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      const safeCandidates: Candidate[] = Array.isArray(data) ? data : [];
      setCandidates(safeCandidates);
      if (safeCandidates.length > 0 && !selectedFormula) {
        setSelectedFormula(safeCandidates[0].formula);
        setFormulaQuery(safeCandidates[0].formula);
      }
    } catch (error) {
      console.error('Failed to load candidates:', error);
    } finally {
      setIsLoadingCandidates(false);
    }
  }, [candidateLimit, selectedFormula]);

  // Load polymorphs when formula changes
  const loadPolymorphs = useCallback(async (formula: string) => {
    setIsLoadingPolymorphs(true);
    try {
      const data = await apiClient.fetchPolymorphs(formula);
      const safePolymorphs = Array.isArray(data) ? data : [];
      setPolymorphs(safePolymorphs);
      if (safePolymorphs.length > 0) {
        setSelectedPolymorph(safePolymorphs[0]);
      } else {
        setSelectedPolymorph(null);
      }
    } catch (error) {
      console.error('Failed to load polymorphs:', error);
      setPolymorphs([]);
      setSelectedPolymorph(null);
    } finally {
      setIsLoadingPolymorphs(false);
    }
  }, [apiClient]);

  // Load analytics & GP diagnostics
  const loadAnalytics = useCallback(async () => {
    setIsLoadingAnalytics(true);
    try {
      const data = await apiClient.fetchModelAnalytics();
      setModelMetrics(data);
      setCurrentIteration(data.iteration);
    } catch (error) {
      console.error('Failed to load analytics:', error);
    } finally {
      setIsLoadingAnalytics(false);
    }
  }, [apiClient]);

  // Initial load
  useEffect(() => {
    loadCandidates();
    loadAnalytics();
  }, [loadCandidates, loadAnalytics]);

  // Load polymorphs when selectedFormula changes
  useEffect(() => {
    if (selectedFormula) {
      loadPolymorphs(selectedFormula);
    }
  }, [selectedFormula, loadPolymorphs]);

  // Handlers
  const handleSelectFormula = useCallback((formula: string) => {
    setSelectedFormula(formula);
    setFormulaQuery(formula);
  }, []);

  const handlePolymorphSelect = useCallback((polymorph: Polymorph) => {
    setSelectedPolymorph(polymorph);
  }, []);

  const handleOracleSubmit = useCallback(async (candidateId: number, trueTc: number) => {
    setIsRetraining(true);
    try {
      const result = await apiClient.submitOracleFeedback({
        candidate_id: candidateId,
        true_tc: trueTc,
      });
      addToast('success', 'Oracle Feedback Submitted', result.message || 'GP model retrained successfully.');
      await loadCandidates();
      await loadAnalytics();
    } catch {
      addToast('error', 'Submission Failed', 'Could not submit oracle feedback. Check API connection.');
    } finally {
      setIsRetraining(false);
    }
  }, [apiClient, addToast, loadCandidates, loadAnalytics]);

  const handleCsvUpload = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.csv')) {
      addToast('error', 'Invalid File', 'Please select a valid .csv dataset.');
      return;
    }
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await fetch(`${API_BASE_URL}/upload`, {
        method: 'POST',
        body: formData,
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.detail || 'Upload failed');
      }
      addToast('success', 'Dataset Imported', payload.message || 'CSV merged into unlabeled pool.');
      await loadCandidates();
      await loadAnalytics();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to upload CSV dataset.';
      addToast('error', 'Upload Error', msg);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [addToast, loadCandidates, loadAnalytics]);

  const handleExportRankedCsv = useCallback(() => {
    window.open(`${API_BASE_URL}/export`, '_blank');
    addToast('info', 'Export Started', 'Downloading top UCB-ranked superconductor candidates CSV.');
  }, [addToast]);

  const handleExportFullFeaturesCsv = useCallback(() => {
    if (candidates.length === 0) {
      addToast('error', 'Empty Pool', 'No candidates available to export.');
      return;
    }
    const featureKeys = Object.keys(candidates[0].features || {});
    const headers = ['id', 'formula', 'predicted_tc', 'uncertainty', 'ucb_score', 'status', ...featureKeys];
    const csvRows = [
      headers.join(','),
      ...candidates.map((c) => {
        const featVals = featureKeys.map((k) => c.features?.[k] ?? 0);
        return [c.id, `"${c.formula}"`, c.predicted_tc, c.uncertainty, c.ucb_score, c.status, ...featVals].join(',');
      }),
    ];
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `superconductor_features_iter_${currentIteration}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    addToast('success', 'Feature Matrix Exported', `Exported ${candidates.length} candidates with Matminer descriptors.`);
  }, [candidates, currentIteration, addToast]);

  const handleDownloadSampleTemplate = useCallback(() => {
    const sampleRows = candidates.slice(0, 3);
    const featureKeys = sampleRows.length > 0 ? Object.keys(sampleRows[0].features || {}) : ['mean_atomic_mass', 'wtd_mean_fie'];
    const headers = ['chemical_formulas', ...featureKeys];
    const rows = [
      headers.join(','),
      ...['LaBa2Cu3O7', 'SrFe2As2', 'Nb3Sn'].map((formula, idx) => {
        const ref = sampleRows[idx % Math.max(1, sampleRows.length)];
        const vals = featureKeys.map((k) => ref?.features?.[k] ?? 50.0);
        return [formula, ...vals].join(',');
      }),
    ];
    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sample_superconductor_upload.csv';
    a.click();
    URL.revokeObjectURL(url);
  }, [candidates]);

  // 1. Main Dashboard View
  const renderDashboard = () => (
    <div className="flex-1 flex flex-col gap-3 p-3 min-h-0 overflow-hidden">
      <div className="flex gap-3 min-h-0" style={{ flex: '0 0 48%' }}>
        <div className="flex-1 flex flex-col gap-2 min-w-0">
          <div className="flex items-end gap-3 flex-shrink-0">
            <div className="flex-1 max-w-xs">
              <PolymorphSelector
                polymorphs={polymorphs}
                selectedPolymorph={selectedPolymorph}
                onSelectPolymorph={handlePolymorphSelect}
                isLoading={isLoadingPolymorphs}
              />
            </div>
            {selectedFormula && (
              <span className="text-xs font-mono text-slate-400 pb-2">{selectedFormula}</span>
            )}
          </div>
          <div className="flex-1 min-h-0">
            {isLoadingPolymorphs ? (
              <SkeletonCard />
            ) : (
              <CrystalViewer3D polymorph={selectedPolymorph} />
            )}
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm h-full p-4">
            {isLoadingCandidates ? (
              <SkeletonChart />
            ) : (
              <PhaseSpacePlot candidates={candidates} />
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0">
        {isLoadingCandidates ? (
          <SkeletonTable />
        ) : (
          <CandidateRankingTable
            candidates={candidates}
            onSelectFormula={handleSelectFormula}
            onOracleSubmit={handleOracleSubmit}
          />
        )}
      </div>
    </div>
  );

  // 2. Full-Page Crystallography Explorer View
  const renderCrystallography = () => {
    const lat = selectedPolymorph?.lattice;
    const anisotropy = lat ? (lat.c / Math.max(lat.a, 0.01)).toFixed(2) : '—';

    return (
      <div className="flex-1 flex flex-col gap-3 p-4 min-h-0 overflow-hidden">
        {/* Top Search & Quick Candidate Bar */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 flex flex-wrap items-center justify-between gap-3 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-emerald-600" />
            <h2 className="text-sm font-semibold text-slate-800">3D Crystallography & Polymorph Explorer</h2>
          </div>

          <div className="flex items-center gap-2 flex-1 max-w-xl">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={formulaQuery}
                onChange={(e) => setFormulaQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && formulaQuery.trim()) {
                    handleSelectFormula(formulaQuery.trim());
                  }
                }}
                placeholder="Enter formula (e.g. YBa2Cu3O7, MgB2, Nb3Ge)..."
                className="w-full pl-8 pr-3 py-1.5 text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>
            <button
              onClick={() => formulaQuery.trim() && handleSelectFormula(formulaQuery.trim())}
              className="px-3 py-1.5 text-xs font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
            >
              Load Structure
            </button>
          </div>

          {/* Quick preset pills from top candidates */}
          <div className="flex items-center gap-1.5 overflow-x-auto">
            {candidates.slice(0, 5).map((c) => (
              <button
                key={c.id}
                onClick={() => handleSelectFormula(c.formula)}
                className={`px-2.5 py-1 rounded-md text-xs font-mono transition-colors ${
                  selectedFormula === c.formula
                    ? 'bg-emerald-100 text-emerald-800 font-semibold border border-emerald-300'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {c.formula}
              </button>
            ))}
          </div>
        </div>

        {/* Main Split: 3D Canvas (Left 60%) + Lattice & Atomic Sites Inspector (Right 40%) */}
        <div className="flex-1 flex gap-3 min-h-0 overflow-hidden">
          <div className="flex-[3] flex flex-col gap-2 min-w-0 min-h-0">
            <div className="flex-1 min-h-0">
              {isLoadingPolymorphs ? <SkeletonCard /> : <CrystalViewer3D polymorph={selectedPolymorph} />}
            </div>
          </div>

          <div className="flex-[2] flex flex-col gap-3 min-w-0 min-h-0 overflow-y-auto pr-1">
            {/* Polymorph Comparison Cards */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2.5">
                Available Polymorphs ({polymorphs.length})
              </h3>
              <div className="space-y-2">
                {polymorphs.map((poly) => {
                  const isSelected = selectedPolymorph?.mp_id === poly.mp_id;
                  return (
                    <button
                      key={poly.mp_id}
                      onClick={() => handlePolymorphSelect(poly)}
                      className={`w-full text-left p-2.5 rounded-lg border transition-all ${
                        isSelected
                          ? 'border-emerald-500 bg-emerald-50/50 shadow-xs'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-mono text-xs font-semibold text-slate-800">
                          {poly.mp_id} · {poly.space_group.symbol} (#{poly.space_group.number})
                        </span>
                        <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700 capitalize">
                          {poly.crystal_system}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-slate-500 font-mono">
                        <span>E_hull: <strong className="text-emerald-700">{poly.energy_above_hull.toFixed(3)} eV/atom</strong></span>
                        <span>E_form: <strong>{poly.formation_energy_per_atom.toFixed(2)} eV</strong></span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Unit Cell Lattice Metrics */}
            {lat && (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2.5">
                  Unit Cell Lattice Geometry
                </h3>
                <div className="grid grid-cols-4 gap-2 text-center font-mono">
                  {[
                    { label: 'a (Å)', value: lat.a.toFixed(3) },
                    { label: 'b (Å)', value: lat.b.toFixed(3) },
                    { label: 'c (Å)', value: lat.c.toFixed(3) },
                    { label: 'c/a Ratio', value: anisotropy },
                    { label: 'α (°)', value: lat.alpha.toFixed(1) },
                    { label: 'β (°)', value: lat.beta.toFixed(1) },
                    { label: 'γ (°)', value: lat.gamma.toFixed(1) },
                    { label: 'Vol (Å³)', value: lat.volume.toFixed(1) },
                  ].map((m) => (
                    <div key={m.label} className="bg-slate-50 border border-slate-100 rounded-lg p-2">
                      <div className="text-[10px] text-slate-400">{m.label}</div>
                      <div className="text-xs font-semibold text-slate-800 mt-0.5">{m.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Fractional Atomic Coordinates Table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex-1 flex flex-col min-h-[200px]">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                Asymmetric & Unit Cell Atomic Sites ({selectedPolymorph?.sites.length ?? 0})
              </h3>
              <div className="flex-1 overflow-auto">
                <table className="w-full text-xs font-mono">
                  <thead className="border-b border-slate-200 text-slate-400 text-left">
                    <tr>
                      <th className="py-1.5">Site</th>
                      <th className="py-1.5">Element</th>
                      <th className="py-1.5">u (x/a)</th>
                      <th className="py-1.5">v (y/b)</th>
                      <th className="py-1.5">w (z/c)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(selectedPolymorph?.sites ?? []).map((site, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="py-1.5 text-slate-600">{site.label}</td>
                        <td className="py-1.5 font-semibold text-emerald-700">{site.element}</td>
                        <td className="py-1.5 text-slate-700">{site.coords[0].toFixed(4)}</td>
                        <td className="py-1.5 text-slate-700">{site.coords[1].toFixed(4)}</td>
                        <td className="py-1.5 text-slate-700">{site.coords[2].toFixed(4)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // 3. Feature Analytics & GP Diagnostics View
  const renderAnalytics = () => {
    const importances = modelMetrics?.feature_importances ?? [];
    const hyperparams = modelMetrics?.kernel_hyperparameters ?? {};
    const highTcCount = candidates.filter((c) => c.predicted_tc >= 77.0).length;
    const maxUcb = candidates.length > 0 ? Math.max(...candidates.map((c) => c.ucb_score)) : 0;

    return (
      <div className="flex-1 flex flex-col gap-4 p-4 min-h-0 overflow-y-auto">
        {/* Header + Refresh */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-800">Gaussian Process Surrogate Diagnostics & Feature Importance</h2>
            <p className="text-xs text-slate-500">
              Live permutation importance (n_repeats=10) and Matérn (ν=2.5) posterior error metrics from your serialized engine.
            </p>
          </div>
          <button
            onClick={loadAnalytics}
            disabled={isLoadingAnalytics}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-700 shadow-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingAnalytics ? 'animate-spin text-emerald-600' : ''}`} />
            Refresh Diagnostics
          </button>
        </div>

        {/* KPI Strip */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: 'Active Learning Iteration', value: `#${modelMetrics?.iteration ?? currentIteration}`, sub: 'Posterior updates' },
            { label: 'Training Set MAE', value: `${(modelMetrics?.mae ?? 0).toFixed(2)} K`, sub: 'Mean absolute residual' },
            { label: 'Training Set RMSE', value: `${(modelMetrics?.rmse ?? 0).toFixed(2)} K`, sub: 'Root mean squared error' },
            { label: 'Labeled / Unlabeled Pool', value: `${modelMetrics?.labeled_pool_size ?? 0} / ${(modelMetrics?.unlabeled_pool_size ?? 0).toLocaleString()}`, sub: 'Active screening ratio' },
            { label: 'Candidates > 77 K (LN₂)', value: `${highTcCount}`, sub: `Peak UCB: ${maxUcb.toFixed(1)} K` },
          ].map((kpi) => (
            <div key={kpi.label} className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-sm">
              <div className="text-xs text-slate-400">{kpi.label}</div>
              <div className="text-lg font-mono font-bold text-slate-800 mt-1">{kpi.value}</div>
              <div className="text-[11px] text-emerald-600 mt-0.5">{kpi.sub}</div>
            </div>
          ))}
        </div>

        {/* Main Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1 min-h-[360px]">
          {/* Left: Permutation Feature Importance Bar Chart */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-emerald-600" />
                <span className="text-sm font-semibold text-slate-700">Top Matminer Compositional Descriptors</span>
              </div>
              <span className="text-xs font-mono text-slate-400">sklearn.inspection.permutation_importance</span>
            </div>

            <div className="flex-1 min-h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={importances}
                  layout="vertical"
                  margin={{ top: 5, right: 25, left: 130, bottom: 10 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10, fill: '#64748b' }} stroke="#cbd5e1" />
                  <YAxis
                    type="category"
                    dataKey="feature"
                    tick={{ fontSize: 11, fill: '#334155', fontFamily: 'monospace' }}
                    width={125}
                  />
                  <RechartsTooltip
                    formatter={(val: number) => [val.toFixed(4), 'Importance Score']}
                    contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: '#e2e8f0' }}
                  />
                  <Bar dataKey="importance" radius={[0, 4, 4, 0]}>
                    {importances.map((_, index) => (
                      <Cell key={index} fill={index < 3 ? '#059669' : '#10b981'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Right: Phase Space + Kernel Hyperparameters */}
          <div className="flex flex-col gap-4">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
              <h3 className="text-sm font-semibold text-slate-700 mb-2.5">Learned GP Kernel Hyperparameters</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {Object.entries(hyperparams).map(([key, val]) => (
                  <div key={key} className="bg-slate-50 border border-slate-100 rounded-lg p-2.5 font-mono">
                    <div className="text-[11px] text-slate-400 truncate" title={key}>{key}</div>
                    <div className="text-sm font-semibold text-slate-800 mt-0.5">{Number(val).toFixed(4)}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex-1 min-h-[240px]">
              <PhaseSpacePlot candidates={candidates} />
            </div>
          </div>
        </div>
      </div>
    );
  };

  // 4. Data Management (CSV Upload, Export & Pool Manager) View
  const renderDataManagement = () => {
    const filteredCandidates = candidates.filter((c) => {
      const matchesFormula = c.formula.toLowerCase().includes(dataSearchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
      return matchesFormula && matchesStatus;
    });

    return (
      <div className="flex-1 flex flex-col gap-4 p-4 min-h-0 overflow-y-auto">
        {/* Top Row: Upload Dataset Card + Export Pools Card */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-shrink-0">
          {/* Upload Card */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <Upload className="w-4 h-4 text-emerald-600" />
                  <h3 className="text-sm font-semibold text-slate-800">Ingest Unlabeled Candidate CSV</h3>
                </div>
                <button
                  onClick={handleDownloadSampleTemplate}
                  className="text-xs font-mono text-emerald-600 hover:text-emerald-700 underline"
                >
                  Download Sample CSV Template
                </button>
              </div>
              <p className="text-xs text-slate-500 mb-3">
                Upload a CSV containing <code className="font-mono bg-slate-100 px-1 rounded">chemical_formulas</code> (or <code className="font-mono bg-slate-100 px-1 rounded">formula</code>) and Matminer elemental features.
              </p>
            </div>

            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files?.[0];
                if (file) handleCsvUpload(file);
              }}
              className="border-2 border-dashed border-slate-200 hover:border-emerald-400 rounded-xl p-4 text-center transition-colors bg-slate-50/60"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleCsvUpload(file);
                }}
                className="hidden"
              />
              <p className="text-xs text-slate-600 mb-2">
                Drag and drop a <span className="font-mono font-semibold">.csv</span> file here, or click below to browse
              </p>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="px-3.5 py-1.5 text-xs font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
              >
                {isUploading ? 'Uploading & Evaluating GP...' : 'Select CSV File'}
              </button>
            </div>
          </div>

          {/* Export & Pool Summary Card */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Database className="w-4 h-4 text-emerald-600" />
                <h3 className="text-sm font-semibold text-slate-800">Export Labeled & Unlabeled Screening Pools</h3>
              </div>
              <p className="text-xs text-slate-500 mb-3">
                Active Pool: <strong className="font-mono text-slate-800">{(modelMetrics?.unlabeled_pool_size ?? candidates.length).toLocaleString()}</strong> unlabeled alloys ·{' '}
                <strong className="font-mono text-slate-800">{modelMetrics?.labeled_pool_size ?? 52}</strong> labeled training alloys.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                onClick={handleExportRankedCsv}
                className="flex items-center justify-center gap-2 px-3 py-2.5 text-xs font-medium bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Export Top Ranked Pool (/export)
              </button>
              <button
                onClick={handleExportFullFeaturesCsv}
                className="flex items-center justify-center gap-2 px-3 py-2.5 text-xs font-medium bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
              >
                <FileText className="w-3.5 h-3.5 text-emerald-600" />
                Export Full Feature Matrix (.CSV)
              </button>
            </div>
          </div>
        </div>

        {/* Bottom Interactive Candidate Pool Inspector */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex-1 flex flex-col min-h-[300px] overflow-hidden">
          <div className="p-3 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-slate-700">Candidate Pool Manager & Batch Oracle</h3>
              <span className="text-xs font-mono text-slate-400">Showing {filteredCandidates.length} candidates</span>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={dataSearchQuery}
                  onChange={(e) => setDataSearchQuery(e.target.value)}
                  placeholder="Filter by formula..."
                  className="pl-8 pr-2.5 py-1 text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg focus:outline-none"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as 'all' | 'unlabeled' | 'synthesized' | 'failed')}
                className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-slate-700"
              >
                <option value="all">All Statuses</option>
                <option value="unlabeled">Unlabeled</option>
                <option value="synthesized">Synthesized</option>
              </select>
            </div>
          </div>

          <div className="flex-1 overflow-auto">
            <table className="w-full text-xs font-mono">
              <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 text-slate-500 text-left">
                <tr>
                  <th className="px-3 py-2">Pool ID</th>
                  <th className="px-3 py-2">Formula</th>
                  <th className="px-3 py-2">Predicted Tc (K)</th>
                  <th className="px-3 py-2">Norm. Variance</th>
                  <th className="px-3 py-2">UCB Score</th>
                  <th className="px-3 py-2">Log Lab Tc (K)</th>
                  <th className="px-3 py-2 text-right">3D Structure</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCandidates.slice(0, 100).map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2 text-slate-400">#{c.id}</td>
                    <td className="px-3 py-2 font-semibold text-slate-800">{c.formula}</td>
                    <td className="px-3 py-2 text-emerald-700 font-semibold">{c.predicted_tc.toFixed(2)}</td>
                    <td className="px-3 py-2 text-slate-600">{c.uncertainty.toFixed(4)}</td>
                    <td className="px-3 py-2 text-slate-800">{c.ucb_score.toFixed(2)}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          step="0.1"
                          placeholder="Measured K"
                          value={oracleQuickInputs[c.id] || ''}
                          onChange={(e) => setOracleQuickInputs((p) => ({ ...p, [c.id]: e.target.value }))}
                          className="w-20 px-1.5 py-0.5 text-xs border border-slate-200 rounded bg-white"
                        />
                        <button
                          onClick={() => {
                            const val = parseFloat(oracleQuickInputs[c.id] || '');
                            if (!isNaN(val)) {
                              handleOracleSubmit(c.id, val);
                              setOracleQuickInputs((p) => ({ ...p, [c.id]: '' }));
                            }
                          }}
                          className="px-2 py-0.5 bg-emerald-600 text-white rounded hover:bg-emerald-700"
                        >
                          Retrain
                        </button>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        onClick={() => {
                          handleSelectFormula(c.formula);
                          setActiveView('crystallography');
                        }}
                        className="text-emerald-600 hover:underline"
                      >
                        Inspect 3D →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  // 5. Settings View
  const renderSettings = () => (
    <div className="flex-1 p-6 overflow-y-auto">
      <div className="max-w-2xl mx-auto bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <Sliders className="w-4 h-4 text-emerald-600" />
          <h2 className="text-base font-semibold text-slate-800">Active Learning & Acquisition Settings</h2>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Top Candidates Fetch Limit (GET /candidates?limit={candidateLimit})
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={50}
                max={1000}
                step={50}
                value={candidateLimit}
                onChange={(e) => setCandidateLimit(Number(e.target.value))}
                className="flex-1 accent-emerald-600"
              />
              <span className="font-mono text-xs font-semibold text-slate-800 w-16">{candidateLimit} rows</span>
              <button
                onClick={() => {
                  loadCandidates(candidateLimit);
                  addToast('success', 'Pool Size Updated', `Loaded top ${candidateLimit} UCB candidates.`);
                }}
                className="px-3 py-1 text-xs bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
              >
                Apply
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              UCB Exploration Coefficient (κ = {kappaParam.toFixed(2)})
            </label>
            <input
              type="range"
              min={0.5}
              max={4.0}
              step={0.05}
              value={kappaParam}
              onChange={(e) => setKappaParam(Number(e.target.value))}
              className="w-full accent-emerald-600"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Controls Upper Confidence Bound balance: UCB(x) = μ(x) + κ · σ(x). Default 95% confidence interval is κ = 1.96.
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  // 6. Profile View
  const renderProfile = () => (
    <div className="flex-1 p-6 overflow-y-auto">
      <div className="max-w-2xl mx-auto bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
          <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
            <User className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-800">Superconductor Triage Researcher</h2>
            <p className="text-xs text-slate-500 font-mono">Backend: {API_BASE_URL} ({apiStatus})</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 text-xs font-mono">
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
            <div className="text-slate-400">Surrogate Engine</div>
            <div className="text-slate-800 font-semibold mt-0.5">Matérn (ν=2.5) Gaussian Process</div>
          </div>
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
            <div className="text-slate-400">Feature Space</div>
            <div className="text-slate-800 font-semibold mt-0.5">81 Matminer Elemental Descriptors</div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="h-screen flex flex-col bg-slate-50 overflow-hidden">
      <TopBar
        apiStatus={apiStatus}
        currentIteration={currentIteration}
        isRetraining={isRetraining}
      />

      <div className="flex-1 flex min-h-0">
        <NavigationRail activeView={activeView} onViewChange={setActiveView} />

        {activeView === 'dashboard' && renderDashboard()}
        {activeView === 'crystallography' && renderCrystallography()}
        {activeView === 'analytics' && renderAnalytics()}
        {activeView === 'data' && renderDataManagement()}
        {activeView === 'settings' && renderSettings()}
        {activeView === 'profile' && renderProfile()}
      </div>

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}