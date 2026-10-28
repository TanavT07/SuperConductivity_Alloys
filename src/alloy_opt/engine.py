import os
from typing import Optional, Tuple, Union

import joblib
import numpy as np
import pandas as pd
from sklearn.base import BaseEstimator, TransformerMixin
from sklearn.cross_decomposition import PLSRegression
from sklearn.gaussian_process import GaussianProcessRegressor
from sklearn.gaussian_process.kernels import ConstantKernel as C, Matern
from sklearn.inspection import permutation_importance
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.utils.validation import check_is_fitted


class SupervisedPLSTransformer(BaseEstimator, TransformerMixin):
    """
    Scikit-learn compatible wrapper around PLSRegression.
    Ensures `fit_transform(X, y)` returns only the 2D `x_scores` array
    and guards against rank-deficient matrices during cold-start training.
    """

    def __init__(self, n_components: int = 15):
        self.n_components = n_components

    def fit(
        self,
        X: Union[np.ndarray, pd.DataFrame],
        y: Optional[Union[np.ndarray, pd.Series]] = None,
    ):
        if y is None:
            raise ValueError("SupervisedPLSTransformer requires target vector `y` during fit().")

        X_arr = np.nan_to_num(np.asarray(X, dtype=float), nan=0.0, posinf=0.0, neginf=0.0)
        y_arr = np.nan_to_num(np.asarray(y, dtype=float).ravel(), nan=0.0, posinf=0.0, neginf=0.0)

        n_samples, n_features = X_arr.shape
        rank = int(np.linalg.matrix_rank(X_arr)) if n_samples > 1 else 1
        safe_k = max(1, min(int(self.n_components), n_samples - 1, n_features, max(1, rank)))

        self.actual_components_ = safe_k
        self.pls_ = PLSRegression(n_components=safe_k, scale=False)
        self.pls_.fit(X_arr, y_arr)
        return self

    def transform(self, X: Union[np.ndarray, pd.DataFrame]) -> np.ndarray:
        check_is_fitted(self, attributes=["pls_", "actual_components_"])
        X_arr = np.nan_to_num(np.asarray(X, dtype=float), nan=0.0, posinf=0.0, neginf=0.0)
        x_scores = self.pls_.transform(X_arr)
        return np.nan_to_num(np.asarray(x_scores, dtype=float), nan=0.0, posinf=0.0, neginf=0.0)

    def fit_transform(
        self,
        X: Union[np.ndarray, pd.DataFrame],
        y: Optional[Union[np.ndarray, pd.Series]] = None,
        **fit_params,
    ) -> np.ndarray:
        return self.fit(X, y).transform(X)


class ActiveLearningEngine:
    def __init__(self, n_components: int = 15):
        self.scaler = StandardScaler()
        self.pls = SupervisedPLSTransformer(n_components=n_components)

        kernel = C(1.0, (1e-3, 1e3)) * Matern(length_scale=1.0, nu=2.5)
        self.gp = GaussianProcessRegressor(
            kernel=kernel,
            alpha=1e-2,
            n_restarts_optimizer=5,
            normalize_y=True,
            random_state=42,
        )

        self.pipeline = Pipeline([
            ("scaler", self.scaler),
            ("pls", self.pls),
            ("gp", self.gp),
        ])

    def Fit(self, X: pd.DataFrame, y: pd.Series) -> None:
        """Fits StandardScaler -> SupervisedPLSTransformer -> GaussianProcessRegressor."""
        y_clean = pd.Series(np.asarray(y, dtype=float).ravel(), index=X.index)
        self.pipeline.fit(X, y_clean)
        print(
            f"[ActiveLearningEngine] PLS compressed {X.shape[1]} features into "
            f"{self.pls.actual_components_} target-aware latent components."
        )

    def predict(
        self, X: pd.DataFrame, return_std: bool = False
    ) -> Union[np.ndarray, Tuple[np.ndarray, np.ndarray]]:
        """Projects X through StandardScaler and PLS before querying the GP posterior."""
        X_scaled = self.scaler.transform(X)
        X_pls = self.pls.transform(X_scaled)
        return self.gp.predict(X_pls, return_std=return_std)

    def permuteimportance(self, X: pd.DataFrame, y: pd.Series):
        """
        Computes permutation importance across the full pipeline so the frontend
        Analytics tab displays importance scores for the original 81 Matminer descriptors.
        """
        y_clean = np.asarray(y, dtype=float).ravel()
        return permutation_importance(
            self.pipeline,
            X,
            y_clean,
            n_repeats=10,
            random_state=42,
            n_jobs=1,
        )

    def save_state(self, deploy_dir: str) -> None:
        """Persists all three fitted pipeline stages to disk."""
        os.makedirs(deploy_dir, exist_ok=True)
        joblib.dump(self.scaler, os.path.join(deploy_dir, "standard_scaler.joblib"))
        joblib.dump(self.pls, os.path.join(deploy_dir, "pls_transformer.joblib"))
        joblib.dump(self.gp, os.path.join(deploy_dir, "gaussian_process.joblib"))

    def load_state(self, deploy_dir: str, expected_features: Optional[int] = None) -> bool:
        """
        Loads all three pipeline stages and verifies dimensional consistency across
        StandardScaler, SupervisedPLSTransformer, and GaussianProcessRegressor.
        """
        scaler_path = os.path.join(deploy_dir, "standard_scaler.joblib")
        pls_path = os.path.join(deploy_dir, "pls_transformer.joblib")
        gp_path = os.path.join(deploy_dir, "gaussian_process.joblib")

        if not (os.path.exists(scaler_path) and os.path.exists(pls_path) and os.path.exists(gp_path)):
            return False

        try:
            scaler = joblib.load(scaler_path)
            pls = joblib.load(pls_path)
            gp = joblib.load(gp_path)

            check_is_fitted(scaler)
            check_is_fitted(pls, attributes=["pls_", "actual_components_"])
            check_is_fitted(gp)

            gp_train = getattr(gp, "X_train_", None)
            pls_dim = getattr(pls, "actual_components_", None)
            scaler_dim = getattr(scaler, "n_features_in_", None)

            if gp_train is None or pls_dim is None or gp_train.shape[1] != pls_dim:
                print("[ActiveLearningEngine] Stale PLS/GP dimensions detected; forcing clean refit.")
                return False

            if expected_features is not None and scaler_dim != expected_features:
                print("[ActiveLearningEngine] Feature count mismatch in scaler; forcing clean refit.")
                return False

            self.scaler = scaler
            self.pls = pls
            self.gp = gp
            self.pipeline = Pipeline([
                ("scaler", self.scaler),
                ("pls", self.pls),
                ("gp", self.gp),
            ])
            return True
        except Exception as exc:
            print(f"[ActiveLearningEngine] Could not load saved state ({exc}); forcing clean refit.")
            return False