"""Turns a MuseTalk result into the ad's presenter take, with natural blinks.

  python3 scripts/lipsync/finish-presenter.py <key> <lipsync.mp4 | frames dir> <voice wav>

Blinks land where people blink: at the first phrase break, right after
"Zorev.", and in the quiet end-card seconds. Timings come from
public/ads/<key>/ad.json (run scripts/prepare-ad.py first). Writes
public/ads/<key>/presenter.mp4 (picture + the voice it was lip-synced to).
"""
import json
import os
import subprocess
import sys
import tempfile

key, src, voice = sys.argv[1:4]
root = os.path.join(os.path.dirname(os.path.abspath(__file__)), "../..")
ad = json.load(open(os.path.join(root, "public/ads", key, "ad.json")))
words = [w for c in ad["captions"] for w in c["words"]]

times = [ad["captions"][0]["endMs"] + 80]
zorev = next(w for w in words if w["text"].lower().startswith("zorev"))
times.append(zorev["endMs"] + 60)
times += [ad["speechEndMs"] + 450, ad["speechEndMs"] + 2500]
times = [t / 1000 for t in times if t < 14700]

tmp = tempfile.mkdtemp()
take = os.path.join(tmp, "take.mp4")
if os.path.isdir(src):  # raw frames grabbed before MuseTalk's cleanup
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-framerate", "25", "-i", os.path.join(src, "%08d.png"),
                    "-i", voice, "-map", "0:v", "-map", "1:a", "-c:v", "libx264", "-crf", "12",
                    "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", "-shortest", take], check=True)
else:
    take = src

out = os.path.join(root, "public/ads", key, "presenter.mp4")
py = os.path.join(root, ".tools/lipsync/venv/bin/python")
subprocess.run([py, os.path.join(root, "scripts/lipsync/blink.py"), take, out] + [f"{t:.2f}" for t in times]
               + ["--debug", os.path.join(tmp, "blinks")], check=True)
print(f"{key}: blinks at {', '.join(f'{t:.2f}s' for t in times)} -> {out}  (debug crops: {tmp}/blinks)")
