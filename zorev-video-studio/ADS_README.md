# ZOREV 15 s Instagram ads (Remotion)

Edit: `src/zorev/ZorevAd.tsx` (layout, captions, end card, audio mix) and
`src/zorev/products.ts` (per-product shots, stills, headline, caption placement).
Preview: `npm run dev`  •  Render: `npx remotion render ZorevNova out/final/Zorev_Nova_AI_Presenter_15s.mp4 --codec h264 --crf 18 --audio-codec aac`

Per ad (public/ads/<key>/):
- presenter.mp4: the fictional presenter's on-camera take (picture + voice).
- voice.wav: the narration, loudness-normalised (scripts/prepare-ad.py).
- ad.json: word-timed captions + edit points (scripts/prepare-ad.py).
- demo.mp4 / detail.mp4: product footage (existing Higgsfield clips of the real products).
- inset / endcard: product photos from the store and supplier references.
Music: `public/audio/zorev-bed.wav`, original, synthesised by scripts/make-music-bed.py.

Presenters: a different fictional person in every video (stills in
public/presenters/, made with Cloudinary FLUX.2 Pro).
- Nova: Canva H3 Max take.
- Hearth, Nimbus, Medusa: made locally and free, with commercially usable
  open models (no paid credits):

## Local presenter pipeline (CPU)
One-time setup: `bash scripts/voice/setup.sh`, `bash scripts/motion/setup.sh`,
`bash scripts/lipsync/setup.sh && bash scripts/lipsync/weights.sh`
(tools and weights go to the git-ignored `.tools/`).

1. Voice: Chatterbox TTS (MIT). `scripts/voice/batch-takes.sh` makes takes;
   `--ref` clones a presenter's timbre from a short clip (public/local-test/*
   Kokoro voices, Apache-2.0). Spell the brand "Zohrev" for the right sound.
   Pick by transcript + pace, then
   `bash scripts/voice/finish-voice.sh take.wav final.wav [tempo]`
   (fuller broadcast tone, 0.3 s lead-in, 15.0 s, -16 LUFS).
2. Captions + edit points: `python3 scripts/prepare-ad.py <key> final.wav <split word> "<script>"`
   (split words: Hearth `for`, Nimbus `cloud-shaped`, Medusa `in`).
3. Motion: `.tools/motion/venv/bin/python scripts/motion/animate.py <key> public/presenters/<key>.png .tools/motion/out/<key>_motion.mp4`
   LivePortrait (MIT; BSD face detector, no InsightFace) driven by the voice:
   phrase nods, per-sentence head turns/tilts, eyebrow lifts, glances, real
   blinks, closing smile. `--probe` renders test poses.
4. Lip-sync: `python3 scripts/lipsync/lipsync.py <key> .tools/motion/out/<key>_motion.mp4`
   MuseTalk v1.5 (MIT) on the on-screen windows only, on a square around the
   face; writes public/ads/<key>/presenter.mp4.
   `bash scripts/presenter-queue.sh "animate medusa" "lipsync medusa"` runs
   steps 3-4 one at a time (running them side by side is ~4x slower).
5. Set `presenterFromStill: true` in products.ts (handheld camera sway) and render.
