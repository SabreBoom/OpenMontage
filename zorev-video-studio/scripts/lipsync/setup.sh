# Free local lip-sync (MuseTalk v1.5, MIT) on CPU. Installs into .tools/lipsync (git-ignored).
#   bash scripts/lipsync/setup.sh && bash scripts/lipsync/weights.sh
set -e
T="$(cd "$(dirname "$0")/../.." && pwd)/.tools/lipsync"; mkdir -p "$T"; cd "$T"
[ -d MuseTalk ] || git clone -q https://github.com/TMElyralab/MuseTalk.git
uv venv -q --python 3.10 venv
P=venv/bin/python
uv pip install -q --python $P torch==2.0.1 torchvision==0.15.2 --index-url https://download.pytorch.org/whl/cpu
uv pip install -q --python $P "numpy==1.23.5" "diffusers==0.30.2" "accelerate==0.28.0" "transformers==4.39.2" "huggingface_hub==0.30.2" \
  "opencv-python-headless==4.9.0.80" "soundfile==0.12.1" "librosa==0.11.0" "einops==0.8.1" omegaconf ffmpeg-python "imageio[ffmpeg]" requests gdown
uv pip install -q --python $P "mmengine==0.10.4" "mmcv==2.0.1" -f https://download.openmmlab.com/mmcv/dist/cpu/torch2.0/index.html
# chumpy (pulled in by mmpose) needs pip at build time; mmengine needs pkg_resources
uv pip install -q --python $P pip wheel cython "setuptools<70"
uv pip install -q --python $P --no-build-isolation chumpy==0.70
uv pip install -q --python $P "mmdet==3.1.0" "mmpose==1.1.0"
$P -c "import pkg_resources, mmpose.apis, mmdet; print('ENV-OK')"
