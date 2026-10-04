import os
from pathlib import Path
from pydantic import BaseModel
from dotenv import load_dotenv

# Load .env file from root or backend folder
env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(dotenv_path=env_path)

class Settings(BaseModel):
    # LLM Settings (OpenAI-compatible format: works with Hermes / Ollama / vLLM / LM Studio / OpenRouter / OpenAI)
    llm_base_url: str = os.getenv("LLM_BASE_URL", "http://localhost:11434/v1")
    llm_api_key: str = os.getenv("LLM_API_KEY", "hermes")
    llm_model: str = os.getenv("LLM_MODEL", "hermes-3-llama-3.1-8b")
    
    # Telegram Bot integration
    telegram_bot_token: str = os.getenv("TELEGRAM_BOT_TOKEN", "")
    telegram_allowed_users: str = os.getenv("TELEGRAM_ALLOWED_USERS", "") # comma-separated IDs or empty for any
    
    # Server host & port
    host: str = os.getenv("HOST", "0.0.0.0")
    port: int = int(os.getenv("PORT", "8000"))
    
    # ElevenLabs Voice integration (Optional for ultra-lifelike neural chef speech)
    elevenlabs_api_key: str = os.getenv("ELEVENLABS_API_KEY", "")
    elevenlabs_voice_id: str = os.getenv("ELEVENLABS_VOICE_ID", "21m00Tcm4TlvDq8ikWAM") # Rachel (default warm voice)
    elevenlabs_model_id: str = os.getenv("ELEVENLABS_MODEL_ID", "eleven_turbo_v2_5")

    # Storage directory
    data_dir: Path = Path(__file__).resolve().parent.parent / "data"

settings = Settings()
settings.data_dir.mkdir(parents=True, exist_ok=True)
