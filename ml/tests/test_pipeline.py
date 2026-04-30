"""
LexiSight ML Tests — Data Integrity & Pipeline Validation
Run with: pytest ml/tests/ -v
"""

import json
import numpy as np
import yaml
import pytest
from pathlib import Path

BASE_DIR = Path(__file__).parent.parent.parent
ML_DIR = BASE_DIR / "ml"


class TestClassMergeConfig:
    """Validate the class merge configuration."""

    @pytest.fixture
    def merge_config(self):
        path = ML_DIR / "configs" / "class_merge.yaml"
        assert path.exists(), "class_merge.yaml not found"
        with open(path, encoding='utf-8') as f:
            return yaml.safe_load(f)

    def test_all_letters_present(self, merge_config):
        """Every letter A-Z must have a canonical entry."""
        for letter in "ABCDEFGHIJKLMNOPQRSTUVWXYZ":
            assert letter in merge_config, f"Missing letter: {letter}"

    def test_all_digits_present(self, merge_config):
        """Every digit 0-9 must have a canonical entry."""
        for d in range(10):
            assert str(d) in merge_config, f"Missing digit: {d}"

    def test_no_duplicate_variants(self, merge_config):
        """No variant string should map to two different canonical names."""
        seen = {}
        for canon, variants in merge_config.items():
            if not isinstance(variants, list):
                continue
            for v in variants:
                v_upper = str(v).upper()
                if v_upper in seen:
                    assert seen[v_upper] == canon, \
                        f"Variant '{v}' maps to both '{seen[v_upper]}' and '{canon}'"
                seen[v_upper] = canon

    def test_exclude_class_exists(self, merge_config):
        """_EXCLUDE must be defined to filter garbage classes."""
        assert "_EXCLUDE" in merge_config


class TestMetricsJson:
    """Validate the canonical metrics file."""

    @pytest.fixture
    def metrics(self):
        path = ML_DIR / "eval" / "metrics.json"
        assert path.exists(), "metrics.json not found"
        with open(path) as f:
            return json.load(f)

    def test_has_version(self, metrics):
        assert "version" in metrics

    def test_has_accuracy(self, metrics):
        assert "accuracy" in metrics
        assert "phase2_val" in metrics["accuracy"]

    def test_has_known_issues(self, metrics):
        assert "known_issues" in metrics
        assert len(metrics["known_issues"]) > 0

    def test_verdict_not_marketing(self, metrics):
        """Verdict must not contain inflated marketing claims."""
        verdict = metrics.get("verdict", "")
        assert "97" not in verdict, "Verdict still contains inflated 97% claim"


class TestTrainTemporalConfig:
    """Validate training configuration."""

    @pytest.fixture
    def config(self):
        path = ML_DIR / "configs" / "train_temporal.yaml"
        assert path.exists(), "train_temporal.yaml not found"
        with open(path, encoding='utf-8') as f:
            return yaml.safe_load(f)

    def test_model_section(self, config):
        m = config["model"]
        assert m["input_frames"] == 30
        assert m["input_features"] == 126
        assert m["num_transformer_layers"] >= 1

    def test_signer_disjoint_split(self, config):
        """Split must be signer-disjoint — this is non-negotiable."""
        assert config["data"]["split_strategy"] == "signer_disjoint"

    def test_augmentation_has_noise(self, config):
        aug = config["augmentation"]
        assert aug["gaussian_noise_sigma"] > 0

    def test_export_min_accuracy(self, config):
        """Never export a model below 90% accuracy."""
        assert config["export"]["min_accuracy_to_export"] >= 0.90


class TestDataIntegrity:
    """Validate processed data if it exists."""

    def test_npy_shape_static(self):
        """If static images are converted, check shape is (30, 2, 21, 3)."""
        static_dir = ML_DIR / "data_processed" / "static_images"
        if not static_dir.exists():
            pytest.skip("Static images not yet processed")
        npys = list(static_dir.rglob("*.npy"))
        if not npys:
            pytest.skip("No .npy files found")
        sample = np.load(npys[0])
        assert sample.shape == (30, 2, 21, 3), f"Bad shape: {sample.shape}"

    def test_no_nan_in_data(self):
        """No NaN values should exist in any processed data."""
        proc_dir = ML_DIR / "data_processed"
        if not proc_dir.exists():
            pytest.skip("No processed data yet")
        for npy in list(proc_dir.rglob("*.npy"))[:20]:
            data = np.load(npy)
            assert not np.any(np.isnan(data)), f"NaN found in {npy}"


class TestLabelMap:
    """Validate the browser-facing label map."""

    def test_label_map_exists(self):
        path = BASE_DIR / "public" / "model" / "label_map.json"
        assert path.exists(), "label_map.json not found"

    def test_label_map_has_36_classes(self):
        path = BASE_DIR / "public" / "model" / "label_map.json"
        if not path.exists():
            pytest.skip("label_map.json not found")
        with open(path) as f:
            lm = json.load(f)
        assert len(lm) >= 36, f"Only {len(lm)} classes (expected >= 36)"
