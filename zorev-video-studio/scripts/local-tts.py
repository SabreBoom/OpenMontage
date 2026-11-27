"""Free local narration with Kokoro-82M (Apache-2.0 weights, commercial use OK).
  .tools/venv/bin/python scripts/local-tts.py <voice> <speed> <out.wav> "<text>"
Write 'Zorev' as 'Zoh-rev' in the text to get the ZOH-rev pronunciation."""
import sys
import soundfile as sf
from kokoro_onnx import Kokoro

voice, speed, out, text = sys.argv[1], float(sys.argv[2]), sys.argv[3], sys.argv[4]
k = Kokoro(".tools/models/kokoro-v1.0.onnx", ".tools/models/voices-v1.0.bin")
samples, sr = k.create(text, voice=voice, speed=speed, lang="en-us")
sf.write(out, samples, sr)
print(out, f"{len(samples)/sr:.2f}s @ {sr} Hz")
