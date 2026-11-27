// Skit ads (src/zorev/ZorevSkit.tsx). Product facts match the store listing;
// the jokes ("you never have to feed it") are playful, not product claims.
import medusaSkit from "../../public/skit/medusa/skit.json";
import { PRODUCTS } from "./products";
import type { SkitConfig, SkitData } from "./ZorevSkit";

const product = (id: string) => {
  const p = PRODUCTS.find((x) => x.id === id);
  if (!p) throw new Error(`no product ${id}`);
  return p;
};

export const SKITS: SkitConfig[] = [
  {
    id: "ZorevMedusaSkit",
    dir: "skit/medusa",
    data: medusaSkit as SkitData,
    product: product("ZorevMedusa"),
    hook: "POV: your roommate walks in",
    punchWord: "jellyfish",
    // the closer tentacle shot, then the wider desk shot (Medusa part of the montage, 7.9-11.7 s)
    reveal: { src: "ads/medusa/detail.mp4", startFromSec: 0.3 },
    broll: { src: "ads/medusa/demo.mp4", startFromSec: 8.0, fromWord: "Moving", toWord: "and" },
    keywords: ["jellyfish", "lamp.", "Medusa.", "feed"],
  },
];
