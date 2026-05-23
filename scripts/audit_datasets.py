import os
import glob
import json
from collections import defaultdict
import re

DATASET_ROOTS = {
    "Daily": r"c:\Users\Navat\OneDrive\Desktop\Lexisight\New Datasets\ISL_Daily_Words",
    "Emergency": r"c:\Users\Navat\OneDrive\Desktop\Lexisight\New Datasets\ISL_Emergency_Situations\A Video Dataset of the Hand Gestures of Indian Sign Language Words used in Emergency Situations",
    "INCLUDE": r"c:\Users\Navat\OneDrive\Desktop\Lexisight\Datasets\INCLUDE_FULL DATASET",
    "CISLR": r"c:\Users\Navat\OneDrive\Desktop\Lexisight\Datasets\CISLR DATASET"
}

def clean_class_name(name):
    # Remove numbers, underscores, dashes, make lowercase
    name = re.sub(r'[\d_,\-]', ' ', name).lower().strip()
    name = re.sub(r'\s+', ' ', name)
    return name

def analyze_datasets():
    datasets = defaultdict(lambda: defaultdict(list))
    
    for ds_name, ds_path in DATASET_ROOTS.items():
        if not os.path.exists(ds_path):
            print(f"Warning: Path not found: {ds_path}")
            continue
            
        # Recursively walk to find directories that contain video files
        for root, dirs, files in os.walk(ds_path):
            videos = [f for f in files if f.lower().endswith(('.mp4', '.avi', '.mov', '.mkv', '.webm'))]
            if videos:
                # The name of the directory containing the videos is the class name
                class_name = os.path.basename(root)
                
                # Special cases where the parent directory is actually the class name (e.g. separated by signer folders)
                # But typically for these datasets, the leaf directory is the word.
                clean_name = clean_class_name(class_name)
                
                # If there are subdirectories like 'signer1', 'signer2' inside a word, we might need parent
                # For now, let's assume standard structure or at least print what we find.
                
                full_video_paths = [os.path.join(root, v) for v in videos]
                datasets[ds_name][clean_name].extend(full_video_paths)
                
    return datasets

def extract_signers(videos):
    signers = set()
    for v in videos:
        basename = os.path.basename(v).lower()
        # Look for common signer patterns: s1, signer1, p1, person1, S001, M01
        match = re.search(r'(signer|person|p|s|m|f)[\s_-]*(\d+)', basename)
        if match:
            signers.add(match.group(1) + match.group(2))
        else:
            # If no explicit signer pattern, hash the filename structure or size
            signers.add("unknown_" + basename)
    
    actual_signers = [s for s in signers if not s.startswith("unknown_")]
    if actual_signers:
        return len(actual_signers)
    return len(signers)

def build_merge_map_and_audit():
    datasets = analyze_datasets()
    
    print("=" * 60)
    print("1. ISL_Daily_Words Signer Audit")
    print("=" * 60)
    daily_classes = datasets.get("Daily", {})
    total_daily_videos = sum(len(v) for v in daily_classes.values())
    print(f"Found {len(daily_classes)} classes, {total_daily_videos} total videos.")
    
    # Analyze all daily classes
    signer_counts = []
    for cls_name, videos in daily_classes.items():
        signer_count = extract_signers(videos)
        signer_counts.append(signer_count)
    
    avg_signers = sum(signer_counts) / max(1, len(signer_counts))
    print(f"Average unique signers per class in ISL_Daily_Words: ~{avg_signers:.1f}")
    
    print("\nSample Classes:")
    for cls_name, videos in list(daily_classes.items())[:5]:
        signer_count = extract_signers(videos)
        print(f"  - {cls_name}: {len(videos)} videos, estimated ~{signer_count} unique signers")
    
    print("\n" + "=" * 60)
    print("2. Merged Vocabulary Map (Overlap Analysis)")
    print("=" * 60)
    
    merge_map = defaultdict(lambda: defaultdict(int))
    all_classes = set()
    
    for ds_name, cls_dict in datasets.items():
        for cls_name, videos in cls_dict.items():
            if len(videos) > 0:
                merge_map[cls_name][ds_name] += len(videos)
                all_classes.add(cls_name)
                
    overlapping = {cls: counts for cls, counts in merge_map.items() if len(counts) > 1}
    print(f"Found {len(overlapping)} classes that overlap across multiple datasets.\n")
    
    # Sort by total videos
    sorted_overlap = sorted(overlapping.items(), key=lambda x: sum(x[1].values()), reverse=True)
    for cls_name, counts in sorted_overlap[:10]:
        breakdown = ", ".join([f"{k}: {v} vids" for k,v in counts.items()])
        print(f"  - '{cls_name}' -> {breakdown} (Total: {sum(counts.values())})")
    
    print("\n" + "=" * 60)
    print("3. CISLR Filtered Sub-Dataset")
    print("=" * 60)
    
    cislr_useful = {}
    for cls_name, counts in merge_map.items():
        if "CISLR" in counts:
            cislr_vids = counts["CISLR"]
            other_vids = sum(v for k,v in counts.items() if k != "CISLR")
            if cislr_vids >= 3 and other_vids > 0:
                cislr_useful[cls_name] = cislr_vids
                
    total_cislr_classes = len(datasets.get('CISLR', {}))
    print(f"Original CISLR Classes: {total_cislr_classes}")
    print(f"Useful CISLR Classes (Overlap + >=3 vids): {len(cislr_useful)}")
    if cislr_useful:
        print(f"Top useful CISLR classes:")
        for cls, count in sorted(cislr_useful.items(), key=lambda x: x[1], reverse=True)[:5]:
            print(f"  - {cls}: {count} videos")
        
    output_path = r"c:\Users\Navat\OneDrive\Desktop\Lexisight\scripts\dataset_merge_map.json"
    with open(output_path, "w") as f:
        json.dump(merge_map, f, indent=2)
        
    print(f"\nMerge map saved to {output_path}")

if __name__ == "__main__":
    build_merge_map_and_audit()
