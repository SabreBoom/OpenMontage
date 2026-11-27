"""Lip-syncs an animated presenter take to its voice with MuseTalk v1.5 (MIT, CPU).

  python3 scripts/lipsync/lipsync.py <key> <motion.mp4> [--full --seconds S --voice V --ad A --out O]

Only the windows where the presenter is on screen in the edit (the hook and the
closing, from public/ads/<key>/ad.json) are lip-synced, which saves ~40% of the
CPU time; the hidden middle holds a frame. Writes public/ads/<key>/presenter.mp4
with public/ads/<key>/voice.wav as its audio. --full lip-syncs the whole clip
(skit takes); --voice/--ad/--out point it at other files.
"""
import argparse
import json
import os
import shutil
import subprocess
import sys
import tempfile

ap = argparse.ArgumentParser()
ap.add_argument("key")
ap.add_argument("motion")
ap.add_argument("--full", action="store_true")
ap.add_argument("--seconds", type=float, default=15.0)
ap.add_argument("--voice")
ap.add_argument("--ad")
ap.add_argument("--out")
args = ap.parse_args()
key, motion = args.key, os.path.abspath(args.motion)
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
MT = os.path.join(ROOT, ".tools/lipsync/MuseTalk")
FPS = 25
voice = os.path.abspath(args.voice or os.path.join(ROOT, "public/ads", key, "voice.wav"))
n = int(round(args.seconds * FPS))
if args.full:
    a1 = b0 = n
else:
    ad = json.load(open(args.ad or os.path.join(ROOT, "public/ads", key, "ad.json")))
    a1 = min(n, int((ad["hookEndMs"] / 1000 + 0.3) * FPS))  # hook window [0, a1)
    b0 = max(a1, int((ad["ctaStartMs"] / 1000 - 0.3) * FPS))  # closing window [b0, n)

tmp = tempfile.mkdtemp(prefix=f"ls_{key}_", dir=os.path.join(MT, "results"))
cond_v, cond_a = os.path.join(tmp, f"{key}_cond.mp4"), os.path.join(tmp, f"{key}_cond.wav")
ff = ["ffmpeg", "-v", "error", "-y"]

# MuseTalk only needs the face: work on a square around it (4-5x faster than the
# full 1080x1920 frame) and paste the result back at full resolution afterwards.
# The box is sized from the face in the first frame with room for head motion.
probe = os.path.join(tmp, "first.png")
subprocess.run(ff + ["-i", motion, "-frames:v", "1", probe], check=True)
det = subprocess.run([os.path.join(ROOT, ".tools/lipsync/venv/bin/python"), "-c", f"""
import sys, cv2, numpy as np
sys.path.insert(0, 'musetalk/utils')
from face_detection import FaceAlignment, LandmarksType
img = cv2.imread({probe!r})
fa = FaceAlignment(LandmarksType._2D, flip_input=False, device='cpu')
x1, y1, x2, y2 = fa.get_detections_for_batch(np.asarray([img]))[0][:4]
print(img.shape[1], img.shape[0], x1, y1, x2, y2)
"""], cwd=MT, capture_output=True, text=True, check=True)
fw, fh, x1, y1, x2, y2 = map(float, det.stdout.split()[-6:])
side = int(min(fw, fh, max(x2 - x1, y2 - y1) * 2.4)) // 2 * 2
cx, cy = (x1 + x2) / 2, (y1 + y2) / 2 + 0.06 * (y2 - y1)
bx = int(min(max(cx - side / 2, 0), fw - side)) // 2 * 2
by = int(min(max(cy - side / 2, 0), fh - side)) // 2 * 2
crop = f"crop={side}:{side}:{bx}:{by}"

