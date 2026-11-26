# LivePortrait (MIT) for natural head motion and real blinks, CPU only.
# InsightFace models (non-commercial) are NOT downloaded; scripts/motion/animate.py
# uses the BSD-licensed S3FD + FAN face detector instead.
set -e
T="$(cd "$(dirname "$0")/../.." && pwd)/.tools/motion"; mkdir -p "$T"; cd "$T"
[ -d LivePortrait ] || git clone -q https://github.com/KwaiVGI/LivePortrait.git
uv venv -q --python 3.10 venv
P=venv/bin/python
uv pip install -q --python $P torch==2.3.1 torchvision==0.18.1 --index-url https://download.pytorch.org/whl/cpu
uv pip install -q --python $P "numpy==1.26.4" pyyaml "opencv-python-headless==4.10.0.84" scipy imageio imageio-ffmpeg \
  tqdm rich onnx "onnxruntime==1.19.2" scikit-image tyro pykalman pillow face-alignment==1.4.1 soundfile librosa
H=https://huggingface.co/KwaiVGI/LivePortrait/resolve/main/liveportrait
W=LivePortrait/pretrained_weights/liveportrait; mkdir -p $W/base_models $W/retargeting_models
dl(){ [ -s "$1" ] || curl -sSL -f --retry 3 -o "$1" "$2"; }
for m in appearance_feature_extractor motion_extractor spade_generator warping_module; do dl $W/base_models/$m.pth $H/base_models/$m.pth; done
dl $W/retargeting_models/stitching_retargeting_module.pth $H/retargeting_models/stitching_retargeting_module.pth
dl $W/landmark.onnx $H/landmark.onnx
du -sh $W; $P -c "import torch, onnxruntime, face_alignment; print('MOTION-OK')"
