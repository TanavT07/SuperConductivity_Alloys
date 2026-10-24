import os
import joblib
import requests
import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from engine import ActiveLearningEngine
from pydantic import BaseModel

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DEPLOY_DIR = os.path.join(BASE_DIR, "deployment")
UNLABELED_POOL_PATH = os.path.join(BASE_DIR, "unlabeled_pool.csv")

#Global dictionary to hold active state in memory
app_state = {}

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("Loading serialized engine state...")

    #Instantiate blank engine and load saved states
    Engine = ActiveLearningEngine()
    Engine.gp = joblib.load(os.path.join(DEPLOY_DIR, 'gaussian_process.joblib'))
    Engine.scaler = joblib.load(os.path.join(DEPLOY_DIR, 'standard_scaler.joblib'))

    app_state['Engine'] = Engine
    app_state['X_train'] = pd.read_csv(os.path.join(DEPLOY_DIR, 'X_train_state.csv'), index_col=0)
    app_state['y_train'] = pd.read_csv(os.path.join(DEPLOY_DIR, 'y_train_state.csv'), index_col=0).squeeze("columns")

    #Load the unlabelled pool directly
    app_state['unlabelled'] = pd.read_csv(UNLABELED_POOL_PATH)

    print("Engine and data states loaded.")
    yield

    app_state.clear()

app = FastAPI(lifespan = lifespan)

app.add_middleware(CORSMiddleware, allow_origins = ["http://localhost:3000"], allow_credentials = True, allow_methods = ['*'], allow_headers = ['*'],)

@app.get("/candidates")
def get_top_candidates():
    unlabelled_df = app_state['unlabelled']
    formulas = unlabelled_df['chemical_formulas']

    #stripping metadata before passing to math engine
    X_unlabelled = unlabelled_df.drop(columns=['critical_temp', 'chemical_formulas'], errors='ignore')
    Engine = app_state['Engine']

    # Execute UCB evaluation
    best_idx, pred_temp, uncertainty = Engine.evaluate_pool(X_unlabelled)
    
    return {
        "candidate_id": int(best_idx),
        "formula": formulas.loc[best_idx],
        "predicted_tc": float(pred_temp),
        "uncertainty": float(uncertainty)
    }

@app.get("/structure/{formula}")
def get_crystal_structure(formula: str):
    api_key = os.getenv("MP_API_KEY")
    if not api_key:
        return {"warning": "No MP_API_KEY found. Returning mock structural state.", "formula": formula}
        
    headers = {"X-API-KEY": api_key}
    url = f"https://api.materialsproject.org/materials/summary/?formula={formula}"
    
    try:
        response = requests.get(url, headers=headers)
        response.raise_for_status()
        return {"formula": formula, "polymorphs": response.json().get('data', [])}
    except requests.RequestException as e:
        raise HTTPException(status_code=502, detail=f"External API failure: {str(e)}")

class OracleResult(BaseModel):
    candidate_id : int
    true_tc : float

@app.post("/oracle")
def submit_lab_result(result: OracleResult):
    engine = app_state['Engine']
    X_train = app_state['X_train']
    y_train = app_state['y_train']
    unlabelled_df = app_state['unlabelled']
    
    # Isolate the exact candidate row
    candidate_row = unlabelled_df.iloc[[result.candidate_id]].copy()
    
    # Drop string metadata to match feature matrix
    X_new = candidate_row.drop(columns=['critical_temp', 'chemical_formulas'], errors = 'ignore')
    y_new = pd.Series([result.true_tc], index=[result.candidate_id])
    
    # Append to training state
    X_train_updated = pd.concat([X_train, X_new])
    y_train_updated = pd.concat([y_train, y_new])
    
    # Retrain the engine
    engine.Fit(X_train_updated, y_train_updated)
    
    # Update in-memory state
    app_state['X_train'] = X_train_updated
    app_state['y_train'] = y_train_updated
    
    # Remove candidate from unlabelled pool
    app_state['unlabelled'] = unlabelled_df.drop(index=result.candidate_id).reset_index(drop=True)
    
    # Serialize the updated model to disk
    import os
    engine.save_state('deployment')
    X_train_updated.to_csv(os.path.join('deployment', 'X_train_state.csv'))
    y_train_updated.to_csv(os.path.join('deployment', 'y_train_state.csv'))
    
    return {"status": "success", "message": "Engine retrained and state serialized."}