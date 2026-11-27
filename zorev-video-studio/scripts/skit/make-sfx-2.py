"""Original sound design for the Nova, Hearth and Nimbus skits, synthesised from
scratch (no samples, no licences): light-switch click, star shimmer, a
music-box lullaby bed (Nova), close-up rain ASMR (Nimbus) and a cozy lo-fi bed
(Hearth).

  python3 scripts/skit/make-sfx-2.py
"""
import numpy as np
import soundfile as sf
from pathlib import Path

SR = 48000
rng = np.random.default_rng(11)
out = Path("public/skit")
out.mkdir(parents=True, exist_ok=True)
hz = lambda m: 440 * 2 ** ((m - 69) / 12)


def lowpass(x, cutoff):
    y = np.zeros_like(x)
    a = 1 - np.exp(-2 * np.pi * cutoff / SR)
    acc = 0.0
    for i in range(len(x)):
        acc += a * (x[i] - acc)
        y[i] = acc
    return y


def reverb(x, seconds=1.6, mix=0.3):
    n = int(seconds * SR)
    ir = rng.standard_normal(n) * np.exp(-np.arange(n) / SR * (6.9 / seconds))
    ir = lowpass(ir, 6000)
    wet = np.pad(np.convolve(x, ir), (0, 1))[: len(x) + n]
    wet = wet / (np.abs(wet).max() + 1e-9) * np.abs(x).max()
    y = np.zeros(len(x) + n)
    y[: len(x)] += x * (1 - mix)
    y += wet * mix
    return y


def bell(freq, length, decay=4.0, bright=0.4):
    t = np.arange(int(length * SR)) / SR
    tone = np.sin(2 * np.pi * freq * t) + bright * np.sin(2 * np.pi * freq * 2.76 * t) * np.exp(-t * 9)
    return tone * np.exp(-t * decay) * np.minimum(1, t * 400)


def save(name, x, peak=0.8):
    x = x / (np.abs(x).max() + 1e-9) * peak
    if x.ndim == 1:
        x = np.stack([x, x], axis=1)
    sf.write(name, x, SR)


def bed(n):
    return np.zeros(n)


def place(buf, sig, at):
    i = int(at * SR)
    j = min(len(buf), i + len(sig))
    if i < len(buf):
        buf[i:j] += sig[: j - i]


# light switch: two tight clicks
n = int(0.12 * SR)
t = np.arange(n) / SR
c = rng.standard_normal(n) * np.exp(-t * 900) + 0.6 * np.sin(2 * np.pi * 2300 * t) * np.exp(-t * 500)
c2 = np.zeros(n)
c2[int(0.022 * SR):] = c[: n - int(0.022 * SR)] * 0.5
save(out / "sfx_click.wav", c + c2, 0.6)

# star shimmer: rising pentatonic bells over a soft noise swell, 2.2 s
N = int(2.2 * SR)
sh = bed(N)
notes = [72, 74, 76, 79, 81, 84, 86, 88, 91, 93, 96]
for k, m in enumerate(notes):
    place(sh, bell(hz(m), 1.2, decay=3.5) * (0.5 + 0.05 * k), 0.08 + k * 0.11)
sw = lowpass(rng.standard_normal(N), 5000) * np.sin(np.pi * np.linspace(0, 1, N)) ** 2 * 0.12
save(out / "sfx_shimmer.wav", reverb(sh + sw, 1.4, 0.35)[: int(3.2 * SR)], 0.6)

# Nova lullaby bed: soft pad + music-box arpeggio, 80 BPM, 15.6 s
dur, beat = 15.6, 60 / 80
N = int(dur * SR)
mb = bed(N)
prog = [[60, 64, 67, 71], [57, 60, 64, 67], [53, 57, 60, 64], [55, 59, 62, 67]]
for k in range(int(dur / (beat / 2))):
    at = k * beat / 2
    ch = prog[int(at / (beat * 4)) % 4]
    m = ch[[0, 2, 1, 3, 2, 1, 3, 2][k % 8]] + 12
    place(mb, bell(hz(m), 1.6, decay=2.6, bright=0.6) * 0.35, at)
