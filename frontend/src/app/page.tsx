"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Candidate, Polymorph, NavView } from '../types/materials';
import { createApiClient } from '../lib/api';
import TopBar from '../components/TopBar';
import NavigationRail from '../components/NavigationRail';
import CrystalViewer3D from '../components/CrystalViewer3D';
import PolymorphSelector from '../components/PolymorphSelector';
import PhaseSpacePlot from '../components/PhaseSpacePlot';
import CandidateRankingTable from '../components/CandidateRankingTable';
import ToastContainer, { useToast } from '../components/ToastNotification';
import { SkeletonCard, SkeletonTable, SkeletonChart } from '../components/SkeletonLoader';

export default function WorkbenchPage() {
  const apiClient = useMemo(() => createApiClient(), []);
  const { toasts, addToast, dismissToast } = useToast();

  // Core state
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [polymorphs, setPolymorphs] = useState<Polymorph[]>([]);
  const [selectedPolymorph, setSelectedPolymorph] = useState<Polymorph | null>(null);
  const [selectedFormula, setSelectedFormula] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<NavView>('dashboard');

  // Loading states
  const [isLoadingCandidates, setIsLoadingCandidates] = useState(true);
  const [isLoadingPolymorphs, setIsLoadingPolymorphs] = useState(false);
  const [isRetraining, setIsRetraining] = useState(false);

  // API health
  const [apiStatus, setApiStatus] = useState<'connected' | 'disconnected'>('disconnected');
  const [currentIteration, setCurrentIteration] = useState(0);

  // API health check
  useEffect(() => {
    const checkApi = async () => {
      try {
        const response = await fetch('http://localhost:8000/candidates', { method: 'GET' });
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
  const loadCandidates = useCallback(async () => {
    setIsLoadingCandidates(true);
    try {
      const data = await apiClient.fetchCandidates();
      const safeCandidates = Array.isArray(data) ? data : [];
      setCandidates(safeCandidates);
      if (safeCandidates.length > 0 && !selectedFormula) {
        setSelectedFormula(safeCandidates[0].formula);
      }
    } catch (error) {
      console.error('Failed to load candidates:', error);
    } finally {
      setIsLoadingCandidates(false);
    }
  }, [apiClient, selectedFormula]);

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

  // Load analytics for iteration count
  const loadAnalytics = useCallback(async () => {
    try {
      const data = await apiClient.fetchModelAnalytics();
      setCurrentIteration(data.iteration);
    } catch (error) {
      console.error('Failed to load analytics:', error);
    }
  }, [apiClient]);

  // Initial data load
  useEffect(() => {
    loadCandidates();
    loadAnalytics();
  }, [loadCandidates, loadAnalytics]);

  // Load polymorphs when formula changes
  useEffect(() => {
    if (selectedFormula) {
      loadPolymorphs(selectedFormula);
    }
  }, [selectedFormula, loadPolymorphs]);

  // Handlers
  const handleSelectFormula = useCallback((formula: string) => {
    setSelectedFormula(formula);
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
      addToast('success', 'Oracle Feedback Submitted', result.message || 'Model retrained successfully.');
      await loadCandidates();
      await loadAnalytics();
    } catch (error) {
      addToast('error', 'Submission Failed', 'Could not submit oracle feedback. Check API connection.');
    } finally {
      setIsRetraining(false);
    }
  }, [apiClient, addToast, loadCandidates, loadAnalytics]);

  const handleViewChange = useCallback((view: NavView) => {
    setActiveView(view);
  }, []);

  // Dashboard view is the main unified 3-panel layout
  const renderDashboard = () => (
    <div className="flex-1 flex flex-col gap-3 p-3 min-h-0 overflow-hidden">
      {/* Top row: Crystal Viewer + Phase Space Plot */}
      <div className="flex gap-3 min-h-0" style={{ flex: '0 0 48%' }}>
        {/* Top-Left: Crystal Viewer */}
        <div className="flex-1 flex flex-col gap-2 min-w-0">
          {/* Polymorph selector */}
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
          {/* 3D Viewer */}
          <div className="flex-1 min-h-0">
            {isLoadingPolymorphs ? (
              <SkeletonCard />
            ) : (
              <CrystalViewer3D polymorph={selectedPolymorph} />
            )}
          </div>
        </div>

        {/* Top-Right: Phase Space Plot */}
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

      {/* Bottom: Candidate Triage Data Grid */}
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

  // Placeholder views for secondary nav items
  const renderPlaceholder = (title: string, description: string) => (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="text-center">
        <h2 className="text-lg font-semibold text-slate-700 mb-2">{title}</h2>
        <p className="text-sm text-slate-400 max-w-md">{description}</p>
      </div>
    </div>
  );

  return (
    <div className="h-screen flex flex-col bg-slate-50 overflow-hidden">
      {/* Top bar */}
      <TopBar
        apiStatus={apiStatus}
        currentIteration={currentIteration}
        isRetraining={isRetraining}
      />

      {/* Main content area */}
      <div className="flex-1 flex min-h-0">
        {/* Left navigation rail */}
        <NavigationRail activeView={activeView} onViewChange={handleViewChange} />

        {/* Content area */}
        {activeView === 'dashboard' && renderDashboard()}
        {activeView === 'crystallography' && renderPlaceholder(
          'Crystallography Explorer',
          'Full-page crystallography view with extended polymorph comparison. Available from the dashboard crystal viewer panel.'
        )}
        {activeView === 'analytics' && renderPlaceholder(
          'Feature Analytics',
          'Detailed feature importance analysis, Gaussian process diagnostics, and model performance metrics.'
        )}
        {activeView === 'data' && renderPlaceholder(
          'Data Management',
          'Upload training datasets, export labeled/unlabeled pools, and manage candidate data.'
        )}
        {activeView === 'settings' && renderPlaceholder(
          'Settings',
          'Configure active learning parameters, UCB β coefficient, and model retraining schedules.'
        )}
        {activeView === 'profile' && renderPlaceholder(
          'User Profile',
          'Manage your researcher profile, API keys, and notification preferences.'
        )}
      </div>

      {/* Toast notifications */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
