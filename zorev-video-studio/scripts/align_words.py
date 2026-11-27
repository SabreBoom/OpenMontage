"""Script-to-transcript word alignment shared by prepare-ad.py and the skit tools.

align(script_words, heard) -> (timed, loosely_matched)
  script_words: the exact words to show (punctuation kept)
  heard: whisper word timings [{"text", "startMs", "endMs"}, ...]
Aligns letter by letter, so the captions always show the exact script even
where whisper splits, joins or mishears a word ("waterfall", "Lincoln Bio",
"flame, like"). Each script word takes its time from the transcript letters it
lines up with; words with no match share the gap between their neighbours.
"""
import re
from difflib import SequenceMatcher


def norm(s):
    return re.sub(r"[^a-z0-9]", "", s.lower())


def align(words, heard):
    S = "".join(norm(w) for w in words)
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
    timed, loose = [], []
    pos = 0
    for w in words:
        span = range(pos, pos + len(norm(w)))
        pos += len(norm(w))
        hit = [s2r[c] for c in span if c in s2r]
        if len(hit) < 0.6 * len(span):
            loose.append(w)
        timed.append({"text": w, "startMs": round(r_time[hit[0]][0]) if hit else None,
                      "endMs": round(r_time[hit[-1]][1]) if hit else None})
    for k, w in enumerate(timed):
        if w["startMs"] is None:
            prev = next((x["endMs"] for x in reversed(timed[:k]) if x["endMs"] is not None), 0)
            nxt = next((x["startMs"] for x in timed[k + 1:] if x["startMs"] is not None), prev + 300)
            w["startMs"], w["endMs"] = prev, max(prev + 1, nxt)
    for a, b in zip(timed, timed[1:]):  # keep word times monotonic
        b["startMs"] = max(b["startMs"], a["startMs"])
        b["endMs"] = max(b["endMs"], b["startMs"] + 1)
    return timed, loose
