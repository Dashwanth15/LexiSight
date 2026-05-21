import os
import glob
import csv
import json
import re
from collections import defaultdict

DATASET_ROOTS = {
    "Daily": r"c:\Users\Navat\OneDrive\Desktop\Lexisight\New Datasets\ISL_Daily_Words",
    "Emergency": r"c:\Users\Navat\OneDrive\Desktop\Lexisight\New Datasets\ISL_Emergency_Situations\A Video Dataset of the Hand Gestures of Indian Sign Language Words used in Emergency Situations",
    "INCLUDE": r"c:\Users\Navat\OneDrive\Desktop\Lexisight\Datasets\INCLUDE_FULL DATASET",
    "CISLR": r"c:\Users\Navat\OneDrive\Desktop\Lexisight\Datasets\CISLR DATASET"
}

def clean_class_name(name):
    # Remove _Cropped or _Raw from Emergency dataset
    name = re.sub(r'_(Cropped|Raw)', '', name, flags=re.IGNORECASE)
    # Remove leading numbers and dots from INCLUDE (e.g., '1. Dog' -> 'Dog')
    name = re.sub(r'^\d+\.\s*', '', name)
    # Remove numbers, underscores, dashes
    name = re.sub(r'[\d_,\-]', ' ', name).lower().strip()
    return re.sub(r'\s+', ' ', name)

def get_signer_from_filename(filename):
    # Some datasets have P1, signer2, S01 in filename
    match = re.search(r'(signer|person|p|s|m|f)[\s_-]*(\d+)', filename, re.IGNORECASE)
    if match:
        return match.group(1).lower() + match.group(2)
    return filename  # fallback to the filename itself

def analyze_cislr():
    cislr_csv_path = r"c:\Users\Navat\OneDrive\Desktop\Lexisight\Datasets\CISLR DATASET copy"
    csv_path = os.path.join(cislr_csv_path, "dataset.csv")
    video_dir = r"c:\Users\Navat\OneDrive\Desktop\Lexisight\Datasets\CISLR DATASET copy\CISLR_v1.5-a_videos\CISLR_v1.5-a_videos"
    
    classes = defaultdict(list)
    
    if not os.path.exists(csv_path):
        print(f"CISLR CSV not found at {csv_path}")
        return classes
        
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            gloss = clean_class_name(row.get('gloss', ''))
            uid = row.get('uid', '')
            if gloss and uid:
                video_file = os.path.join(video_dir, f"{uid}.mp4")
                if os.path.exists(video_file):
                    classes[gloss].append(video_file)
    return classes

def analyze_include():
    include_path = DATASET_ROOTS["INCLUDE"]
    classes = defaultdict(list)
    
    if not os.path.exists(include_path):
        return classes
        
    # INCLUDE has structure like: Category/Word/MVI_1234.mp4
    for cat in os.listdir(include_path):
        cat_path = os.path.join(include_path, cat)
        if os.path.isdir(cat_path):
            for word in os.listdir(cat_path):
                word_path = os.path.join(cat_path, word)
                if os.path.isdir(word_path):
                    videos = glob.glob(os.path.join(word_path, "*.*"))
                    videos = [v for v in videos if v.lower().endswith(('.mp4', '.avi', '.mov'))]
                    
                    clean_word = clean_class_name(word)
                    classes[clean_word].extend(videos)
    return classes

def analyze_standard_dir(ds_path):
    classes = defaultdict(list)
    if not os.path.exists(ds_path):
        return classes
        
    for root, dirs, files in os.walk(ds_path):
        videos = [os.path.join(root, f) for f in files if f.lower().endswith(('.mp4', '.avi', '.mov'))]
        if videos:
            class_name = os.path.basename(root)
            # If the leaf dir is 'Sample Videos' or 'Video_Dataset', we should take the parent dir name
            if class_name.lower() in ["sample videos", "video_dataset", "raw_data", "cropped_data"]:
                class_name = os.path.basename(os.path.dirname(root))
            
            clean_word = clean_class_name(class_name)
            classes[clean_word].extend(videos)
    return classes

def run_audit():
    print("=" * 60)
    print("1. Parsing Datasets & Building Signer Metrics")
    print("=" * 60)
    
    datasets = {
        "Daily": analyze_standard_dir(DATASET_ROOTS["Daily"]),
        "Emergency": analyze_standard_dir(DATASET_ROOTS["Emergency"]),
        "INCLUDE": analyze_include(),
        "CISLR": analyze_cislr()
    }
    
    # Signer metrics
    for ds_name, cls_dict in datasets.items():
        total_videos = sum(len(v) for v in cls_dict.values())
        print(f"[{ds_name}] Classes: {len(cls_dict)} | Total Videos: {total_videos}")
        
        signer_counts = []
        for cls_name, videos in cls_dict.items():
            signers = set(get_signer_from_filename(os.path.basename(v)) for v in videos)
            signer_counts.append(len(signers))
            
        if signer_counts:
            avg_signers = sum(signer_counts) / len(signer_counts)
            max_signers = max(signer_counts)
            print(f"  └─ Avg Signers/Class: {avg_signers:.1f} | Max Signers/Class: {max_signers}")
            
    print("\n" + "=" * 60)
    print("2. Building Merge Map & Identifying True Production Classes")
    print("=" * 60)
    
    merge_map = defaultdict(lambda: defaultdict(int))
    for ds_name, cls_dict in datasets.items():
        for cls_name, videos in cls_dict.items():
            if videos:
                merge_map[cls_name][ds_name] = len(videos)
                
    # Calculate total signers per concept (assuming filenames represent unique signers roughly)
    # To be extremely accurate we'd hash files, but we'll use total merged videos as proxy for coverage depth
    production_ready = []
    acceptable = []
    at_risk = []
    
    for cls_name, counts in merge_map.items():
        total_vids = sum(counts.values())
        if total_vids >= 60 or len(counts) >= 2: # High depth OR crosses multiple datasets
            production_ready.append((cls_name, total_vids, counts))
        elif total_vids >= 10:
            acceptable.append((cls_name, total_vids, counts))
        else:
            at_risk.append((cls_name, total_vids, counts))
            
    production_ready.sort(key=lambda x: x[1], reverse=True)
    
    print(f"Production-Ready Classes (>60 vids or cross-dataset): {len(production_ready)}")
    print(f"Acceptable Classes (10-59 vids): {len(acceptable)}")
    print(f"At-Risk Classes (<10 vids, single dataset): {len(at_risk)}")
    
    print("\nTop 10 Production-Ready Classes:")
    for cls, total, breakdown in production_ready[:10]:
        details = ", ".join(f"{k}: {v}" for k,v in breakdown.items())
        print(f"  - '{cls}': {total} videos [{details}]")
        
    print("\n" + "=" * 60)
    print("3. Filtering CISLR Noise")
    print("=" * 60)
    
    cislr_total = len(datasets["CISLR"])
    cislr_useful = {cls: counts["CISLR"] for cls, counts in merge_map.items() 
                    if "CISLR" in counts and counts["CISLR"] >= 3 and len(counts) > 1}
                    
    print(f"Original CISLR Classes: {cislr_total}")
    print(f"Useful CISLR Classes (Overlap + >=3 vids): {len(cislr_useful)}")
    
    with open(r"c:\Users\Navat\OneDrive\Desktop\Lexisight\scripts\dataset_merge_map.json", "w") as f:
        json.dump(merge_map, f, indent=2)
        
if __name__ == "__main__":
    run_audit()
