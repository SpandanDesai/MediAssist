# 🩺 MediAssist AI

> **An AI-powered multimodal healthcare information assistant built with React, FastAPI, Google Gemini, and MongoDB.**

MediAssist AI helps users understand symptoms through AI-powered conversations while providing image analysis, voice interaction, nearby hospital discovery, medical history tracking, and downloadable health reports.

> **⚠️ Medical Disclaimer**
>
> MediAssist AI is intended for **educational and informational purposes only**. It does **not** diagnose medical conditions, replace licensed healthcare professionals, or delay emergency medical treatment. If symptoms indicate a medical emergency, seek immediate professional care.

---

# ✨ Features

- 💬 AI Medical Chat Assistant (Google Gemini)
- 🎙️ Voice-based Health Consultation (speech-to-text + TTS)
- 🖼️ Medical Image Analysis
- 📍 Nearby Hospitals using OpenStreetMap + browser geolocation
- ⚠️ Emergency Symptom Detection with immediate urgent-care guidance
- 📊 Lifestyle Health Risk Assessment
- 👤 Secure User Authentication (JWT)
- 📜 Conversation & Medical History
- 📄 Downloadable Medical Reports (PDF)
- 🌙 Responsive UI with Dark Mode, Markdown, and typing indicators
- 🔒 Secure API, Rate Limiting, and Input Validation

---

# 🏗️ Tech Stack

## Frontend

- React
- TypeScript
- Vite
- Tailwind CSS
- Axios

## Backend

- FastAPI
- Python
- JWT Authentication
- Pydantic
- Google Gemini API

## Database

- MongoDB Atlas

---

# 📂 Project Structure

```text
MediAssist/
│
├── frontend/
│   ├── src/
│   ├── public/
│   └── package.json
│
├── backend/
│   ├── app/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── models/
│   │   ├── db/
│   │   └── core/
│   ├── requirements.txt
│   └── .env.example
│
└── README.md
```

---

# ⚙️ Prerequisites

Install the following before running the project:

- Node.js 20+
- Python 3.11+
- MongoDB Atlas (or MongoDB Community Edition)
- Google Gemini API Key

---

# 🔑 Environment Variables

## Backend (`backend/.env`)

```env
MONGODB_URI=your_mongodb_connection_string
MONGODB_DATABASE=mediassist
GEMINI_API_KEY=your_gemini_api_key
GEMINI_TTS_MODEL=models/gemini-2.5-flash-preview-tts
GEMINI_TTS_VOICE=Kore
SECRET_KEY=your_long_random_secret
FRONTEND_ORIGINS=http://localhost:5173
```

> `GEMINI_API_KEY` and `MONGODB_URI` are optional for local development. When
> either service is not configured, the backend transparently falls back to an
> in-memory data store and a safety-first educational rules engine so the UI can
> run immediately. Configure real services before production.

## Frontend (`frontend/.env`)

```env
VITE_API_BASE_URL=http://localhost:8000
```

> **Never commit `.env` files to GitHub.**

---

# 🚀 Running the Backend

```bash
cd backend

python -m venv .venv
```

### Windows

```bash
.venv\Scripts\activate
```

### Linux / macOS

```bash
source .venv/bin/activate
```

Install dependencies

```bash
pip install -r requirements.txt
```

Run the server

```bash
uvicorn app.main:app --reload
```

Backend runs at:

```
http://localhost:8000
```

---

# 💻 Running the Frontend

```bash
cd frontend

npm install

npm run dev
```

Frontend runs at:

```
http://localhost:5173
```

---

# 🌐 API Overview

| Feature | Endpoint |
|----------|----------|
| Authentication | `/api/auth` |
| Medical Chat | `/api/chat` |
| Image Analysis | `/api/image` |
| Voice Consultation | `/api/voice` |
| Medical History | `/api/history` |
| Health Risk Assessment | `/api/assessment` |
| Reports | `/api/reports` |
| Nearby Hospitals | `/api/hospitals` |
| User Profile | `/api/profile` |
| Health / Readiness | `/api/health` |
| Personal Reminders | `/api/reminders` (incl. `/api/reminders/upcoming`) |
| Health Stats / Trends | `/api/stats` |
| Report Share Links | `/api/reports/{id}/share`, `/api/reports/{id}/shares`, `/api/share/{token}/download` |
| Operational Metrics | `/api/metrics` (PHI-free counters) |

---

# 🐳 Run with Docker (optional)

A `docker-compose.yml` is included to run MongoDB, the FastAPI backend, and a
production-style static frontend together:

```bash
cp .env.example .env   # set real GEMINI_API_KEY / SECRET_KEY first
docker compose up --build
```

- Frontend: <http://localhost:5173>
- Backend API + docs: <http://localhost:8000>
- MongoDB: `localhost:27017`

