"""Turn written text into what a narrator would actually say.

TTS models read digits, symbols and acronyms unreliably ("$2.5B", "GPT-4",
"Opus 5.5", "3:30pm"). Professional systems expand these before synthesis;
so do we. Rules run in a fixed order (most specific first) and the user's
pronunciation dictionary is applied last, so it always wins.
"""

import json
import re
from pathlib import Path

from num2words import num2words

from .config import APP_DIR

PRONUNCIATIONS_PATH = APP_DIR / "pronunciations.json"

_MAGNITUDE = {"k": "thousand", "m": "million", "b": "billion", "bn": "billion", "t": "trillion",
              "thousand": "thousand", "million": "million", "billion": "billion", "trillion": "trillion"}
_CURRENCY = {"$": ("dollar", "dollars"), "€": ("euro", "euros"), "£": ("pound", "pounds"), "₹": ("rupee", "rupees")}

# Acronyms people say as words, not letters.
_SPOKEN_AS_WORD = {
    "NASA", "NATO", "SCUBA", "LASER", "RADAR", "UNICEF", "FIFA", "GIF", "JPEG", "PIN", "CAPTCHA",
    "COVID", "ASAP", "YOLO", "FOMO", "OK", "TV", "IKEA", "LEGO", "SIM", "RAM", "ROM", "WIFI", "SaaS",
}
# Common all-caps words that aren't acronyms.
_NOT_ACRONYMS = {"I", "A", "OK"}


def _num(text: str) -> str:
    """Read a number string: integers, decimals ("five point five")."""
    text = text.replace(",", "")
    if "." in text:
        whole, frac = text.split(".", 1)
        whole_words = num2words(int(whole)) if whole else "zero"
        return f"{whole_words} point {' '.join(num2words(int(d)) for d in frac)}"
    return num2words(int(text))


def _pairs(digits: str) -> str:
    """4090 → "forty ninety", 3080 → "thirty eighty", 2000 → "twenty hundred"."""
    hi, lo = digits[:2], digits[2:]
    lo_words = "hundred" if lo == "00" else (f"oh {num2words(int(lo))}" if lo[0] == "0" else num2words(int(lo)))
    return f"{num2words(int(hi))} {lo_words}"


def _money(m: re.Match) -> str:
    symbol, amount, mag = m.group(1), m.group(2), (m.group(3) or "").lower()
    singular, plural = _CURRENCY[symbol]
    words = _num(amount)
    if mag:
        return f"{words} {_MAGNITUDE[mag]} {plural}"
    if "." in amount:  # $4.99 → four dollars and ninety-nine cents
        whole, cents = amount.replace(",", "").split(".", 1)
        cents = (cents + "0")[:2]
        out = f"{num2words(int(whole))} {singular if whole == '1' else plural}"
        return out + (f" and {num2words(int(cents))} cents" if int(cents) else "")
    return f"{words} {singular if amount == '1' else plural}"


def _time(m: re.Match) -> str:
    h, mins, ampm = int(m.group(1)), int(m.group(2) or 0), (m.group(3) or "").lower().replace(".", "")
    words = num2words(h)
    if mins:
        words += " " + (f"oh {num2words(mins)}" if mins < 10 else num2words(mins))
    elif not ampm:
        words += " o'clock"
    if ampm:
        words += " " + " ".join(ampm.upper())
    return words


def _year(m: re.Match) -> str:
    return num2words(int(m.group(0)), to="year")


def _acronym(m: re.Match) -> str:
    word = m.group(0)
    if word in _SPOKEN_AS_WORD or word in _NOT_ACRONYMS:
        return word
    plural = word.endswith("s") and word[:-1].isupper()
    letters = word[:-1] if plural else word
    return " ".join(letters) + ("s" if plural else "")


def _model_name(m: re.Match) -> str:
    """GPT-4o, H100, iOS-17 → letters + spoken number."""
    letters, num, suffix = m.group(1), m.group(2), m.group(3) or ""
    lead = _acronym(re.match(r".+", letters)) if letters.isupper() else letters
    spoken_suffix = " ".join("oh" if c.lower() == "o" else c.upper() for c in suffix)
    return f"{lead} {_num(num)}{(' ' + spoken_suffix) if suffix else ''}"


