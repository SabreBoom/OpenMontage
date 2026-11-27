"""Puts back the skin and beard detail that lip-sync loses around the mouth.

  .tools/motion/venv/bin/python scripts/lipsync/restore_detail.py <motion.mp4> <presenter.mp4> [--debug DIR]

MuseTalk renders the lower face at 256 px, which softens skin and can wash out
stubble or a beard. The animated take it was made from (motion.mp4) still has
that detail, in the same place, because the head pose is identical. For every
frame: take the fine detail (< ~5 px) of the animated take and lay it over the
lip-synced frame, inside the area MuseTalk changed, except on the lips and
mouth (found with 68-point face landmarks, BSD-3 face-alignment), so the new
lip shapes are untouched. Rewrites presenter.mp4 in place (audio kept).
"""
import argparse
import os
import subprocess

import cv2
import numpy as np

ap = argparse.ArgumentParser()
ap.add_argument("motion")
ap.add_argument("presenter")
ap.add_argument("--debug")
args = ap.parse_args()

import face_alignment  # noqa: E402

fa = face_alignment.FaceAlignment(face_alignment.LandmarksType.TWO_D, device="cpu", flip_input=False)
ca, cb = cv2.VideoCapture(args.motion), cv2.VideoCapture(args.presenter)
fps = cb.get(cv2.CAP_PROP_FPS)
w, h = int(cb.get(cv2.CAP_PROP_FRAME_WIDTH)), int(cb.get(cv2.CAP_PROP_FRAME_HEIGHT))
tmp = args.presenter + ".restored.mp4"
enc = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{w}x{h}",
                        "-r", str(fps), "-i", "-", "-i", args.presenter, "-map", "0:v", "-map", "1:a?", "-c:v",
                        "libx264", "-crf", "12", "-pix_fmt", "yuv420p", "-c:a", "copy", tmp], stdin=subprocess.PIPE)
box = None
n = touched = 0
while True:
    oka, a8 = ca.read()
    okb, b8 = cb.read()
    if not okb:
        break
    out = b8
    if oka:
        a, b = a8.astype(np.float32), b8.astype(np.float32)
        changed = np.abs(b - a).mean(axis=2)
        if (changed > 2.0).sum() > 500:
            if box is None:  # face box once; the head only moves a little
                det = fa.face_detector.detect_from_image(cv2.cvtColor(a8, cv2.COLOR_BGR2RGB))[0][:4]
                bw, bh = det[2] - det[0], det[3] - det[1]
                box = [det[0] - 0.15 * bw, det[1] - 0.15 * bh, det[2] + 0.15 * bw, det[3] + 0.15 * bh]
            lm = fa.get_landmarks(cv2.cvtColor(a8, cv2.COLOR_BGR2RGB), detected_faces=[box])[0]
            mouth = lm[48:68]
            mw = mouth[:, 0].max() - mouth[:, 0].min()
            mask = np.zeros((h, w), np.uint8)
            cv2.fillConvexPoly(mask, cv2.convexHull(mouth.astype(np.int32)), 255)
            # a little room around the lips, and more below: the jaw drops when
            # the mouth opens, while the upper lip (and a moustache) stays put
            k = int(0.1 * mw) | 1
            mask = cv2.dilate(mask, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k * 2 + 1, k * 2 + 1)))
            mask = cv2.dilate(mask, np.ones((int(0.32 * mw) | 1, 1), np.uint8), anchor=(0, 0))
            mouth_w = cv2.GaussianBlur(mask.astype(np.float32) / 255, (0, 0), 0.08 * mw)
            region = np.clip(cv2.GaussianBlur((changed > 2.0).astype(np.float32), (0, 0), 8) * 1.3, 0, 1)
            wgt = (region * (1 - mouth_w))[..., None]
            da = a - cv2.GaussianBlur(a, (0, 0), 4.0)
            db = b - cv2.GaussianBlur(b, (0, 0), 4.0)
            out = np.clip(b + wgt * (da - db), 0, 255).astype(np.uint8)
            touched += 1
            if args.debug and n % 40 == 0:
                os.makedirs(args.debug, exist_ok=True)
                cx, cy = int(mouth[:, 0].mean()), int(mouth[:, 1].mean())
                s = int(1.6 * mw)
                crop = lambda x: x[max(cy - s, 0):cy + s, max(cx - s, 0):cx + s]
                vis = np.dstack([wgt[..., 0] * 255] * 3).astype(np.uint8)
                cv2.imwrite(os.path.join(args.debug, f"f{n:03d}.png"), np.hstack([crop(b8), crop(out), crop(a8), crop(vis)]))
    enc.stdin.write(np.ascontiguousarray(out).tobytes())
    n += 1
enc.stdin.close()
if enc.wait() != 0:
    raise SystemExit("encode failed")
os.replace(tmp, args.presenter)
print(f"restored detail on {touched}/{n} frames -> {args.presenter}")