pad = bed(N)
tt = np.arange(N) / SR
for k in range(int(dur / (beat * 4)) + 1):
    ch = prog[k % 4]
    seg0, seg1 = int(k * beat * 4 * SR), min(N, int((k + 1) * beat * 4 * SR) + int(0.4 * SR))
    if seg0 >= N:
        break
    ts = tt[seg0:seg1] - tt[seg0]
    env = np.minimum(1, ts / 0.6) * np.minimum(1, (ts[-1] - ts + 1e-3) / 0.5)
    for m in ch[:3]:
        pad[seg0:seg1] += (np.sin(2 * np.pi * hz(m) * ts) + 0.3 * np.sin(2 * np.pi * hz(m) * 1.003 * ts)) * env * 0.08
lull = reverb(mb + lowpass(pad, 2500), 2.2, 0.4)[:N]
fade = np.ones(N)
fade[-int(1.5 * SR):] = np.linspace(1, 0, int(1.5 * SR))
save("public/audio/zorev-lullaby-bed.wav", lull * fade, 0.8)

# Nimbus rain ASMR: soft rain bed + water-drop plinks into the basin, 15.6 s
N = int(15.6 * SR)
rain = lowpass(rng.standard_normal(N), 3500) - lowpass(rng.standard_normal(N), 300)
rain *= 0.05
drops = bed(N)
at = 0.05
while at < 15.5:
    n = int(0.16 * SR)
    t = np.arange(n) / SR
    f0 = rng.uniform(700, 1500)
    plink = np.sin(2 * np.pi * np.cumsum(f0 * (1 + 1.4 * (1 - np.exp(-t * 60)))) / SR) * np.exp(-t * rng.uniform(28, 45))
    place(drops, plink * rng.uniform(0.35, 1.0), at)
    at += rng.exponential(0.17) + 0.04
asmr = reverb(rain + drops * 0.5, 0.8, 0.25)[:N]
save(out / "rain_asmr.wav", asmr, 0.7)

# Hearth cozy lo-fi bed: electric-piano chords, soft kick + brushed snare, 76 BPM
dur, beat = 15.6, 60 / 76
N = int(dur * SR)
lofi = bed(N)
chords = [[62, 65, 69, 72], [60, 64, 67, 71], [57, 60, 64, 67], [58, 62, 65, 69]]


def epiano(freq, length):
    t = np.arange(int(length * SR)) / SR
    mod = np.sin(2 * np.pi * freq * t) * 1.2 * np.exp(-t * 3)
    return np.sin(2 * np.pi * freq * t + mod) * np.exp(-t * 1.8) * np.minimum(1, t * 200)


for bar in range(int(dur / (beat * 4)) + 1):
    t0 = bar * beat * 4
    for m in chords[bar % 4]:
        place(lofi, epiano(hz(m), beat * 4) * 0.12, t0 + 0.02 * (m % 3))
    place(lofi, epiano(hz(chords[bar % 4][0] - 24), beat * 4) * 0.22, t0)
    for b in range(4):
        tb = t0 + b * beat
        n = int(0.3 * SR)
        t = np.arange(n) / SR
        if b in (0, 2):
            place(lofi, np.sin(2 * np.pi * np.cumsum(50 + 70 * np.exp(-t * 35)) / SR) * np.exp(-t * 10) * 0.35, tb)
        else:
            place(lofi, lowpass(rng.standard_normal(n), 4000) * np.exp(-t * 18) * 0.08, tb)
        place(lofi, (rng.standard_normal(int(0.05 * SR)) * np.exp(-np.arange(int(0.05 * SR)) / SR * 80)) * 0.03, tb + beat / 2)
lofi = lowpass(lofi, 6000)
fade = np.ones(N)
fade[-int(1.2 * SR):] = np.linspace(1, 0, int(1.2 * SR))
save("public/audio/zorev-lofi-bed.wav", lofi * fade, 0.8)
print("click, shimmer, lullaby bed, rain asmr, lofi bed written")
