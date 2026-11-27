"""Brings a presenter still to life: head motion, real blinks and expressions.

  .tools/motion/venv/bin/python scripts/motion/animate.py <key> <presenter.png> <out.mp4> [--probe]

Uses LivePortrait (MIT) on CPU. The performance is driven by the presenter's
own narration (public/ads/<key>/ad.json word timings + voice.wav energy):
  - a nod as each phrase starts and small dips on stressed words
  - the head turns and tilts a little differently for every sentence
  - eyebrows lift on the question / product name / call to action
  - real blinks (LivePortrait's eye retargeting) at natural pauses
  - small glances, breathing, and a warm smile once the line is delivered
Only the frames where the presenter is on screen are rendered; the rest hold
still (they are hidden behind product footage in the edit).
Face detection uses S3FD + FAN (BSD-3, face-alignment), not InsightFace.
--probe writes a few test poses to check directions and strengths.
"""
import argparse
import json
import os
import subprocess
import sys

import cv2
import numpy as np
import torch

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
LP = os.path.join(ROOT, ".tools/motion/LivePortrait")
sys.path.insert(0, LP)
from src.config.inference_config import InferenceConfig  # noqa: E402
from src.live_portrait_wrapper import LivePortraitWrapper  # noqa: E402
from src.utils.camera import get_rotation_matrix  # noqa: E402
from src.utils.crop import crop_image, paste_back, prepare_paste_back  # noqa: E402
from src.utils.human_landmark_runner import LandmarkRunner  # noqa: E402
from src.utils.retargeting_utils import calc_eye_close_ratio  # noqa: E402

FPS = 25
W, H = 1080, 1920
TAU = 2 * np.pi


# --- expression deltas (same formulas as LivePortrait's retargeting UI) ---
def add_smile(d, s):
    d[0, 20, 1] += s * -0.01
    d[0, 14, 1] += s * -0.02
    d[0, 17, 1] += s * 0.0065
    d[0, 17, 2] += s * 0.003
    d[0, 13, 1] += s * -0.00275
    d[0, 16, 1] += s * -0.00275
    d[0, 3, 1] += s * -0.0035
    d[0, 7, 1] += s * -0.0035


def add_eyebrow(d, e):
    if e > 0:
        d[0, 1, 1] += e * 0.001
        d[0, 2, 1] += e * -0.001
    else:
        d[0, 1, 0] += e * -0.001
        d[0, 2, 0] += e * 0.001
        d[0, 1, 1] += e * 0.0003
        d[0, 2, 1] += e * -0.0003


def add_gaze(d, x, y):
    if x > 0:
        d[0, 11, 0] += x * 0.0007
        d[0, 15, 0] += x * 0.001
    else:
        d[0, 11, 0] += x * 0.001
        d[0, 15, 0] += x * 0.0007
    d[0, 11, 1] += y * -0.001
    d[0, 15, 1] += y * -0.001
    blink = -y / 2.0
    d[0, 11, 1] += blink * -0.001
    d[0, 13, 1] += blink * 0.0003
    d[0, 15, 1] += blink * -0.001
    d[0, 16, 1] += blink * 0.0003


def bump(x):
    """smooth 0 -> 1 -> 0 over x in [0, 1]"""
    x = np.clip(x, 0, 1)
    return np.sin(np.pi * x) ** 2


def smooth_steps(t, times, values, tau):
    """piecewise targets, eased with a critically damped follow (time constant tau)"""
    out = np.zeros_like(t)
    cur = values[0]
    k = 0
    dt = t[1] - t[0]
    for i, ti in enumerate(t):
        while k + 1 < len(times) and ti >= times[k + 1]:
            k += 1
        cur += (values[k] - cur) * (1 - np.exp(-dt / tau))
        out[i] = cur
    return out


