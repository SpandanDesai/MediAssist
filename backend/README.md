# MediAssist AI backend

The API is a FastAPI service for the MediAssist frontend. It can be run without
external services for local UI development: an in-memory data store and a
safety-first educational response engine are used when MongoDB or a Gemini API
key are not configured. Configure both services for persistent, model-powered use.

## Run locally

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
uvicorn app.main:app --reload --port 8000
```

OpenAPI documentation is available at `http://localhost:8000/docs`; a health
check is available at `GET /api/health`.

## Configuration

`MONGODB_URI` and `GEMINI_API_KEY` are optional for local development. When
MongoDB is unreachable, startup continues using volatile in-memory storage and
the health endpoint reports `storage: memory`. Set a unique `SECRET_KEY` and a
restricted comma-separated `FRONTEND_ORIGINS` list before deployment.

## Main API contract

- `POST /api/auth/signup` and `POST /api/auth/login` return
  `{access_token, token_type, user}`. Legacy aliases `/api/signup` and
  `/api/login` are also provided.
- `POST /api/chat` accepts `{message, conversation_id?, context?}` and returns
  an educational response, conditions with non-diagnostic confidence estimates,
  urgency, recommendations, follow-up questions, emergency state, and a
  disclaimer.
- `POST /api/voice` accepts multipart `audio` and optional `conversation_id`.
  It returns the transcript plus the same consultation result. TTS audio is
  base64 encoded only when Gemini TTS is configured.
- `POST /api/image` accepts multipart `image` and optional `notes`; it returns
  a cautious visible-observation analysis and the mandatory disclaimer.
- Authenticated endpoints: `GET/PUT /api/profile`, `GET/DELETE /api/history`,
  `POST/GET /api/reports`, and `GET /api/reports/{id}/download`.
- `GET /api/hospitals?lat=<latitude>&lng=<longitude>&radius=<metres>` returns
  nearby OSM hospitals/clinics/emergency facilities and distances.

Every consultation response is informational only. The API routes deterministic
emergency language into an immediate emergency response before model processing.
