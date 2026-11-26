"""Adds natural eye blinks to a talking-head clip (MuseTalk only animates the mouth).

  .tools/lipsync/venv/bin/python scripts/lipsync/blink.py in.mp4 out.mp4 1.9 5.4 8.8 ...
  (blink start times in seconds; add --debug DIR to save close-up crops of every blink)

Eyelids are located with DWPose's 68-point face landmarks. For each blink the
upper lid slides down over the eye and back (about 0.24 s: close, hold, open)
by stretching the lid skin between brow and lash line, the way a real lid
covers the eye. Everything outside the eye areas is untouched; audio is copied.
"""
import argparse
import os
import subprocess
import sys

import cv2
import numpy as np

MUSETALK = os.path.join(os.path.dirname(os.path.abspath(__file__)), "../../.tools/lipsync/MuseTalk")
# closure per frame at 25 fps: close quickly, hold, open a little slower
PROFILE = [0.45, 0.9, 1.0, 0.8, 0.45, 0.15]

EYES = [  # (eye 68-pt indices in contour order, brow indices)
    ([36, 37, 38, 39, 40, 41], [17, 18, 19, 20, 21]),
    ([42, 43, 44, 45, 46, 47], [22, 23, 24, 25, 26]),
]


def load_pose_model():
    sys.path.insert(0, MUSETALK)
    from mmpose.apis import init_model
    cfg = os.path.join(MUSETALK, "musetalk/utils/dwpose/rtmpose-l_8xb32-270e_coco-ubody-wholebody-384x288.py")
    ckpt = os.path.join(MUSETALK, "models/dwpose/dw-ll_ucoco_384.pth")
    return init_model(cfg, ckpt, device="cpu")


def face_landmarks(model, frame):
    from mmpose.apis import inference_topdown
    from mmpose.structures import merge_data_samples
    res = merge_data_samples(inference_topdown(model, frame))
    return res.pred_instances.keypoints[0][23:91].astype(np.float32)  # 68 face points