def performance(ad, voice_wav, n, double_take=False):
    """per-frame pose / expression / blink curves from the narration"""
    import librosa

    t = np.arange(n) / FPS
    words = [w for c in ad["captions"] for w in c["words"]]
    phrase_starts = [c["startMs"] / 1000 for c in ad["captions"]]
    sentences, cur = [], []
    for w in words:
        cur.append(w)
        if w["text"][-1] in ".?!":
            sentences.append(cur)
            cur = []
    if cur:
        sentences.append(cur)
    speech_end = ad["speechEndMs"] / 1000

    y, sr = librosa.load(voice_wav, sr=16000, mono=True)
    hop = sr // FPS
    env = librosa.feature.rms(y=y, frame_length=hop * 2, hop_length=hop)[0][:n]
    env = np.pad(env, (0, max(0, n - len(env))))
    env = env / (env.max() + 1e-6)
    env_s = np.convolve(env, np.ones(3) / 3, mode="same")

    # head pitch (degrees; positive = chin down, checked with --probe): phrase nods, stress dips, speech energy
    pitch = 0.7 * np.sin(TAU * t / 4.9 + 0.3)
    for s in phrase_starts:
        pitch += 2.4 * bump((t - s + 0.06) / 0.5)
    for w in words:
        dur = (w["endMs"] - w["startMs"]) / 1000
        if dur > 0.28:
            pitch += 1.0 * bump((t - w["startMs"] / 1000) / 0.32)
    pitch += 1.2 * (env_s - env_s.mean()) * (t < speech_end + 0.2)

    # yaw / roll: a different head angle per sentence, eased, plus slow drift
    seq_yaw = [2.6, -2.2, 1.6, -0.8, 0.6, 0.0]
    seq_roll = [1.4, -1.0, 1.8, -0.4, 0.8, 0.0]
    starts = [0.0] + [s[0]["startMs"] / 1000 - 0.15 for s in sentences[1:]] + [speech_end + 0.3]
    yv = [seq_yaw[i % len(seq_yaw)] for i in range(len(starts) - 1)] + [0.8]
    rv = [seq_roll[i % len(seq_roll)] for i in range(len(starts) - 1)] + [1.6]
    yaw = smooth_steps(t, starts, yv, 0.35) + 0.9 * np.sin(TAU * t / 6.7 + 1.0)
    roll = smooth_steps(t, starts, rv, 0.45) + 0.5 * np.sin(TAU * t / 5.3 + 2.0)
    for s in sentences:  # a question tilts the head a touch more
        if s[-1]["text"].endswith("?"):
            roll += 1.6 * bump((t - s[-1]["startMs"] / 1000 + 0.2) / 0.9)

    # eyebrows: lift on the question, the product name and "Shop"
    brow = np.zeros_like(t)
    names = {"hearth", "nimbus", "medusa", "nova", "shop"}
    for w in words:
        key = "".join(ch for ch in w["text"].lower() if ch.isalpha())
        if key in names or w["text"].endswith("?"):
            brow += 7.0 * bump((t - w["startMs"] / 1000 + 0.12) / 0.7)

    # smile: easy and warm, fuller once the line is delivered
    smile = 0.08 + 0.22 * np.clip((t - speech_end - 0.1) / 0.6, 0, 1)

    # gaze: mostly to camera, short glances at sentence starts
    gaze_x = np.zeros_like(t)
    for i, s in enumerate(sentences[1:]):
        gaze_x += (2.5 if i % 2 == 0 else -2.5) * bump((t - s[0]["startMs"] / 1000 + 0.25) / 0.45)

    # blinks: at phrase breaks, roughly every 2.5-4 s, and in the quiet ending
    closure = [0.5, 0.95, 1.0, 0.7, 0.35, 0.1]
    blink_t = []
    last = -10.0
    for c in ad["captions"]:
        b = c["endMs"] / 1000 + 0.05
        if b - last >= 2.4 and b < speech_end:
            blink_t.append(b)
            last = b
    blink_t += [speech_end + 0.45, speech_end + 2.3]
    blink_t = [b for b in blink_t if b < n / FPS - 0.3]
    eye_close = np.zeros_like(t)
    for b in blink_t:
        i0 = int(round(b * FPS))
        for k, c in enumerate(closure):
            if 0 <= i0 + k < n:
                eye_close[i0 + k] = max(eye_close[i0 + k], c)

    breath = 1 + 0.004 * np.sin(TAU * t / 4.2)

    if double_take:
        # skit reaction, anchored to the line: looking at the thing off-screen,
        # a quick "huh?" glance to camera, a snap back with wide eyes, raised
        # brows and a lean-in on the first word, then he turns to camera to ask.
        # (+yaw = towards camera for a subject turned to frame-right, see --probe)
        s0 = words[0]["startMs"] / 1000
        s1 = words[1]["startMs"] / 1000 if len(words) > 1 else s0 + 0.6
        end = words[-1]["endMs"] / 1000
        kt = [0, s0 - 0.55, s0 - 0.42, s0 - 0.12, s0, s1 - 0.12, s1 + 0.2, end + 0.4, end + 1.5]
        ky = [0, 0, 12, 12, -6, -6, 10, 10, 6]
        yaw = np.interp(t, kt, ky) + 0.4 * np.sin(TAU * t / 3.7)
        shock = np.interp(t, [s0 - 0.12, s0, end, end + 0.8], [0, 1, 0.8, 0.2])
        brow = brow * 0.5 + 14 * shock
        eye_close = np.where(eye_close > 0.01, eye_close, -0.3 * shock)
        breath = breath * (1 + 0.045 * np.interp(t, [s0 - 0.1, s0 + 0.15, s1 + 0.3, end + 0.6], [0, 1, 0.6, 0.1]))
        pitch = pitch - 2.5 * np.interp(t, [s0 - 0.1, s0 + 0.1, s1, s1 + 0.4], [0, 1, 1, 0])
        roll = roll * 0.5
        smile = np.interp(t, [0, end + 0.3, end + 1.0], [0.0, 0.0, 0.25])
        gaze_x = gaze_x * 0
    return dict(pitch=pitch, yaw=yaw, roll=roll, brow=brow, smile=smile, gaze_x=gaze_x,
                eye_close=eye_close, breath=breath, blinks=blink_t)