Stop with `docker compose down` (add `-v` only if you want to erase the data volume).

---

# 🚀 Deployment

## Frontend (Vercel)

Project Root

```
frontend
```

Build Command

```
npm run build
```

Output Directory

```
dist
```

Environment Variable

```
VITE_API_BASE_URL=https://your-backend-url.onrender.com
```

---

## Backend (Render)

Project Root

```
backend
```

Build Command

```
pip install -r requirements.txt
```

Start Command

```
uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

Environment Variables

```env
MONGODB_URI=
MONGODB_DATABASE=
GEMINI_API_KEY=
SECRET_KEY=
FRONTEND_ORIGINS=
```

---

# ✅ Testing Checklist

- User Registration & Login
- JWT Authentication
- AI Chat Responses
- Voice Consultation
- Medical Image Analysis
- Hospital Search
- Conversation History
- Report Generation
- Mobile Responsiveness
- Dark Mode
- Error Handling

---

# 🔒 Security

- JWT Authentication
- Password Hashing
- Input Validation
- Protected Routes
- Environment Variable Management
- CORS Configuration

---

# 📸 Screenshots

Add screenshots here.

```
Home Page

AI Chat

Medical Image Analysis

Voice Consultation

Hospital Finder

Medical Reports
```

---

# 🧪 Testing & CI

## Backend

```bash
cd backend
pytest -q
```

The suite runs against the in-memory fallback store, so no database or API key is
required. It covers safety rules, ownership isolation, the OpenAPI/CORS contract,
message pagination headers, `/reminders/upcoming`, share-link revocation, and the
`/metrics` snapshot.

## Frontend

```bash
cd frontend
npm run lint      # oxlint
npx tsc --noEmit  # typecheck
npm run test      # vitest (auth bootstrap, API error handling)
npm run build     # production build
```

## Continuous Integration

`.github/workflows/ci.yml` runs both stacks on every push/PR to `main`:

- **Backend** — Python 3.12, `pytest`, with a MongoDB 7 service container and a
  driver-connectivity smoke check.
- **Frontend** — Node 20, `oxlint`, `tsc --noEmit`, `vitest`, and `vite build`.

---

# 🛡️ Reliability & Observability

- **Structured JSON logs** with a per-request `X-Request-ID` (echoed on every
  response and propagated to log lines for correlation).
- **Bounded Gemini calls** — per-request timeout plus an overall failover deadline,
  with transient-only retries (408/425/429/5xx) and terminal-error short-circuit.
- **Overpass circuit breaker** — nearby-hospital lookups back off from a recently
  failing endpoint and fall back to a curated list.
- **`/metrics`** — aggregate, PHI-free counters (traffic, 5xx, slow requests,
  Gemini retries/failovers, rate-limit blocks). Disable with `ENABLE_METRICS=false`.
- **Resilience settings** (all optional, `.env`-configurable):

  ```env
  GEMINI_REQUEST_TIMEOUT_SECONDS=45
  GEMINI_OVERALL_TIMEOUT_SECONDS=110
  GEMINI_MAX_RETRIES=2
  OVERPASS_TIMEOUT_SECONDS=12
  OVERPASS_CIRCUIT_COOLDOWN_SECONDS=60
  ENABLE_METRICS=true
  ```

---

# 🗺️ Deferred (needs external secrets or product decisions)

These items are intentionally **not** implemented because they require third-party
accounts/keys, paid data sources, or larger architectural changes that need a
deliberate decision rather than a code-only change:

- **Outbound notifications (email / web push).** Requires an SMTP provider or a
  VAPID key pair and a delivery policy. The reminder data model and
  `/api/reminders/upcoming` aggregation already exist as the trigger source.
- **Authoritative drug-interaction data (e.g. OpenFDA).** The current medication
  guard is heuristic and safety-first; wiring a real interaction API needs an
  agreed data source (and possibly an API key) plus a caching/normalisation layer.
- **Internationalisation (i18n).** Full locale support is a product decision
  (which languages, RTL handling, translated medical copy review) before any
  framework is introduced.
- **Streaming responses (SSE).** Progressive token streaming from Gemini would
  change the chat request/response contract and needs client + proxy support;
  left out to keep the existing contract stable.
- **Retiring the in-memory fallback store.** Kept deliberately so the app runs with
  zero external dependencies in development/tests; removing it is a deployment
  choice.

---

# 👨‍💻 Authors

### Sushant Kumar
Computer Science Engineering (IoT, Blockchain & Cyber Security)

GitHub: https://github.com/sushantkumarkhobian-lab

---

### Spandan Desai
Computer Science Engineering (IoT, Blockchain & Cyber Security)

GitHub: https://github.com/SpandanDesai
---

## ⭐ Support

If you found this project useful, consider giving it a **⭐ Star** on GitHub!