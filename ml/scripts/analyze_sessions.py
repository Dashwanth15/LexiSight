#!/usr/bin/env python3
import pandas as pd
from pathlib import Path
import re

df = pd.read_csv('ml/data_processed/manifest_holistic_include.csv')
print(f'Total clips: {len(df)}')
print(f'Unique sessions (MVI IDs): {df["signer_id"].nunique()}')
print(f'Unique classes: {df["class"].nunique()}')
print()

per_class = df.groupby('class')['signer_id'].nunique()
print(f'Sessions per class: min={per_class.min()}, max={per_class.max()}, median={per_class.median():.1f}')

per_session = df.groupby('signer_id')['class'].nunique()
print(f'Classes per session: min={per_session.min()}, max={per_session.max()}, median={per_session.median():.1f}')

clips_per = df.groupby('signer_id').size()
print(f'Clips per session: min={clips_per.min()}, max={clips_per.max()}, median={clips_per.median():.1f}')

mvi_nums = df['signer_id'].apply(lambda x: int(re.search(r'MVI_(\d+)', x).group(1)) if re.search(r'MVI_(\d+)', x) else 0)
print(f'MVI number range: {mvi_nums.min()} to {mvi_nums.max()}')

mvi_ranges = pd.cut(mvi_nums, bins=10).value_counts().sort_index()
print('MVI number distribution (10 bins):')
for r, c in mvi_ranges.items():
    print(f'  {r}: {c} sessions')

broad = per_session[per_session >= 10]
print(f'Sessions with 10+ classes: {len(broad)} out of {len(per_session)}')

one_clip = clips_per[clips_per == 1]
print(f'Sessions with only 1 clip: {len(one_clip)} out of {len(clips_per)}')

sessions_with_5plus = clips_per[clips_per >= 5]
print(f'Sessions with 5+ clips: {len(sessions_with_5plus)}')

single_class = per_session[per_session == 1]
print(f'Sessions recording only 1 class: {len(single_class)}')

print()
print('Sample sessions with high clip count:')
top_sessions = clips_per.sort_values(ascending=False).head(10)
for sess, count in top_sessions.items():
    classes = df[df['signer_id'] == sess]['class'].unique()
    print(f'  {sess}: {count} clips, classes: {list(classes)[:5]}')
