#!/usr/bin/env python3
import pandas as pd
import numpy as np
from pathlib import Path
from collections import defaultdict
import re

df = pd.read_csv('ml/data_processed/manifest_holistic_include.csv')
print(f"Total clips: {len(df)}")
print(f"Unique sessions: {df['signer_id'].nunique()}")
print(f"Unique classes: {df['class'].nunique()}")

clips_per = df.groupby('signer_id').size()
print(f"\nClips per session: min={clips_per.min()}, max={clips_per.max()}, median={clips_per.median():.1f}")

classes_per = df.groupby('signer_id')['class'].nunique()
print(f"Classes per session: min={classes_per.min()}, max={classes_per.max()}, median={classes_per.median():.1f}")

# The dataset has each person recording VERY few clips.
# If each person recorded 2 classes x 2 clips = 4 clips max
# Then 4284 clips / 4 = ~1071 unique people minimum
# If each recorded only 1 class x 1 clip = 2142 people
print(f"\nEstimated unique people: {len(df) // clips_per.max()} to {len(df) // clips_per.min()}")

# How many sessions share classes?
class_sessions = df.groupby('class')['signer_id'].apply(list).to_dict()
shared = 0
for cls, sessions in class_sessions.items():
    if len(sessions) > 1:
        shared += len(sessions)
print(f"\nSessions appearing in multi-person classes: {shared}")
print(f"Classes with >1 session: {sum(1 for s in class_sessions.values() if len(s) > 1)}")
print(f"Classes with >5 sessions: {sum(1 for s in class_sessions.values() if len(s) > 5)}")

# Sessions grouped by MVI number range
mvi_nums = df['signer_id'].apply(lambda x: int(re.search(r'MVI_(\d+)', str(x)).group(1)) if re.search(r'MVI_(\d+)', str(x)) else 0)
df['_mvi_num'] = mvi_nums

bins = [(0,1000),(1000,2000),(2000,3000),(3000,4000),(4000,5000),(5000,6000),(6000,7000),(7000,8000),(8000,9000),(9000,10000)]
for lo, hi in bins:
    mask = (df['_mvi_num'] >= lo) & (df['_mvi_num'] < hi)
    n_sessions = df[mask]['signer_id'].nunique()
    n_clips = mask.sum()
    if n_sessions > 0:
        print(f"  MVI {lo:5d}-{hi:5d}: {n_sessions:4d} sessions, {n_clips:4d} clips")

# Cross-class analysis: same session across different classes?
multi_class = classes_per[classes_per >= 2]
print(f"\nSessions with 2+ classes: {len(multi_class)}")
for sess in multi_class.head(10).index:
    classes = df[df['signer_id'] == sess]['class'].unique()
    clips = len(df[df['signer_id'] == sess])
    mvi = re.search(r'MVI_(\d+)', sess).group(1) if re.search(r'MVI_(\d+)', sess) else '?'
    print(f"  {sess} (MVI_{mvi}): {clips} clips, classes: {list(classes)}")
