"""Voice conversion with Chatterbox VC (MIT): keeps the delivery (timing,
intonation, emphasis) of an expressive take and gives it another timbre, so
presenters keep distinct voices without losing expressiveness.

  .tools/voice/venv/bin/python scripts/voice/convert.py take.wav target_voice.wav out.wav
"""
import sys

import torch
import torchaudio as ta
from chatterbox.vc import ChatterboxVC

src, target, out = sys.argv[1:4]
torch.set_num_threads(4)
vc = ChatterboxVC.from_pretrained(device="cpu")
wav = vc.generate(audio=src, target_voice_path=target)
ta.save(out, wav, vc.sr)
print(f"{out}: {wav.shape[-1] / vc.sr:.2f}s")