_RULES: list[tuple[re.Pattern, object]] = [
    # URLs and emails
    (re.compile(r"https?://"), ""),
    (re.compile(r"\bwww\."), "w w w dot "),
    (re.compile(r"\b([\w.-]+)@([\w-]+)\.(com|org|net|io|ai|dev)\b"), lambda m: f"{m.group(1)} at {m.group(2)} dot {m.group(3)}"),
    (re.compile(r"\b([\w-]+)\.(com|org|net|io|ai|dev|co)\b(/\S*)?"), lambda m: f"{m.group(1)} dot {m.group(2)}"),
    # Money with optional magnitude: $2.5B, $10k, €3 million
    (re.compile(r"([$€£₹])\s?(\d[\d,]*(?:\.\d+)?)(?:\s?(bn|[kmbt]\b|thousand|million|billion|trillion))?", re.I), _money),
    # Percentages
    (re.compile(r"(\d[\d,]*(?:\.\d+)?)\s?%"), lambda m: f"{_num(m.group(1))} percent"),
    # Times: 3:30pm, 10 am, 9:05
    (re.compile(r"\b(\d{1,2}):(\d{2})(?:\s?([ap](?:\.m\.|m\b)))?", re.I), _time),
    (re.compile(r"\b(\d{1,2})()\s?([ap](?:\.m\.|m\b))", re.I), _time),
    # Product codes: RTX 4090 → "R T X forty ninety", H100 → "H one hundred"
    (re.compile(r"\b([A-Z]{2,5})\s(\d{4})\b"), lambda m: f"{_acronym(re.match(r'.+', m.group(1)))} {_pairs(m.group(2))}"),
    (re.compile(r"\b([A-Z]{1,4})(\d{2,4})\b"), lambda m: f"{' '.join(m.group(1))} {_num(m.group(2))}"),
    # Model / product names: GPT-4, GPT-4o, H100
    (re.compile(r"\b([A-Za-z]{1,6})-(\d+(?:\.\d+)?)([a-z]{0,2})\b"), _model_name),
    # Versions: v2.1.3 / version 5.5
    (re.compile(r"\bv(\d+(?:\.\d+)+)\b", re.I), lambda m: "version " + " point ".join(_num(p) for p in m.group(1).split("."))),
    # Ordinals: 1st, 22nd
    (re.compile(r"\b(\d+)(st|nd|rd|th)\b"), lambda m: num2words(int(m.group(1)), to="ordinal")),
    # Ranges: 10-20 → ten to twenty
    (re.compile(r"\b(\d+)\s?[-–]\s?(\d+)\b"), lambda m: f"{_num(m.group(1))} to {_num(m.group(2))}"),
    # Multipliers: 10x
    (re.compile(r"\b(\d+(?:\.\d+)?)x\b"), lambda m: f"{_num(m.group(1))} times"),
    # Years (standalone 1100-2099, not part of a larger number)
    (re.compile(r"(?<![\d.,$])\b(1[1-9]\d\d|20\d\d)\b(?![.,]?\d)"), _year),
    # Remaining numbers
    (re.compile(r"\b\d[\d,]*(?:\.\d+)?\b"), lambda m: _num(m.group(0))),
    # Symbols
    (re.compile(r"\s*&\s*"), " and "),
    (re.compile(r"\s\+\s"), " plus "),
    (re.compile(r"\s=\s"), " equals "),
    (re.compile(r"#(\w)"), r"number \1"),
    # Acronyms (2-5 capitals, optional plural s)
    (re.compile(r"\b[A-Z]{2,5}s?\b"), _acronym),
]


def load_pronunciations() -> dict[str, str]:
    try:
        return json.loads(PRONUNCIATIONS_PATH.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        return {}


def save_pronunciations(entries: dict[str, str]) -> None:
    clean = {k.strip(): v.strip() for k, v in entries.items() if k.strip() and v.strip()}
    PRONUNCIATIONS_PATH.write_text(json.dumps(clean, indent=2, ensure_ascii=False), encoding="utf-8")


def _apply_pronunciations(text: str, entries: dict[str, str]) -> str:
    for word in sorted(entries, key=len, reverse=True):
        text = re.sub(rf"(?<!\w){re.escape(word)}(?!\w)", entries[word], text, flags=re.I)
    return text


def normalize_for_speech(text: str) -> str:
    entries = load_pronunciations()
    # Dictionary first for exact terms (so "GPT-4" → custom wins over rules)...
    text = _apply_pronunciations(text, entries)
    for pattern, repl in _RULES:
        text = pattern.sub(repl, text)
    # ...and again after, for words the rules produced.
    text = _apply_pronunciations(text, entries)
    return re.sub(r"[ \t]{2,}", " ", text)