# condensed picture and sound: hook window followed by closing window
if b0 < n:
    vf = (f"[0:v]{crop},split[c1][c2];"
          f"[c1]trim=start_frame=0:end_frame={a1},setpts=PTS-STARTPTS[a];"
          f"[c2]trim=start_frame={b0}:end_frame={n},setpts=PTS-STARTPTS[b];[a][b]concat=n=2:v=1:a=0[v]")
    af = (f"[0:a]atrim=0:{a1 / FPS},asetpts=PTS-STARTPTS[a];[0:a]atrim={b0 / FPS}:{n / FPS},asetpts=PTS-STARTPTS[b];"
          "[a][b]concat=n=2:v=0:a=1[o]")
else:  # whole clip
    vf = f"[0:v]{crop},trim=start_frame=0:end_frame={n},setpts=PTS-STARTPTS[v]"
    af = f"[0:a]apad,atrim=0:{n / FPS},asetpts=PTS-STARTPTS[o]"
subprocess.run(ff + ["-i", motion, "-filter_complex", vf,
                     "-map", "[v]", "-r", str(FPS), "-c:v", "libx264", "-crf", "10", "-pix_fmt", "yuv420p", cond_v],
               check=True)
subprocess.run(ff + ["-i", voice, "-filter_complex", af, "-map", "[o]", "-ar", "16000", "-ac", "1", cond_a], check=True)

task = os.path.join(tmp, "task.yaml")
open(task, "w").write(f'task_0:\n video_path: "{cond_v}"\n audio_path: "{cond_a}"\n result_name: "{key}_cond_ls.mp4"\n')
env = dict(os.environ, OMP_NUM_THREADS="4", MKL_NUM_THREADS="4")
subprocess.run([os.path.join(ROOT, ".tools/lipsync/venv/bin/python"), "-m", "scripts.inference",
                "--inference_config", task, "--result_dir", tmp,
                "--unet_model_path", "models/musetalkV15/unet.pth", "--unet_config", "models/musetalkV15/musetalk.json",
                "--version", "v15", "--batch_size", "4", "--fps", str(FPS)], cwd=MT, env=env, check=True)
ls = os.path.join(tmp, "v15", f"{key}_cond_ls.mp4")

# expand back onto the 15 s timeline (hook, held frame for the hidden middle,
# closing) and paste the lip-synced face square over the full-resolution take
out = os.path.abspath(args.out or os.path.join(ROOT, "public/ads", key, "presenter.mp4"))
hold = (b0 - a1) / FPS
if b0 < n:
    faces = (f"[0:v]trim=start_frame=0:end_frame={a1},setpts=PTS-STARTPTS[a];"
             f"[0:v]trim=start_frame={a1 - 1}:end_frame={a1},setpts=PTS-STARTPTS,tpad=stop_mode=clone:stop_duration={hold - 1 / FPS:.3f}[m];"
             f"[0:v]trim=start_frame={a1}:end_frame={a1 + n - b0},setpts=PTS-STARTPTS[b];"
             "[a][m][b]concat=n=3:v=1:a=0,")
else:
    faces = "[0:v]"
subprocess.run(ff + ["-i", ls, "-i", motion, "-i", voice, "-filter_complex",
                     # MuseTalk can drop the last frame or two: hold the final one
                     faces + "setpts=PTS-STARTPTS,tpad=stop_mode=clone:stop_duration=1[face];"
                     f"[1:v][face]overlay=x={bx}:y={by}:shortest=1[v]",
                     "-map", "[v]", "-map", "2:a", "-r", str(FPS), "-c:v", "libx264", "-crf", "12", "-pix_fmt", "yuv420p",
                     "-c:a", "aac", "-b:a", "192k", "-t", f"{n / FPS}", out], check=True)
shutil.rmtree(tmp, ignore_errors=True)
# put back the skin/beard detail MuseTalk's 256 px mouth area loses
subprocess.run([os.path.join(ROOT, ".tools/motion/venv/bin/python"), os.path.join(ROOT, "scripts/lipsync/restore_detail.py"),
                motion, out], check=True)
print(f"{key}: lip-synced a {side}px face square at ({bx},{by}), frames 0-{a1 - 1} and {b0}-{n - 1} -> {out}")
