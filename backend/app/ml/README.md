# ML model artifacts

This folder holds the trained artifacts for MediAssist's two experimental,
offline ML classifiers. They are loaded **lazily** at prediction time, so a
missing artifact never breaks `import app.main`, the app, or the test suite —
the route tests run against a stub estimator.

## Layout

```
backend/app/ml/
  model_metadata.json                     # obesity classifiers contract (committed)
  obesity_all_features.joblib             # ~13 MB  (committed)
  obesity_lifestyle_only.joblib           # ~15 MB  (committed)
  diabetes/
    diabetes_metadata.json                # CDC diabetes contract (committed)
    cdc_diabetes_rf.joblib                # ~283 MB (NOT committed — see below)
```

The small `*_metadata.json` files are always committed: they define the feature
order, target labels, decision threshold, and version/limitations, so the model
**contract** lives in the repo even when the binary does not.

## Why the diabetes artifact is not in git

GitHub rejects any single file over **100 MB** on a normal push. The CDC
diabetes RandomForest (`diabetes/cdc_diabetes_rf.joblib`, ~283 MB) exceeds that
limit, so it is excluded via `.gitignore`
(`backend/app/ml/diabetes/cdc_diabetes_rf.joblib`). A fresh clone therefore
has everything needed to build and test the app; only the live
`POST /api/ml/diabetes/predict` endpoint needs the binary restored locally.

## Restoring `cdc_diabetes_rf.joblib`

The loader (`backend/app/services/diabetes_model.py`) expects the file at exactly
`backend/app/ml/diabetes/cdc_diabetes_rf.joblib`. Pick any of these:

1. **Copy from the original training machine** — drop the file into that path.

2. **Download from a release / model host** — publish the artifact as a GitHub
   Release asset (recommended; release assets are not subject to the 100 MB
   repo-file limit) or a Hugging Face / cloud bucket, then:

   ```powershell
   cd backend
   $env:DIABETES_MODEL_URL = "https://github.com/<owner>/<repo>/releases/download/<tag>/cdc_diabetes_rf.joblib"
   # optional integrity check:
   # $env:DIABETES_MODEL_SHA256 = "<lowercase hex sha256>"
   .\.venv\Scripts\python app\ml\fetch_model.py
   ```

3. **Git LFS** (if you want the binary versioned) — needs converting this file
   only and is subject to GitHub's free LFS storage/bandwidth quotas, so it is
   not the default here. Track `backend/app/ml/diabetes/*.joblib` in
   `.gitattributes` and reinstall the file via `git lfs pull`.

## Retraining

The artifact was trained on the UCI **CDC Diabetes Health Indicators** survey
(UCI dataset id 891, target `Diabetes_binary`) — see `diabetes/metadata` fields
(`dataset`, `features`, `random_state`, `test_size_fraction`). The 21 encoded
inputs are documented in `diabetes_metadata.json` and mirrored by the frontend
questionnaire. Predictions are an experimental survey-label estimate, **not** a
clinical diagnosis.

## scikit-learn version note

The two model families were pickled under different scikit-learn versions and
are version-coupled. `requirements.txt` pins `scikit-learn==1.6.1`, which has no
wheels for Python 3.13+. Run the ML suite / inference on a Python 3.12 (or 3.11)
venv — see the note in `backend/README.md` and the CI pin guard.
