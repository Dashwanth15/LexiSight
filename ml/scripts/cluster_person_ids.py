#!/usr/bin/env python3
"""
LexiSight — True Person-Level Signer ID Pipeline
================================================
Best approach given the INCLUDE dataset structure:

PRIMARY SIGNALS (definitive):
  1. Same MVI_XXXX session with 2+ different classes → same person
  2. Consecutive MVI numbers (e.g., MVI_9984 + MVI_9985) in same recording → same person
  3. Sessions that appear in identical class sets → same person (one person recorded them)

SECONDARY SIGNALS (probabilistic):
  4. Same MVI number range + same background features → same person
  5. Hand-style biometric clustering from landmarks

ALGORITHM:
  Step 1: Build a graph of sessions
  Step 2: Connect sessions that are DEFINITIVELY the same person (signals 1-3)
  Step 3: Use connected components to get person groups
  Step 4: For singletons (sessions not connected to anything),
          use hand-style clustering to find potential same-person groups

PRIOR KNOWLEDGE from INCLUDE dataset:
  - Each MVI file = one video clip = one person
  - Each person recorded multiple signs in one session
  - Same person has consecutive MVI numbers

OUTPUT:
  manifest_holistic_true_persons.csv with:
    - signer_id: person_001, person_002, etc.
    - original_session: MVI_XXXX
    - confidence: high/medium/low (based on how we identified the person)
"""

import argparse
import json
import numpy as np
import pandas as pd
from pathlib import Path
from collections import defaultdict
from sklearn.cluster import AgglomerativeClustering
from sklearn.preprocessing import StandardScaler
from sklearn.metrics.pairwise import cosine_similarity
import re
import sys

BASE_DIR = Path(__file__).parent.parent.parent


def extract_hand_style_features(npy_path: Path) -> np.ndarray:
    """Extract hand-style biometric features from landmarks."""
    try:
        seq = np.load(npy_path).astype(np.float32)
        if seq.shape != (30, 225):
            return None
        # Average across frames for stability
        avg = seq.mean(axis=0)  # (225,)
        pose = avg[:99].reshape(33, 3)
        lh = avg[99:162].reshape(21, 3)
        rh = avg[162:].reshape(21, 3)

        if np.all(lh == 0) and np.all(rh == 0):
            return None

        # Choose dominant hand
        lh_var = np.var(lh)
        rh_var = np.var(rh)
        hand = lh if lh_var >= rh_var else rh
        other = rh if lh_var >= rh_var else lh

        # Hand size normalization
        wrist = hand[0]
        hand_centered = hand - wrist
        scale = np.max(np.linalg.norm(hand_centered, axis=1)) + 1e-8
        hand_norm = hand_centered / scale

        # Biometric features (scale-invariant)
        finger_tips = [4, 8, 12, 16, 20]
        finger_bases = [2, 5, 9, 13, 17]

        features = []

        # 1. Finger length ratios (size-invariant)
        for base, tip in zip(finger_bases, finger_tips):
            length = np.linalg.norm(hand[tip] - hand[base])
            features.append(length / scale)

        # 2. Finger spread ratios
        for i in range(len(finger_tips)):
            for j in range(i+1, len(finger_tips)):
                dist = np.linalg.norm(hand[finger_tips[i]] - hand[finger_tips[j]])
                features.append(dist / scale)

        # 3. Hand aspect ratio
        width = max(
            np.linalg.norm(hand[0] - hand[17]),  # wrist to pinky
            np.linalg.norm(hand[0] - hand[5])      # wrist to index
        )
        length = np.linalg.norm(hand[0] - hand[12])  # wrist to middle
        features.append(width / (length + 1e-8))

        # 4. Pose features (upper body proportions)
        shoulder_dist = np.linalg.norm(pose[11] - pose[12]) + 1e-8
        hip_dist = np.linalg.norm(pose[23] - pose[24]) + 1e-8
        torso_height = np.linalg.norm(pose[11] - pose[23])
        features.append(torso_height / shoulder_dist)
        features.append(hip_dist / shoulder_dist)

        # 5. Arm angle (rotation invariant)
        left_shoulder = pose[11]
        right_shoulder = pose[12]
        left_elbow = pose[13]
        right_elbow = pose[14]
        left_angle = np.arctan2(left_elbow[1] - left_shoulder[1],
                                  left_elbow[0] - left_shoulder[0] + 1e-8)
        right_angle = np.arctan2(right_elbow[1] - right_shoulder[1],
                                  right_elbow[0] - right_shoulder[0] + 1e-8)
        features.append(left_angle)
        features.append(right_angle)
        features.append(abs(left_angle - right_angle))

        # 6. Dominant hand side
        features.append(1.0 if lh_var >= rh_var else 0.0)

        # 7. Cross-hand coordination
        both_active = not (np.all(lh == 0) or np.all(rh == 0))
        features.append(1.0 if both_active else 0.0)

        return np.array(features, dtype=np.float32)

    except Exception:
        return None


