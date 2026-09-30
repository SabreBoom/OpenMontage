# ZOREV — visual assets: what exists, what was generated, what is still needed

Theme: **Zorev V12**, theme id `187716436219` (unpublished). Built and tested on the identical copy `ZOREV v12 film (Claude, DRAFT)`, `187717452027`.
All images below live in Shopify **Content → Files** and are wired into the draft theme only.

---

## 1. Generated for this draft (real generations, Cloudinary AI, 2026-09-30)

Every product image used the store's real product cutouts as reference images. Every output was
inspected at 1:1 before use; two were repaired with the real product's own pixels rather than
regenerated (details below).

| Slot | File | How it was made | QC result |
|---|---|---|---|
| H1 — hero (desktop) | `zorev-v12-hero-trail-dawn.jpg` 2752×1536 | Text-to-image, nano-banana-2, 2K. No product. | Pass. Natural, no text, no people, dark left third for copy. |
| H1-M — hero (phones) | `zorev-v12-hero-trail-dawn-mobile.jpg` 1080×1920 | Portrait crop of H1 around the light shafts and trail, Cloudinary AI upscale, downsampled. | Pass. |
| G1 — GODA in use | `zorev-v12-goda-wrist-overlook.jpg` 2752×1536 | Image-to-image, nano-banana-2-edit, 1K, reference = real GODA Black bottle cutout. Cloudinary AI upscale ×4, downsampled ×2. | **Repaired.** Bottle shape, colour, logo and GODA wordmark were right, but the fine print was invented ("For Hor", garbled lines). The real label from the product cutout was composited onto the bottle, colour-graded to the scene and curved-shaded. Hands and the overlook are AI-generated. |
| Y1 — HOYGI everyday | `zorev-v12-hoygi-cafe-window.jpg` 2752×1536 | Image-to-image, nano-banana-2-edit, 1K, reference = real Hoygi stick cutout. | **Rebuilt.** The generated stick had a blank label band and was ~2.5× too big next to the espresso cup. It was removed (Cloudinary generative remove), the plate upscaled, and the **real Hoygi cutout** composited at true scale with light from the street window and a cast shadow matching the cup's. |
| P1 — The Pair | `zorev-v12-pair-basalt-dawn.jpg` 2400×1792 | Image-to-image, nano-banana-2-edit, 1K, references = real GODA bottle + real Hoygi stick. AI upscale. | Pass. Labels, dropper, collar, colours and printed text match the packaging. |
| M1 — Road | `zorev-v12-road-golden-hills.jpg` 2400×1792 | Text-to-image, nano-banana-2, 1K, AI upscale. No product. | Pass. No vehicles, no text. |

Generation quota: the Cloudinary plan's 50 image-generation credits are **fully spent** (one 2K
text-to-image = 14 credits, one 1K image-to-image = 9). More needs a plan change at
https://console.cloudinary.com/app/image/generation/plans or another generator.

### Existing store files reused (provenance unknown — uploaded to Files by the store)

| Use | File | Note |
|---|---|---|
| Made to move → Travel | `8C64E5DB-41A4-4F4E-B7C5-D3CAEC464CFF.jpg` 1470×981 | Valley at dawn. Fine at card size. **Replace with M2.** |
| Made to move → Trail | `IMG_7283.jpg` 768×1376 | Forest light rays. Only 768 px wide: soft on retina. **Replace with M3.** |
| Closing band | `zorev-hero-forest-basalt.jpg` 2048×1152 | Kept. |
| Made to move → Everyday | crop of Y1 | Reuse. **Replace with M4.** |

### Store files NOT used, and why

- Maker infographics (`4A146F7F…`, `6AD9E300…`, `AB88A0DB…`, `AC93D4C2…`, `IMG-7280.png`, `A4CF034C…`, `84c6d0cd…`, `e52ed7cf…`): marketing claims printed on the image ("Pheromone infused", "Anti-wrinkle"), which the store labels as the maker's rather than repeats.
- `34d3164f…` ("COUPLE DATE PERFUME"), `dfc1d253…` ("WOMEN'S FRAGRANCE SUNSHINE GIRL"), `671771d3…`: AI-looking people with overlaid text; exactly the dropshipping look to avoid.
- `zorev-hero-loop.mp4`, `zorev-hero-poster.jpg`: "Velvet Oud", a previous product. Stale.
- `zorev-note-top.png`, `zorev-note-base.png`: scent-note still lifes (bergamot, amber). GODA's notes are not published by the maker, so showing notes would be an invented claim.
- Dry bag, umbrella and other legacy product photos: products no longer sold.

---

## 2. Still needed — production briefs

Why these are still missing: video generation is not available in this environment (no fal.ai,
HeyGen or Gemini key; Figma Weave not linked), and the image-generation quota is spent.
Each slot already exists in the draft theme and takes the file in the theme editor with no code change.

