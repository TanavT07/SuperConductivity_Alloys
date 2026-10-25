export interface Candidate {
  id: number;
  formula: string;
  predicted_tc: number;
  uncertainty: number;
  ucb_score: number;
  status: 'unlabeled' | 'synthesized' | 'failed';
  features: Record<string, number>;
}

export interface CandidateRow extends Candidate {
  lattice_a?: number;
  lattice_b?: number;
  lattice_c?: number;
  sparkline: SparklinePoint[];
  approved: boolean;
}

export interface SparklinePoint {
  iteration: number;
  value: number;
}

export interface Polymorph {
  mp_id: string;
  formula: string;
  space_group: {
    number: number;
    symbol: string;
  };
  crystal_system: string;
  energy_above_hull: number;
  formation_energy_per_atom: number;
  lattice: {
    a: number;
    b: number;
    c: number;
    alpha: number;
    beta: number;
    gamma: number;
    volume: number;
  };
  sites: Array<{
    element: string;
    coords: [number, number, number];
    label: string;
  }>;
}

export interface OraclePayload {
  candidate_id: number;
  true_tc: number;
  synthesis_method?: string;
  annealing_temp_k?: number;
}

export interface OracleResponse {
  status: string;
  message: string;
}

export interface ModelMetrics {
  iteration: number;
  labeled_pool_size: number;
  unlabeled_pool_size: number;
  mae: number;
  rmse: number;
  kernel_hyperparameters: Record<string, number>;
  feature_importances: Array<{
    feature: string;
    importance: number;
    std: number;
  }>;
}

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'info';
  title: string;
  message: string;
}

export type NavView = 'dashboard' | 'crystallography' | 'analytics' | 'data' | 'settings' | 'profile';
