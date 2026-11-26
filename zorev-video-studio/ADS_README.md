# ZOREV 15 s Instagram ads (Remotion)

Edit: `src/zorev/ZorevAd.tsx` (layout, captions, end card, audio mix) and
`src/zorev/products.ts` (per-product shots, stills, headline, caption placement).
Preview: `npm run dev`  •  Render: `npx remotion render ZorevNova out/final/Zorev_Nova_AI_Presenter_15s.mp4 --codec h264 --crf 18 --audio-codec aac`

Per ad (public/ads/<key>/):
- presenter.mp4: Canva H3 Max on-camera take of the fictional presenter (her voice and lip-sync).
- voice.wav: that take's audio, loudness-normalised (scripts/prepare-ad.py).
- ad.json: word-timed captions + edit points from whisper.cpp (scripts/prepare-ad.py).
- demo.mp4 / detail.mp4: product footage (existing Higgsfield clips of the real products).
- inset / endcard: product photos from the store and supplier references.
Music: `public/audio/zorev-bed.wav`, original, synthesised by scripts/make-music-bed.py.

Presenters: a different fictional person in every video (public/presenters/,
made with Cloudinary FLUX.2 Pro; Canva asset ids for the takes):
- Nova: MAHb_5JRMIg (take done)
- Hearth: MAHcADOmN3U (new take needed; the current Hearth take uses the Nova presenter)
- Nimbus: MAHcAHMxjYY (male presenter; take needed)
- Medusa: MAHcAA_3MKc (take needed)

Hearth, Nimbus and Medusa need their takes (Canva AI limit reached on
2026-11-26; it resets 2026-12-01). For each:
1. Generate the take with that product's presenter asset and the spec used for Nova (H3 Max, 15 s, speech in the first 12 s).
2. `python3 scripts/prepare-ad.py nimbus public/ads/nimbus/presenter.mp4 brings "<script>"` (Medusa: split word `combines`).
3. Add the product entry in products.ts (captionPos top for both shots) and render.
