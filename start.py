#!/usr/bin/env python3
"""
POLAR-X Production Startup Script
===================================
Usage:
    python start.py

Environment variables (set in .env or shell):
    HOST            Bind host (default: 0.0.0.0)
    PORT            Bind port (default: 8000)
    WORKERS         Number of uvicorn workers (default: 1 — SQLite is single-writer)
    LOG_LEVEL       Uvicorn log level: debug|info|warning|error (default: info)
    DATABASE_URL    SQLite path or PostgreSQL URL (default: ./backend/polar_x.db)
    CORS_ORIGINS    Comma-separated allowed origins (default: * for all)
"""
import os
import sys

# Ensure project root is in sys.path
PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

# ── Load .env file if present (dev/staging convenience) ──────────────────────
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass  # python-dotenv optional; env vars should be set by the platform

import uvicorn

HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", "8000"))
WORKERS = int(os.getenv("WORKERS", "1"))
LOG_LEVEL = os.getenv("LOG_LEVEL", "info")

if __name__ == "__main__":
    print(f"[POLAR-X] Production server starting on http://{HOST}:{PORT}")
    uvicorn.run(
        "backend.main:app",
        host=HOST,
        port=PORT,
        workers=WORKERS,
        log_level=LOG_LEVEL,
        # reload=False in production; set RELOAD=1 for dev hot-reload
        reload=os.getenv("RELOAD", "0") == "1",
    )
