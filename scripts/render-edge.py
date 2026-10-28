#!/usr/bin/env python3
"""Render a manifest with Microsoft Edge's neural voices, atomically and with retries."""
import asyncio
import json
import os
import pathlib
import sys

import edge_tts


async def main():
    manifest = json.loads(pathlib.Path(sys.argv[1]).read_text(encoding='utf-8'))
    out = pathlib.Path(sys.argv[2])
    force = '--force' in sys.argv[3:]
    out.mkdir(parents=True, exist_ok=True)
    sem = asyncio.Semaphore(int(os.environ.get('SDP_TTS_CONCURRENCY', '4')))
    failures = []

    async def render(clip):
        dest = out / clip['file']
        if not force and dest.exists() and dest.stat().st_size > 1000:
            return
        async with sem:
            tmp = dest.with_suffix('.mp3.part')
            for attempt in range(5):
                try:
                    await edge_tts.Communicate(clip['text'], clip['voice']).save(str(tmp))
                    if tmp.stat().st_size <= 1000:
                        raise ValueError('audio output is too small')
                    tmp.replace(dest)
                    print(clip['file'] + ' (' + clip['voice'] + ')', flush=True)
                    return
                except Exception as exc:
                    tmp.unlink(missing_ok=True)
                    if attempt == 4:
                        failures.append(clip['file'] + ': ' + str(exc))
                    else:
                        await asyncio.sleep(1.5 * (attempt + 1))

    await asyncio.gather(*(render(clip) for clip in manifest['clips']))
    if failures:
        raise SystemExit('Rendering failed:\n' + '\n'.join(failures))
    print('Rendered the complete neural voice pack.', flush=True)


if __name__ == '__main__':
    asyncio.run(main())
