# Runs the presenter jobs one at a time (they each use all CPU cores; running
# them side by side is ~4x slower). Waits for anything already running first.
#   bash scripts/presenter-queue.sh "lipsync hearth" "animate medusa" ...
cd "$(dirname "$0")/.."
O=.tools/motion/out; mkdir -p $O
while pgrep -f "scripts/motion/animate.py|scripts/lipsync/lipsync.py" >/dev/null; do sleep 15; done
for job in "$@"; do
  set -- $job
  echo "START $job $(date +%T)"
  if [ "$1" = animate ]; then
    .tools/motion/venv/bin/python scripts/motion/animate.py $2 public/presenters/$2.png $O/$2_motion.mp4 > $O/$2.log 2>&1
  else
    python3 scripts/lipsync/lipsync.py $2 $O/$2_motion.mp4 > $O/$2_ls.log 2>&1
  fi
  echo "DONE $job exit=$? $(date +%T)"
done
echo QUEUE-DONE
