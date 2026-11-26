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

norm = lambda s: re.sub(r"[^a-z0-9]", "", s.lower())
words = script.split()

# Align script and transcript letter by letter, so the captions always show the
# exact script even where whisper splits, joins or mishears a word
# ("waterfall", "Lincoln Bio", "flame, like"). Each script word takes its time
# from the transcript letters it lines up with.
from difflib import SequenceMatcher
S, s_word = "", []
for k, w in enumerate(words):
    S += norm(w); s_word += [k] * len(norm(w))
R, r_time = "", []
for h in heard:
    n = norm(h["text"])
    for o in range(len(n)):
        a = h["startMs"] + (h["endMs"] - h["startMs"]) * o / len(n)
        b = h["startMs"] + (h["endMs"] - h["startMs"]) * (o + 1) / len(n)
        r_time.append((a, b))
    R += n
s2r = {}
for blk in SequenceMatcher(None, S, R, autojunk=False).get_matching_blocks():
    for d in range(blk.size):
        s2r[blk.a + d] = blk.b + d
timed, mismatch = [], []
pos = 0
for k, w in enumerate(words):
    span = range(pos, pos + len(norm(w)))
    pos += len(norm(w))
    hit = [s2r[c] for c in span if c in s2r]
    if len(hit) < 0.6 * len(span):
        mismatch.append(w)
    timed.append({"text": w, "startMs": round(r_time[hit[0]][0]) if hit else None,
                  "endMs": round(r_time[hit[-1]][1]) if hit else None})
# words with no matched letters: share the gap between their neighbours
for k, w in enumerate(timed):
    if w["startMs"] is None:
        prev = next((x["endMs"] for x in reversed(timed[:k]) if x["endMs"] is not None), 0)
        nxt = next((x["startMs"] for x in timed[k + 1:] if x["startMs"] is not None), prev + 300)
        w["startMs"], w["endMs"] = prev, max(prev + 1, nxt)
for a, b in zip(timed, timed[1:]):  # keep word times monotonic
    b["startMs"] = max(b["startMs"], a["startMs"])
    b["endMs"] = max(b["endMs"], b["startMs"] + 1)

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
