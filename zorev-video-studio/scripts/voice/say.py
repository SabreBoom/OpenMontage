"""Natural, expressive narration with Chatterbox TTS (MIT, runs on CPU).

  .tools/voice/venv/bin/python scripts/voice/say.py OUT.wav "text" [--ref voice.wav]
      [--exaggeration 0.6] [--cfg 0.4] [--seed 1]

--ref clones the timbre of a short reference clip (we use the presenter's
Kokoro voice, Apache-2.0, so every presenter keeps a distinct voice);
without it Chatterbox's own default voice is used. Higher exaggeration =
more animated delivery; lower cfg = slower, more deliberate pacing.
"""
import argparse

import torch
import torchaudio as ta
from chatterbox.tts import ChatterboxTTS

ap = argparse.ArgumentParser()
ap.add_argument("out")
ap.add_argument("text")
ap.add_argument("--ref")
ap.add_argument("--exaggeration", type=float, default=0.6)
ap.add_argument("--cfg", type=float, default=0.4)
ap.add_argument("--temperature", type=float, default=0.8)
ap.add_argument("--seed", type=int, default=1)
a = ap.parse_args()

torch.set_num_threads(4)
torch.manual_seed(a.seed)
model = ChatterboxTTS.from_pretrained(device="cpu")
wav = model.generate(a.text, audio_prompt_path=a.ref, exaggeration=a.exaggeration,
                     cfg_weight=a.cfg, temperature=a.temperature)
ta.save(a.out, wav, model.sr)
print(f"{a.out}: {wav.shape[-1] / model.sr:.2f}s")
