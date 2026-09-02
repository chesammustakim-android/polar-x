import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from .database import engine, Base, SessionLocal, get_db
from . import models, crud, schemas
from .routers import (
    expeditions, cargo, inventory, personnel, alerts, stations,
    incidents, response_units, reports, auth, automation,
    settings as settings_router
)

# ─── Environment Configuration ───────────────────────────────────────────────
# CORS_ORIGINS: comma-separated list of allowed origins.
# Examples:
#   CORS_ORIGINS=https://polar-x.example.com
#   CORS_ORIGINS=https://polar-x.example.com,https://www.polar-x.example.com
#   CORS_ORIGINS=*   (allow all – fine for public demo, not recommended for production)
_cors_env = os.getenv("CORS_ORIGINS", "*")
CORS_ORIGINS: list[str] = [o.strip() for o in _cors_env.split(",") if o.strip()]

# When wildcard is used FastAPI requires allow_credentials=False
_allow_credentials = "*" not in CORS_ORIGINS


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize SQLite database schema and seed initial data (idempotent – safe on restart)
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        crud.seed_initial_data(db)
    finally:
        db.close()
    yield


app = FastAPI(
    title="POLAR-X — Polar Expedition Logistics & Asset Management API",
    description="Backend REST API for MoES / NCPOR Polar Command Center (SIH26062)",
    version="1.0.0",
    lifespan=lifespan
)

# ─── CORS ─────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=_allow_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── API Routers ──────────────────────────────────────────────────────────────
app.include_router(auth.router)
app.include_router(expeditions.router)
app.include_router(cargo.router)
app.include_router(inventory.router)
app.include_router(personnel.router)
app.include_router(alerts.router)
app.include_router(stations.router)
app.include_router(incidents.router)
app.include_router(response_units.router)
app.include_router(reports.router)
app.include_router(automation.router)
app.include_router(settings_router.router)


@app.get("/api", tags=["System"])
@app.get("/api/", tags=["System"])
def api_root():
    return {
        "system": "POLAR-X API",
        "status": "ONLINE",
        "organization": "Ministry of Earth Sciences (MoES) / NCPOR",
        "version": "1.0.0",
        "docs_url": "/docs",
        "redoc_url": "/redoc",
    }


@app.get("/api/dashboard", response_model=schemas.DashboardDataOut, tags=["Dashboard"])
def get_dashboard_data(db: Session = Depends(get_db)):
    """
    Consolidated endpoint returning all metrics, active expeditions,
    recent cargo, personnel vitals, inventory alerts, and emergency feed.
    """
    return crud.get_dashboard_summary(db)


# ─── Frontend Static Files (production build) ─────────────────────────────────
# When `dist/` exists (after `npm run build`), serve the React SPA.
# API routes registered above are checked first; all other paths fall through
# to the SPA index.html so client-side routing works on direct URL access.
_DIST_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "dist")

if os.path.isdir(_DIST_DIR):
    app.mount("/assets", StaticFiles(directory=os.path.join(_DIST_DIR, "assets")), name="assets")

    @app.get("/", include_in_schema=False)
    @app.get("/{full_path:path}", include_in_schema=False)
    def serve_spa(full_path: str = ""):
        """Serve the React SPA for all non-API routes (enables client-side routing)."""
        # Don't catch /api/* or /docs or /redoc
        if full_path.startswith("api/") or full_path in ("docs", "redoc", "openapi.json"):
            from fastapi import HTTPException as _HTTPException
            raise _HTTPException(status_code=404, detail="Not found")
        if full_path:
            potential_file = os.path.join(_DIST_DIR, full_path)
            if os.path.isfile(potential_file):
                return FileResponse(potential_file)
        index_file = os.path.join(_DIST_DIR, "index.html")
        return FileResponse(index_file)
else:
    @app.get("/", tags=["System"])
    def root():
        return {
            "system": "POLAR-X API",
            "status": "ONLINE",
            "note": "Frontend dist/ not found. Run `npm run build` in the project root.",
            "docs_url": "/docs",
        }

