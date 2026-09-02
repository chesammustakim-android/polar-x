# POLAR-X — Production Deployment & Internet Readiness Guide

This document specifies the production architecture, environment configuration, startup procedures, and step-by-step instructions to deploy **POLAR-X** to a **single public HTTPS URL** accessible from any web browser without installing local dependencies.

---

## 1. System Architecture

```text
Any Internet Browser (Phone, Tablet, Laptop)
                     │
                     ▼
          PUBLIC HTTPS URL (Port 443)
          [e.g. https://polar-x.onrender.com]
                     │
                     ▼
             POLAR-X Server (start.py)
   ┌───────────────────────────────────────────────┐
   │ FastAPI Backend (Port $PORT)                  │
   │                                               │
   │  ├── /api/*          REST API Endpoints       │
   │  │   ├── /api/auth         JWT Auth & RBAC    │
   │  │   ├── /api/expeditions  Expeditions Data   │
   │  │   ├── /api/cargo        Supply Pipeline    │
   │  │   ├── /api/inventory    Smart Inventory    │
   │  │   ├── /api/personnel    Vitals & Tracking  │
   │  │   ├── /api/incidents    SAR & Distress     │
   │  │   ├── /api/reports      Analytics & KPIs   │
   │  │   ├── /api/automation   Predictive Engine  │
   │  │   └── /api/settings     Operational Config │
   │  │                                            │
   │  └── /*              Static Single Page App   │
   │      └── dist/       Pre-built React Bundle   │
   └───────────────────────┬───────────────────────┘
                           │
                           ▼
                 Central Database
            (SQLite file or PostgreSQL)
```

### Architecture Key Features
- **Unified Single-Port Hosting**: In production, the FastAPI server mounts and serves the pre-compiled React single-page application (`dist/`) alongside all `/api/*` endpoints on a single port (`$PORT`).
- **No CORS Issues**: Because the frontend and API originate from the exact same domain and port, cross-origin restrictions are completely eliminated.
- **Direct Route Refresh**: All client-side SPA routes (e.g. `/expeditions`, `/cargo`, `/settings`) fall through to `index.html` seamlessly without 404 errors.
- **Zero Local Client Requirements**: Evaluators, judges, and station commanders need only an internet browser.

---

## 2. Environment Variables Specification

All configuration parameters can be set in a `.env` file or directly in your hosting platform's environment settings:

| Variable | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `PORT` | Integer | `8000` | Port the application listens on. Provided automatically by Render, Railway, Fly.io, Heroku, etc. |
| `HOST` | String | `0.0.0.0` | Bind IP. Use `0.0.0.0` for cloud container deployments. |
| `WORKERS` | Integer | `1` | Number of Uvicorn worker processes (keep at `1` for SQLite). |
| `LOG_LEVEL` | String | `info` | Logging verbosity (`debug`, `info`, `warning`, `error`). |
| `DATABASE_URL` | String | `sqlite:///./backend/polar_x.db` | Connection string for database. Accepts SQLite path or PostgreSQL connection string (`postgresql://...`). |
| `CORS_ORIGINS` | String | `*` | Comma-separated list of allowed origins or `*` for all. |
| `VITE_API_URL` | String | `""` (relative) | **Build-time** URL for frontend API calls. When deployed as unified app, leave empty so requests use relative `/api` paths. |

---

## 3. Production Build & Startup Commands

### Step 1: Install Dependencies
```bash
# Frontend
npm install

# Backend
pip install -r backend/requirements.txt
```

### Step 2: Compile Frontend Production Bundle
```bash
npm run build
```
This outputs optimized, minified static files into `dist/`.

### Step 3: Launch Production Server
```bash
python start.py
```
Or directly using Uvicorn:
```bash
uvicorn backend.main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 1
```

---

## 4. Step-by-Step Cloud Deployment

### Option A: Render (Recommended — Free & Automatic HTTPS)

1. Push your code to a GitHub or GitLab repository.
2. Sign up / Log in to [render.com](https://render.com).
3. Click **New +** → **Web Service**.
4. Connect your GitHub repository.
5. Configure the service:
   - **Name**: `polar-x`
   - **Region**: Any (e.g., Oregon, Frankfurt, Singapore)
   - **Branch**: `main` (or your active branch)
   - **Runtime**: `Python 3`
   - **Build Command**:
     ```bash
     npm install && npm run build && pip install -r backend/requirements.txt
     ```
   - **Start Command**:
     ```bash
     python start.py
     ```
6. Add Environment Variables (under the **Environment** tab):
   - `HOST` = `0.0.0.0`
   - `CORS_ORIGINS` = `*`
   - `PYTHON_VERSION` = `3.11.9`
7. Click **Create Web Service**.
8. Within 2–3 minutes, Render will assign your public HTTPS URL:
   `https://polar-x-<unique-id>.onrender.com`

---

### Option B: Railway (One-Click Deploy)

1. Go to [railway.app](https://railway.app) and connect your repository.
2. Railway detects the project and builds the application.
3. In service settings, set:
   - **Build Command**: `npm install && npm run build && pip install -r backend/requirements.txt`
   - **Start Command**: `python start.py`
4. Under **Networking**, click **Generate Domain** to get your public HTTPS URL.

---

### Option C: Docker Container (Any VPS / Cloud Host)

Build and run using the included container configuration:

```dockerfile
# Build image
docker build -t polar-x:latest .

# Run container
docker run -d -p 8000:8000 -v polar_data:/app/backend --name polar-x polar-x:latest
```

---

## 5. Pre-Configured Demo Credentials

Once the public URL is loaded, anyone can authenticate immediately using the deterministic demo accounts:

| Role | Username | Password | Clearance Level |
| :--- | :--- | :--- | :--- |
| **Station Administrator** | `admin` | `Polar@2026` | Full Read/Write (Settings, Users, System Config) |
| **Expedition Director** | `director` | `Polar@2026` | Operational Oversight & Cross-Module Planning |
| **Logistics Officer** | `logistics` | `Polar@2026` | Cargo Manifests & Supply Pipelines |
| **SAR Officer** | `sar` | `Polar@2026` | Search and Rescue & Emergency Response |
| **Field Operator** | `field` | `Polar@2026` | Field Telemetry & Data Collection |

---

## 6. Critical Flow Verification Checklist

Once deployed, the following user journey can be tested:
1. **Login**: Authenticate as `admin` / `Polar@2026`.
2. **Dashboard**: View overall readiness, active traverse metrics, and real-time telemetry feed.
3. **Expeditions**: Inspect Antarctic traverse routes (e.g. Maitri to Dome-C).
4. **Cargo Logistics**: Review consignments, temperature compliance, and delay flags.
5. **Smart Inventory**: Check runway ratios and stockout alerts.
6. **Personnel & Telemetry**: Review vitals, active crew status, and SOS triggers.
7. **Interactive Map**: View station coordinates, live positions, and geofences.
8. **Emergency & SAR**: Triage incident cards and evaluate automated rescue unit recommendations.
9. **Reports & Analytics**: Generate summary KPIs and filtered status distributions.
10. **Smart Automation**: Review explainable readiness scores and inventory risk forecasts.
11. **System Settings**: Adjust operational warning/critical thresholds and verify persistence.
