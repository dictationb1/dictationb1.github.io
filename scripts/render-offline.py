#!/usr/bin/env python3
"""Offline fallback renderer for the Smart Dictation studio pack.

The official pack is rendered with Microsoft Edge neural voices
(en-GB-SoniaNeural / si-LK-ThiliniNeural) by scripts/render-edge.py.
When that endpoint is unreachable, this offline renderer produces real
British English speech with espeak-ng (en-gb+f3) and encodes it to MP3
with lameenc, so every clip in ./audio stays playable and offline-safe.

    python3 scripts/render-offline.py <manifest.json> <out-dir> [--force]
"""
import ctypes, json, pathlib, sys, wave

import espeakng_loader
import lameenc

SR = 22050
VOICE = "en-gb+f3"


class Speaker:
    def __init__(self):
        self.lib = ctypes.CDLL(espeakng_loader.get_library_path())
        self.data = espeakng_loader.get_data_path().encode()
        self.pcm = bytearray()
        self.cb = ctypes.CFUNCTYPE(
            ctypes.c_int, ctypes.POINTER(ctypes.c_short), ctypes.c_int, ctypes.c_void_p
        )(self._on_pcm)
        self.lib.espeak_Initialize.restype = ctypes.c_int
        self.lib.espeak_Initialize(2, 0, self.data, 0)
        self.lib.espeak_SetVoiceByName(VOICE.encode())
        self.lib.espeak_SetSynthCallback(self.cb)
        self.lib.espeak_SetParameter(1, 132, 0)   # speed (words per minute)
        self.lib.espeak_SetParameter(2, 62, 0)    # pitch
        self.lib.espeak_SetParameter(3, 175, 0)   # amplitude

    def _on_pcm(self, wav, count, events):
        if count > 0:
            self.pcm.extend(ctypes.string_at(wav, count * 2))
        return 0

    def render(self, text, voice=None):
        self.pcm = bytearray()
        self.lib.espeak_SetVoiceByName((voice or VOICE).encode())
        raw = text.encode("utf-8")
        self.lib.espeak_Synth(raw, len(raw) + 1, 0, 1, 0, 1, None, None)
        self.lib.espeak_Synchronize()
        pcm = bytes(self.pcm) + b"\x00\x00" * int(SR * 0.55)
        enc = lameenc.Encoder()
        enc.set_bit_rate(32)
        enc.set_in_sample_rate(SR)
        enc.set_channels(1)
        enc.set_quality(5)
        return enc.encode(pcm) + enc.flush()


def main():
    manifest = json.loads(pathlib.Path(sys.argv[1]).read_text(encoding="utf-8"))
    out = pathlib.Path(sys.argv[2])
    out.mkdir(parents=True, exist_ok=True)
    force = "--force" in sys.argv[3:]
    only = [a for a in sys.argv[3:] if not a.startswith("--")]
    speaker = Speaker()
    made = skipped = 0
    for clip in manifest["clips"]:
        name = clip["file"]
        if only and not any(name.startswith(p) for p in only):
            continue
        dest = out / name
        if not force and dest.exists() and dest.stat().st_size > 1000:
            skipped += 1
            continue
        voice = "si" if clip.get("voice", "").startswith("si-") else None
        if voice and name != "guide-si.mp3":
            continue
        data = speaker.render(clip["text"], "en-gb+f3" if voice else None)
        if len(data) <= 1000:
            raise SystemExit("too small: " + name)
        dest.write_bytes(data)
        made += 1
        print(name, len(data), flush=True)
    print("rendered %d, kept %d" % (made, skipped), flush=True)


if __name__ == "__main__":
    main()
