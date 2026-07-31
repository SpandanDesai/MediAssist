# MediAssist AI

MediAssist AI is a multimodal healthcare-information assistant built with a React/Vite frontend and a FastAPI backend. It supports text consultations, voice and image workflows, health history, nearby-care discovery, and downloadable reports.

> **Safety notice:** MediAssist provides educational information only. It must not diagnose, replace a clinician, or delay emergency care. Emergency signals must receive an immediate emergency-care recommendation.

## Architecture

```text
frontend/   React + TypeScript + Vite + Tailwind (browser UI)
    | HTTP / multipart uploads, JWT bearer token
backend/    FastAPI + Pydantic (auth, AI orchestration, reports, hospitals)
    | MongoDB driver
MongoDB     Users, conversations, uploaded-image metadata, reports
```

The frontend reads its API origin from `VITE_API_BASE_URL` (default: `http://localhost:8000`). The backend exposes routes below `/api` and enables CORS for the configured frontend origins.

## Prerequisites

- Node.js 20 or newer
- Python 3.11 or newer
- MongoDB Atlas connection string, or local MongoDB 7
- An OpenAI API key for production AI, speech, and vision features

## Local development

Create local environment files from the component examples:

```powershell
Copy-Item frontend\.env.example frontend\.env
Copy-Item backend\.env.example backend\.env
```

The backend `.env` should set `MONGODB_URI`, `MONGODB_DATABASE`, `OPENAI_API_KEY`, `SECRET_KEY`, and `FRONTEND_ORIGINS`. Keep `SECRET_KEY` long and random, and never commit either `.env` file. In development, the backend can fall back to an in-memory data store when MongoDB is unavailable and to a safety-first rules engine when OpenAI is not configured; use real services before production deployment.

Start MongoDB locally or point the backend at MongoDB Atlas, then open two terminals.

```powershell
# Terminal 1: FastAPI
Set-Location backend
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

```powershell
# Terminal 2: React/Vite
Set-Location frontend
npm install
npm run dev
```

Visit `http://localhost:5173` after both services are running.

## Docker development

The included Compose setup starts MongoDB, the FastAPI service, and a production-style static frontend.

```powershell
docker compose up --build
```

Before using real AI features, create a root `.env` file with the real secrets, for example:

```dotenv
OPENAI_API_KEY=your_key
SECRET_KEY=replace-with-a-long-random-secret
VITE_API_BASE_URL=http://localhost:8000
```

The Compose frontend is available at `http://localhost:5173`, the backend at `http://localhost:8000`, and MongoDB at `localhost:27017`. Stop services with `docker compose down`; add `-v` only if you intentionally want to erase the local database volume.

## Deployment

### Vercel (frontend)

- Set the Vercel project root directory to `frontend`.
- Build command: `npm run build`; output directory: `dist`.
- Add `VITE_API_BASE_URL=https://your-render-service.onrender.com` as a production environment variable, then redeploy so Vite embeds the value.

### Render (backend)

- Set the Render service root directory to `backend`.
- Use either the included Dockerfile or build with `pip install -r requirements.txt` and start with `uvicorn app.main:app --host 0.0.0.0 --port $PORT`.
- Set `OPENAI_API_KEY`, `MONGODB_URI`, `MONGODB_DATABASE`, `SECRET_KEY`, and `FRONTEND_ORIGINS` (including the Vercel URL).
- Configure MongoDB Atlas network access appropriately for Render and keep all credentials in Render environment variables.

## Core verification checklist

1. Sign up, sign in, refresh, and verify protected profile/history requests send a JWT bearer token.
2. Confirm every text, voice, and image response includes a non-diagnostic disclaimer, confidence/urgency framing, and deterministic emergency escalation.
3. Verify image/audio type and size validation, error states, and rate limits before testing third-party APIs.
4. Test geolocation denial, no nearby-hospital results, network failure, mobile layout, and dark mode.
5. Generate a report and verify that it contains the user/date, symptoms or conversation, possible conditions, recommendations, and disclaimer.
