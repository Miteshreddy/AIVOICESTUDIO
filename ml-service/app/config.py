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

# Sample rate every engine's output is resampled to before mastering, so
# chunks from different engines/voices can be concatenated and compared.
OUTPUT_SR = 24000

# Sound-effects model. AudioLDM2 is ungated on Hugging Face (no token needed).
SFX_MODEL_ID = os.environ.get("SFX_MODEL_ID", "cvssp/audioldm2")

# Only one large model on the GPU at a time: Turbo alone peaks at ~5 GB on an 8 GB card.
MAX_RESIDENT_MODELS = int(os.environ.get("MAX_RESIDENT_MODELS", "1"))