def build_definitive_graph(df: pd.DataFrame) -> dict:
    """
    Build a graph connecting sessions that are DEFINITELY the same person.
    Returns: dict[session] -> set of definitely-same-person sessions
    """
    graph = defaultdict(set)

    # SIGNAL 1: Same session (MVI_XXXX) with multiple classes = same person
    # (already grouped by session in manifest — each MVI_XXXX IS one session)
    print("  Signal 1: sessions with 2+ classes (definitive same-person)...")
    for session, grp in df.groupby('signer_id'):
        classes = grp['class'].unique()
        if len(classes) > 1:
            # All clips in this session are the same person
            pass  # already 1 node per session, nothing to add

    # SIGNAL 2: Consecutive MVI numbers = same person
    # e.g., MVI_9984, MVI_9985, MVI_9986 all have consecutive numbers AND same classes
    print("  Signal 2: consecutive MVI numbers + same class set (definitive same-person)...")
    sessions_by_num = {}
    for session in df['signer_id'].unique():
        m = re.search(r'MVI_(\d+)', str(session))
        if m:
            sessions_by_num[int(m.group(1))] = session

    sorted_nums = sorted(sessions_by_num.keys())
    for i in range(len(sorted_nums) - 1):
        a_num, b_num = sorted_nums[i], sorted_nums[i+1]
        if b_num == a_num + 1:  # consecutive
            a_sess = sessions_by_num[a_num]
            b_sess = sessions_by_num[b_num]
            a_classes = set(df[df['signer_id'] == a_sess]['class'].unique())
            b_classes = set(df[df['signer_id'] == b_sess]['class'].unique())
            # If same classes or overlapping classes -> same person
            if a_classes & b_classes:
                graph[a_sess].add(b_sess)
                graph[b_sess].add(a_sess)

    # SIGNAL 3: Sessions appearing in IDENTICAL class sets
    # (same person recorded same signs across multiple MVI files)
    print("  Signal 3: identical class-set sessions (definitive same-person)...")
    class_set_to_sessions = defaultdict(list)
    for session, grp in df.groupby('signer_id'):
        classes = tuple(sorted(grp['class'].unique()))
        class_set_to_sessions[classes].append(session)

    for sessions in class_set_to_sessions.values():
        if len(sessions) > 1:
            # All these sessions have identical class sets = same person
            for i in range(len(sessions)):
                for j in range(i+1, len(sessions)):
                    graph[sessions[i]].add(sessions[j])
                    graph[sessions[j]].add(sessions[i])

    # SIGNAL 4: Sessions in the same MVI number range AND SAME CLASS
    # -> same person (different takes of the same sign)
    print("  Signal 4: same MVI range + same class + consecutive numbers...")
    for session, grp in df.groupby('signer_id'):
        m = re.search(r'MVI_(\d+)', str(session))
        if not m:
            continue
        num = int(m.group(1))
        for cls in grp['class'].unique():
            same_cls = df[df['class'] == cls]
            for other_sess in same_cls['signer_id'].unique():
                if other_sess == session:
                    continue
                m2 = re.search(r'MVI_(\d+)', str(other_sess))
                if not m2:
                    continue
                num2 = int(m2.group(1))
                if abs(num2 - num) <= 5:  # within 5 MVI numbers
                    graph[session].add(other_sess)
                    graph[other_sess].add(session)

    return dict(graph)


