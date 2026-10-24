from sklearn.metrics import mean_absolute_error
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
import matplotlib.pyplot as plt
from engine import ActiveLearningEngine

def main():
    print("Loading UCI SUperconductivity dataset")
    labeled_pool = pd.read_csv('labeled_pool.csv')
    unlabelled_pool = pd.read_csv('unlabeled_pool.csv')

    #feature seperation
    X_labelled = labeled_pool.drop(columns = ['critical_temp'])
    y_labelled = labeled_pool['critical_temp']

    #Set aside 20% for validation
    X_train, X_test, y_train, y_test = train_test_split(X_labelled, y_labelled, test_size = 0.20, random_state=42)

    X_unlabelled = unlabelled_pool.drop(columns = ['critical_temp'])
    y_unlabelled = unlabelled_pool['critical_temp']

    print("Initializing Active Learning ENgine...")
    Engine = ActiveLearningEngine()
    Engine.Fit(X_train, y_train)

    # Discovery Simulation ---
    n_iterations = 10
    print(f"\n Initiating {n_iterations}-Iteration Discovery Loop\n" + "="*65)

    for i in range(n_iterations):
        # 1. Identify the best candidate using the engine's UCB logic
        best_idx, pred_temp, uncertainty = Engine.evaluate_pool(X_unlabelled)
        
        # 2. Oracle Query: Reveal the true temperature
        true_temp = y_unlabelled.loc[best_idx]
        
        # 3. Evaluate distribution shift on the static validation set
        X_test_scaled = Engine.scaler.transform(X_test)
        test_preds = Engine.gp.predict(X_test_scaled)
        current_mae = mean_absolute_error(y_test, test_preds)

        print(f"Iteration {i+1:02d} | Candidate Index: {best_idx}")
        print(f"Model Predicted     : {pred_temp:>6.2f} K (± {uncertainty:.2f})")
        print(f"Oracle Result       : {true_temp:>6.2f} K")
        print(f"Validation Set MAE  : {current_mae:>6.2f} K")
        print("-" * 65)

        # 4. Mutate State: Move the discovered material from unlabelled to training
        candidate_features = X_unlabelled.loc[[best_idx]]
        candidate_target = y_unlabelled.loc[[best_idx]]

        X_train = pd.concat([X_train, candidate_features])
        y_train = pd.concat([y_train, candidate_target])

        X_unlabelled = X_unlabelled.drop(index=best_idx)
        y_unlabelled = y_unlabelled.drop(index=best_idx)

        # 5. Retrain the engine on the newly expanded dataset
        Engine.Fit(X_train, y_train)

    print(f"\n✅ Loop Complete. Final Training Set Size: {X_train.shape[0]} materials.")

    print("\nSerializing pipeline for deplyment...")
    Engine.save_state('deployment')

    #Dumping mutated trainnig data
    X_train.to_csv('deployment/X_train_state.csv', index = True)
    y_train.to_csv('deployment/y_train_state.csv', index = True)
    print("Pipelin and data states exportes")



if __name__ == "__main__":
    main()