class Animator:
    def __init__(self, img_rgb):
        import face_alignment

        torch.set_num_threads(4)
        cfg = InferenceConfig(flag_force_cpu=True, flag_use_half_precision=False)
        self.lp = LivePortraitWrapper(cfg)
        fa = face_alignment.FaceAlignment(face_alignment.LandmarksType.TWO_D, device="cpu", flip_input=False)
        lmk68 = fa.get_landmarks(img_rgb)[0]
        crop = crop_image(img_rgb, lmk68, dsize=512, scale=2.3, vx_ratio=0, vy_ratio=-0.125, flag_do_rot=True)
        runner = LandmarkRunner(ckpt_path=os.path.join(LP, "pretrained_weights/liveportrait/landmark.onnx"),
                                onnx_provider="cpu", device_id=0)
        self.src_lmk = runner.run(img_rgb, lmk68)
        self.img = img_rgb
        self.M = crop["M_c2o"]
        self.mask = prepare_paste_back(cfg.mask_crop, crop["M_c2o"], dsize=(img_rgb.shape[1], img_rgb.shape[0]))
        I_s = self.lp.prepare_source(cv2.resize(crop["img_crop"], (256, 256), interpolation=cv2.INTER_AREA))
        self.info = self.lp.get_kp_info(I_s)
        self.f_s = self.lp.extract_feature_3d(I_s)
        self.x_s = self.lp.transform_keypoint(self.info)
        self.eye_open = float(np.mean(calc_eye_close_ratio(self.src_lmk[None])))

    @torch.no_grad()
    def frame(self, pitch=0.0, yaw=0.0, roll=0.0, brow=0.0, smile=0.0, gaze_x=0.0, eye_close=0.0, breath=1.0):
        i = self.info
        R = get_rotation_matrix(i["pitch"] + pitch, i["yaw"] + yaw, i["roll"] + roll)
        d = i["exp"].clone()
        if smile:
            add_smile(d, smile)
        if brow:
            add_eyebrow(d, brow)
        if gaze_x:
            add_gaze(d, gaze_x, 0.0)
        t = i["t"].clone()
        t[..., 2] = 0
        x_d = breath * i["scale"] * (i["kp"] @ R + d) + t
        if abs(eye_close) > 0.01:  # > 0 closes (blinks), < 0 widens (surprise)
            ratio = self.lp.calc_combined_eye_ratio([[self.eye_open * (1 - eye_close)]], self.src_lmk)
            x_d = x_d + self.lp.retarget_eye(self.x_s, ratio)
        x_d = self.lp.stitching(self.x_s, x_d)
        out = self.lp.warp_decode(self.f_s, self.x_s, x_d)
        out = self.lp.parse_output(out["out"])[0]
        return paste_back(out, self.M, self.img, self.mask)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("key")
    ap.add_argument("image")
    ap.add_argument("out")
    ap.add_argument("--probe", action="store_true")
    ap.add_argument("--seconds", type=float, default=15.0)
    ap.add_argument("--ad", help="word timings json (default public/ads/<key>/ad.json)")
    ap.add_argument("--voice", help="narration wav (default public/ads/<key>/voice.wav)")
    ap.add_argument("--full", action="store_true", help="render every frame (no hidden windows)")
    ap.add_argument("--double-take", action="store_true", help="skit reaction: glance, snap back, wide eyes")
    a = ap.parse_args()

    img = cv2.cvtColor(cv2.imread(a.image), cv2.COLOR_BGR2RGB)
    img = cv2.resize(img, (W, H), interpolation=cv2.INTER_AREA)
    anim = Animator(img)

    if a.probe:
        poses = [dict(), dict(pitch=-8), dict(yaw=8), dict(yaw=-12), dict(roll=6), dict(brow=14), dict(smile=0.4),
                 dict(gaze_x=6), dict(eye_close=1.0), dict(eye_close=-0.35), dict(breath=1.06)]
        tiles = []
        for p in poses:
            f = anim.frame(**p)
            x0, y0 = int(anim.M[0, 2]), int(anim.M[1, 2])
            side = int(512 * anim.M[0, 0])
            crop = f[max(0, y0):y0 + side, max(0, x0):x0 + side]
            crop = cv2.resize(crop, (300, 300))
            cv2.putText(crop, str(p) or "{}", (6, 20), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (255, 255, 0), 1)
            tiles.append(crop)
        cv2.imwrite(a.out, cv2.cvtColor(np.hstack(tiles), cv2.COLOR_RGB2BGR))
        print("probe ->", a.out)
        return

    ad = json.load(open(a.ad or os.path.join(ROOT, "public/ads", a.key, "ad.json")))
    voice = a.voice or os.path.join(ROOT, "public/ads", a.key, "voice.wav")
    n = int(round(a.seconds * FPS))
    perf = performance(ad, voice, n, double_take=a.double_take)
    if a.full:
        vis = np.ones(n, bool)
    else:
        # on screen in the edit: hook (until hookEnd) and closing (from ctaStart); small margins
        vis = np.zeros(n, bool)
        vis[: int((ad["hookEndMs"] / 1000 + 0.3) * FPS)] = True
        vis[int((ad["ctaStartMs"] / 1000 - 0.3) * FPS):] = True
    enc = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}",
                            "-r", str(FPS), "-i", "-", "-c:v", "libx264", "-crf", "12", "-pix_fmt", "yuv420p", a.out],
                           stdin=subprocess.PIPE)
    last = None
    keys = ["pitch", "yaw", "roll", "brow", "smile", "gaze_x", "eye_close", "breath"]
    for k in range(n):
        if vis[k] or last is None:
            last = anim.frame(**{x: float(perf[x][k]) for x in keys})
        enc.stdin.write(last.tobytes())
        if k % 25 == 0:
            print(f"frame {k}/{n}", flush=True)
    enc.stdin.close()
    enc.wait()
    print("blinks at", ", ".join(f"{b:.2f}s" for b in perf["blinks"]), "->", a.out)


if __name__ == "__main__":
    main()
