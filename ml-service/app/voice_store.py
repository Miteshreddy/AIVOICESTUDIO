import json
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from .config import VOICES_DIR

METADATA_FILENAME = "metadata.json"
REFERENCE_FILENAME = "reference.wav"


def _voice_dir(voice_id: str) -> Path:
    return VOICES_DIR / voice_id


def create_voice(
    name: str,
    description: str,
    reference_bytes: bytes,
    tags: Optional[list[str]] = None,
    source: str = "user",
    voice_id: Optional[str] = None,
    gender: Optional[str] = None,
    speed: float = 1.0,
) -> dict:
    voice_id = voice_id or str(uuid.uuid4())
    voice_dir = _voice_dir(voice_id)
    voice_dir.mkdir(parents=True, exist_ok=True)

    (voice_dir / REFERENCE_FILENAME).write_bytes(reference_bytes)

    metadata = {
        "id": voice_id,
        "name": name,
        "description": description,
        "tags": tags or [],
        "gender": gender,
        # Playback-rate multiplier applied at generation time (pitch-preserving
        # time-stretch) — Chatterbox exposes no direct speaking-rate control,
        # so this is how voices like TIK 1/2 actually deliver faster speech
        # rather than just sounding more "energetic" at the same pace.
        "speed": speed,
        "source": source,
        "generationCount": 0,
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "updatedAt": datetime.now(timezone.utc).isoformat(),
    }
    (voice_dir / METADATA_FILENAME).write_text(json.dumps(metadata))
    return metadata


def get_voice_metadata(voice_id: str) -> Optional[dict]:
    metadata_path = _voice_dir(voice_id) / METADATA_FILENAME
    if not metadata_path.exists():
        return None
    data = json.loads(metadata_path.read_text())
    data.setdefault("tags", [])
    data.setdefault("generationCount", 0)
    data.setdefault("updatedAt", data.get("createdAt"))
    data.setdefault("source", "user")
    data.setdefault("gender", None)
    data.setdefault("speed", 1.0)
    return data


def update_voice(
    voice_id: str,
    name: Optional[str] = None,
    description: Optional[str] = None,
    tags: Optional[list[str]] = None,
    speed: Optional[float] = None,
) -> Optional[dict]:
    metadata = get_voice_metadata(voice_id)
    if not metadata:
        return None
    if name is not None:
        metadata["name"] = name
    if description is not None:
        metadata["description"] = description
    if tags is not None:
        metadata["tags"] = tags
    if speed is not None:
        metadata["speed"] = speed
    metadata["updatedAt"] = datetime.now(timezone.utc).isoformat()
    (_voice_dir(voice_id) / METADATA_FILENAME).write_text(json.dumps(metadata))
    return metadata


def increment_generation_count(voice_id: str) -> None:
    metadata = get_voice_metadata(voice_id)
    if not metadata:
        return
    metadata["generationCount"] = metadata.get("generationCount", 0) + 1
    (_voice_dir(voice_id) / METADATA_FILENAME).write_text(json.dumps(metadata))


def get_reference_path(voice_id: str) -> Optional[Path]:
    reference_path = _voice_dir(voice_id) / REFERENCE_FILENAME
    return reference_path if reference_path.exists() else None


def list_voices() -> list[dict]:
    voices = []
    for entry in VOICES_DIR.iterdir():
        if entry.is_dir():
            metadata = get_voice_metadata(entry.name)
            if metadata:
                voices.append(metadata)
    return sorted(voices, key=lambda v: v["createdAt"], reverse=True)


def delete_voice(voice_id: str) -> bool:
    voice_dir = _voice_dir(voice_id)
    if not voice_dir.exists():
        return False
    for child in voice_dir.iterdir():
        child.unlink()
    voice_dir.rmdir()
    return True
