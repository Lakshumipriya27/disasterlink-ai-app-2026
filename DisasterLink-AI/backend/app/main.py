"""DisasterLink AI - FastAPI application entry point.

Run:  uvicorn app.main:app --reload --port 8000     (Swagger UI at http://localhost:8000/docs)
"""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

from .config import APP_VERSION, CORS_ORIGINS, SEED_ON_STARTUP
from .database import SessionLocal
from .routers import (admin, ai, analytics, auth, family, matching, media, requests, resources, shelters, sos, sync,
                      volunteers, vulnerable)
from .seed import init_db

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("disasterlink")


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db(seed_if_empty=SEED_ON_STARTUP)
    log.info("DisasterLink AI backend ready (v%s)", APP_VERSION)
    yield


app = FastAPI(
    title="DisasterLink AI API",
    version=APP_VERSION,
    description="Intelligent, inclusive & offline-first disaster relief coordination. "
                "All AI outputs are advisory; authorised coordinators make final decisions. "
                "Demo data is SIMULATED.",
    lifespan=lifespan,
)

app.add_middleware(CORSMiddleware, allow_origins=CORS_ORIGINS, allow_credentials=True, allow_methods=["*"],
                   allow_headers=["*"])


@app.exception_handler(RequestValidationError)
async def validation_handler(request: Request, exc: RequestValidationError):
    msgs = []
    for e in exc.errors():
        loc = ".".join(str(x) for x in e["loc"] if x not in ("body", "query", "path"))
        msgs.append(f"{loc}: {e['msg']}" if loc else e["msg"])
    return JSONResponse(status_code=422, content={"detail": "; ".join(msgs), "errors": exc.errors()},)


@app.exception_handler(Exception)
async def unhandled(request: Request, exc: Exception):
    log.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(status_code=500, content={"detail": "Internal server error. The error has been logged."})


for r in (auth.router, requests.router, sos.router, media.router, ai.router, vulnerable.router, resources.router,
          matching.router, shelters.router, volunteers.router, family.router, analytics.router,
          analytics.notif_router, sync.router, admin.router):
    app.include_router(r)


@app.get("/api/health", tags=["Health"], summary="Liveness + database check (used by the offline sync engine)")
def health():
    db = SessionLocal()
    try:
        db.execute(text("SELECT 1"))
        ok = True
    except Exception:  # noqa: BLE001
        ok = False
    finally:
        db.close()
    return {"status": "ok" if ok else "degraded", "database": ok, "version": APP_VERSION}


@app.get("/", include_in_schema=False)
def root():
    return {"name": "DisasterLink AI API", "docs": "/docs", "health": "/api/health"}
