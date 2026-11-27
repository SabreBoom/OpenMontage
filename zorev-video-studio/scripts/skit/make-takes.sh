# Animates and lip-syncs every on-camera speaker of a skit, one job at a time.
#   bash scripts/skit/make-takes.sh public/skit/medusa roommate:public/skit/roommate.png:double owner:public/presenters/medusa.png
cd "$(dirname "$0")/../.."
S=$1; shift
O=.tools/motion/out; mkdir -p $O
for spec in "$@"; do
  IFS=: read who img style <<< "$spec"
  T=$S/takes/$who
  secs=$(python3 -c "import json; d=json.load(open('$T/ad.json')); print(round(d['takeEndSec']-d['takeStartSec'],2))")
  extra=""; [ "$style" = double ] && extra="--double-take"
  echo "START animate $who ${secs}s $(date +%T)"
  .tools/motion/venv/bin/python scripts/motion/animate.py skit-$who $img $O/skit_${who}_motion.mp4 \
    --ad $T/ad.json --voice $T/voice.wav --full --seconds $secs $extra > $O/skit_$who.log 2>&1 || { echo "FAIL animate $who"; exit 1; }
  echo "START lipsync $who $(date +%T)"
  python3 scripts/lipsync/lipsync.py skit-$who $O/skit_${who}_motion.mp4 --full --seconds $secs \
    --voice $T/voice.wav --out $T/presenter.mp4 > $O/skit_${who}_ls.log 2>&1 || { echo "FAIL lipsync $who"; exit 1; }
  echo "DONE $who $(date +%T)"
done
echo TAKES-DONE
