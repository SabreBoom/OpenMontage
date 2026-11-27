"""Builds a skit ad's dialogue track, word-timed captions and timeline.

  python3 scripts/skit/prepare-skit.py public/skit/<name>/skit-spec.json

The spec lists the lines in order: who says it, the take (wav), the exact text
for captions, and the pause before it. Each take gets the same broadcast-style
voice finishing as the presenter ads; the joined track is loudness-normalised
to -16 LUFS. Word times come from whisper.cpp (small.en) aligned to the exact
text. Writes, next to the spec:
  voice.wav     the whole 15 s dialogue track
  skit.json     lines + word times (ms on the ad's timeline) for the edit
  takes/<who>/  voice.wav + ad.json per on-camera speaker, cut to that
                speaker's take window, for scripts/motion and scripts/lipsync
"""
import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from align_words import align  # noqa: E402

spec_path = Path(sys.argv[1])
spec = json.loads(spec_path.read_text())
out = spec_path.parent
SR = 48000
DUR = spec.get("seconds", 15.0)
tmp = Path(tempfile.mkdtemp())
ff = ["ffmpeg", "-v", "error", "-y"]
CHAIN = ("silenceremove=start_periods=1:start_threshold=-45dB,areverse,"
         "silenceremove=start_periods=1:start_threshold=-45dB,areverse,"
         "highpass=f=70,equalizer=f=170:t=q:w=0.9:g=2.5,equalizer=f=3200:t=q:w=1.2:g=1.5,"
         "equalizer=f=7500:t=q:w=1.5:g=-1.5,acompressor=threshold=-20dB:ratio=3:attack=6:release=90:makeup=2")


def dur(p):
    return float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(p)],
                                capture_output=True, text=True, check=True).stdout)


def words_of(wav, text):
    raw = tmp / (Path(wav).stem + ".json")
    env = dict(os.environ, WHISPER_MODEL="small.en")
    subprocess.run(["node", "scripts/transcribe-local.mjs", str(wav), str(raw)], check=True, capture_output=True, env=env)
    heard = [c for c in json.loads(raw.read_text()) if c["text"].strip()]
    timed, loose = align(text.split(), heard)
    return timed, loose


t = spec.get("lead", 0.6)
lines, parts = [], []
for i, ln in enumerate(spec["lines"]):
    t += ln.get("pause", 0.0)
    clean = tmp / f"line{i}.wav"
    tempo = ln.get("tempo", 1.0)
    subprocess.run(ff + ["-i", ln["take"], "-af", f"{CHAIN},atempo={tempo}", "-ar", str(SR), "-ac", "1", str(clean)], check=True)
    d = dur(clean)
    timed, loose = words_of(clean, ln["text"])
    for w in timed:
        w["startMs"] += round(t * 1000)
        w["endMs"] += round(t * 1000)
    lines.append({"who": ln["who"], "text": ln["text"], "startMs": round(t * 1000), "endMs": round((t + d) * 1000),
                  "words": timed, "loose": loose})
    parts.append((clean, t))
    t += d
if t > DUR:
    raise SystemExit(f"dialogue runs {t:.2f}s, longer than {DUR}s")

# place every line on the timeline, then loudness-normalise the whole track
inputs, filters = [], []
for k, (p, at) in enumerate(parts):
    inputs += ["-i", str(p)]
    filters.append(f"[{k}:a]adelay={int(at * 1000)}:all=1[a{k}]")
mixin = "".join(f"[a{k}]" for k in range(len(parts)))
filters.append(f"{mixin}amix=inputs={len(parts)}:normalize=0,loudnorm=I=-16:TP=-2:LRA=9,aresample={SR},"
               f"apad=whole_dur={DUR},atrim=0:{DUR}[o]")
subprocess.run(ff + inputs + ["-filter_complex", ";".join(filters), "-map", "[o]", "-ac", "2", str(out / "voice.wav")],
               check=True)

# per on-camera speaker: their take window on the timeline + timings relative to it
# spec "takes": {"who": {"lines": [i, ...], "pre": s, "post": s | "to_end": true}}
for who, cfg in spec.get("takes", {}).items():
    idx = cfg["lines"]
    w0 = round(max(0.0, lines[idx[0]]["startMs"] / 1000 - cfg.get("pre", 0.5)), 2)
    w1 = DUR if cfg.get("to_end") else round(min(DUR, lines[idx[-1]]["endMs"] / 1000 + cfg.get("post", 0.5)), 2)
    d = out / "takes" / who
    d.mkdir(parents=True, exist_ok=True)
    subprocess.run(ff + ["-i", str(out / "voice.wav"), "-af", f"atrim={w0}:{w1},asetpts=PTS-STARTPTS",
                         str(d / "voice.wav")], check=True)
    mine = [lines[i] for i in idx]
    for i in idx:
        lines[i]["take"] = who
    caps = [{"text": ln["text"], "startMs": ln["startMs"] - round(w0 * 1000), "endMs": ln["endMs"] - round(w0 * 1000),
             "words": [dict(x, startMs=x["startMs"] - round(w0 * 1000), endMs=x["endMs"] - round(w0 * 1000))
                       for x in ln["words"]]} for ln in mine]
    (d / "ad.json").write_text(json.dumps({"captions": caps, "speechEndMs": caps[-1]["endMs"],
                                           "takeStartSec": w0, "takeEndSec": w1}, indent=1))

takes = {}
for who in spec.get("takes", {}):
    takes[who] = json.loads((out / "takes" / who / "ad.json").read_text())
skit = {"seconds": DUR, "lines": lines,
        "takes": {w: {"startSec": v["takeStartSec"], "endSec": v["takeEndSec"]} for w, v in takes.items()}}
(out / "skit.json").write_text(json.dumps(skit, indent=1))

for ln in lines:
    print(f'{ln["who"]:9s} {ln["startMs"] / 1000:5.2f}-{ln["endMs"] / 1000:5.2f}s  {ln["text"]}'
          + (f'   (loose: {ln["loose"]})' if ln["loose"] else ""))
print(f"dialogue ends at {t:.2f}s -> {out / 'voice.wav'}, {out / 'skit.json'}")
