"""Original instrumental music bed for the ZOREV ads, synthesised from scratch
(no samples, no third-party recordings), so it is ours to use commercially.
Warm pad + soft felt-piano plucks, ~72 BPM feel, 16 s, gentle fade in/out.
  python3 scripts/make-music-bed.py public/audio/zorev-bed.wav"""
import sys, wave
import numpy as np

SR = 48000
DUR = 16.5
rng = np.random.default_rng(7)
t = np.arange(int(SR * DUR)) / SR

def midi(n): return 440.0 * 2 ** ((n - 69) / 12)

# Cmaj9 - Am9 - Fmaj9 - Gsus2, one chord per ~4.1 s
chords = [[48, 55, 59, 62, 64], [45, 52, 55, 59, 64], [41, 48, 52, 55, 57], [43, 50, 55, 57, 62]]
seg = DUR / 4
pad = np.zeros_like(t)
for i, ch in enumerate(chords):
    a, b = i * seg, (i + 1) * seg
    env = np.clip((t - a) / 1.2, 0, 1) * np.clip((b + 1.0 - t) / 1.4, 0, 1)
    for n in ch:
        f = midi(n)
        for det in (-0.12, 0.0, 0.11):  # gentle chorus
            ph = rng.uniform(0, 2 * np.pi)
            pad += env * (np.sin(2 * np.pi * f * (1 + det / 100) * t + ph)
                          + 0.25 * np.sin(2 * np.pi * 2 * f * t + ph)) / 3
pad *= 0.06

# felt-piano plucks: sparse arpeggio notes from each chord
pl = np.zeros_like(t)
beat = 60 / 72
for k in range(int(DUR / beat)):
    start = k * beat + 0.15
    ci = min(int(start // seg), 3)
    if k % 2 == 1 and rng.random() < 0.5:
        continue
    n = chords[ci][rng.integers(1, 5)] + 12
    f = midi(n)
    tt = t - start
    m = tt >= 0
    tp = np.maximum(tt, 0)
    env = np.where(m, np.exp(-tp * 2.4) * (1 - np.exp(-tp * 180)), 0)
    pl += env * (np.sin(2 * np.pi * f * tt) + 0.35 * np.sin(2 * np.pi * 2 * f * tt) + 0.12 * np.sin(2 * np.pi * 3 * f * tt))
pl *= 0.05

mix = pad + pl
# soft low-pass (one-pole) for warmth
y = np.zeros_like(mix); a = 0.12
for i in range(1, len(mix)): y[i] = y[i - 1] + a * (mix[i] - y[i - 1])
# simple stereo reverb: convolve with decaying noise
ir_len = int(SR * 2.2)
ir = rng.standard_normal((2, ir_len)) * np.exp(-np.arange(ir_len) / (SR * 0.55))
ir /= np.abs(ir).sum(axis=1, keepdims=True) / 6
wet = np.stack([np.convolve(y, ir[c])[: len(y)] for c in range(2)])
out = 0.75 * np.stack([y, y]) + 0.35 * wet
fade = np.clip(t / 1.5, 0, 1) * np.clip((DUR - t) / 2.0, 0, 1)
out *= fade
out /= np.abs(out).max() / 0.6  # leave headroom; level is set in the edit
pcm = (out.T * 32767).astype(np.int16)
with wave.open(sys.argv[1], "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print("wrote", sys.argv[1], f"{DUR}s")
