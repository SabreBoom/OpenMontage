// Text-led skit ads: a list of hard-cut scenes, static native captions and a
// safe-zone end card, all from config (src/zorev/skitTimelines.ts).
// Layout follows the cross-platform Reels/TikTok safe band: captions and key
// visuals stay inside x 180-900 and y 220-1420 so the app UI never covers them.
import React from "react";
import { AbsoluteFill, Easing, Img, Interactive, Sequence, interpolate, random, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Audio, Video } from "@remotion/media";
import type { ProductAd } from "./products";
import { FPS, fontFamily } from "./ZorevAd";

export type Grade = "none" | "night" | "dim" | "warm";

export type SkitScene = {
  name: string;
  from: number; // seconds on the timeline
  to: number;
  src?: string; // video in public/
  startFromSec?: number;
  color?: string; // plain background instead of video
  grade?: Grade;
  blur?: number; // constant blur, px (e.g. to hide the product before the reveal)
  stars?: boolean; // projected star dots drifting over the frame (star projector light)
  push?: [number, number]; // scale at scene start -> end
  origin?: string; // transform origin for the push
  focusPull?: number; // seconds of blur -> sharp at the start (shows a focus dial being turned)
};

export type SkitCaption = {
  text: string;
  from: number;
  to: number;
  pos?: "top" | "center" | "low";
  size?: number;
  accent?: string[]; // words drawn in the accent colour
};

export type SkitTimelineConfig = {
  id: string;
  seconds: number;
  product: ProductAd;
  accent: string;
  scenes: SkitScene[];
  captions: SkitCaption[];
  endCard: { from: number; headline: string; src: string; startFromSec: number };
  music: { src: string; volume: number };
  ambience?: { src: string; volume: number };
  sfx: { src: string; at: number; volume: number }[];
};

const SAFE = { left: 180, right: 900, top: 220, bottom: 1420 };
const CAPTION_TOP = { top: 270, center: 760, low: 1170 };
const toF = (s: number) => Math.round(s * FPS);
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

const gradeFilter = (g: Grade | undefined) =>
  g === "night" ? "brightness(0.62) contrast(1.08) saturate(0.85)" : g === "dim" ? "brightness(0.45) saturate(0.7)" : g === "warm" ? "saturate(1.1) sepia(0.12)" : "none";

// Star projector light: soft dots that drift around a centre point and twinkle.
const Stars: React.FC = () => {
  const frame = useCurrentFrame();
  const dots = Array.from({ length: 140 }, (_, i) => ({
    x: random(`sx${i}`) * 1500 - 210,
    y: random(`sy${i}`) * 2300 - 190,
    r: 2 + random(`sr${i}`) * 5,
    tw: random(`st${i}`) * Math.PI * 2,
    hue: random(`sh${i}`) < 0.3 ? "190,210,255" : random(`sh${i}`) < 0.5 ? "220,190,255" : "255,255,255",
  }));
  return (
    <AbsoluteFill style={{ mixBlendMode: "screen", rotate: `${frame * 0.06}deg`, transformOrigin: "50% 45%" }}>
      {dots.map((d, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: d.x,
            top: d.y,
            width: d.r * 2,
            height: d.r * 2,
            borderRadius: "50%",
            opacity: 0.45 + 0.4 * Math.sin(frame / 9 + d.tw),
            background: `radial-gradient(circle, rgba(${d.hue},1) 0%, rgba(${d.hue},0.6) 35%, rgba(${d.hue},0) 70%)`,
            boxShadow: `0 0 ${d.r * 3}px rgba(${d.hue},0.6)`,
          }}
        />
      ))}
    </AbsoluteFill>
  );
};

const SceneView: React.FC<{ scene: SkitScene }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const dur = toF(scene.to - scene.from);
  const [s0, s1] = scene.push ?? [1, 1];
  const pull = scene.focusPull
    ? interpolate(frame, [0, toF(scene.focusPull)], [16, 0], { ...clamp, easing: Easing.bezier(0.16, 1, 0.3, 1) })
    : 0;
  return (
    <AbsoluteFill style={{ backgroundColor: scene.color ?? "#000", overflow: "hidden" }}>
      {scene.src ? (
        <Interactive.Div
          name={scene.name}
          style={{
            position: "absolute",
            inset: 0,
            scale: interpolate(frame, [0, dur], [s0, s1], { ...clamp, easing: Easing.bezier(0.45, 0, 0.55, 1) }),
            transformOrigin: scene.origin ?? "50% 50%",
            filter: `${gradeFilter(scene.grade)} blur(${(scene.blur ?? 0) + pull}px)`,
          }}
        >
          <Video
            src={staticFile(scene.src)}
            muted
            trimBefore={Math.round((scene.startFromSec ?? 0) * FPS)}
            objectFit="cover"
            style={{ width: "100%", height: "100%" }}
          />
        </Interactive.Div>
      ) : null}
      {scene.grade === "night" ? (
        <AbsoluteFill style={{ backgroundColor: "#3d3fb8", mixBlendMode: "multiply", opacity: 0.55 }} />
      ) : null}
      {scene.stars ? <Stars /> : null}
      {scene.grade === "night" || scene.grade === "dim" ? (
        <AbsoluteFill style={{ background: "radial-gradient(ellipse at 50% 40%, rgba(0,0,0,0) 45%, rgba(0,0,0,0.55) 100%)" }} />
      ) : null}
    </AbsoluteFill>
  );
};

