$env:PYTHONIOENCODING="utf-8"
Write-Host "LexiSight AI Training Pipeline Started!"
Write-Host "====================================="
Write-Host "Step 1: Extracting Hand Landmarks from Datasets (This takes ~5-15 mins)..."
python scripts\process_dataset.py

if ($LASTEXITCODE -ne 0) {
    Write-Host "Error in process_dataset.py!"
    exit $LASTEXITCODE
}

Write-Host "Step 2: Training TensorFlow Neural Network..."
python scripts\train_model.py

if ($LASTEXITCODE -ne 0) {
    Write-Host "Error in train_model.py!"
    exit $LASTEXITCODE
}

Write-Host "====================================="
Write-Host "Training Complete! Model deployed to public/model/tfjs_model/"
Write-Host "Please refresh your browser. The app will now automatically use the trained AI instead of GEO_FALLBACK."
