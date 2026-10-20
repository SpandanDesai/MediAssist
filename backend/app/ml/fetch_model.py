r"""Restore the large CDC diabetes artifact out of band.

The ~283MB ``diabetes/cdc_diabetes_rf.joblib`` is intentionally NOT committed
(GitHub blocks files >100MB; see ``backend/app/ml/README.md``). This helper
downloads it from a release/model host into the exact path the loader in
``app/services/diabetes_model.py`` expects.

Usage (PowerShell)::

    cd backend
    $env:DIABETES_MODEL_URL = "https://.../cdc_diabetes_rf.joblib"
    $env:DIABETES_MODEL_SHA256 = "<optional lowercase hex sha256>"
    .\.venv\Scripts\python app\ml\fetch_model.py

The URL (and optional sha256) may also be passed as positional args:
``python fetch_model.py <url> [sha256]``. An existing file is left untouched
unless ``--force`` is given. Only the Python standard library is used so this
runs even before the ML dependencies are installed.
"""

from __future__ import annotations

import hashlib
import os
import sys
import tempfile
import urllib.request
from pathlib import Path

TARGET = Path(__file__).resolve().parent / "diabetes" / "cdc_diabetes_rf.joblib"
CHUNK = 1024 * 1024  # 1 MiB


def _resolve(args: list[str]) -> tuple[str | None, str | None, bool]:
    url = os.environ.get("DIABETES_MODEL_URL")
    digest = os.environ.get("DIABETES_MODEL_SHA256")
    force = "--force" in args
    positional = [a for a in args if not a.startswith("--")]
    if positional:
        url = positional[0] or url
    if len(positional) > 1:
        digest = positional[1] or digest
    return url, digest, force


def main(argv: list[str]) -> int:
    args = argv[1:]
    url, digest, force = _resolve(args)

    if not url:
        print("error: set DIABETES_MODEL_URL (or pass the URL as the first argument).", file=sys.stderr)
        print("       See backend/app/ml/README.md for restore options.", file=sys.stderr)
        return 2

    if TARGET.exists() and not force:
        print(f"already present: {TARGET} ({TARGET.stat().st_size / 1024 / 1024:.1f} MB)")
        print("re-run with --force to overwrite.")
        return 0

    TARGET.parent.mkdir(parents=True, exist_ok=True)
    hasher = hashlib.sha256() if digest else None
    tmp_path: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(dir=TARGET.parent, suffix=".part", delete=False) as tmp:
            tmp_path = Path(tmp.name)
            downloaded = 0
            with urllib.request.urlopen(url) as response, tmp as handle:  # noqa: S310 (trusted operator URL)
                total = int(response.headers.get("Content-Length", 0) or 0)
                while True:
                    chunk = response.read(CHUNK)
                    if not chunk:
                        break
                    handle.write(chunk)
                    if hasher:
                        hasher.update(chunk)
                    downloaded += len(chunk)
                    if total:
                        pct = downloaded * 100 // total
                        print(f"\r  {downloaded / 1024 / 1024:.0f}/{total / 1024 / 1024:.0f} MB ({pct}%)", end="", flush=True)
        print()
    except Exception as error:  # noqa: BLE001 - surface any network/IO failure plainly
        print(f"\nerror: download failed: {error}", file=sys.stderr)
        if tmp_path and tmp_path.exists():
            tmp_path.unlink(missing_ok=True)
        return 1

    if digest:
        actual = hasher.hexdigest()
        if actual.lower() != digest.lower():
            print(f"error: sha256 mismatch (expected {digest}, got {actual}). Discarding.", file=sys.stderr)
            tmp_path.unlink(missing_ok=True)
            return 1
        print("sha256 verified.")

    os.replace(tmp_path, TARGET)
    print(f"model ready: {TARGET} ({TARGET.stat().st_size / 1024 / 1024:.1f} MB)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
