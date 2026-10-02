# Launch posts, built

The three feed posts and the story from [`../launch-social.md`](../launch-social.md),
made from the store's own pictures and the theme's own type and colour.

| File | What it is |
| --- | --- |
| `renders/zorev-launch-post-1.jpg` | 1. The new look, 1080x1350 |
| `renders/zorev-launch-post-2.jpg` | 2. Two essentials, 1080x1350 |
| `renders/zorev-launch-post-3.jpg` | 3. The Pair, 1080x1350 |
| `renders/zorev-launch-story-1.jpg` | Story, 1080x1920. Label sits 330 px above the bottom edge. |
| `canva-feed.html`, `canva-story.html` | The same posts for Canva's HTML import: the picture as one image, the words as editable text. |
| `posts.html` | The source. Edit this, then rebuild. |

## Pictures

- Forest and Pair photographs: the hero and Pair images from Shopify Files
  (`zorev-v12-hero-trail-dawn-mobile.jpg`, `zorev-v12-pair-basalt-dawn.jpg`), copied to `img/`.
- GODA and HOYGI: the real cutouts from each product's `zorev.cutouts` metafield, copied to `img/`,
  standing on `zorev-theme/assets/zorev-stage-amber.jpg` and `zorev-stage-sage.jpg`.
- Type: `newsreader-latin-400.woff2` and `public-sans-latin.woff2` from the theme.

## Claims checked against Shopify on 2026-10-02

- GODA $30 and HOYGI $25: the products' live prices.
- "$47 together ... no code": the automatic discount "The ZOREV Pair · Save $8" is active,
  and the theme's `pair_save_cents` is 800. $30 + $25 − $8 = $47.
- "Out within one business day" is not used.

Check the prices again on the day the posts go out.

## Rebuild

```sh
NODE_PATH=$(npm root -g) node build.js                 # renders/ and plates/
NODE_PATH=$(npm root -g) node build.js <public-url>    # also canva-*.html, plates loaded from <public-url>/plates/
```
