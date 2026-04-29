#!/usr/bin/env python3
"""
LexiSight — TFJS Model Exporter
Exports a trained Keras model to TensorFlow.js format with float16 quantization.

Usage: python ml/scripts/export_tfjs.py --model training_logs/phase2_best.keras
"""

import json, argparse
import numpy as np
from pathlib import Path

BASE_DIR = Path(__file__).parent.parent.parent


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--model", default="training_logs/phase2_best.keras",
                   help="Path to Keras model file")
    p.add_argument("--output", default="public/model/tfjs_model",
                   help="TFJS output directory")
    p.add_argument("--label-map", default="public/model/label_map.json")
    p.add_argument("--metrics", default="ml/eval/metrics.json")
    args = p.parse_args()

    import tensorflow as tf
    model_path = BASE_DIR / args.model
    if not model_path.exists():
        print(f"Model not found: {model_path}")
        return

    print(f"Loading model: {model_path}")
    model = tf.keras.models.load_model(str(model_path))
    model.summary()

    out_dir = BASE_DIR / args.output
    out_dir.mkdir(parents=True, exist_ok=True)

    try:
        import tensorflowjs as tfjs
        print("Exporting with float16 quantization...")
        tfjs.converters.save_keras_model(
            model, str(out_dir),
            quantization_dtype_map={"float16": "*"}
        )
        print(f"✓ TFJS model saved to {out_dir}")
    except Exception as e:
        print(f"float16 export failed: {e}")
        try:
            import tensorflowjs as tfjs
            tfjs.converters.save_keras_model(model, str(out_dir))
            print(f"✓ TFJS model saved (unquantized) to {out_dir}")
        except Exception as e2:
            print(f"✗ TFJS export failed: {e2}")
            return

    # Write model meta
    meta = {
        "version": "0.93.0",
        "model_type": model.name,
        "n_classes": model.output_shape[-1],
        "input_shape": list(model.input_shape[1:]),
        "params": model.count_params(),
        "quantization": "float16",
    }

    # Read accuracy from metrics.json if available
    metrics_path = BASE_DIR / args.metrics
    if metrics_path.exists():
        with open(metrics_path) as f:
            m = json.load(f)
        meta["accuracy_val"] = m.get("accuracy", {}).get("phase2_val")
        meta["accuracy_wild"] = m.get("accuracy", {}).get("wild_test")

    with open(BASE_DIR / "public" / "model" / "model_meta.json", "w") as f:
        json.dump(meta, f, indent=2)
    print(f"✓ Model meta saved")


if __name__ == "__main__":
    main()
