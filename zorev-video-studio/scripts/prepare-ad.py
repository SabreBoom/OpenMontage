"""Prepare one ad: normalised voice track + word-timed captions + edit points.
  python3 scripts/prepare-ad.py <key> <presenter take mp4> <split word> "<exact script>"
Captions show the exact script words, timed from whisper.cpp word timestamps
of the presenter's own audio, so they match what she says."""
import json, re, subprocess, sys
from pathlib import Path

key, take, split_word, script = sys.argv[1:5]
out = Path("public/ads") / key
out.mkdir(parents=True, exist_ok=True)

subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", take, "-vn", "-af",
                "loudnorm=I=-16:TP=-2:LRA=7", "-ar", "48000", "-ac", "2", str(out / "voice.wav")], check=True)
raw = out / "whisper.json"
subprocess.run(["node", "scripts/transcribe-local.mjs", take, str(raw)], check=True, capture_output=True)
heard = [c for c in json.loads(raw.read_text()) if c["text"].strip()]

sys.path.insert(0, str(Path(__file__).parent))
from align_words import align, norm  # noqa: E402

words = script.split()
timed, mismatch = align(words, heard)

# caption segments: sentence -> comma clauses -> balanced chunks of at most 5 words,
# never ending a chunk on a small function word
WEAK = {"a", "an", "the", "to", "for", "into", "with", "on", "in", "and", "of", "your", "that"}
def chunks(clause):
    n = len(clause)
    if n <= 5: return [clause]
    k = -(-n // 5)
    size = n / k
    out, i = [], 0
    for c in range(k - 1):
        j = round(size * (c + 1))
        best = min((x for x in range(max(i + 2, j - 1), min(n - 1, j + 2))),
                   key=lambda x: (clause[x - 1]["text"].lower().strip(",.?!") in WEAK, abs(x - j)))
        out.append(clause[i:best]); i = best
    out.append(clause[i:])
    return out
segs, sent, clause = [], [], []
for w in timed:
    clause.append(w)
    if w["text"][-1] in ",.?!":
        segs.extend(chunks(clause)); clause = []
if clause: segs.extend(chunks(clause))
# merge a 1-2 word chunk into its neighbour inside the same sentence when it stays <= 6 words
merged = []
for c in segs:
    if merged and len(c) <= 2 and merged[-1][-1]["text"][-1] not in ".?!" and len(merged[-1]) + len(c) <= 6:
        merged[-1] = merged[-1] + c
    else:
        merged.append(c)
segs = merged
captions = [{"text": " ".join(x["text"] for x in s), "startMs": s[0]["startMs"], "endMs": s[-1]["endMs"],
             "words": s} for s in segs]

first_end = next(i for i, w in enumerate(timed) if w["text"][-1] in ".?!")
hook_end = min(timed[first_end]["endMs"] + 250, timed[first_end + 1]["startMs"] - 40)
split = next(w["startMs"] for w in timed[first_end + 1:] if norm(w["text"]) == norm(split_word)) - 60
cta = next(w["startMs"] for w in timed if norm(w["text"]) == "shop") - 200
ad = {"key": key, "hookEndMs": hook_end, "splitMs": split, "ctaStartMs": cta,
      "speechEndMs": timed[-1]["endMs"], "captions": captions}
(out / "ad.json").write_text(json.dumps(ad, indent=1))
print(json.dumps({k: ad[k] for k in ("hookEndMs", "splitMs", "ctaStartMs", "speechEndMs")}),
      "| segments:", [c["text"] for c in captions], "| loosely matched:", mismatch)
