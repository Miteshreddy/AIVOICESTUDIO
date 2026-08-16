import os
from pathlib import Path

APP_DIR = Path(__file__).resolve().parent.parent
VOICES_DIR = APP_DIR / "voices"
VOICES_DIR.mkdir(exist_ok=True)
GENERATIONS_DIR = APP_DIR / "generations"
GENERATIONS_DIR.mkdir(exist_ok=True)

HOST = os.environ.get("ML_SERVICE_HOST", "0.0.0.0")
PORT = int(os.environ.get("ML_SERVICE_PORT", "8095"))
DEVICE = os.environ.get("ML_SERVICE_DEVICE", "cuda")
