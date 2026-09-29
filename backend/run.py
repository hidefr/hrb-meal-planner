import sys
import uvicorn
from app.config import settings

if sys.stdout is None or sys.stderr is None:
    log_file = settings.data_dir / "server.log"
    log_stream = open(log_file, "a", buffering=1, encoding="utf-8")
    if sys.stdout is None:
        sys.stdout = log_stream
    if sys.stderr is None:
        sys.stderr = log_stream

if __name__ == "__main__":
    print(f"[TasteCraft] Starting server at http://{settings.host}:{settings.port}")
    uvicorn.run("app.main:app", host=settings.host, port=settings.port, reload=False)
