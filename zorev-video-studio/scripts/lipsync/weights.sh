# Downloads MuseTalk v1.5 weights and helper models into .tools/lipsync/MuseTalk/models.
set -e
cd "$(cd "$(dirname "$0")/../.." && pwd)/.tools/lipsync/MuseTalk"
M=models; mkdir -p $M/musetalkV15 $M/dwpose $M/face-parse-bisent $M/sd-vae $M/whisper
H=https://huggingface.co
dl(){ [ -s "$1" ] || curl -sSL -f --retry 3 -o "$1" "$2"; }
dl $M/musetalkV15/musetalk.json $H/TMElyralab/MuseTalk/resolve/main/musetalkV15/musetalk.json
dl $M/musetalkV15/unet.pth $H/TMElyralab/MuseTalk/resolve/main/musetalkV15/unet.pth
dl $M/sd-vae/config.json $H/stabilityai/sd-vae-ft-mse/resolve/main/config.json
dl $M/sd-vae/diffusion_pytorch_model.bin $H/stabilityai/sd-vae-ft-mse/resolve/main/diffusion_pytorch_model.bin
for f in config.json pytorch_model.bin preprocessor_config.json; do dl $M/whisper/$f $H/openai/whisper-tiny/resolve/main/$f; done
dl $M/dwpose/dw-ll_ucoco_384.pth $H/yzd-v/DWPose/resolve/main/dw-ll_ucoco_384.pth
dl $M/face-parse-bisent/resnet18-5c106cde.pth https://download.pytorch.org/models/resnet18-5c106cde.pth
[ -s $M/face-parse-bisent/79999_iter.pth ] || ../venv/bin/gdown -q 154JgKpzCPW82qINcVieuPH3fZ2e0P812 -O $M/face-parse-bisent/79999_iter.pth
dl musetalk/utils/face_detection/detection/sfd/s3fd.pth https://www.adrianbulat.com/downloads/python-fan/s3fd-619a316812.pth
du -sh $M/*; echo WEIGHTS-OK
