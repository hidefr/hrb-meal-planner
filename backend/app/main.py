import logging
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.api import chat, meal_plan, grocery, media, voice, settings as settings_api
from app.services.telegram_bot import telegram_service

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("tastecraft")

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("[TasteCraft] Starting backend API...")
    # Start Telegram bot if configured
    try:
        await telegram_service.start()
    except Exception as e:
        logger.error(f"Failed to start Telegram Bot: {e}")
    yield
    logger.info("[TasteCraft] Shutting down backend API...")
    try:
        await telegram_service.stop()
    except Exception as e:
        logger.error(f"Error shutting down Telegram Bot: {e}")

app = FastAPI(
    title="TasteCraft API",
    description="AI-First Meal Planner & Grocery List Backend",
    version="1.0.0",
    lifespan=lifespan
)

# Enable CORS for mobile devices across LAN and localhost
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Prevent aggressive Android WebView caching so updates apply immediately on refresh/reopen
@app.middleware("http")
async def add_no_cache_headers(request, call_next):
    response = await call_next(request)
    # Always prevent caching on HTML, JS, JSON API, and root paths
    path = request.url.path
    if path == "/" or path.endswith(".html") or path.endswith(".js") or path.startswith("/api/"):
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate, max-age=0"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
    return response

# Include API Routers
app.include_router(chat.router)
app.include_router(meal_plan.router)
app.include_router(grocery.router)
app.include_router(media.router)
app.include_router(voice.router)
app.include_router(settings_api.router)

@app.get("/api/health")
async def health_check():
    return {
        "status": "healthy",
        "llm_base_url": settings.llm_base_url,
        "llm_model": settings.llm_model,
        "telegram_enabled": bool(settings.telegram_bot_token)
    }

@app.get("/dist/TasteCraft.apk")
@app.get("/TasteCraft.apk")
@app.get("/download")
async def download_apk():
    apk_path = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist" / "TasteCraft.apk"
    if apk_path.exists():
        from fastapi.responses import FileResponse
        return FileResponse(
            path=str(apk_path),
            filename="TasteCraft.apk",
            media_type="application/vnd.android.package-archive"
        )
    return {"error": "APK not found"}

# Check if built frontend exists in frontend/dist
frontend_dist = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"
if frontend_dist.exists():
    app.mount("/", StaticFiles(directory=str(frontend_dist), html=True), name="frontend")
