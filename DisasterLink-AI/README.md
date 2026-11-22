# DisasterLink AI

**Every Need Matters. Every Life Deserves Help.**

An intelligent, inclusive and offline-first disaster relief coordination platform. It connects affected people, volunteers, relief organisations and authorised coordinators, using local AI to classify requests, detect duplicates, recommend urgency, find shortages, match resources and highlight areas where people may need help but have not asked.

> All demonstration data is **SIMULATED** (a fictional Chennai flood). No real people, incidents or phone numbers are used.
> All AI outputs are **advisory**; authorised human coordinators make every final decision.

---

## Contents
1. [Quick start (Windows + VS Code)](#1-quick-start-windows--vs-code)
2. [Demo accounts](#2-demo-accounts)
3. [Testing offline mode](#3-testing-offline-mode)
4. [Resetting demo data](#4-resetting-demo-data)
5. [Suggested demo walkthrough](#5-suggested-demo-walkthrough-18-steps)
6. [Features by module](#6-features-by-module)
7. [Architecture](#7-architecture)
8. [API overview](#8-api-overview)
9. [Testing performed](#9-testing-performed)
10. [Known limitations and honest disclosures](#10-known-limitations-and-honest-disclosures)
11. [Project structure](#11-project-structure)
12. [Troubleshooting](#12-troubleshooting)

---

## 1. Quick start (Windows + VS Code)

### Prerequisites (install once)
| Tool | Version | Download |
|---|---|---|
| Python | 3.10 – 3.13 (3.12 recommended). Tick **"Add python.exe to PATH"** during install. | https://www.python.org/downloads/ |
| Node.js | 18.18 or newer (20 LTS recommended) | https://nodejs.org/ |
| VS Code | any recent | https://code.visualstudio.com/ |

Check in PowerShell:
```powershell
python --version
node --version
npm --version
```

### Step 1 – Extract the ZIP
Right-click `DisasterLink-AI.zip` → **Extract All…** → choose a folder, e.g. `C:\Projects`. You will get `C:\Projects\DisasterLink-AI`.

### Step 2 – Open in VS Code
VS Code → **File → Open Folder…** → select `DisasterLink-AI`. Open a terminal with **Terminal → New Terminal** (PowerShell).

### Step 3 – Install backend dependencies
```powershell
cd backend
python -m venv .venv
.venv\Scripts\python.exe -m pip install --upgrade pip
.venv\Scripts\python.exe -m pip install -r requirements.txt
cd ..
```
(We call `.venv\Scripts\python.exe` directly, so you do not need to change PowerShell's script execution policy to "activate" the environment.)

### Step 4 – Install frontend dependencies
```powershell
cd frontend
npm install
cd ..
```

> Shortcut: double-click **`setup-windows.bat`** to do steps 3 and 4 automatically.

### Step 5 – Start the backend (Terminal 1)
```powershell
cd backend
.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
```
On first start the SQLite database (`backend/data/disasterlink.db`) is created and the simulated scenario is loaded automatically. Leave this terminal running. (Shortcut: `start-backend.bat`.)

### Step 6 – Start the frontend (Terminal 2)
Click the **+** in the VS Code terminal panel to open a second terminal:
```powershell
cd frontend
npm run dev
```
(Shortcut: `start-frontend.bat`.)

### Step 7 – Open the website
- Public site: **http://localhost:5173**
- Operations dashboard: **http://localhost:5173/login** (see demo accounts below)

### Step 8 – Open the API documentation (Swagger)
- **http://localhost:8000/docs** (interactive Swagger UI)
- http://localhost:8000/redoc (ReDoc)

To call protected endpoints in Swagger, click **Authorize** and enter a demo username and password (e.g. `coordinator` / `Coord@2026`).

### Optional configuration
Copy `backend/.env.example` to `backend/.env` to change the database URL, CORS origins, JWT secret, upload limit or to enable the optional external AI. Nothing is required: the app runs with defaults. A random JWT secret is generated on first start and stored in `backend/data/.secret_key` (never committed).

---

## 2. Demo accounts

For **local academic demonstration only** (fictional, not real people). Passwords are stored as bcrypt hashes.

| Role | Username | Password | Can do |
|---|---|---|---|
| Administrator | `admin` | `Admin@2026` | Everything, including users, scenario controls and demo reset |
| Relief Coordinator | `coordinator` | `Coord@2026` | Verify, prioritise, override urgency, approve matches, registry, family reconnection |
| Volunteer | `volunteer` | `Volunteer@2026` | View operations (read-only), manage own assignments and availability |
| Public User | `public` | `Public@2026` | Public pages and request tracking (no dashboard) |

The public SOS, request form, tracking, communication centre, shelter finder and registrations **do not require login**. The login page has one-click buttons that fill these credentials.

---

## 3. Testing offline mode

Offline support uses a **service worker** (only active in the production build) plus **IndexedDB**.

1. Keep the backend running (Step 5).
2. Build and serve the production frontend:
   ```powershell
   cd frontend
   npm run build
   npm run preview
   ```
   Open **http://localhost:4173** (shortcut: `start-offline-test.bat`). Visit a few pages (SOS, Request Help, the dashboard and the Disaster Map) while online so they are cached.
3. Open Chrome/Edge DevTools (**F12**) → **Network** tab → change *No throttling* to **Offline**.
   (Alternatively: DevTools → Application → Service Workers → tick *Offline*.)
4. Reload the page – it still loads (served by the service worker). The header shows **Offline**.
5. Go to **Request Help**, fill in the form and submit. You will see **"Saved on this device – not yet delivered"**. Do the same with **SOS**. The header shows *N pending*.
6. Dashboard pages you opened earlier show cached data with an orange **"Showing data cached on this device from …"** banner. The map shows only tiles you viewed before and says so.
7. Switch DevTools back to **No throttling**. Within a few seconds the app detects connectivity, checks `/api/health`, and uploads the queue. Items change to **Delivered** with real server IDs (see **Track Request** or **Dashboard → Offline Center**). You can also press **SYNC NOW**.
8. Duplicate-upload prevention: every queued item has a unique client ID. Re-sending the same item returns the existing record (`already_synced`) – see **Offline Center → Server synchronisation log → duplicate upload attempts blocked**.

You can also simulate "online but server down": stop the backend (Ctrl+C) and submit – the header shows **Server unreachable** and items stay queued until the backend is restarted.

---

## 4. Resetting demo data

Any of these restores the original simulated scenario (all your changes are deleted):
- Dashboard → **Admin Settings** → *Reset demo data…* (log in as `admin`), or
- Swagger: `POST /api/admin/reset-demo` (admin), or
- PowerShell (stop the backend first):
  ```powershell
  cd backend
  .venv\Scripts\python.exe -m app.seed
  ```
  (shortcut: `reset-demo-data.bat`), or simply delete the `backend/data` folder and restart the backend.

To clear the browser side (offline queue, cached data), use DevTools → Application → Storage → *Clear site data*.

---

## 5. Suggested demo walkthrough (18 steps)

| # | Step | Where |
|---|---|---|
| 1 | Open the dashboard | Log in as `coordinator` → Command Center |
| 2 | Show simulated flood conditions | Header badge, Disaster Map zones, Analytics → Impact intelligence |
| 3 | Submit a normal request | Public site → Request Help (watch the on-device AI preview) |
| 4 | Submit an accessible SOS | Public → SOS (press Enter/Space or the button; try Silent SOS, categories, voice/video) |
| 5 | Offline submission | Section 3 above (DevTools → Offline) |
| 6 | Restore connectivity | DevTools → No throttling |
| 7 | Synchronise | Automatic, or **SYNC NOW**; check Offline Center |
| 8 | AI classification | AI Intelligence → Analyser (try the samples, incl. Tamil words *thanni*, *saapadu*) |
| 9 | Duplicate detection | AI Intelligence → Duplicate review (REQ-SIM002 ↔ SIM001, SIM009 ↔ SIM006, SIM026 ↔ SIM003) |
| 10 | Registered vulnerable people | Vulnerable Registry → "In potentially affected areas" |
| 11 | Medicine shortage | Smart Matching → shortage cards (Velachery medicine; North Chennai water 80 vs 20) |
| 12 | Interactive map | Disaster Map (layers, filters, popups, coordinate entry) |
| 13 | Recommend a resource match | Smart Matching → **Run matching engine** → "Why this match?" |
| 14 | Approve the match | Send for approval → Approve allocation (stock is reserved) |
| 15 | Update request status | Dispatch → Fulfil, or Emergency Requests → open a request → status buttons |
| 16 | Underserved areas | Unreported Needs (Pallikaranai, Mudichur) |
| 17 | Shelter matching | Shelter Management → Shelter matching (tick *Wheelchair user*: the nearest shelter is excluded because its access is unverified) |
| 18 | Final analytics | Analytics & Impact |

---

## 6. Features by module

| # | Module | What is implemented |
|---|---|---|
| 1 | Command Center | 10 live KPI cards, category/status/resource/geographic charts, 48 h activity timeline, urgent panel, recent requests, shortage alerts, underserved list; working filters (category, location, priority, status) – all computed from the database |
| 2 | One-touch accessible SOS | Huge auto-focused button (Enter/Space/switch), 3-second cancel window, GPS capture with honest status, Silent SOS, large category & accessibility buttons, optional video/voice with visible REC indicator, 30 s / 20 MB limits and stop control, text-to-speech guidance, offline queue with real delivery status, add-details after sending |
| 3 | Vulnerable registry | Consent-based self/coordinator registration, affected-area view, welfare-check records, assistance arrangements, consent withdrawal (erases details), restricted to coordinators |
| 4 | AI classification | Rule-based NLP with weighted English + Tamil-transliteration lexicons, keyword extraction, people-count extraction, multi-category detection, confidence and explanations; optional external AI via env vars |
| 5 | Urgency intelligence | Points-based, explainable: danger indicators, people, waiting time, vulnerability (form or text), category, local supply; Critical/High/Medium/Low; coordinator override with mandatory reason (audited) |
| 6 | Geospatial map | React Leaflet + OSM: requests, SOS, resources, shelters, simulated impact zones, underserved areas, restricted vulnerable layer; category/priority filters, place search (online), coordinate entry, popups, legend, cached-tile notice |
| 7 | Need-aware matching | Demand vs supply per area×category, shortage detection, scored suggestions (distance, coverage, urgency, expiry-first), explanations, mandatory workflow Suggested → Awaiting approval → Approved → Dispatched → Fulfilled, stock reservation/deduction |
| 8 | Shelter matching | Hard filters (capacity, verified wheelchair access) + weighted scoring with reasons, warnings and "why not the nearest" note; public and coordinator versions |
| 9 | Family reconnection | Missing/found reports (never public), similarity matching (name trigrams, age, gender, distance, time, description), contact hidden until verified **and** consent confirmed |
| 10 | Volunteer network | Public registration (incl. new organisations), coordinator approval, availability, assignments with accept/complete |
| 11 | Inventory & wastage | Quantities, units, expiry, organisation, availability; shortage, expiry (≤7 d), excess detection and redistribution recommendations |
| 12 | Unreported need detection | Per-zone score from reporting ratio vs simulated impact, severity, unchecked vulnerable people and shortages; separates Confirmed / Unverified / Estimated; recommends welfare checks only |
| 13 | Offline-first | PWA service worker (app shell + viewed map tiles), IndexedDB outbox/media/cache, auto & manual sync, health check, idempotent batch upload, retries, honest statuses, cached-data banners |
| 14 | Nearby devices | Manual store-and-forward relay file (export/share/import with checksum); Web Bluetooth capability check; documented native BLE/Wi-Fi Direct architecture (not implemented – see limitations) |
| 15 | Communication accessibility | 12 large communication cards (English/Tamil), full-screen display, text-to-speech, speech-to-text (where supported), ISLRTC sign-language resource link |
| 16 | Impact intelligence | Demand density map, demand distribution by area/category, per-area summary (severity, estimates, shelters, shortages) – labelled as estimates |

---

## 7. Architecture

```
┌──────────────────────── Browser (React PWA) ────────────────────────┐
│ Public pages  ·  Secure dashboard (role-based routes)               │
│ Service worker: precached app shell + runtime-cached OSM tiles      │
│ IndexedDB: outbox (requests/SOS) · media blobs · API cache · auth   │
│ Sync engine: health check → POST /api/sync/batch → media uploads    │
│ On-device classifier + urgency (offline preview)                    │
└───────────────────────────────┬─────────────────────────────────────┘
                                │ /api (Vite proxy in dev/preview)
┌───────────────────────────────▼─────────────────────────────────────┐
│ FastAPI · Pydantic validation · JWT (PyJWT) + bcrypt · CORS         │
│ Routers: auth, requests, sos, media, ai, vulnerable, resources,      │
│          matching, shelters, volunteers, family, analytics, sync,    │
│          admin, notifications                                       │
│ AI: classifier.py · duplicates.py · urgency.py · external.py (opt.)  │
│ Services: matching · shelters · unreported · inventory · family     │
│ SQLAlchemy 2.0 ORM → SQLite (dev) / PostgreSQL-compatible           │
└─────────────────────────────────────────────────────────────────────┘
```

**Database tables:** users, roles, emergency_requests, sos_alerts, media_attachments, vulnerable_people, welfare_checks, resources, resource_matches, shelters, volunteers, volunteer_assignments, organizations, missing_person_reports, family_match_suggestions, notifications, synchronization_records, disaster_scenarios, activity_logs.

**PostgreSQL:** set `DATABASE_URL=postgresql+psycopg2://user:pass@host:5432/disasterlink` in `backend/.env` and `pip install psycopg2-binary`. Models use portable types (JSON, String IDs). Not tested against a live PostgreSQL server in this delivery.

**Optional external AI:** `pip install anthropic`, then in `backend/.env` set `AI_PROVIDER=anthropic`, `ANTHROPIC_API_KEY=...` (and optionally `AI_MODEL`, default `claude-opus-5-5`). It is used only when "Use optional external AI enhancement" is ticked in the AI Analyser; it requests server-side model fallbacks on refusals, and any error falls back to the local engine. Public submissions and offline sync always use the local engine.

---

## 8. API overview

Full, interactive documentation at **http://localhost:8000/docs**. Main groups:

| Group | Key endpoints |
|---|---|
| Health | `GET /api/health` |
| Auth | `POST /api/auth/login`, `POST /api/auth/token` (Swagger), `GET /api/auth/me`, `POST /api/auth/logout` |
| Requests | `POST /api/requests` (public, idempotent), `GET /api/requests`, `GET /api/requests/{id}`, `GET /api/requests/track/{id}`, `POST …/verify`, `…/override-urgency`, `…/mark-duplicate`, `…/not-duplicate`, `…/assign`, `PATCH …/status` |
| SOS | `POST /api/sos`, `PATCH /api/sos/{id}/details`, `GET /api/sos`, `PATCH /api/sos/{id}`, `GET /api/sos/track/{id}` |
| Media | `POST /api/media/upload` (type/size checked, idempotent), `GET /api/media/{id}/file` (coordinators) |
| AI | `POST /api/ai/analyze`, `GET /api/ai/duplicates`, `GET /api/ai/insights`, `GET /api/ai/status` |
| Registry | `POST /api/vulnerable/register`, `GET /api/vulnerable`, `GET /api/vulnerable/in-affected-areas`, `POST …/welfare-checks`, `POST …/withdraw-consent` |
| Resources | `GET/POST /api/resources`, `PATCH/DELETE /api/resources/{id}`, `GET /api/resources/insights` |
| Matching | `GET /api/matching/shortages`, `POST /api/matching/generate`, `GET /api/matching`, `POST /api/matching/{id}/transition` |
| Shelters | `GET/POST /api/shelters`, `PATCH /api/shelters/{id}`, `POST /api/shelters/match` |
| Volunteers | `POST /api/volunteers/register`, `GET /api/volunteers`, `PATCH /api/volunteers/{id}`, `GET/POST /api/volunteers/assignments` |
| Family | `POST /api/family/reports`, `GET /api/family/suggestions`, `POST /api/family/suggestions/{id}/verify` |
| Analytics | `GET /api/analytics/dashboard`, `/map`, `/impact`, `/summary`; `GET /api/notifications` |
| Sync | `POST /api/sync/batch`, `GET /api/sync/check/{client_id}`, `GET /api/sync/records` |
| Admin | `GET /api/admin/overview`, `POST /api/admin/reset-demo`, users, scenario, activity log |

Authorisation is enforced on the server for every protected endpoint (roles: admin, coordinator, volunteer, public).

---

## 9. Testing performed

**Automated backend tests** – 18 passing (`backend/tests/test_api.py`), run with:
```powershell
cd backend
.venv\Scripts\python.exe -m pytest -q
```
They cover: health; login failure; role permissions (anonymous / public / volunteer / coordinator / admin); seed counts; validation errors; classification and urgency (English and Tamil transliteration); idempotent submission and duplicate detection; offline sync batch (created / already_synced / rejected); SOS + media upload (type rejection, idempotency, coordinator-only download, add-details proof); urgency override requires reason; matching workflow cannot skip approval and reserves/deducts stock; wheelchair shelter matching; unreported-need detection; family contact disclosure requires consent; registry consent and withdrawal; volunteer self-approval blocked; dashboard filters; demo reset.

**Frontend** – `npm run build` succeeds (Vite 5 + PWA plugin, 65 precached files). Every dashboard route was opened in a browser and rendered without console errors. Phone-width (375 px) layouts were checked for the SOS page and login.

**Offline / sync tested in a real browser (Chromium):**
- With the backend stopped, a request and an SOS were submitted → shown as *"Saved on this device – not yet delivered"*, header showed *Server unreachable · 2 pending*.
- With the web server also stopped, reloading the page loaded the app from the service worker; SOS, Request, Communication and Relay pages rendered and the queued items were still listed.
- After restarting both servers, the queue synchronised automatically; both items showed *Delivered* with server IDs, the request arrived with `source=offline_sync`, the correct area and AI analysis.
- Re-sending the same two items returned `already_synced` – exactly one record each in the database (duplicate prevention confirmed).
- The DevTools *Offline* toggle itself (navigator.onLine = false) was **not** available in the test harness; the offline path was exercised via server/network failure, which uses the same queue and sync code. Please use Section 3 to demonstrate it with DevTools.

**Not tested in this delivery:** real camera/microphone recording (the test browser had no media devices – the code paths, permission handling and upload endpoint were tested separately), real GPS (permission was denied in the test browser; the denied path was verified), speech recognition, Web Bluetooth, PostgreSQL, the external AI integration with a live key, Safari/Firefox, and running on Windows itself (developed and tested on Linux with Node 18 and Python 3.12; the commands above are standard Windows equivalents).

---

## 10. Known limitations and honest disclosures

- **Simulated data:** all incidents, people, organisations, shelters and impact figures are fictional. Coordinates are approximate Chennai locality centroids with random offsets.
- **AI is rule-based:** a transparent keyword/similarity engine, not a trained ML model. It can misclassify unusual wording; low-confidence items are surfaced for review. Urgency is **not** medically validated triage.
- **Unreported-need estimates** use stated assumptions (≈2 requests per 1,000 affected people; 25 % in need at full severity). They are illustrations, not official warnings.
- **Offline maps:** only tiles you have already viewed are cached (OpenStreetMap's usage policy discourages bulk tile downloads). Unviewed areas are blank offline, and the app says so.
- **Offline login:** you must have logged in while online for the dashboard to show cached data offline. Write actions in the dashboard need the server.
- **Nearby-device communication (Module 14):** browsers cannot advertise over Bluetooth or use Wi-Fi Direct, so automatic device-to-device relay is **not implemented**. The working alternative is a manual relay file (export/share/import). A native-app architecture is documented on the Relay page.
- **Sign language:** no automatic sign-language recognition. The app provides communication cards, TTS/STT and a link to ISLRTC resources.
- **Speech-to-text** works only in browsers that support the Web Speech API (Chrome/Edge) and, in Chrome, needs internet access.
- **Tamil card translations** are short phrases and should be reviewed by a native speaker before real-world use.
- **Location search** uses the public OpenStreetMap Nominatim service and needs internet; coordinate entry works offline.
- **Security:** suitable for local demonstration. For production you would add HTTPS, refresh tokens, persistent rate limiting, audit retention policies, encrypted storage of sensitive fields and a proper data-protection review.
- **Media capture** requires HTTPS or `localhost` (browser rule).

---

## 11. Project structure

```
DisasterLink-AI/
├─ README.md               ← this guide
├─ .env.example            ← backend environment example (copy to backend/.env)
├─ .gitignore
├─ setup-windows.bat · start-backend.bat · start-frontend.bat · start-offline-test.bat · reset-demo-data.bat
├─ backend/
│  ├─ requirements.txt · requirements-optional.txt · .env.example
│  ├─ app/
│  │  ├─ main.py           ← FastAPI app, CORS, error handling, health
│  │  ├─ config.py · database.py · models.py · security.py · serializers.py · ratelimit.py · seed.py
│  │  ├─ ai/               ← classifier.py, duplicates.py, urgency.py, external.py
│  │  ├─ services/         ← matching, shelters, unreported, inventory, family, geo, pipeline, audit
│  │  └─ routers/          ← one file per API group
│  └─ tests/test_api.py
└─ frontend/
   ├─ package.json · vite.config.js (PWA) · tailwind.config.js · index.html
   ├─ public/              ← favicon, PWA icons
   └─ src/
      ├─ lib/              ← api.js, db.js (IndexedDB), sync.jsx, auth.jsx, classifier.js, speech.js
      ├─ components/       ← layouts, UI kit, charts, map, media capture, location picker, shelter finder
      └─ pages/public · pages/dash
```

---

## 12. Troubleshooting

| Problem | Fix |
|---|---|
| `python` not recognised | Reinstall Python with "Add to PATH", or use `py -3.12 -m venv .venv` |
| `npm` not recognised | Install Node.js LTS and reopen VS Code |
| Dashboard says "Cannot reach the server" | Start the backend (Step 5) on port 8000 |
| Port 8000 or 5173 already in use | Close the other program, or run uvicorn with `--port 8001` and set `VITE_BACKEND_URL=http://127.0.0.1:8001` in `frontend/.env` |
| Offline reload shows the browser's offline page | Use the production build (`npm run build` + `npm run preview`, port 4173) and visit the pages once while online |
| Login stops working after a reset | Log out and log in again (tokens from before the reset may refer to removed users) |
| Old data after reset | DevTools → Application → *Clear site data* |
| `pip install` fails on bcrypt | Upgrade pip (`.venv\Scripts\python.exe -m pip install --upgrade pip`) and retry |
