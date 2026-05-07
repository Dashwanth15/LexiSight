import os
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import pandas as pd
import numpy as np
import tensorflow as tf
from sklearn.model_selection import StratifiedGroupKFold, train_test_split
from sklearn.metrics import confusion_matrix
import matplotlib.pyplot as plt
import seaborn as sns

def main():
    manifest_path = "ml/data_processed/manifest.csv"
    model_path = "training_logs/temporal_best.keras"
    
    print("Loading Manifest...")
    df = pd.read_csv(manifest_path)
    
    class_counts = df["class"].value_counts()
    valid_classes = class_counts[class_counts >= 3].index.tolist()
    df = df[df["class"].isin(valid_classes)].copy()
    
    # CRITICAL FIX: Only use real video data
    df = df[df["source"] == "include"].copy()
    
    unique_classes = sorted(df["class"].unique())
    n_classes = len(unique_classes)
    class_to_id = {c: i for i, c in enumerate(unique_classes)}
    id_to_class = {i: c for c, i in class_to_id.items()}
    df["class_id"] = df["class"].map(class_to_id)
    
    print("Splitting Data (Ensuring Unseen Signers in Validation)...")
    if df["signer_id"].nunique() <= 1:
        train_df, val_df = train_test_split(df, test_size=0.1, stratify=df["class_id"], random_state=42)
    else:
        sgkf = StratifiedGroupKFold(n_splits=5)
        train_idx, val_idx = next(sgkf.split(df, df["class_id"], df["signer_id"]))
        val_df = df.iloc[val_idx]
        
    print(f"Validation Set Size: {len(val_df)}")
    
    print("Loading Model...")
    from ml.models.temporal_v1 import PositionalEncoding, TransformerEncoderBlock
    custom_objects = {
        "PositionalEncoding": PositionalEncoding,
        "TransformerEncoderBlock": TransformerEncoderBlock
    }
    model = tf.keras.models.load_model(model_path, custom_objects=custom_objects)
    
    print("Loading Val Data into RAM...")
    X_val = np.zeros((len(val_df), 30, 126), dtype=np.float32)
    y_true_indices = []
    
    for i, (_, row) in enumerate(val_df.iterrows()):
        clip_path = "ml/data_processed/" + row["clip_path"]
        if os.path.exists(clip_path):
            try:
                data = np.load(clip_path)
                X_val[i] = data.reshape(30, -1)
            except:
                pass
        y_true_indices.append(int(row["class_id"]))
        
    y_true_indices = np.array(y_true_indices)
    
    print("Running Predictions...")
    y_pred_probs = model.predict(X_val, batch_size=64, verbose=1)
    y_pred_indices = np.argmax(y_pred_probs, axis=1)
    
    print("\n=============================================")
    print("          FINAL MODEL ANALYTICS              ")
    print("=============================================\n")
    
    print("--- 1. OVERALL ACCURACY (UNSEEN SIGNERS) ---")
    correct = np.sum(y_true_indices == y_pred_indices)
    accuracy = correct / len(val_df)
    print(f"Accuracy: {accuracy*100:.2f}% (Guessed {correct} correct out of {len(val_df)} unseen videos)")
    
    top3_correct = 0
    top5_correct = 0
    for i in range(len(val_df)):
        top5_preds = np.argsort(y_pred_probs[i])[-5:]
        top3_preds = top5_preds[-3:]
        if y_true_indices[i] in top5_preds: top5_correct += 1
        if y_true_indices[i] in top3_preds: top3_correct += 1
    
    print(f"Top-3 Accuracy: {top3_correct/len(val_df)*100:.2f}%")
    print(f"Top-5 Accuracy: {top5_correct/len(val_df)*100:.2f}%\n")
    
    print("--- 2. WORST PERFORMING WORDS (FAILING SIGNS) ---")
    from collections import defaultdict
    class_correct = defaultdict(int)
    class_total = defaultdict(int)
    class_errors = defaultdict(list)
    
    for true_id, pred_id in zip(y_true_indices, y_pred_indices):
        class_total[true_id] += 1
        if true_id == pred_id:
            class_correct[true_id] += 1
        else:
            class_errors[true_id].append(id_to_class[pred_id])
            
    worst_classes = []
    for cid in class_total:
        acc = class_correct[cid] / class_total[cid]
        if acc < 1.0: 
            worst_classes.append({
                "word": id_to_class[cid],
                "accuracy": acc * 100,
                "total": class_total[cid],
                "mistook_for": max(set(class_errors[cid]), key=class_errors[cid].count) if class_errors[cid] else "Unknown"
            })
            
    worst_classes.sort(key=lambda x: x["accuracy"])
    
    if len(worst_classes) == 0:
        print("Amazing! No failing words. The model achieved 100% on validation.")
    else:
        for c in worst_classes[:10]:
            print(f"  [X] '{c['word']}': {c['accuracy']:.1f}% accuracy ({c['total']} test samples). Commonly confused with: '{c['mistook_for']}'")
        
    print("\n--- 3. CONFUSION MATRIX ---")
    cm = confusion_matrix(y_true_indices, y_pred_indices, labels=np.arange(n_classes))
    plt.figure(figsize=(20, 20))
    top_50_cids = [k for k, v in sorted(class_total.items(), key=lambda item: item[1], reverse=True)[:50]]
    cm_50 = cm[np.ix_(top_50_cids, top_50_cids)]
    labels_50 = [id_to_class[i] for i in top_50_cids]
    
    sns.heatmap(cm_50, annot=False, cmap='Blues', xticklabels=labels_50, yticklabels=labels_50)
    plt.title('Confusion Matrix (Top 50 Most Frequent Words)')
    plt.ylabel('True Sign')
    plt.xlabel('AI Predicted Sign')
    plt.savefig('training_logs/final_confusion_matrix.png', dpi=300, bbox_inches='tight')
    print("A high-resolution Confusion Matrix image has been generated!")
    print("Saved to: Lexisight/training_logs/final_confusion_matrix.png")

if __name__ == "__main__":
    main()
