import { Candidate, Polymorph, OraclePayload, OracleResponse, ModelMetrics } from '../types/materials';

export interface ApiClient {
  fetchCandidates: () => Promise<Candidate[]>;
  fetchPolymorphs: (formula: string) => Promise<Polymorph[]>;
  submitOracleFeedback: (payload: OraclePayload) => Promise<OracleResponse>;
  fetchModelAnalytics: () => Promise<ModelMetrics>;
}

const API_BASE_URL = 'http://localhost:8000';

export const createApiClient = (): ApiClient => {
  const fetchCandidates = async (): Promise<Candidate[]> => {
    try {
      const response = await fetch(`${API_BASE_URL}/candidates`);

      if (!response.ok) {
        throw new Error(`Failed to fetch candidates: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      // Defensive: backend returns a single best-candidate object, not an array.
      if (Array.isArray(data)) {
        return data;
      }

      // If backend returns an object with a candidates array, extract it
      if (data && typeof data === 'object' && Array.isArray(data.candidates)) {
        return data.candidates;
      }

      // Map backend field names → frontend Candidate fields.
      const candidate: Candidate = {
        id:           data.candidate_id ?? data.id ?? 0,
        formula:      data.formula      ?? 'Unknown',
        predicted_tc: data.predicted_tc ?? 0,
        uncertainty:  data.uncertainty  ?? 0,
        ucb_score:    data.ucb_score    ?? 0,
        status:       data.status       ?? 'unlabeled',
        features:     data.features     ?? {},
      };
      return [candidate];
    } catch (error) {
      console.error('Error fetching candidates:', error);
      throw new Error('Failed to load candidate list');
    }
  };

  const fetchPolymorphs = async (formula: string): Promise<Polymorph[]> => {
    try {
      const response = await fetch(`${API_BASE_URL}/structure/${encodeURIComponent(formula)}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch polymorphs for ${formula}: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      // Defensive: handle various backend response shapes
      if (Array.isArray(data)) {
        return data;
      }

      // Backend wraps polymorphs in { formula, polymorphs: [...] }
      if (data && typeof data === 'object' && Array.isArray(data.polymorphs)) {
        return data.polymorphs;
      }

      // Single polymorph object
      if (data && typeof data === 'object' && data.mp_id) {
        return [data as Polymorph];
      }

      // Warning/mock response from backend (no API key)
      if (data && typeof data === 'object' && data.warning) {
        console.warn('Structure API returned warning:', data.warning);
        return [];
      }

      return [];
    } catch (error) {
      console.error(`Error fetching polymorphs for ${formula}:`, error);
      return [];
    }
  };

  const submitOracleFeedback = async (payload: OraclePayload): Promise<OracleResponse> => {
    try {
      const response = await fetch(`${API_BASE_URL}/oracle`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Failed to submit oracle feedback: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return {
        status: data.status ?? 'unknown',
        message: data.message ?? 'No message',
      };
    } catch (error) {
      console.error('Error submitting oracle feedback:', error);
      throw new Error('Failed to submit feedback');
    }
  };

  const fetchModelAnalytics = async (): Promise<ModelMetrics> => {
    try {
      const response = await fetch(`${API_BASE_URL}/analytics`);

      if (!response.ok) {
        throw new Error(`analytics endpoint not found (${response.status})`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.warn(
        'fetchModelAnalytics: backend /analytics endpoint unavailable, returning stub metrics.',
        error,
      );
      // Stub that satisfies ModelMetrics so the UI never crashes.
      return {
        iteration:              0,
        labeled_pool_size:      0,
        unlabeled_pool_size:    0,
        mae:                    0,
        rmse:                   0,
        kernel_hyperparameters: {},
        feature_importances:    [],
      };
    }
  };

  return {
    fetchCandidates,
    fetchPolymorphs,
    submitOracleFeedback,
    fetchModelAnalytics,
  };
};
