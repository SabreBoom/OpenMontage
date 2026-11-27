"""Original sound design for the skit ads, synthesised from scratch (no samples,
no licences needed): whoosh, low "boom" hit, caption pop, and a playful
15 s music bed (soft kick, shaker, marimba-like plucks, 104 BPM).

  python3 scripts/skit/make-sfx.py
"""
import numpy as np
import soundfile as sf
from pathlib import Path

SR = 48000
out = Path("public/skit")
out.mkdir(parents=True, exist_ok=True)
rng = np.random.default_rng(7)


def env(n, a, r):
    e = np.ones(n)
    a, r = int(a * SR), int(r * SR)
    e[:a] = np.linspace(0, 1, a)
    e[-r:] *= np.linspace(1, 0, r) ** 2
    return e


def lowpass(x, cutoff):  # one-pole, cutoff may vary per sample
    y = np.zeros_like(x)
    c = np.broadcast_to(np.asarray(cutoff, dtype=float), x.shape)
    a = 1 - np.exp(-2 * np.pi * c / SR)
    acc = 0.0
    for i in range(len(x)):
        acc += a[i] * (x[i] - acc)
        y[i] = acc
    return y


def stereo(x, width=0.0):
    return np.stack([x * (1 - width), x * (1 + width)], axis=1)


# whoosh: noise swept up then down through a low-pass, 0.45 s
n = int(0.45 * SR)
t = np.linspace(0, 1, n)
sweep = 400 + 5200 * np.sin(np.pi * t) ** 1.5
w = lowpass(rng.standard_normal(n), sweep) * env(n, 0.12, 0.25) * np.sin(np.pi * t) ** 0.8
w = w / np.abs(w).max() * 0.5
sf.write(out / "sfx_whoosh.wav", stereo(w, 0.1), SR)

# boom: pitched-down sine thump with a little grit, 0.9 s
n = int(0.9 * SR)
t = np.arange(n) / SR
f = 95 * np.exp(-t * 2.2) + 38
b = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 4.0)
b += 0.25 * lowpass(rng.standard_normal(n), 900) * np.exp(-t * 18)
b = np.tanh(2.2 * b)
b = b / np.abs(b).max() * 0.7
sf.write(out / "sfx_boom.wav", stereo(b), SR)

# pop: short bright click with a pitch blip, 0.09 s
n = int(0.09 * SR)
t = np.arange(n) / SR
p = np.sin(2 * np.pi * (900 + 1600 * np.exp(-t * 60)) * t) * np.exp(-t * 55)
p = p / np.abs(p).max() * 0.35
sf.write(out / "sfx_pop.wav", stereo(p), SR)

# music bed: 104 BPM, playful but quiet under dialogue
bpm, dur = 104, 15.6
beat = 60 / bpm
N = int(dur * SR)
mix = np.zeros((N, 2))


def place(sig, at, pan=0.0):
    i = int(at * SR)
    j = min(N, i + len(sig))
    mix[i:j, 0] += sig[: j - i] * (1 - pan)
    mix[i:j, 1] += sig[: j - i] * (1 + pan)


def kick():
    n = int(0.35 * SR)
    t = np.arange(n) / SR
    return np.sin(2 * np.pi * np.cumsum(55 + 90 * np.exp(-t * 30)) / SR) * np.exp(-t * 9) * 0.55


def shaker():
    n = int(0.08 * SR)
    t = np.arange(n) / SR
    s = rng.standard_normal(n)
    s = s - lowpass(s, 5000)
    return s * np.exp(-t * 60) * 0.09


def marimba(freq, length=0.5):
    n = int(length * SR)
    t = np.arange(n) / SR
    tone = np.sin(2 * np.pi * freq * t) + 0.35 * np.sin(2 * np.pi * freq * 4 * t) * np.exp(-t * 30)
    return tone * np.exp(-t * 7) * 0.16


# I - vi - IV - V in C, two bars each
chords = [[60, 64, 67], [57, 60, 64], [53, 57, 60], [55, 59, 62]]
mel = [72, 76, 79, 76, 74, 72, 69, 72, 69, 72, 76, 74, 71, 74, 79, 76]
hz = lambda m: 440 * 2 ** ((m - 69) / 12)
steps = int(dur / (beat / 2))
for k in range(steps):
    at = k * beat / 2
    bar = int(at / (beat * 4)) % 4
    if k % 2 == 0:
        if (k // 2) % 4 in (0, 2):
            place(kick(), at)
        place(marimba(hz(chords[bar][(k // 2) % 3] - 12), 0.6), at, -0.2)
    place(shaker(), at + (0.02 if k % 2 else 0), 0.3)
    if k % 2 == 1 or k % 4 == 0:
        place(marimba(hz(mel[k % len(mel)]), 0.35), at, 0.25)
mix = np.tanh(mix * 1.2)
fade = np.ones(N)
fade[: int(0.05 * SR)] = np.linspace(0, 1, int(0.05 * SR))
fade[-int(1.2 * SR):] = np.linspace(1, 0, int(1.2 * SR))
mix *= fade[:, None]
mix = mix / np.abs(mix).max() * 0.8
sf.write("public/audio/zorev-fun-bed.wav", mix, SR)
print("sfx + fun bed written")
