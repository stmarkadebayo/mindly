"""Compare speech models on your own recordings.

Put clips in a folder as NAME.webm/.m4a/.wav/.mp3 with the true words in NAME.txt, then:

    python scripts/asr_eval.py clips/ \
        --model groq=https://api.groq.com/openai/v1,whisper-large-v3-turbo,$GROQ_KEY \
        --model naijavox=https://YOUR-HOST/v1,naijavox-2.0,$KEY

Prints word error rate per model (lower is better), overall and per clip. Name clips with a
prefix such as en_, pcm_, yo_, es_, fr_ to get a per-language summary.
"""

import argparse
import re
import sys
from collections import defaultdict
from pathlib import Path

import httpx

AUDIO = {".webm", ".m4a", ".mp4", ".wav", ".mp3", ".ogg"}


def words(text: str) -> list[str]:
    return re.findall(r"[\w']+", text.lower())


def wer(ref: list[str], hyp: list[str]) -> tuple[int, int]:
    """(word errors, reference words) by edit distance."""
    prev = list(range(len(hyp) + 1))
    for i, r in enumerate(ref, 1):
        cur = [i]
        for j, h in enumerate(hyp, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (r != h)))
        prev = cur
    return prev[-1], len(ref)


def transcribe(base: str, model: str, key: str, path: Path) -> str:
    with path.open("rb") as f:
        r = httpx.post(f"{base}/audio/transcriptions", headers={"Authorization": f"Bearer {key}"},
                       data={"model": model, "temperature": "0", "response_format": "json"},
                       files={"file": (path.name, f)}, timeout=120)
    r.raise_for_status()
    return r.json().get("text", "")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("folder", type=Path)
    ap.add_argument("--model", action="append", required=True, help="label=base_url,model,api_key")
    args = ap.parse_args()
    clips = sorted(p for p in args.folder.iterdir() if p.suffix.lower() in AUDIO and p.with_suffix(".txt").exists())
    if not clips:
        sys.exit("No clips with a matching .txt transcript found.")
    for spec in args.model:
        label, rest = spec.split("=", 1)
        base, model, key = rest.split(",", 2)
        totals = defaultdict(lambda: [0, 0])
        print(f"\n== {label} ({model})")
        for clip in clips:
            ref = words(clip.with_suffix(".txt").read_text())
            errs, n = wer(ref, words(transcribe(base, model, key, clip)))
            group = clip.stem.split("_")[0] if "_" in clip.stem else "all"
            for g in (group, "ALL"):
                totals[g][0] += errs
                totals[g][1] += n
            print(f"  {clip.name}: {errs / max(n, 1):.1%}")
        for g, (e, n) in sorted(totals.items()):
            print(f"  [{g}] WER {e / max(n, 1):.1%} over {n} words")


if __name__ == "__main__":
    main()