def find_connected_components(graph: dict, all_sessions: list) -> dict:
    """Find connected components = person groups."""
    visited = set()
    components = {}
    comp_id = 0

    def dfs(session):
        stack = [session]
        members = []
        while stack:
            s = stack.pop()
            if s in visited:
                continue
            visited.add(s)
            members.append(s)
            for neighbor in graph.get(s, []):
                if neighbor not in visited:
                    stack.append(neighbor)
        return members

    for session in all_sessions:
        if session not in visited:
            comp = dfs(session)
            if comp:
                components[f"person_{comp_id:04d}"] = sorted(comp)
                comp_id += 1

    return components


def cluster_singletons_by_hand_style(
    df: pd.DataFrame,
    components: dict,
    singletons: list,
    eps: float = 0.15
) -> dict:
    """
    Cluster singleton sessions (not connected to anything definitive)
    using hand-style biometric features.
    """
    if not singletons:
        return {}

    print(f"\n  Clustering {len(singletons)} singleton sessions by hand-style biometrics...")
    features = []
    valid_sessions = []

    for session in singletons:
        clips = df[df['signer_id'] == session]['clip_path'].tolist()
        if not clips:
            continue
        feat = extract_hand_style_features(
            BASE_DIR / "ml" / "data_processed" / clips[0]
        )
        if feat is not None:
            features.append(feat)
            valid_sessions.append(session)

    if len(features) < 2:
        # Not enough to cluster
        return {s: f"person_singleton_{i:04d}" for i, s in enumerate(singletons)}

    features = np.array(features)
    scaler = StandardScaler()
    features_scaled = scaler.fit_transform(features)

    n_clusters = max(2, len(features_scaled) // 3)
    clustering = AgglomerativeClustering(
        n_clusters=n_clusters,
        metric='cosine',
        linkage='average',
    )
    labels = clustering.fit_predict(features_scaled)

    singleton_clusters = {}
    for session, label in zip(valid_sessions, labels):
        singleton_clusters[session] = f"person_singleton_{label:04d}"

    for session in singletons:
        if session not in singleton_clusters:
            singleton_clusters[session] = f"person_unknown_{session}"

    print(f"  Formed {n_clusters} singleton clusters from {len(valid_sessions)} sessions "
          f"with valid hand features")
    return singleton_clusters


def assign_confidence(sessions_in_group: list, df: pd.DataFrame) -> str:
    """Assign confidence level for how we identified this person group."""
    if len(sessions_in_group) == 1:
        # Single session — check how many clips/classes it has
        row = df[df['signer_id'] == sessions_in_group[0]]
        if len(row['class'].unique()) >= 2:
            return "medium"  # same session, 2+ classes
        return "low"        # single session, 1 class, 1 clip
    else:
        return "high"       # multiple sessions connected definitively


def run_pipeline(manifest_path: Path, output_path: Path, dry_run: bool = False):
    df = pd.read_csv(manifest_path)
    print(f"Loaded {len(df)} clips, {df['signer_id'].nunique()} sessions")

    # Step 1: Build definitive person graph
    print("\nStep 1 — Building definitive person graph...")
    graph = build_definitive_graph(df)
    print(f"  Graph: {len(graph)} sessions connected to others")

    # Step 2: Find connected components = person groups
    print("\nStep 2 — Finding connected components...")
    all_sessions = list(df['signer_id'].unique())
    components = find_connected_components(graph, all_sessions)
    print(f"  Found {len(components)} person groups")

    # Step 3: Identify singletons (sessions not connected to anything)
    sessions_in_components = set()
    for sessions in components.values():
        sessions_in_components.update(sessions)
    singletons = [s for s in all_sessions if s not in sessions_in_components]
    print(f"  Singletons (no connections): {len(singletons)} sessions")

    # Step 4: Cluster singletons by hand-style biometrics
    print("\nStep 3 — Clustering singletons by hand-style biometrics...")
    singleton_clusters = cluster_singletons_by_hand_style(df, components, singletons)

    # Step 5: Assign person IDs
    print("\nStep 4 — Assigning person IDs...")
    person_id_map = {}
    confidence_map = {}
    person_counter = 1

    for sessions in sorted(components.values(), key=lambda x: x[0]):
        if len(sessions) > 1:
            pid = f"person_{person_counter:04d}"
            person_counter += 1
            conf = assign_confidence(sessions, df)
            for s in sessions:
                person_id_map[s] = pid
                confidence_map[s] = conf

    for session, cluster_id in singleton_clusters.items():
        if cluster_id not in person_id_map.values():
            person_id_map[session] = cluster_id
            confidence_map[session] = "low"

    # Build output dataframe
    df_out = df.copy()
    df_out['original_session'] = df_out['signer_id']
    df_out['person_id'] = df_out['original_session'].map(person_id_map)
    df_out['identification_confidence'] = df_out['original_session'].map(confidence_map)

    # Count people
    n_people = df_out['person_id'].nunique()
    print(f"\nTotal unique persons detected: {n_people}")
    print(f"  High confidence: {sum(1 for v in confidence_map.values() if v == 'high')}")
    print(f"  Medium confidence: {sum(1 for v in confidence_map.values() if v == 'medium')}")
    print(f"  Low confidence: {sum(1 for v in confidence_map.values() if v == 'low')}")

    if dry_run:
        print("\n--- DRY RUN: Statistics only ---")
        print(f"Original sessions: {df['signer_id'].nunique()}")
        print(f"Detected persons: {n_people}")
        people_counts = df_out.groupby('person_id').size()
        print(f"Clips per person: min={people_counts.min()}, median={people_counts.median():.1f}, max={people_counts.max()}")
        print(f"\nPerson group sizes:")
        group_sizes = [len(s) for s in components.values()] + [1]*len(singleton_clusters)
        print(f"  1 session: {group_sizes.count(1)} persons")
        print(f"  2 sessions: {group_sizes.count(2)} persons")
        print(f"  3+ sessions: {sum(1 for g in group_sizes if g >= 3)} persons")

        # Show sample person groups
        print(f"\nSample person groups (first 5 multi-session):")
        shown = 0
        for pid, sessions in sorted(components.items()):
            if len(sessions) > 1:
                classes_per = [list(df[df['signer_id']==s]['class'].unique()) for s in sessions]
                all_classes = set(c for cs in classes_per for c in cs)
                print(f"  {pid}: {len(sessions)} sessions, {len(all_classes)} classes")
                shown += 1
                if shown >= 5:
                    break
        return

    # Save
    df_out['signer_id'] = df_out['person_id']
    df_out.to_csv(output_path, index=False)
    print(f"\nSaved: {output_path}")

    # Save session-to-person mapping
    mapping_path = output_path.parent / "session_to_person_mapping.json"
    mapping = {str(s): str(pid) for s, pid in person_id_map.items()}
    with open(mapping_path, 'w') as f:
        json.dump(mapping, f, indent=2)
    print(f"Saved mapping: {mapping_path}")

    # Summary statistics
    print("\n=== FINAL SUMMARY ===")
    print(f"Original sessions: {df['signer_id'].nunique()}")
    print(f"Unique persons: {df_out['person_id'].nunique()}")
    people_per_class = df_out.groupby('class')['person_id'].nunique()
    print(f"Persons per class: min={people_per_class.min()}, max={people_per_class.max()}, median={people_per_class.median():.1f}")

    # Person size distribution
    person_sizes = df_out.groupby('person_id').size()
    print(f"\nClips per person: min={person_sizes.min()}, median={person_sizes.median():.1f}, max={person_sizes.max()}")

    return df_out


def main():
    parser = argparse.ArgumentParser(description="True person-level signer ID pipeline")
    parser.add_argument("--manifest", default="ml/data_processed/manifest_holistic_include.csv")
    parser.add_argument("--output", default="ml/data_processed/manifest_holistic_true_persons.csv")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    manifest_path = BASE_DIR / args.manifest
    output_path = BASE_DIR / args.output

    if not manifest_path.exists():
        print(f"Manifest not found: {manifest_path}")
        sys.exit(1)

    run_pipeline(manifest_path, output_path, dry_run=args.dry_run)


if __name__ == "__main__":
    main()
