import logging
import os
import uuid
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.requests import Request as StarletteRequest

from backend.routers.coordinates import router as coordinates_router
from backend.routers.floors import router as floors_router
from backend.routers.heatmap import router as heatmap_router
from backend.routers.lots import router as lots_router
from backend.routers.trends import router as trends_router
from backend.utils.db import (
    check_warehouse_config,
    run_sql,
)
from backend.utils.rate_limit import (
    RateLimitExceeded,
    SlowAPIMiddleware,
    limiter,
    rate_limit_handler,
)

STATIC_DIR: Path = Path(__file__).parent.parent / "frontend" / "dist"
_NO_CACHE = {"Cache-Control": "no-store"}

app = FastAPI(title="EM Visualisation API", docs_url="/api/docs", redoc_url=None)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, rate_limit_handler)
app.add_middleware(SlowAPIMiddleware)

app.include_router(floors_router, prefix="/api/em", tags=["Floors"])
app.include_router(heatmap_router, prefix="/api/em", tags=["Heatmap"])
app.include_router(trends_router, prefix="/api/em", tags=["Trends"])
app.include_router(lots_router, prefix="/api/em", tags=["Lots"])
app.include_router(coordinates_router, prefix="/api/em", tags=["Coordinates"])


@app.exception_handler(Exception)
async def global_exception_handler(request: StarletteRequest, exc: Exception):
    if isinstance(exc, HTTPException):
        return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})
    error_id = str(uuid.uuid4())
    logging.getLogger(__name__).exception(
        "Unhandled exception error_id=%s method=%s path=%s",
        error_id,
        request.method,
        request.url.path,
    )
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error", "error_id": error_id},
    )


@app.get("/api/health")
async def health():
    return {"status": "ok"}


@app.get("/api/ready")
async def ready():
    try:
        check_warehouse_config()
    except HTTPException as exc:
        raise HTTPException(
            status_code=503,
            detail={"status": "not_ready", "reason": "warehouse_config_missing"},
        ) from exc

    readiness_token = os.environ.get("DATABRICKS_READINESS_TOKEN", "").strip()
    if not readiness_token:
        raise HTTPException(
            status_code=503,
            detail={"status": "not_ready", "reason": "readiness_token_missing"},
        )

    try:
        rows = run_sql(readiness_token, "SELECT 1 AS ok")
    except Exception as exc:
        raise HTTPException(
            status_code=503,
            detail={"status": "not_ready", "reason": "sql_warehouse_unreachable"},
        ) from exc

    return {"status": "ready", "checks": {"config": "ok", "sql_warehouse": "ok"}}


if (STATIC_DIR / "assets").exists():
    app.mount("/assets", StaticFiles(directory=STATIC_DIR / "assets"), name="assets")


@app.get("/", include_in_schema=False)
async def serve_index():
    if not STATIC_DIR.exists():
        return {"status": "backend running", "frontend": "not built"}
    return FileResponse(STATIC_DIR / "index.html", headers=_NO_CACHE)


@app.get("/{full_path:path}", include_in_schema=False)
async def serve_spa(full_path: str):
    if STATIC_DIR.exists():
        candidate = STATIC_DIR / full_path
        if candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(STATIC_DIR / "index.html", headers=_NO_CACHE)
    raise HTTPException(status_code=404, detail="Frontend not built.")
