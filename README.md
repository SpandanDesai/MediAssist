# 🩺 MediAssist AI

> **An AI-powered multimodal healthcare information assistant built with React, FastAPI, Google Gemini, and MongoDB.**

MediAssist AI helps users understand symptoms through AI-powered conversations while providing image analysis, voice interaction, nearby hospital discovery, medical history tracking, and downloadable health reports.

> **⚠️ Medical Disclaimer**
>
> MediAssist AI is intended for **educational and informational purposes only**. It does **not** diagnose medical conditions, replace licensed healthcare professionals, or delay emergency medical treatment. If symptoms indicate a medical emergency, seek immediate professional care.

---

# ✨ Features

- 💬 AI Medical Chat Assistant (Google Gemini)
- 🎙️ Voice-based Health Consultation
- 🖼️ Medical Image Analysis
- 📍 Nearby Hospitals using Google Maps
- 👤 Secure User Authentication (JWT)
- 📜 Conversation & Medical History
- 📄 Downloadable Medical Reports
- 🌙 Responsive UI with Dark Mode
- 🔒 Secure API & Input Validation

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
SECRET_KEY=your_long_random_secret
FRONTEND_ORIGINS=http://localhost:5173
```

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
| Reports | `/api/reports` |
| Nearby Hospitals | `/api/hospitals` |
| User Profile | `/api/profile` |

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