"""24 kHz → 48 kHz speech super-resolution (AP-BWE, MIT).

Chatterbox-Turbo outputs 24 kHz audio, which has nothing above 12 kHz — the
"air" and crisp sibilance of close-mic studio voice-over. AP-BWE predicts the
missing high band (amplitude and phase) with a small GAN, ~300x real time on
a GPU, so output can be delivered at 48 kHz like commercial TTS.
"""

import json
from pathlib import Path

import numpy as np
import torch
import torchaudio.functional as aF

from . import models

WEIGHTS_DIR = Path(r"G:\KAIZ_AI\apbwe-w") if Path("G:/").exists() else Path(__file__).parent.parent / "apbwe-w"
HF_BASE = "https://huggingface.co/rsxdalv/AP-BWE/resolve/main/weights/24kto48k/"
OUT_SR = 48000


class _Cfg(dict):
    __getattr__ = dict.get


def _stft(audio, n_fft, hop, win):
    window = torch.hann_window(win).to(audio.device)
    spec = torch.stft(audio, n_fft, hop_length=hop, win_length=win, window=window,
                      center=True, pad_mode="reflect", normalized=False, return_complex=True)
    return torch.log(torch.abs(spec) + 1e-4), torch.angle(spec)


def _istft(log_amp, pha, n_fft, hop, win):
    amp = torch.exp(log_amp)
    com = torch.complex(amp * torch.cos(pha), amp * torch.sin(pha))
    window = torch.hann_window(win).to(com.device)
    return torch.istft(com, n_fft, hop_length=hop, win_length=win, window=window, center=True)


def _ensure_weights() -> None:
    WEIGHTS_DIR.mkdir(parents=True, exist_ok=True)
    import urllib.request

    for name in ("config.json", "g_24kto48k.safetensors"):
        target = WEIGHTS_DIR / name
        if not target.exists():
            urllib.request.urlretrieve(HF_BASE + name, target)


def _model():
    def load():
        from safetensors.torch import load_file

        from .apbwe.model import APNet_BWE_Model

        _ensure_weights()
        cfg = _Cfg(json.loads((WEIGHTS_DIR / "config.json").read_text()))
        net = APNet_BWE_Model(cfg)
        state = load_file(str(WEIGHTS_DIR / "g_24kto48k.safetensors"))
        net.load_state_dict(state)
        return net.eval().to(models.device()), cfg

    return models._get("superres", load, heavy=False)


def upsample(audio: np.ndarray, sr: int) -> np.ndarray:
    """Return the audio at 48 kHz with a reconstructed high band."""
    net, cfg = _model()
    dev = models.device()
    x = torch.from_numpy(audio.astype(np.float32)).unsqueeze(0).to(dev)
    if sr != cfg.lr_sampling_rate:
        x = aF.resample(x, sr, cfg.lr_sampling_rate)
    x = aF.resample(x, cfg.lr_sampling_rate, cfg.hr_sampling_rate)
    out = []
    # Process in ~10 s blocks with overlap to bound memory on long scripts.
    block, overlap = cfg.hr_sampling_rate * 10, cfg.hr_sampling_rate // 4
    with torch.inference_mode():
        start = 0
        while start < x.shape[1]:
            seg = x[:, max(0, start - overlap): start + block]
            amp, pha = _stft(seg, cfg.n_fft, cfg.hop_size, cfg.win_size)
            amp_g, pha_g, _ = net(amp, pha)
            y = _istft(amp_g, pha_g, cfg.n_fft, cfg.hop_size, cfg.win_size)[:, : seg.shape[1]]
            y = y[:, (start - max(0, start - overlap)):]
            out.append(y)
            start += block
    y = torch.cat(out, dim=1)[0, : x.shape[1]].float().cpu().numpy()
    return y.astype(np.float32)
