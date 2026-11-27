# Chatterbox TTS (MIT, Resemble AI): natural, expressive voices, CPU.
set -e
T="$(cd "$(dirname "$0")/../.." && pwd)/.tools/voice"; mkdir -p "$T"; cd "$T"
uv venv -q --python 3.11 venv
P=venv/bin/python
uv pip install -q --python $P torch==2.6.0 torchaudio==2.6.0 --index-url https://download.pytorch.org/whl/cpu
uv pip install -q --python $P chatterbox-tts==0.1.2 soundfile "setuptools<70"
$P -c "from huggingface_hub import snapshot_download; print(snapshot_download('ResembleAI/chatterbox', allow_patterns=['*.safetensors','*.json','conds.pt']))"
$P -c "import chatterbox; print('VOICE-OK')"
