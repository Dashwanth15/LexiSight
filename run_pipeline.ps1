$env:PYTHONIOENCODING = "utf-8"

Write-Host ""
Write-Host "╔══════════════════════════════════════════════╗"
Write-Host "║   LexiSight ML Pipeline                     ║"
Write-Host "╚══════════════════════════════════════════════╝"
Write-Host ""

$action = $args[0]

switch ($action) {
    "data" {
        Write-Host "-> Step 1: Extracting landmarks from image datasets..."
        python ml\scripts\process_dataset.py
        if ($LASTEXITCODE -ne 0) { Write-Host "[X] process_dataset.py failed!"; exit $LASTEXITCODE }
        
        Write-Host "-> Step 2: Extracting landmarks from video datasets..."
        python ml\scripts\process_videos.py
        if ($LASTEXITCODE -ne 0) { Write-Host "[X] process_videos.py failed!"; exit $LASTEXITCODE }
    }
    "train" {
        Write-Host "-> Training model..."
        python ml\scripts\train_model.py
        if ($LASTEXITCODE -ne 0) { Write-Host "[X] train_model.py failed!"; exit $LASTEXITCODE }
    }
    "train-temporal" {
        Write-Host "-> Training temporal model..."
        python ml\scripts\train_temporal.py
        if ($LASTEXITCODE -ne 0) { Write-Host "[X] train_temporal.py failed!"; exit $LASTEXITCODE }
    }
    "eval" {
        Write-Host "-> Evaluating on wild test set..."
        python ml\scripts\eval_wild.py
        if ($LASTEXITCODE -ne 0) { Write-Host "[X] eval_wild.py failed!"; exit $LASTEXITCODE }
    }
    "export" {
        Write-Host "-> Exporting to TFJS..."
        python ml\scripts\export_tfjs.py
        if ($LASTEXITCODE -ne 0) { Write-Host "[X] export_tfjs.py failed!"; exit $LASTEXITCODE }
    }
    "extract-include" {
        Write-Host "-> Extracting INCLUDE dataset..."
        python ml\scripts\extract_include.py
        if ($LASTEXITCODE -ne 0) { Write-Host "[X] extract_include.py failed!"; exit $LASTEXITCODE }
    }
    "extract-cislr" {
        Write-Host "-> Extracting CISLR dataset..."
        python ml\scripts\extract_cislr.py
        if ($LASTEXITCODE -ne 0) { Write-Host "[X] extract_cislr.py failed!"; exit $LASTEXITCODE }
    }
    "manifest" {
        Write-Host "-> Building unified manifest..."
        python ml\scripts\build_manifest.py
        if ($LASTEXITCODE -ne 0) { Write-Host "[X] build_manifest.py failed!"; exit $LASTEXITCODE }
    }
    "all" {
        Write-Host "-> Running full pipeline: data -> train -> eval -> export"
        Write-Host ""
        
        Write-Host "Step 1/4: Extracting landmarks..."
        python ml\scripts\process_dataset.py
        if ($LASTEXITCODE -ne 0) { Write-Host "[X] process_dataset.py failed!"; exit $LASTEXITCODE }
        
        Write-Host "Step 2/4: Training model..."
        python ml\scripts\train_model.py
        if ($LASTEXITCODE -ne 0) { Write-Host "[X] train_model.py failed!"; exit $LASTEXITCODE }
        
        Write-Host "Step 3/4: Evaluating..."
        python ml\scripts\eval_wild.py
        if ($LASTEXITCODE -ne 0) { Write-Host "[!] eval_wild.py failed (no wild test data?)"; }
        
        Write-Host "Step 4/4: Exporting TFJS..."
        python ml\scripts\export_tfjs.py
        if ($LASTEXITCODE -ne 0) { Write-Host "[X] export_tfjs.py failed!"; exit $LASTEXITCODE }
        
        Write-Host ""
        Write-Host "[OK] Full pipeline complete! Model deployed to public/model/tfjs_model/"
        Write-Host "  Refresh your browser to use the new model."
    }
    default {
        Write-Host "Usage: .\run_pipeline.ps1 <command>"
        Write-Host ""
        Write-Host "Commands:"
        Write-Host "  data              Extract landmarks from all datasets"
        Write-Host "  train             Train Dense ResNet (v0, baseline)"
        Write-Host "  train-temporal    Train Temporal Transformer (v1)"
        Write-Host "  eval              Evaluate on wild test set"
        Write-Host "  export            Export best model to TFJS"
        Write-Host "  extract-include   Extract INCLUDE dataset"
        Write-Host "  extract-cislr     Extract CISLR dataset"
        Write-Host "  manifest          Build unified data manifest"
        Write-Host "  all               Run full pipeline (data -> train -> eval -> export)"
    }
}
