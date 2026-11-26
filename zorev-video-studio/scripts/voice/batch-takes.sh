cd "$(dirname "$0")/../.."; mkdir -p public/voice-test
P=.tools/voice/venv/bin/python; V=public/voice-test
H="Want that fireplace glow on your desk? Hearth pairs a flame-like light effect with cool mist, for a cozy corner without an actual flame. Shop Zoh-rev. Link in bio."
N="A little rain, right on your nightstand. Nimbus brings falling droplets and a soft glow into one cloud-shaped centerpiece. Watch the water fall. Shop Zoh-rev. Link in bio."
M="A jellyfish-inspired glow for your desk. Medusa combines moving tentacles and colorful light in a lamp that gives your space an underwater feel. Shop Zoh-rev. Link in bio."
$P scripts/voice/say.py $V/hearth-def-e5c2-s3.wav "$H" --exaggeration 0.5 --cfg 0.2 --seed 3
$P scripts/voice/say.py $V/hearth-def-e45c15-s4.wav "$H" --exaggeration 0.45 --cfg 0.15 --seed 4
$P scripts/voice/say.py $V/nimbus-michael-e6c3.wav "$N" --ref public/local-test/nimbus-am_michael.wav --exaggeration 0.6 --cfg 0.3
$P scripts/voice/say.py $V/nimbus-michael-e7c25-s2.wav "$N" --ref public/local-test/nimbus-am_michael.wav --exaggeration 0.7 --cfg 0.25 --seed 2
$P scripts/voice/say.py $V/medusa-bella-e6c3.wav "$M" --ref public/local-test/medusa-af_bella.wav --exaggeration 0.6 --cfg 0.3
$P scripts/voice/say.py $V/medusa-bella-e7c25-s2.wav "$M" --ref public/local-test/medusa-af_bella.wav --exaggeration 0.7 --cfg 0.25 --seed 2
echo BATCH-DONE
