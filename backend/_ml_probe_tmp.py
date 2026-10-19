import json
import zipfile
import joblib
import pandas as pd

ZIP = r"C:\Users\Spandan\Documents\GitHub\MediAssist\mediassist_ml_artifacts.zip"
OUT = r"c:\Users\Spandan\Documents\GitHub\MediAssist\backend\_ml_probe_tmp"

import os
os.makedirs(OUT, exist_ok=True)
z = zipfile.ZipFile(ZIP)
paths = {}
for name in ["obesity_lifestyle_only.joblib", "obesity_all_features.joblib"]:
    p = os.path.join(OUT, name)
    with open(p, "wb") as fh:
        fh.write(z.read("artifacts/" + name))
    paths[name] = p

import sklearn
print("sklearn", sklearn.__version__)
print("pandas", pd.__version__)

for name, p in paths.items():
    print("=" * 30, name)
    m = joblib.load(p)
    print("type:", type(m).__mro__[:3])
    if hasattr(m, "steps"):
        print("steps:", [(s, type(o).__name__) for s, o in m.steps])
        ct = dict(m.steps).get("prep") or dict(m.steps).get("preprocessor")
        for step_name, step_obj in m.steps:
            tname = type(step_obj).__name__
            if tname == "ColumnTransformer":
                try:
                    print("ct.feature_names_in_:", list(step_obj.feature_names_in_))
                except Exception as e:
                    print("ct names err", e)
                print("ct transformers:", [(t[0], type(t[1]).__name__, t[2]) for t in step_obj.transformers])
                break
    print("feature_names_in_:", list(getattr(m, "feature_names_in_", ["<none>"])))
    print("n_classes_:", getattr(m, "n_classes_", None))
    print("classes_:", list(getattr(m, "classes_", [])))
    print("has predict_proba:", hasattr(m, "predict_proba"))

# Try a real prediction with the 14 lifestyle cols to confirm the exact accepted schema
sample_lifestyle = {
    "Gender": "Female", "Age": 21.0, "family_history_with_overweight": "yes",
    "FAVC": "no", "FCVC": 2.0, "NCP": 3.0, "CAEC": "Sometimes", "SMOKE": "no",
    "CH2O": 2.0, "SCC": "no", "FAF": 2.0, "TUE": 1.0, "CALC": "Sometimes",
    "MTRANS": "Public_Transportation",
}
m = joblib.load(paths["obesity_lifestyle_only.joblib"])
df = pd.DataFrame([sample_lifestyle])
print("LIFESTYLE predict:", m.predict(df)[0])
print("LIFESTYLE proba ok:", m.predict_proba(df).shape)
try:
    df2 = pd.DataFrame([{**sample_lifestyle, "Height": 1.7, "Weight": 70.0}])
    print("with extra cols predict:", m.predict(df2)[0])
except Exception as e:
    print("extra-col ERROR:", type(e).__name__, str(e)[:200])