Product accuracy for every product shot: **the real product, unmodified.** GODA: dark amber 15 ml
glass bottle, black rubber dropper bulb, ridged black collar, black wrap label with the white
logo mark, "GODA" in white condensed caps, "For Her" (Black option) and a fine red line pattern.
HOYGI: plum twist-up stick, peach balm, white label band with "Hoygi", "CALCIUM MULTI BALM",
the six-line list and "NET:9G/0.32OZ". No redesigned caps, no invented text, no added logos,
true scale (bottle ≈ 8 cm tall with dropper, stick ≈ 7 cm).

### H1-F — Hero film (loop)

- **Purpose:** plays over H1 in the homepage hero (`Cinematic hero → Film`).
- **Subject / product:** the H1 place; no product, no people.
- **Environment / location type:** Pacific-Northwest-style fir forest, narrow packed-earth trail, sword ferns, moss on basalt.
- **Time of day / weather:** first light, 20–30 min after sunrise; thin ground fog, still air with the faintest breeze.
- **Camera position / height:** locked off on sticks, 60 cm above the trail, 3 m back from the first bend. No camera move.
- **Lens / look:** 35 mm full frame, f/4; natural contrast, fine grain; no lens flare.
- **Framing:** trail enters lower right and bends into fog at centre right; tall dark trunks fill the left third.
- **Foreground / background:** soft ferns in the lower left corner; background dissolves into luminous fog.
- **Negative space / text-safe area:** left 45 % of the frame, from 20 % to 85 % of the height, stays dark and quiet.
- **Product position:** none.
- **Lighting / shadows / reflections:** sun behind the canopy at upper centre right making 2–3 soft shafts; no hard shadows; dew glints only.
- **Colour treatment / materials:** moss green, charcoal bark, pale gold highlights, blue-grey fog; restrained saturation.
- **Mood:** still, early, private.
- **Motion:** fog drifting slowly left to right through the shafts; fern tips moving a few millimetres; shafts brightening and dimming very slowly. Nothing else moves.
- **Loop behaviour:** 10–12 s, seamless (cross-dissolve the last 1.5 s into the first in the edit, or shoot a symmetric drift); no visible jump.
- **Desktop crop:** 16:9 master. **Mobile crop:** 9:16 cut centred at 64 % across (same as H1-M).
- **Aspect / resolution / format:** 16:9, 3840×2160 master; deliver 1920×1080 H.264 MP4 (≤ 6 MB) and 1080×1920 for phones; upload to Shopify Files as video.
- **Performance:** silent, no audio track; the theme plays it only on screen and never for reduced motion, Save-Data or 2G; H1 stays the poster.

### G2 — GODA detail (macro)

- **Purpose:** 3rd product-gallery slide on GODA; optional second specimen in the GODA chapter.
- **Subject:** the dropper lifted a few centimetres from the bottle neck, one drop forming at the pipette tip.
- **Product accuracy:** the real bottle, Black option, label facing camera, fully legible.
- **Environment / location type:** dark grey granite slab, outdoors on a ledge; nothing else in frame.
- **Time of day / weather:** late afternoon, clear.
- **Camera position / height:** at bottle-shoulder height, 25 cm away, 20° off the label axis.
- **Lens / look:** 100 mm macro, f/5.6 (label sharp end to end); focus-stack if needed.
- **Framing:** bottle in the lower right third, pipette tip at the upper third line.
- **Foreground / background:** clean stone foreground; background valley falling to soft green-gold bokeh.
- **Negative space:** upper left 40 %.
- **Lighting:** low warm sun from camera left behind, rim on the glass shoulder and the drop; white card fill from the right.
- **Shadows / reflections:** one soft contact shadow; a faint amber caustic from the glass on the stone is welcome.
- **Colour / materials:** amber glass, black rubber, grey granite, warm gold; no oversaturation.
- **Mood:** precise, calm.
- **Text-safe area:** none needed (gallery).
- **Desktop / mobile crop:** square 1:1 master; keep bottle and drop inside the central 80 %.
- **Aspect / resolution / format:** 1:1, 3000×3000, JPEG q85, sRGB.
- **Performance:** ≤ 900 KB.

### Y2 — HOYGI detail (macro)

- **Purpose:** 3rd product-gallery slide on HOYGI.
- **Subject:** the stick twisted up 3 mm, balm surface texture visible, uncapped.
- **Product accuracy:** the real stick, label band facing camera, every line legible.
- **Environment:** pale linen over a light oak table, indoors by a window.
- **Time of day / weather:** morning, soft overcast daylight.
- **Camera position / height:** 10° above the balm's top plane, 20 cm away.
- **Lens / look:** 100 mm macro, f/8.
- **Framing:** stick vertical, centred slightly right; balm top at the upper third line.
- **Foreground / background:** linen weave soft in foreground; window light falling off to warm grey.
- **Negative space:** left third.
- **Lighting:** large window from the left; white bounce right.
- **Shadows / reflections:** soft shadow to the right; slight sheen on the balm, no specular hot spots on the tube.
- **Colour / materials:** plum, peach, cream linen, oak.
- **Mood:** tactile, clean.
- **Crops:** 1:1 master; stick within the central 70 %.
- **Aspect / resolution / format:** 1:1, 3000×3000, JPEG q85.
- **Performance:** ≤ 900 KB.

