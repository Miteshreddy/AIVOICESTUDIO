"""Text front-end: normalisation + splitting into prosody-friendly chunks.

Autoregressive TTS models (Chatterbox in particular) lose expressiveness and
start to drift, mumble or repeat once an utterance goes past ~20-30 s. Humans
also breathe between sentences. So we synthesise sentence-sized chunks and
join them with pauses whose length depends on the punctuation that ended them.
"""

import re
from dataclasses import dataclass

import pysbd

from .text_normalize import normalize_for_speech

_segmenter = pysbd.Segmenter(language="en", clean=False)

# Turbo keeps prosody coherent over a few sentences, so chunks are
# paragraph-sized (up to ~20 s of speech) rather than single sentences.
MAX_CHUNK_CHARS = 320
MIN_CHUNK_CHARS = 25

_REPLACEMENTS = [
    (r"&", " and "),
    (r"%", " percent"),
    (r"\s*@\s*", " at "),
    (r"\bw/\s*", "with "),
    (r"\be\.g\.", "for example"),
    (r"\bi\.e\.", "that is"),
    (r"\betc\.", "et cetera"),
    (r"\bvs\.?\b", "versus"),
    (r"\bDr\.", "Doctor"),
    (r"\bMr\.", "Mister"),
    (r"\bMrs\.", "Missus"),
    (r"\bMs\.", "Miz"),
    (r"\bSt\.", "Saint"),
    (r"[“”]", '"'),
    (r"[‘’]", "'"),
    (r"…", "..."),
    (r"\s+—\s+|—", ", "),  # em dash → comma pause
    (r"\s+-\s+", ", "),
]


@dataclass
class Chunk:
    text: str
    pause_after_ms: int
    paragraph_end: bool = False


def normalize(text: str) -> str:
    text = text.replace("\r\n", "\n")
    text = normalize_for_speech(text)
    for pattern, repl in _REPLACEMENTS:
        text = re.sub(pattern, repl, text)
    text = re.sub(r"\$(\d+(?:\.\d+)?)", r"\1 dollars", text)
    text = re.sub(r"[ \t]+", " ", text)
    return text.strip()


def _pause_for(sentence: str, paragraph_end: bool) -> int:
    if paragraph_end:
        return 560
    s = sentence.rstrip()
    if s.endswith("..."):
        return 520
    if s.endswith(("?", "!")):
        return 380
    if s.endswith((":", ";")):
        return 300
    return 320


def _split_long(sentence: str) -> list[str]:
    """Split a run-on sentence at commas/semicolons so no chunk is too long."""
    if len(sentence) <= MAX_CHUNK_CHARS:
        return [sentence]
    parts = re.split(r"(?<=[,;:])\s+", sentence)
    out, cur = [], ""
    for part in parts:
        if cur and len(cur) + len(part) + 1 > MAX_CHUNK_CHARS:
            out.append(cur)
            cur = part
        else:
            cur = f"{cur} {part}".strip()
    if cur:
        out.append(cur)
    # Last resort: hard split on words.
    final = []
    for piece in out:
        while len(piece) > MAX_CHUNK_CHARS:
            cut = piece.rfind(" ", 0, MAX_CHUNK_CHARS)
            cut = cut if cut > 0 else MAX_CHUNK_CHARS
            final.append(piece[:cut])
            piece = piece[cut:].strip()
        final.append(piece)
    return final


def split_into_chunks(text: str) -> list[Chunk]:
    text = normalize(text)
    paragraphs = [p.strip() for p in re.split(r"\n\s*\n|\n", text) if p.strip()]
    chunks: list[Chunk] = []

    for p_idx, paragraph in enumerate(paragraphs):
        sentences = [s.strip() for s in _segmenter.segment(paragraph) if s.strip()]
        pieces: list[str] = []
        for sentence in sentences:
            pieces.extend(_split_long(sentence))

        # Pack consecutive sentences into one chunk (up to MAX_CHUNK_CHARS) so
        # the model hears the surrounding context and intonation flows across
        # sentence boundaries instead of resetting at every full stop.
        merged: list[str] = []
        for piece in pieces:
            if merged and len(merged[-1]) + len(piece) + 1 <= MAX_CHUNK_CHARS:
                merged[-1] = f"{merged[-1]} {piece}"
            else:
                merged.append(piece)

        for i, piece in enumerate(merged):
            last_in_paragraph = i == len(merged) - 1
            if not re.search(r"[.!?…\"')\]]$", piece):
                piece += "."
            chunks.append(
                Chunk(piece, _pause_for(piece, last_in_paragraph and p_idx < len(paragraphs) - 1), last_in_paragraph)
            )

    if chunks:
        chunks[-1].pause_after_ms = 0
    return chunks
