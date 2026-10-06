from pathlib import Path
ROOT = Path(r"c:\Users\Spandan\Documents\GitHub\MediAssist")

# Fix escaped newlines in chat.py
chat = ROOT / "backend/app/routes/chat.py"
text = chat.read_text(encoding="utf-8")
text = text.replace('"\\n\\n".join(ctx_parts)', '"\n\n".join(ctx_parts)')
chat.write_text(text, encoding="utf-8")
print("fixed chat newlines:", '"\\n\\n".join' not in chat.read_text(encoding="utf-8"))

# Add assessments index
db = ROOT / "backend/app/db/database.py"
dbtext = db.read_text(encoding="utf-8")
needle = 'await self.database.reports.create_index([("user_id", 1), ("created_at", -1)])'
insert = needle + '\n        await self.database.assessments.create_index([("user_id", 1), ("created_at", -1)])'
if "assessments.create_index" not in dbtext:
    if needle not in dbtext:
        raise SystemExit("index needle missing")
    db.write_text(dbtext.replace(needle, insert), encoding="utf-8")
    print("OK assessments index")
else:
    print("index already present")

# Gemini systemInstruction
gemini = ROOT / "backend/app/services/gemini_agent.py"
gtext = gemini.read_text(encoding="utf-8")
old_contents = '''        contents: list[dict[str, Any]] = [
            {"role": "user", "parts": [{"text": f"SYSTEM: {system_text}"}]},
        ]

        for item in history or []:
            role = item.get("role")
            content = item.get("content")
            if not content:
                continue
            if role == "user":
                contents.append({"role": "user", "parts": [{"text": content}]})
            elif role == "assistant":
                contents.append({"role": "model", "parts": [{"text": content}]})

        parts: list[dict[str, Any]] = [{"text": user_text}]
        if image_bytes and image_mime:
            parts.append(
                {
                    "inline_data": {
                        "mime_type": image_mime,
                        "data": base64.b64encode(image_bytes).decode("ascii"),
                    }
                }
            )
        if audio_bytes and audio_mime:
            parts.append(
                {
                    "inline_data": {
                        "mime_type": audio_mime,
                        "data": base64.b64encode(audio_bytes).decode("ascii"),
                    }
                }
            )
        contents.append({"role": "user", "parts": parts})

        last_error: Exception | None = None
        for model_name in self.available_models:
            url = f"{GEMINI_BASE}/{model_name}:generateContent"
            try:
                return await self._try_generate(url, contents)
            except Exception as exc:
                logger.warning("Gemini model %s failed: %s", model_name, exc)
                last_error = exc

        raise RuntimeError(f"All Gemini models failed. Last error: {last_error}")

    async def _try_generate(self, url: str, contents: list[dict[str, Any]]) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "contents": contents,
            "generationConfig": {"response_mime_type": "application/json"},
        }'''

new_contents = '''        contents: list[dict[str, Any]] = []

        for item in history or []:
            role = item.get("role")
            content = item.get("content")
            if not content:
                continue
            if role == "user":
                contents.append({"role": "user", "parts": [{"text": content}]})
            elif role == "assistant":
                contents.append({"role": "model", "parts": [{"text": content}]})

        parts: list[dict[str, Any]] = [{"text": user_text}]
        if image_bytes and image_mime:
            parts.append(
                {
                    "inline_data": {
                        "mime_type": image_mime,
                        "data": base64.b64encode(image_bytes).decode("ascii"),
                    }
                }
            )
        if audio_bytes and audio_mime:
            parts.append(
                {
                    "inline_data": {
                        "mime_type": audio_mime,
                        "data": base64.b64encode(audio_bytes).decode("ascii"),
                    }
                }
            )
        contents.append({"role": "user", "parts": parts})

        last_error: Exception | None = None
        for model_name in self.available_models:
            url = f"{GEMINI_BASE}/{model_name}:generateContent"
            try:
                return await self._try_generate(url, contents, system_text=system_text)
            except Exception as exc:
                logger.warning("Gemini model %s failed: %s", model_name, exc)
                last_error = exc

        raise RuntimeError(f"All Gemini models failed. Last error: {last_error}")

    async def _try_generate(
        self,
        url: str,
        contents: list[dict[str, Any]],
        *,
        system_text: str | None = None,
    ) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "contents": contents,
            "generationConfig": {"response_mime_type": "application/json"},
        }
        if system_text:
            payload["systemInstruction"] = {"parts": [{"text": system_text}]}'''

if old_contents not in gtext:
    raise SystemExit("gemini generate block not found")
gemini.write_text(gtext.replace(old_contents, new_contents), encoding="utf-8")
print("OK gemini systemInstruction")

# Fix rules_engine docstring (OpenAI -> Gemini)
rules = ROOT / "backend/app/services/rules_engine.py"
rtext = rules.read_text(encoding="utf-8")
rtext2 = rtext.replace(
    "Safety-first educational response engine used when OpenAI is unavailable.",
    "Safety-first educational response engine used when Gemini is unavailable.",
)
# Add chat_prompts to assess_lifestyle return - actually assessment route adds them
rules.write_text(rtext2, encoding="utf-8")
print("OK rules docstring")