### Y3 — HOYGI in use

- **Purpose:** product-gallery slide and alternative HOYGI chapter photograph.
- **Subject:** an adult's hand gliding the stick along the cheekbone; face cropped at the lower lip line (no full face).
- **Product accuracy:** real stick; label band readable; balm visibly in contact with skin.
- **Environment / location type:** window seat on a train, landscape blurred outside.
- **Time of day / weather:** mid-morning, bright overcast.
- **Camera position / height:** eye level, 60 cm, three-quarter from the window side.
- **Lens / look:** 85 mm, f/2.8; real skin texture, no retouch smoothing.
- **Framing:** hand and stick in the right half; window in the left half.
- **Foreground / background:** soft seat edge foreground; landscape streaks behind.
- **Negative space:** left half (window).
- **Lighting:** window key from the left; no flash.
- **Colour:** natural skin, plum, cool grey window light.
- **Mood:** unhurried, ordinary.
- **Crops:** 16:9 master for desktop; 4:5 phone crop centred at 70 % across.
- **Aspect / resolution / format:** 16:9, 4000×2250, JPEG q85.
- **Casting:** a real person with a signed model release. Not AI-generated.

### M2 — Travel (Made to move)

- **Purpose:** replace the reused valley photograph.
- **Subject:** a carry-on liquids pouch on an airport tray at security, GODA upright inside it, HOYGI beside the pouch (a solid, so outside it).
- **Product accuracy:** both real, labels legible.
- **Environment / location type:** airport security tray, grey plastic, a passport and a phone beside.
- **Time of day:** early morning, fluorescent plus window daylight.
- **Camera position / height:** 45° down, 60 cm above the tray.
- **Lens / look:** 50 mm, f/4.
- **Framing / product position:** pouch lower centre, stick lower right.
- **Negative space:** top third (tray edge and floor soft).
- **Lighting / shadows:** mixed daylight; neutralise green cast in the grade.
- **Colour:** neutral greys, clear plastic, plum and amber accents.
- **Mood:** practical, calm.
- **Crops:** 3:4 portrait master (the card is 3:4 on desktop, 4:5 on phones).
- **Aspect / resolution / format:** 3:4, 2400×3200, JPEG q85.
- **Performance:** ≤ 800 KB.

### M3 — Trail (Made to move)

- **Purpose:** replace the 768 px forest photograph.
- **Subject:** the side pocket of a daypack resting on a rock beside a trail, the GODA bottle and HOYGI stick sitting in the mesh pocket, tops visible.
- **Product accuracy:** both real; label fronts toward the camera.
- **Environment:** alpine trail, granite, low heather.
- **Time of day / weather:** golden hour, clear.
- **Camera position / height:** 40 cm, level with the pocket, 1 m away.
- **Lens / look:** 35 mm, f/4.
- **Framing:** pack in the lower left half; trail rising behind to the right.
- **Negative space:** sky and ridge in the upper half.
- **Lighting:** low sun from behind right, rim on pack and products.
- **Colour:** warm stone, faded green, deep sky blue.
- **Mood:** earned, quiet.
- **Crops / aspect / resolution / format:** 3:4 portrait, 2400×3200, JPEG q85.

### M4 — Everyday (Made to move)

- **Purpose:** replace the reused Y1 crop.
- **Subject:** a wool coat on a chair back, GODA just visible in the chest pocket, keys and a phone on the seat.
- **Product accuracy:** only the dropper bulb, collar and top of the label show; the visible part must match exactly.
- **Environment:** small apartment entryway, warm plaster wall.
- **Time of day:** early evening, lamp light plus last daylight.
- **Camera position / height:** chest height, 1.5 m.
- **Lens / look:** 50 mm, f/2.8.
- **Framing:** pocket at the right third line.
- **Negative space:** plaster wall, left half.
- **Lighting:** tungsten lamp from the right, cool daylight fill from the left.
- **Colour:** camel wool, warm plaster, amber.
- **Mood:** home, the ordinary day.
- **Crops / aspect / resolution / format:** 3:4 portrait, 2400×3200, JPEG q85.

### P1-F — The Pair film (optional)

- **Purpose:** plays over P1 in the Pair section.
- **Subject / product:** P1's two real products on the basalt rock.
- **Environment / light:** as P1: forest edge, morning fog, backlight.
- **Camera:** locked off, P1 framing; 100 mm.
- **Motion:** fog drifting behind; one dew drop running down the rock; products perfectly still.
- **Loop:** 8 s seamless.
- **Aspect / format:** 1:1, 2160×2160 master, 1080×1080 H.264 MP4 ≤ 4 MB, silent.

### R1 — Real media (customer and creator clips)

These cannot be generated or staged. The `Real media` section shows an honest empty state until a
clip is added **and** its "I have permission" box is ticked. For each clip: 9:16, under 20 s, the
creator's written permission, the credit exactly as they want it, a poster frame from the clip, and
a caption that says plainly what happens in it.
