#!/usr/bin/env python3
"""
Offline neural TTS helper for the v43 bundled audio pack.

Every clip in ./audio/ must come from ONE single neural voice engine so the app
never mixes two voices.  This helper is the offline fallback used when the
build machine has no internet access (no Edge/Sonia, no Google, no Youdao):

    python3 scripts/tts_offline.py --manifest audio-manifest.json --out audio

It renders the manifest with Supertonic 3 (Supertone, ONNX, CPU, 44.1 kHz)
through sherpa-onnx and encodes every clip as mono MP3 with lameenc.

The ONNX weights live beside this script only during a build; they are never
committed (they are >100 MB).  Point SDP_SUPERTONIC_DIR at a directory that
contains:

    duration_predictor.onnx  text_encoder.onnx  vector_estimator.onnx
    vocoder.onnx  tts.json  unicode_indexer.bin  voice.bin

Speaker ids in voice.bin are sorted: 0-4 = F1-F5 (female), 5-9 = M1-M5 (male).
The v43 pack uses a single female speaker for every single clip.

Requirements:  pip install sherpa-onnx lameenc numpy
"""

import argparse
import json
import os
import sys
import time

import numpy as np

SAMPLE_RATE = 44100
MP3_KBPS = 64

# One single speaker for the whole pack.  sid 0 = "F1", the default female
# style of Supertonic 3.  Do not change this between clips.
SPEAKER_ID = int(os.environ.get("SDP_TTS_SPEAKER", "0"))


def load_tts(model_dir):
    import sherpa_onnx

    def p(name):
        return os.path.join(model_dir, name)

    config = sherpa_onnx.OfflineTtsConfig(
        model=sherpa_onnx.OfflineTtsModelConfig(
            supertonic=sherpa_onnx.OfflineTtsSupertonicModelConfig(
                duration_predictor=p("duration_predictor.onnx"),
                text_encoder=p("text_encoder.onnx"),
                vector_estimator=p("vector_estimator.onnx"),
                vocoder=p("vocoder.onnx"),
                tts_json=p("tts.json"),
                unicode_indexer=p("unicode_indexer.bin"),
                voice_style=p("voice.bin"),
            ),
            num_threads=int(os.environ.get("SDP_TTS_THREADS", "4")),
            debug=False,
            provider="cpu",
        ),
        max_num_sentences=1,
    )
    if not config.validate():
        raise SystemExit("Supertonic model directory is incomplete: " + model_dir)
    return sherpa_onnx.OfflineTts(config)


def trim(samples, sr, threshold=0.006, pad_ms=60):
    """Trim leading/trailing silence and add a short, deliberate tail."""
    if samples.size == 0:
        return samples
    win = max(1, int(0.01 * sr))
    energy = np.sqrt(np.convolve(samples ** 2, np.ones(win) / win, mode="same"))
    voiced = np.where(energy > threshold)[0]
    if voiced.size:
        start = max(0, voiced[0] - int(pad_ms / 1000.0 * sr))
        end = min(samples.size, voiced[-1] + int(pad_ms / 1000.0 * sr))
        samples = samples[start:end]
    tail = int(0.16 * sr)
    return np.concatenate([samples, np.zeros(tail, dtype=np.float32)])


def normalise(samples, target_rms=0.075, peak=0.94):
    """One consistent loudness for every clip so nothing jumps in level."""
    if samples.size == 0:
        return samples
    rms = float(np.sqrt(np.mean(samples ** 2)))
    if rms > 1e-4:
        samples = samples * (target_rms / rms)
    m = float(np.max(np.abs(samples)))
    if m > peak:
        samples = samples * (peak / m)
    return np.clip(samples, -1.0, 1.0).astype(np.float32)


def to_mp3(samples, sr, path):
    import lameenc

    pcm = np.clip(samples, -1.0, 1.0)
    pcm16 = (pcm * 32767.0).astype("<i2").tobytes()
    enc = lameenc.Encoder()
    enc.set_bit_rate(MP3_KBPS)
    enc.set_in_sample_rate(sr)
    enc.set_channels(1)
    enc.set_quality(2)
    data = enc.encode(pcm16) + enc.flush()
    with open(path, "wb") as fh:
        fh.write(data)
    return len(data)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--manifest", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--force", action="store_true")
    args = ap.parse_args()

    model_dir = os.environ.get("SDP_SUPERTONIC_DIR", "")
    if not model_dir or not os.path.isdir(model_dir):
        raise SystemExit(
            "SDP_SUPERTONIC_DIR must point at the Supertonic 3 ONNX directory "
            "(duration_predictor.onnx, text_encoder.onnx, vector_estimator.onnx, "
            "vocoder.onnx, tts.json, unicode_indexer.bin, voice.bin)."
        )

    with open(args.manifest, "r", encoding="utf-8") as fh:
        manifest = json.load(fh)

    os.makedirs(args.out, exist_ok=True)
    jobs = [c for c in manifest["clips"] if args.force or not os.path.exists(os.path.join(args.out, c["file"]))]
    if not jobs:
        print("offline tts: every clip already exists")
        return 0

    tts = load_tts(model_dir)
    started = time.time()
    total_bytes = 0
    for i, clip in enumerate(jobs):
        audio = tts.generate(clip["text"], sid=SPEAKER_ID, speed=float(clip.get("speed", 0.98)))
        samples = np.array(audio.samples, dtype=np.float32)
        samples = normalise(trim(samples, audio.sample_rate))
        out = os.path.join(args.out, clip["file"])
        size = to_mp3(samples, audio.sample_rate, out)
        total_bytes += size
        print("  %3d/%3d  %-34s %6.2fs  %6d bytes  %s"
              % (i + 1, len(jobs), clip["file"], len(samples) / float(audio.sample_rate), size, clip["text"][:58]))
    print("offline tts: %d clips, %.1f KB, %.1fs (speaker %d)"
          % (len(jobs), total_bytes / 1024.0, time.time() - started, SPEAKER_ID))
    return 0


if __name__ == "__main__":
    sys.exit(main())
