// Three text-led skits, one format each (research: hook in 2-3 s, hard cuts,
// muted-friendly text, true product facts only; facts from the Shopify listings).
//  - Nova: kid reaction + hard cut (bedtime negotiations)
//  - Hearth: landlord meme, demo proof (hand through the "flame")
//  - Nimbus: question hook answered by the product, rain ASMR
import { PRODUCTS } from "./products";
import type { SkitTimelineConfig } from "./SkitTimeline";

const product = (id: string) => {
  const p = PRODUCTS.find((x) => x.id === id);
  if (!p) throw new Error(`no product ${id}`);
  return p;
};
const F = "skit/footage/";

export const SKIT_TIMELINES: SkitTimelineConfig[] = [
  {
    id: "ZorevNovaSkit",
    seconds: 15,
    product: product("ZorevNova"),
    accent: "#9FD8FF",
    scenes: [
      { name: "Kid: not tired", from: 0, to: 2.6, src: "skit/nova/kid-grumpy.mp4", grade: "warm", push: [1.1, 1.16], origin: "50% 30%" },
      { name: "Lights off", from: 2.6, to: 3.15, color: "#000" },
      { name: "Ceiling reveal", from: 3.15, to: 5.9, src: F + "nova_ceiling_phone.mp4", startFromSec: 0.3, push: [1.0, 1.12] },
      { name: "Kid: whoa", from: 5.9, to: 9.3, src: "skit/nova/kid-awe.mp4", grade: "night", stars: true, push: [1.12, 1.2], origin: "50% 30%" },
      { name: "13 discs", from: 9.3, to: 10.6, src: F + "nova_ceiling_nightstand.mp4", startFromSec: 1.0, push: [1.04, 1.1] },
      { name: "Focus", from: 10.6, to: 11.8, src: F + "nova_ceiling_phone.mp4", startFromSec: 5.5, focusPull: 0.8, push: [1.08, 1.12] },
      { name: "Rotation", from: 11.8, to: 12.9, src: F + "nova_ceiling_nightstand.mp4", startFromSec: 6.0, push: [1.0, 1.05] },
    ],
    captions: [
      { text: "me: it's bedtime", from: 0, to: 1.0 },
      { text: "my kid:\n\"I'm NOT tired\"", from: 1.0, to: 2.6, accent: ["NOT"] },
      { text: "*turns on Nova*", from: 2.6, to: 3.15, pos: "center", size: 70 },
      { text: "the ceiling:", from: 3.3, to: 5.9 },
      { text: "wait... bedtime\nlooks like THIS?", from: 6.2, to: 9.3, accent: ["THIS?"] },
      { text: "13 space scenes\nin the box", from: 9.3, to: 10.6, accent: ["13"] },
      { text: "turn to focus", from: 10.6, to: 11.8 },
      { text: "and the sky\nslowly turns", from: 11.8, to: 12.9 },
    ],
    endCard: { from: 12.9, headline: "Bedtime,\nbut make it space.", src: F + "nova_ceiling_phone.mp4", startFromSec: 7.5 },
    music: { src: "audio/zorev-lullaby-bed.wav", volume: 0.8 },
    sfx: [
      { src: "skit/sfx_click.wav", at: 2.62, volume: 0.9 },
      { src: "skit/sfx_shimmer.wav", at: 3.05, volume: 0.75 },
      { src: "skit/sfx_shimmer.wav", at: 12.85, volume: 0.3 },
    ],
  },
  {
    id: "ZorevHearthSkit",
    seconds: 15,
    product: product("ZorevHearth"),
    accent: "#FFB45E",
    scenes: [
      { name: "Landlord rule", from: 0, to: 1.7, src: F + "hearth_orange_pushin.mp4", startFromSec: 0.2, grade: "dim", blur: 26 },
      { name: "Me: reveal", from: 1.7, to: 4.6, src: F + "hearth_orange_pushin.mp4", startFromSec: 2.2, push: [1.0, 1.08] },
      { name: "Hand through it", from: 4.6, to: 7.7, src: F + "hearth_hand_mist.mp4", startFromSec: 3.6, push: [1.02, 1.08] },
      { name: "Colour change", from: 7.7, to: 10.7, src: F + "hearth_remote.mp4", startFromSec: 2.0, push: [1.0, 1.05] },
      { name: "Timer", from: 10.7, to: 12.4, src: F + "hearth_orange_pushin.mp4", startFromSec: 6.5, push: [1.04, 1.1] },
    ],
    captions: [
      { text: "my landlord:\n\"absolutely NO\nfireplaces.\"", from: 0, to: 1.7, pos: "center", size: 70, accent: ["NO"] },
      { text: "me:", from: 1.7, to: 2.8, size: 72 },
      { text: "it's not a fire.\nit's mist + light.", from: 2.8, to: 4.6 },
      { text: "hand right through it", from: 4.6, to: 5.9 },
      { text: "no real flame.\nnothing to burn.", from: 5.9, to: 7.7, accent: ["no", "nothing"] },
      { text: "orange, blue or purple\nfrom the remote", from: 7.7, to: 10.7 },
      { text: "timer: 2 to 8 hours", from: 10.7, to: 12.4 },
    ],
    endCard: { from: 12.4, headline: "Fireplace vibes.\nNo real flame.", src: F + "hearth_orange_pushin.mp4", startFromSec: 7.5 },
    music: { src: "audio/zorev-lofi-bed.wav", volume: 0.85 },
    sfx: [
      { src: "skit/sfx_pop.wav", at: 1.68, volume: 0.5 },
      { src: "skit/sfx_click.wav", at: 8.0, volume: 0.5 },
    ],
  },
  {
    id: "ZorevNimbusSkit",
    seconds: 15,
    product: product("ZorevNimbus"),
    accent: "#8FE3FF",
    scenes: [
      { name: "Question", from: 0, to: 1.8, src: F + "nimbus_blue_pushin.mp4", startFromSec: 0.5, grade: "dim", blur: 22 },
      { name: "Yes: drops", from: 1.8, to: 5.3, src: F + "nimbus_blue_pushin.mp4", startFromSec: 4.4, push: [1.02, 1.1] },
      { name: "Seven colours", from: 5.3, to: 8.1, src: F + "nimbus_color_pushin.mp4", startFromSec: 1.0, push: [1.0, 1.06] },
      { name: "Essential oil", from: 8.1, to: 10.7, src: F + "nimbus_oil_button.mp4", startFromSec: 0.2, push: [1.02, 1.06] },
      { name: "Rain close-up", from: 10.7, to: 12.5, src: F + "nimbus_blue_pushin.mp4", startFromSec: 7.2, push: [1.05, 1.12] },
    ],
    captions: [
      { text: "sound on", from: 0, to: 1.8, size: 40 },
      { text: "does it actually\nrain?", from: 0, to: 1.8, pos: "center", size: 84 },
      { text: "yes.", from: 1.8, to: 2.9, size: 84 },
      { text: "drop by drop,\ninto its own base", from: 2.9, to: 5.3 },
      { text: "glows in 7 colors", from: 5.3, to: 8.1, accent: ["7"] },
      { text: "add a few drops of\nyour essential oil", from: 8.1, to: 10.7 },
      { text: "a little rain cloud\nfor your nightstand", from: 10.7, to: 12.5 },
    ],
    endCard: { from: 12.5, headline: "A little rain.\nRight here.", src: F + "nimbus_color_pushin.mp4", startFromSec: 7.0 },
    music: { src: "audio/zorev-bed.wav", volume: 0.22 },
    ambience: { src: "skit/rain_asmr.wav", volume: 0.95 },
    sfx: [{ src: "skit/sfx_pop.wav", at: 1.78, volume: 0.4 }],
  },
];
