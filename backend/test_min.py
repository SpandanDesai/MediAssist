from fastapi import FastAPI`napp = FastAPI()`n@app.get("/")`ndef r(): return {"ok": True}
