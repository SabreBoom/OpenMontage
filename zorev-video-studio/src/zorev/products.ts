// Per-product edit settings for the ZOREV 15 s Instagram ads.
// Timings come from public/ads/<key>/ad.json (word timestamps of the
// presenter's own voice, written by scripts/prepare-ad.py).
import novaAd from "../../public/ads/nova/ad.json";
import hearthAd from "../../public/ads/hearth/ad.json";

export type CaptionWord = { text: string; startMs: number; endMs: number };
export type CaptionSeg = { text: string; startMs: number; endMs: number; words: CaptionWord[] };
export type AdTiming = {
  key: string;
  hookEndMs: number;
  splitMs: number;
  ctaStartMs: number;
  speechEndMs: number;
  captions: CaptionSeg[];
};

// Where captions sit over each piece of footage, so they never cover the
// presenter's mouth, the product's effect or its stand.
export type CaptionPos = "top" | "mid" | "bottom";

export type FootageShot = {
  src: string; // file in public/
  startFromSec: number; // where to start inside the source clip
  captionPos: CaptionPos;
};

export type ProductAd = {
  id: string; // composition id
  name: string; // on-screen product name
  descriptor: string; // short verified descriptor from the product page
  headline: [string, string]; // opening headline, two lines
  timing: AdTiming;
  presenter: string;
  voice: string;
  inset: string; // product still shown beside the presenter in the hook
  insetBg: string;
  endcard: string; // product still for the closing view (a different photo)
  endcardBg: string;
  demo: FootageShot;
  detail: FootageShot;
};

export const PRODUCTS: ProductAd[] = [
  {
    id: "ZorevNova",
    name: "NOVA",
    descriptor: "Home planetarium projector",
    headline: ["Your ceiling.", "A different view."],
    timing: novaAd as AdTiming,
    presenter: "ads/nova/presenter.mp4",
    voice: "ads/nova/voice.wav",
    inset: "ads/nova/inset.png",
    insetBg: "#ffffff",
    endcard: "ads/nova/endcard.jpg",
    endcardBg: "#ffffff",
    demo: { src: "ads/nova/demo.mp4", startFromSec: 1.0, captionPos: "bottom" },
    detail: { src: "ads/nova/detail.mp4", startFromSec: 1.5, captionPos: "mid" },
  },
  {
    id: "ZorevHearth",
    name: "HEARTH",
    descriptor: "Flame mist diffuser",
    headline: ["Fireplace vibes.", "No real flame."],
    timing: hearthAd as AdTiming,
    presenter: "ads/hearth/presenter.mp4",
    voice: "ads/hearth/voice.wav",
    inset: "ads/hearth/inset.jpg",
    insetBg: "#ffffff",
    endcard: "ads/hearth/endcard.jpg",
    endcardBg: "#17171a",
    demo: { src: "ads/hearth/demo.mp4", startFromSec: 4.6, captionPos: "top" },
    detail: { src: "ads/hearth/detail.mp4", startFromSec: 0.2, captionPos: "top" },
  },
];
