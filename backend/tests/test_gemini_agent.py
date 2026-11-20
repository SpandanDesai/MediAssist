from __future__ import annotations

from types import SimpleNamespace

import pytest

from app.services import gemini_agent
from app.services.gemini_agent import GeminiMedicalAgent


@pytest.mark.anyio
async def test_model_discovery_prioritizes_current_flash_models(monkeypatch):
    models = [
        {
            "name": f"models/{model_id}",
            "supportedGenerationMethods": ["generateContent"],
        }
        for model_id in (
            "gemini-2.5-flash",
            "gemini-flash-latest",
            "gemini-3.5-flash-lite",
            "gemini-3.8-flash",
        )
    ]

    class FakeClient:
        def __init__(self, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            pass

        async def get(self, *args, **kwargs):
            return SimpleNamespace(
                raise_for_status=lambda: None,
                json=lambda: {"models": models},
            )

    monkeypatch.setattr(gemini_agent.httpx, "AsyncClient", FakeClient)
    agent = GeminiMedicalAgent(api_key="test-key")

    await agent._discover_models()

    assert agent.available_models == [
        "models/gemini-3.8-flash",
        "models/gemini-3.5-flash-lite",
    ]


@pytest.mark.anyio
async def test_429_retries_use_exponential_backoff_with_jitter(monkeypatch):
    monkeypatch.setattr(gemini_agent.get_settings(), "gemini_max_retries", 3)
    monkeypatch.setattr(gemini_agent.random, "uniform", lambda start, end: 0.5)
    delays = []
    statuses = iter((429, 429, 429, 200))

    async def fake_sleep(delay):
        delays.append(delay)

    class FakeClient:
        def __init__(self, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            pass

        async def post(self, *args, **kwargs):
            status_code = next(statuses)
            return SimpleNamespace(
                status_code=status_code,
                is_success=status_code == 200,
                json=lambda: {},
            )

    monkeypatch.setattr(gemini_agent.asyncio, "sleep", fake_sleep)
    monkeypatch.setattr(gemini_agent.httpx, "AsyncClient", FakeClient)
    agent = GeminiMedicalAgent(api_key="test-key")
    monkeypatch.setattr(agent, "_parse_response", lambda data: {"response": "ok"})

    result = await agent._try_generate("https://example.test/generate", [])

    assert result == {"response": "ok"}
    assert delays == [2.5, 4.5, 8.5]
