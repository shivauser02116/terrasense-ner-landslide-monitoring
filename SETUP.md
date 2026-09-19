# NER Landslide Early Warning System — Setup & Execution Guide

## Architecture Overview
- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS v4 + Leaflet (CARTO base map)
- **Backend**: Python 3.10+ FastAPI Service (REST API & Pluggable Landslide Risk Model)
- **Database & Storage**: Firebase Firestore (Data Collections), Firebase Storage (Field Media) & Firebase Authentication
- **AI/LLM**: Google Gemini API for bilingual (English/Kannada) Disaster Assistant

---

## 1. Backend Setup (FastAPI + ML Service)

### Prerequisites
- Python 3.10 or higher installed
- Firebase Project created with Firestore and Storage enabled

### Step 1: Create Virtual Environment & Install Dependencies
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### Step 2: Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Fill in the configuration parameters:
- `FIREBASE_SERVICE_ACCOUNT_PATH`: Path to your downloaded service account JSON file from Firebase Console (`./serviceAccount.json`).
- `GEMINI_API_KEY`: Google Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey).
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`: (Optional) Credentials for SMS dispatch.
- `CORS_ORIGINS`: Comma-separated allowed frontend origins (default: `http://localhost:8443,http://localhost:5173`).

### Step 3: Seed Initial 18 NER Monitoring Zones
```bash
python firestore_seed.py
```

### Step 4: Run the FastAPI Server
```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```
- Interactive API Docs (Swagger): `http://localhost:8000/docs`
- Redoc Documentation: `http://localhost:8000/redoc`

---

## 2. Frontend Setup (React Dashboard)

### Step 1: Install Dependencies
```bash
pnpm install
```

### Step 2: Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Set your backend URL and Firebase Web credentials:
```env
VITE_API_BASE_URL=http://localhost:8000
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

### Step 3: Run Development Server
```bash
pnpm dev
```
Open `http://localhost:8443` or the port displayed in terminal.

---

## 3. Core API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/predict-risk` | Compute landslide risk score, level, 24h probability & factors |
| `GET` | `/api/zones` | Fetch all monitoring zones from Firestore (or filter by state) |
| `GET` | `/api/zones/{id}` | Get single zone detail |
| `GET` | `/api/emergency-contacts` | Retrieve verified national and local emergency contacts |
| `GET` | `/api/alerts` | List active emergency alerts |
| `POST` | `/api/alerts` | Create new alert (triggers SMS if configured) |
| `POST` | `/api/field-reports` | Upload geo-tagged photos/videos and field observations |
| `GET` | `/api/field-reports` | Retrieve field observation reports |
| `POST` | `/api/sync-reports` | Idempotent sync endpoint for offline report queues |
| `POST` | `/api/chat` | Bilingual (EN/KN) Disaster Assistant with zone risk context |

---

## 4. Testing
Run the backend test suite:
```bash
cd backend
.venv/bin/pytest tests/ -v
```
