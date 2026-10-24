import os
import joblib
from sklearn.inspection import permutation_importance
import pandas as pd
import numpy as np
from sklearn.preprocessing import StandardScaler
from sklearn.gaussian_process import GaussianProcessRegressor
from sklearn.gaussian_process.kernels import Matern


class ActiveLearningEngine:
    def __init__(self, random_state=42):
        self.random_state = random_state
        self.scaler = StandardScaler()

        self.K = Matern(nu=2.5, length_scale=1.0, length_scale_bounds=(1e-2, 1e4))
        self.gp = GaussianProcessRegressor(
            kernel=self.K,
            alpha=1e-2,
            random_state=self.random_state,
            normalize_y=True,
            n_restarts_optimizer=2,
        )

    def Fit(self, X_train: pd.DataFrame, y_train: pd.Series):
        X_train_scaled = self.scaler.fit_transform(X_train)
        self.gp.fit(X_train_scaled, y_train)

    def evaluate_pool(self, X_unlabelled: pd.DataFrame, kappa: float = 1.96):
        X_unlabelled_scaled = self.scaler.transform(X_unlabelled)
        mu, std = self.gp.predict(X_unlabelled_scaled, return_std=True)
        ucb_scores = mu + (std * kappa)
        best_local_idx = np.argmax(ucb_scores)
        best_global_idx = X_unlabelled.index[best_local_idx]

        return best_global_idx, mu[best_local_idx], std[best_local_idx]

    def permuteimportance(self, X_test: pd.DataFrame, y_test: pd.Series):
        X_test_scaled = self.scaler.transform(X_test)
        result = permutation_importance(
            self.gp,
            X_test_scaled,
            y_test,
            n_jobs=-1,
            n_repeats=10,
            random_state=self.random_state,
        )

        return result

    def save_state(self, deploy_dir: str = "deployment"):
        os.makedirs(deploy_dir, exist_ok=True)

        model_path = os.path.join(deploy_dir, "gaussian_process.joblib")
        scaler_path = os.path.join(deploy_dir, "standard_scaler.joblib")

        # Export memory states to disk
        joblib.dump(self.gp, model_path)
        joblib.dump(self.scaler, scaler_path)
