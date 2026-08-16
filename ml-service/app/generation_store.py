import json
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from .config import GENERATIONS_DIR

METADATA_FILENAME = "metadata.json"
AUDIO_FILENAME = "audio.wav"


def _generation_dir(generation_id: str) -> Path:
    return GENERATIONS_DIR / generation_id


def create_generation(
    voice_id: Optional[str],
    voice_name: str,
    text: str,
    duration_seconds: float,
    audio_bytes: bytes,
) -> dict:
    generation_id = str(uuid.uuid4())
    gen_dir = _generation_dir(generation_id)
    gen_dir.mkdir(parents=True, exist_ok=True)

    (gen_dir / AUDIO_FILENAME).write_bytes(audio_bytes)

    metadata = {
        "id": generation_id,
        "voiceId": voice_id,
        "voiceName": voice_name,
        "text": text,
        "durationSeconds": duration_seconds,
        "status": "ready",
        "favorite": False,
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "updatedAt": datetime.now(timezone.utc).isoformat(),
    }
    (gen_dir / METADATA_FILENAME).write_text(json.dumps(metadata))
    return metadata


def get_generation_metadata(generation_id: str) -> Optional[dict]:
    metadata_path = _generation_dir(generation_id) / METADATA_FILENAME
    if not metadata_path.exists():
        return None
    data = json.loads(metadata_path.read_text())
    data.setdefault("status", "ready")
    data.setdefault("favorite", False)
    return data


def update_generation(
    generation_id: str,
    favorite: Optional[bool] = None,
    status: Optional[str] = None,
) -> Optional[dict]:
    metadata = get_generation_metadata(generation_id)
    if not metadata:
        return None
    if favorite is not None:
        metadata["favorite"] = favorite
    if status is not None:
        metadata["status"] = status
    metadata["updatedAt"] = datetime.now(timezone.utc).isoformat()
    (_generation_dir(generation_id) / METADATA_FILENAME).write_text(json.dumps(metadata))
    return metadata


def get_audio_path(generation_id: str) -> Optional[Path]:
    audio_path = _generation_dir(generation_id) / AUDIO_FILENAME
    return audio_path if audio_path.exists() else None


def list_generations(limit: int = 200) -> list[dict]:
    if not GENERATIONS_DIR.exists():
        return []
    generations = []
    for entry in GENERATIONS_DIR.iterdir():
        if entry.is_dir():
            metadata = get_generation_metadata(entry.name)
            if metadata:
                generations.append(metadata)
    generations.sort(key=lambda g: g["createdAt"], reverse=True)
    return generations[:limit]


def delete_generation(generation_id: str) -> bool:
    gen_dir = _generation_dir(generation_id)
    if not gen_dir.exists():
        return False
    for child in gen_dir.iterdir():
        child.unlink()
    gen_dir.rmdir()
    return True
