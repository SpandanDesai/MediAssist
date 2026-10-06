from pathlib import Path
import re
p = Path(r"c:\Users\Spandan\Documents\GitHub\MediAssist\backend\app\routes\chat.py")
text = p.read_text(encoding="utf-8")
fixed = re.sub(
    r"merged_context = .*? if ctx_parts else None",
    "merged_context = chr(10).join(ctx_parts) if ctx_parts else None",
    text,
    count=1,
    flags=re.S,
)
p.write_text(fixed, encoding="utf-8")
compile(p.read_text(encoding="utf-8"), str(p), "exec")
print("chat.py compiles OK")
for line in p.read_text(encoding="utf-8").splitlines():
    if "merged" in line or "ctx_parts" in line:
        print(repr(line))