// Native caption: white fill, black outline, no box, no entrance animation.
const Caption: React.FC<{ c: SkitCaption; accent: string }> = ({ c, accent }) => {
  const keys = new Set((c.accent ?? []).map((w) => w.toLowerCase()));
  const lines = c.text.split("\n");
  return (
    <Interactive.Div
      name={`Caption: ${c.text.slice(0, 24)}`}
      style={{
        position: "absolute",
        left: SAFE.left,
        width: SAFE.right - SAFE.left,
        top: CAPTION_TOP[c.pos ?? "top"],
        textAlign: "center",
        fontFamily,
        fontWeight: 800,
        fontSize: c.size ?? 64,
        lineHeight: 1.12,
        letterSpacing: -0.5,
        color: "#fff",
        WebkitTextStroke: "10px #000",
        paintOrder: "stroke fill",
        textShadow: "0 3px 14px rgba(0,0,0,0.45)",
      }}
    >
      {lines.map((ln, i) => (
        <div key={i}>
          {ln.split(" ").map((w, j) => (
            <span key={j} style={{ color: keys.has(w.toLowerCase()) ? accent : "#fff" }}>
              {w}
              {" "}
            </span>
          ))}
        </div>
      ))}
    </Interactive.Div>
  );
};

// End card inside the safe band: product photo, name, descriptor, CTA, handle.
const SafeEndCard: React.FC<{ product: ProductAd; headline: string; accent: string }> = ({ product, headline, accent }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  // staggered pop-in: photo, then name, descriptor, CTA pill, handle
  const pop = (delay: number) => spring({ frame: frame - delay, fps, config: { damping: 13, stiffness: 180 } });
  const item = (delay: number): React.CSSProperties => ({
    opacity: interpolate(frame - delay, [0, 5], [0, 1], clamp),
    scale: String(0.86 + 0.14 * pop(delay)),
  });
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ backgroundColor: "rgba(8,8,14,0.55)" }} />
      <Caption c={{ text: headline, from: 0, to: 99, pos: "top", size: 62 }} accent={accent} />
      <Interactive.Div
        name="End card"
        style={{
          position: "absolute",
          left: SAFE.left,
          width: SAFE.right - SAFE.left,
          top: 560,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          fontFamily,
          color: "#fff",
        }}
      >
        <div
          style={{
            ...item(0),
            width: 380,
            height: 380,
            borderRadius: 32,
            overflow: "hidden",
            backgroundColor: product.endcardBg,
            border: "4px solid rgba(255,255,255,0.92)",
            boxShadow: "0 22px 50px rgba(0,0,0,0.5)",
          }}
        >
          <Img src={staticFile(product.endcard)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>
        <div style={{ ...item(4), marginTop: 34, fontWeight: 800, fontSize: 96, lineHeight: 1, letterSpacing: 2 }}>{product.name}</div>
        <div style={{ ...item(7), marginTop: 12, fontWeight: 500, fontSize: 34, color: "rgba(255,255,255,0.9)" }}>{product.descriptor}</div>
        <div
          style={{
            ...item(10),
            marginTop: 30,
            backgroundColor: "#fff",
            color: "#16120E",
            borderRadius: 999,
            padding: "16px 34px",
            fontWeight: 800,
            fontSize: 38,
            whiteSpace: "nowrap",
          }}
        >
          Shop now • Link in bio
        </div>
        <div style={{ ...item(13), marginTop: 22, fontWeight: 700, fontSize: 40, color: accent }}>@zorevhousing</div>
      </Interactive.Div>
    </AbsoluteFill>
  );
};

export const SkitTimeline: React.FC<{ skit: SkitTimelineConfig }> = ({ skit }) => {
  const N = toF(skit.seconds);
  const end = skit.endCard;
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {skit.scenes.map((s) => (
        <Sequence key={s.name} name={s.name} from={toF(s.from)} durationInFrames={toF(s.to) - toF(s.from)}>
          <SceneView scene={s} />
        </Sequence>
      ))}
      <Sequence name="End card" from={toF(end.from)} durationInFrames={N - toF(end.from)}>
        <SceneView scene={{ name: "End card background", from: end.from, to: skit.seconds, src: end.src, startFromSec: end.startFromSec, grade: "dim" }} />
        <SafeEndCard product={skit.product} headline={end.headline} accent={skit.accent} />
      </Sequence>
      {skit.captions.map((c, i) => (
        <Sequence key={i} name={`Caption ${i + 1}`} from={toF(c.from)} durationInFrames={toF(c.to) - toF(c.from)} layout="none">
          <Caption c={c} accent={skit.accent} />
        </Sequence>
      ))}
      <Interactive.Div
        name="AI label"
        style={{ position: "absolute", left: SAFE.left, top: SAFE.top + 6, fontFamily, fontWeight: 600, fontSize: 24, color: "rgba(255,255,255,0.72)" }}
      >
        AI-generated skit
      </Interactive.Div>
      <Audio
        src={staticFile(skit.music.src)}
        volume={(f) => skit.music.volume * interpolate(f, [0, 8, N - 25, N - 1], [0, 1, 1, 0], clamp)}
      />
      {skit.ambience ? (
        <Audio
          src={staticFile(skit.ambience.src)}
          volume={(f) => skit.ambience!.volume * interpolate(f, [0, 6, N - 25, N - 1], [0, 1, 1, 0], clamp)}
        />
      ) : null}
      {skit.sfx.map((x, i) => (
        <Sequence key={i} name={`SFX ${x.src}`} from={Math.max(0, toF(x.at))} durationInFrames={FPS * 4} layout="none">
          <Audio src={staticFile(x.src)} volume={x.volume} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