def blink_eye(frame, lm, eye_idx, brow_idx, c):
    """Remap one eye so the upper lid covers fraction c (0..1) of the eye opening."""
    p = lm[eye_idx]
    outer, up1, up2, inner, lo1, lo2 = p
    left, right = sorted([outer, inner], key=lambda q: q[0])
    width = right[0] - left[0]
    if width < 6:
        return frame
    # upper and lower lid curves, sampled per column
    up_pts = sorted([outer, up1, up2, inner], key=lambda q: q[0])
    lo_pts = sorted([outer, lo2, lo1, inner], key=lambda q: q[0])
    brow = lm[brow_idx]

    m = 0.35 * width
    x0, x1 = int(np.floor(left[0] - m)), int(np.ceil(right[0] + m))
    brow_y = float(np.interp((left[0] + right[0]) / 2, brow[:, 0], brow[:, 1])) if brow[0, 0] < brow[-1, 0] else float(brow[:, 1].mean())
    eye_h = max(lo1[1], lo2[1]) - min(up1[1], up2[1])
    y0 = int(np.floor(brow_y + 0.45 * (min(up1[1], up2[1]) - brow_y)))
    y1 = int(np.ceil(max(lo1[1], lo2[1]) + 0.6 * eye_h + 2))
    h, w = frame.shape[:2]
    x0, x1, y0, y1 = max(x0, 0), min(x1, w - 1), max(y0, 0), min(y1, h - 1)

    xs = np.arange(x0, x1 + 1, dtype=np.float32)
    ys = np.arange(y0, y1 + 1, dtype=np.float32)
    gx, gy = np.meshgrid(xs, ys)

    xc = np.clip(xs, left[0], right[0])
    y_up = np.interp(xc, [q[0] for q in up_pts], [q[1] for q in up_pts]).astype(np.float32)
    y_lo = np.interp(xc, [q[0] for q in lo_pts], [q[1] for q in lo_pts]).astype(np.float32)
    # lash line rests just above the lower lid when fully closed
    y_new = y_up + c * 0.92 * (y_lo - y_up)
    y_b = np.full_like(y_up, float(y0))

    # horizontal feather: full effect between the corners, fading outside them
    wgt = np.ones_like(xs)
    wgt = np.where(xs < left[0], np.clip(1 - (left[0] - xs) / m, 0, 1), wgt)
    wgt = np.where(xs > right[0], np.clip(1 - (xs - right[0]) / m, 0, 1), wgt)
    wgt = wgt * wgt * (3 - 2 * wgt)  # smoothstep

    Yb, Yu, Yn = (np.broadcast_to(a, gx.shape) for a in (y_b, y_up, y_new))
    # stretch only the lid skin; the lash band keeps its real thickness and rides the lid edge
    lash = max(2.0, 0.22 * eye_h)
    Ys, Ns = Yu - lash, Yn - lash
    span = np.maximum(Ns - Yb, 1e-3)
    skin = Yb + (gy - Yb) * (Ys - Yb) / span
    src = np.where(gy <= Ns, skin, np.where(gy <= Yn, gy - (Yn - Yu), gy))
    map_y = gy + wgt[None, :] * (src - gy)

    roi = cv2.remap(frame, gx, map_y.astype(np.float32), interpolation=cv2.INTER_LINEAR,
                    borderMode=cv2.BORDER_REPLICATE)
    # soft shadow along the closing lash line
    if c > 0.3:
        dist = np.abs(gy - Yn)
        shade = 1 - 0.18 * c * np.exp(-(dist ** 2) / 2.0) * wgt[None, :]
        roi = np.clip(roi.astype(np.float32) * shade[..., None], 0, 255).astype(np.uint8)
    out = frame.copy()
    out[y0:y1 + 1, x0:x1 + 1] = roi
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("inp")
    ap.add_argument("out")
    ap.add_argument("times", nargs="+", type=float)
    ap.add_argument("--debug")
    a = ap.parse_args()

    cap = cv2.VideoCapture(a.inp)
    fps = cap.get(cv2.CAP_PROP_FPS)
    frames = []
    while True:
        ok, f = cap.read()
        if not ok:
            break
        frames.append(f)
    h, w = frames[0].shape[:2]
    model = load_pose_model()

    for t in a.times:
        start = int(round(t * fps))
        if start + len(PROFILE) > len(frames):
            continue
        # the head barely moves within 0.24 s, so one landmark pass per blink is enough
        lm = face_landmarks(model, frames[start + 2])
        for k, c in enumerate(PROFILE):
            i = start + k
            for eye_idx, brow_idx in EYES:
                frames[i] = blink_eye(frames[i], lm, eye_idx, brow_idx, c)
        if a.debug:
            os.makedirs(a.debug, exist_ok=True)
            pts = lm[36:48]
            cx, cy = pts[:, 0].mean(), pts[:, 1].mean()
            half = int((pts[:, 0].max() - pts[:, 0].min()) * 0.9)
            crops = [cv2.resize(frames[i][int(cy) - half // 2:int(cy) + half // 2, int(cx) - half:int(cx) + half],
                                None, fx=3, fy=3, interpolation=cv2.INTER_CUBIC)
                     for i in range(start - 1, start + len(PROFILE) + 1)]
            cv2.imwrite(os.path.join(a.debug, f"blink_{t:05.2f}.png"), np.vstack(crops))
        print(f"blink at {t:.2f}s (frames {start}-{start + len(PROFILE) - 1})", flush=True)

    enc = subprocess.Popen(
        ["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{w}x{h}", "-r", str(fps),
         "-i", "-", "-i", a.inp, "-map", "0:v", "-map", "1:a?", "-c:v", "libx264", "-crf", "14",
         "-pix_fmt", "yuv420p", "-c:a", "copy", a.out], stdin=subprocess.PIPE)
    for f in frames:
        enc.stdin.write(f.tobytes())
    enc.stdin.close()
    sys.exit(enc.wait())


if __name__ == "__main__":
    main()
