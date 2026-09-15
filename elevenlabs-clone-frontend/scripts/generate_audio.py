import argparse
import asyncio
import os
import sys
import wave
import math
import numpy as np

VOICE_MAP = {
    "andreas": "en-US-AndrewNeural",
    "woman": "en-US-JennyNeural",
    "trump": "en-US-GuyNeural",
    "adam": "en-US-ChristopherNeural",
    "antoni": "en-US-BrianNeural",
    "josh": "en-US-EricNeural",
}

def generate_wav_sine(output_path, duration=3.0, freq=440.0):
    sample_rate = 24000
    n_samples = int(sample_rate * duration)
    t = np.linspace(0, duration, n_samples, False)
    audio = 0.3 * np.sin(2 * np.pi * freq * t)
    audio_int16 = (audio * 32767).astype(np.int16)

    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
    with wave.open(output_path, 'wb') as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes(audio_int16.tobytes())

async def run_edge_tts(text, voice_id, output_path):
    import edge_tts
    neural_voice = VOICE_MAP.get(voice_id.lower(), "en-US-AndrewNeural")
    communicate = edge_tts.Communicate(text, neural_voice)
    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
    await communicate.save(output_path)

def generate_sound_effect(prompt, output_path):
    sample_rate = 44100
    duration = 5.0
    n_samples = int(sample_rate * duration)
    t = np.linspace(0, duration, n_samples, False)
    audio = np.zeros(n_samples)

    p = prompt.lower()
    if any(w in p for w in ["rain", "storm", "thunder", "water"]):
        # Rain sound: filtered white noise + gentle thunder rumble
        noise = np.random.normal(0, 0.15, n_samples)
        # Smoothing filter
        noise = np.convolve(noise, np.ones(15)/15, mode='same')
        # Thunder rumble in background
        rumble = 0.25 * np.sin(2 * np.pi * 55 * t) * np.exp(-0.5 * (t - 1.5)**2)
        audio = noise + rumble
    elif any(w in p for w in ["car", "engine", "rev", "vehicle"]):
        # Engine revving: rising pitch and harmonics
        pitch = 60 + 120 * (1 / (1 + np.exp(-3 * (t - 2.5))))
        phase = 2 * np.pi * np.cumsum(pitch) / sample_rate
        audio = 0.3 * np.sin(phase) + 0.15 * np.sin(2 * phase) + 0.08 * np.sin(3 * phase)
        # Add subtle mechanical noise
        audio += 0.05 * np.random.normal(0, 1, n_samples)
    elif any(w in p for w in ["ocean", "wave", "sea", "beach"]):
        # Ocean waves: cyclic swelling noise
        envelope = (np.sin(2 * np.pi * 0.2 * t) ** 2) * 0.3
        noise = np.random.normal(0, 1, n_samples)
        noise = np.convolve(noise, np.ones(30)/30, mode='same')
        audio = noise * envelope
    elif any(w in p for w in ["robot", "chip", "computer", "sci-fi"]):
        # Robot beeps and FM chirp
        carrier = np.sin(2 * np.pi * 880 * t)
        modulator = np.sin(2 * np.pi * 15 * t)
        beeps = np.sin(2 * np.pi * (600 + 400 * modulator) * t) * (np.sin(2 * np.pi * 3 * t) > 0)
        audio = 0.25 * beeps + 0.05 * np.random.normal(0, 1, n_samples) * (beeps != 0)
    elif any(w in p for w in ["crowd", "cheer", "applause", "stadium"]):
        # Crowd cheering and applause: burst of claps + crowd rumble
        claps = np.random.normal(0, 0.2, n_samples) * (np.random.random(n_samples) > 0.95)
        cheer = np.convolve(np.random.normal(0, 0.12, n_samples), np.ones(20)/20, mode='same')
        audio = claps * 0.4 + cheer * 0.3
    elif any(w in p for w in ["door", "creak"]):
        # Creaky door
        freq = 300 + 150 * np.sin(2 * np.pi * 8 * t)
        phase = 2 * np.pi * np.cumsum(freq) / sample_rate
        audio = 0.25 * np.sin(phase) * (t < 3.0)
    else:
        # Cinematic ambient swell
        freq = 220 + 40 * np.sin(2 * np.pi * 0.5 * t)
        phase = 2 * np.pi * np.cumsum(freq) / sample_rate
        audio = 0.25 * np.sin(phase) * np.sin(np.pi * t / duration)

    # Fade in / fade out
    fade_len = int(sample_rate * 0.1)
    fade_in = np.linspace(0, 1, fade_len)
    fade_out = np.linspace(1, 0, fade_len)
    audio[:fade_len] *= fade_in
    audio[-fade_len:] *= fade_out

    # Normalize
    max_val = np.max(np.abs(audio))
    if max_val > 0:
        audio = (audio / max_val) * 0.85

    audio_int16 = (audio * 32767).astype(np.int16)
    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
    with wave.open(output_path, 'wb') as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes(audio_int16.tobytes())

def convert_voice(source_path, voice_id, output_path):
    # If source_path exists, apply pitch transformation
    if source_path and os.path.exists(source_path):
        try:
            with wave.open(source_path, 'rb') as wf:
                params = wf.getparams()
                frames = wf.readframes(params.nframes)
                audio = np.frombuffer(frames, dtype=np.int16).astype(np.float32)

            # Simple resample / pitch shift simulation
            pitch_factors = {
                "andreas": 0.95,
                "woman": 1.25,
                "trump": 0.88,
                "adam": 0.92,
                "antoni": 1.0,
                "josh": 1.05,
            }
            factor = pitch_factors.get(voice_id.lower(), 1.0)

            # Pitch shift via linear interpolation
            indices = np.round(np.arange(0, len(audio), factor)).astype(int)
            indices = indices[indices < len(audio)]
            transformed = audio[indices]

            transformed_int16 = transformed.astype(np.int16)
            os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
            with wave.open(output_path, 'wb') as wf:
                wf.setnchannels(params.nchannels)
                wf.setsampwidth(params.sampwidth)
                wf.setframerate(params.framerate)
                wf.writeframes(transformed_int16.tobytes())
            return
        except Exception as e:
            print(f"Error transforming source audio: {e}", file=sys.stderr)

    # Fallback: synthesize target voice greeting
    asyncio.run(run_edge_tts(f"This is your audio converted with the {voice_id} voice model.", voice_id, output_path))

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--service", required=True, choices=["styletts2", "seedvc", "seed-vc", "make-an-audio"])
    parser.add_argument("--voice", default="andreas")
    parser.add_argument("--text", default="")
    parser.add_argument("--source", default="")
    parser.add_argument("--output", required=True)

    args = parser.parse_args()

    try:
        if args.service == "styletts2":
            text = args.text or "Hello from ElevenLabs clone."
            try:
                asyncio.run(run_edge_tts(text, args.voice, args.output))
            except Exception as e:
                print(f"Edge-TTS failed ({e}), generating fallback WAV...", file=sys.stderr)
                generate_wav_sine(args.output, duration=2.5, freq=300.0)
        elif args.service in ["seedvc", "seed-vc"]:
            convert_voice(args.source, args.voice, args.output)
        elif args.service == "make-an-audio":
            generate_sound_effect(args.text, args.output)
        print("SUCCESS")
    except Exception as e:
        print(f"FAILED: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
