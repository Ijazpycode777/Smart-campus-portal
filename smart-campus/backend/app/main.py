"""FastAPI application factory and lifespan.

Wires:
  * CORS (configured origins only)
  * CSRF double-submit cookie middleware
  * rate limiting (slowapi)
  * request-id + security headers
  * structured exception handlers
  * /api/v1 router
  * /health endpoint
  * static frontend serving (production single-origin)
  * optional demo data seeding on startup
"""
from __future__ import annotations

import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from app.api.v1 import api_router
from app.core.config import settings
from app.core.exceptions import add_exception_handlers
from app.middleware.csrf import CSRFMiddleware
from app.middleware.security import RequestIdMiddleware, SecurityHeadersMiddleware

log = logging.getLogger("smartcampus")
logging.basicConfig(level=getattr(logging, settings.app_log_level.upper(), logging.INFO))

limiter = Limiter(key_func=get_remote_address, default_limits=[settings.default_rate_limit])


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Optional demo seeding (only when explicitly enabled).
    if settings.seed_reset_on_start and settings.app_env != "production":
        try:
            from app.seed import seed_demo_data

            await seed_demo_data()
            log.info("Demo data seeded.")
        except Exception as exc:  # noqa: BLE001
            log.warning("Seeding skipped: %s", exc)
    yield


def create_app() -> FastAPI:
    app = FastAPI(
        title="Smart Campus",
        description="College management system — students, teachers, attendance, "
                    "examinations, fees, materials and more.",
        version="1.0.0",
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
        lifespan=lifespan,
    )

    # Order matters: outermost first.
    app.add_middleware(RequestIdMiddleware)
    app.add_middleware(SecurityHeadersMiddleware)
    app.add_middleware(CSRFMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(settings.allowed_origin_set()),
        allow_credentials=True,
        allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
        allow_headers=["*"],
    )

    # Rate limiting state
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

    add_exception_handlers(app)

    # API
    app.include_router(api_router, prefix=settings.api_v1_prefix)

    # Health
    @app.get("/health", tags=["meta"])
    async def health():
        return {"status": "ok", "app": settings.app_name, "env": settings.app_env}

    # Serve the built frontend (single-origin production deployment).
    dist = Path(os.environ.get("FRONTEND_DIST_DIR", settings.frontend_dist_dir))
    if dist.exists() and (dist / "index.html").exists():
        app.mount("/", StaticFiles(directory=str(dist), html=True), name="frontend")
        log.info("Serving frontend from %s", dist)
    else:
        @app.get("/", tags=["meta"])
        async def root():
            return {
                "name": settings.app_name,
                "docs": "/docs",
                "frontend": "not built — run `npm run build` in frontend/ and restart",
            }

    return app


app = create_app()
