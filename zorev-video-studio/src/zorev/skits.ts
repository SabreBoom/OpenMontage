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
    // reveal on the warm pink glow; the cutaway on "colorful light" shows the
    // same lamp later in the clip, after it has shifted to blue/cyan
    reveal: { src: "ads/medusa/detail.mp4", startFromSec: 0.3 },
    broll: { src: "ads/medusa/detail.mp4", startFromSec: 7.0, fromWord: "Moving", toWord: "and" },
    keywords: ["jellyfish", "lamp.", "Medusa.", "feed"],
  },
];
