import React from "react";
import {
  AbsoluteFill,
  Img,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Audio, Video } from "@remotion/media";
import { loadFont } from "@remotion/fonts";
import type { CaptionPos, CaptionSeg, ProductAd } from "./products";

// Inter (variable, latin) is bundled in public/fonts so renders need no network.
export const fontFamily = "Inter";
loadFont({ family: fontFamily, url: staticFile("fonts/inter-latin-var.woff2"), weight: "100 900", format: "woff2" });

export const FPS = 30;
export const DURATION_FRAMES = 15 * FPS; // 15.0 s

// Instagram Reels safe area (1080x1920): keep essentials below the top bar,
// above the caption/username block, and left of the action buttons.
export const SAFE_TOP = 190;
// (bottom limit 1600: the end card and captions stay above it)
const SAFE_RIGHT = 940;

export const INK = "rgba(18, 15, 12, 0.80)";
export const WARM = "#FFD9A0";
const MUSIC_VOLUME = 0.16;

const msToFrame = (ms: number) => Math.round((ms / 1000) * FPS);

export const Cover: React.FC<{ src: string; startFromSec: number }> = ({ src, startFromSec }) => (
  <AbsoluteFill style={{ backgroundColor: "#000" }}>
    <Video
      src={staticFile(src)}
      muted
      trimBefore={Math.round(startFromSec * FPS)}
      objectFit="cover"
      style={{ width: "100%", height: "100%" }}
    />
  </AbsoluteFill>
);

// For presenters animated from a still photo (scripts/motion + scripts/lipsync):
// the head already nods, turns and blinks in the take; this adds the slow sway
// of a handheld phone so the camera breathes like a real selfie video.
// Driven by the timeline frame, so it is deterministic.
export const HandheldMotion: React.FC<{ absFrame: number; children: React.ReactNode }> = ({ absFrame, children }) => {
  const t = absFrame / FPS;
  const TAU = Math.PI * 2;
  const rotate = 0.35 * Math.sin((TAU * t) / 5.3) + 0.2 * Math.sin((TAU * t) / 3.1 + 1.1);
  const x = 6 * Math.sin((TAU * t) / 6.1 + 0.4) + 2.5 * Math.sin((TAU * t) / 2.3);
  const y = 5 * Math.sin((TAU * t) / 4.4 + 2.0);
  const scale = 1.04 + 0.008 * Math.sin((TAU * t) / 7.7);
  return (
    <AbsoluteFill
      style={{
        transform: `translate(${x}px, ${y}px) rotate(${rotate}deg) scale(${scale})`,
        transformOrigin: "50% 58%",
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

// The presenter take is one continuous shot whose audio is the voice track, so
// its picture is always taken from the same moment as the timeline: whenever
// her mouth is on screen it matches the narration.
const PresenterAt: React.FC<{ ad: ProductAd; fromFrame: number }> = ({ ad, fromFrame }) => {
  const frame = useCurrentFrame();
  const take = <Cover src={ad.presenter} startFromSec={fromFrame / FPS} />;
  if (!ad.presenterFromStill) return take;
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <HandheldMotion absFrame={fromFrame + frame}>{take}</HandheldMotion>
    </AbsoluteFill>
  );
};

export const Pill: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
  <div
    style={{
      backgroundColor: INK,
      color: "#fff",
      borderRadius: 26,
      padding: "18px 30px",
      fontFamily,
      boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
      ...style,
    }}
  >
    {children}
  </div>
);

const Headline: React.FC<{ lines: [string, string]; durationInFrames: number }> = ({ lines, durationInFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 200 }, durationInFrames: 12 });
  const exit = interpolate(frame, [durationInFrames - 6, durationInFrames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill style={{ alignItems: "center" }}>
      <div style={{ position: "absolute", top: SAFE_TOP + 20, opacity: enter * exit, transform: `translateY(${(1 - enter) * 16}px)` }}>
        <Pill style={{ textAlign: "center", padding: "22px 40px" }}>
          <div style={{ fontWeight: 800, fontSize: 64, lineHeight: 1.08, letterSpacing: -1 }}>{lines[0]}</div>
          <div style={{ fontWeight: 800, fontSize: 64, lineHeight: 1.08, letterSpacing: -1, color: WARM }}>{lines[1]}</div>
        </Pill>
      </div>
    </AbsoluteFill>
  );
};

// Product still beside the presenter, clearly an edited inset card.
const ProductInset: React.FC<{ src: string; bg: string; name: string }> = ({ src, bg, name }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 200 }, durationInFrames: 14 });
  return (
    <div
      style={{
        position: "absolute",
        left: SAFE_RIGHT - 360,
        top: 960,
        width: 360,
        opacity: s,
        transform: `translateY(${(1 - s) * 30}px)`,
      }}
    >
      <div
        style={{
          width: 360,
          height: 360,
          borderRadius: 30,
          overflow: "hidden",
          backgroundColor: bg,
          boxShadow: "0 18px 40px rgba(0,0,0,0.35)",
          border: "4px solid rgba(255,255,255,0.9)",
        }}
      >
        <Img src={staticFile(src)} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
      </div>
      <div style={{ marginTop: 14, display: "flex", justifyContent: "center" }}>
        <Pill style={{ padding: "8px 22px", fontWeight: 800, fontSize: 30, letterSpacing: 3 }}>{name}</Pill>
      </div>
    </div>
  );
};

const CAPTION_Y: Record<CaptionPos, number> = { top: SAFE_TOP + 30, mid: 860, bottom: 1450 };

// Word-timed captions: one short segment at a time, current word in warm tone.
const Captions: React.FC<{ captions: CaptionSeg[]; posAt: (ms: number) => CaptionPos }> = ({ captions, posAt }) => {
  const frame = useCurrentFrame();
  const ms = (frame / FPS) * 1000;
  const seg = captions.find((c, i) => {
    const next = captions[i + 1];
    const until = next ? Math.min(next.startMs, c.endMs + 500) : c.endMs + 700;
    return ms >= c.startMs - 60 && ms < until;
  });
  if (!seg) return null;
  const local = ms - (seg.startMs - 60);
  const opacity = interpolate(local, [0, 120], [0, 1], { extrapolateRight: "clamp" });
  const pos = posAt(seg.startMs);
  // one line, sized to fit: never a single orphaned word on a second line
  const fontSize = Math.max(44, Math.min(56, Math.floor(800 / (seg.text.length * 0.56))));
  return (
    <AbsoluteFill style={{ alignItems: "center" }}>
      <div
        style={{
          position: "absolute",
          top: CAPTION_Y[pos],
          maxWidth: 880,
          opacity,
          transform: `translateY(${(1 - opacity) * 6}px)`,
        }}
      >
        <Pill style={{ textAlign: "center", fontWeight: 700, fontSize, lineHeight: 1.18, padding: "16px 30px", whiteSpace: "nowrap" }}>
          {seg.words.map((w, i) => (
            <span key={i} style={{ color: ms >= w.startMs && ms < w.endMs + 80 ? WARM : "#fff" }}>
              {w.text}
              {i < seg.words.length - 1 ? " " : ""}
            </span>
          ))}
        </Pill>
      </div>
    </AbsoluteFill>
  );
};

// Closing: presenter stays on screen, with a prominent product view, the
// product name, the call to action and the account, all together.
export const EndCard: React.FC<{ ad: ProductAd }> = ({ ad }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const a = spring({ frame, fps, config: { damping: 200 }, durationInFrames: 16 });
  const b = spring({ frame: frame - 6, fps, config: { damping: 200 }, durationInFrames: 16 });
  return (
    <AbsoluteFill>
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(180deg, rgba(10,8,6,0) 48%, rgba(10,8,6,0.55) 62%, rgba(10,8,6,0.86) 78%, rgba(10,8,6,0.9) 100%)",
          opacity: a,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 64,
          top: 1040,
          width: 420,
          height: 420,
          borderRadius: 34,
          overflow: "hidden",
          backgroundColor: ad.endcardBg,
          boxShadow: "0 22px 50px rgba(0,0,0,0.45)",
          border: "4px solid rgba(255,255,255,0.92)",
          opacity: a,
          transform: `translateY(${(1 - a) * 40}px)`,
        }}
      >
        <Img src={staticFile(ad.endcard)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </div>
      <div
        style={{
          position: "absolute",
          left: 516,
          top: 1052,
          width: SAFE_RIGHT - 516,
          fontFamily,
          color: "#fff",
          opacity: b,
          transform: `translateY(${(1 - b) * 30}px)`,
        }}
      >
        <div style={{ fontWeight: 800, fontSize: 96, lineHeight: 1, letterSpacing: 2 }}>{ad.name}</div>
        <div style={{ fontWeight: 500, fontSize: 34, marginTop: 14, color: "rgba(255,255,255,0.9)", lineHeight: 1.2 }}>
          {ad.descriptor}
        </div>
        <div
          style={{
            marginTop: 30,
            display: "inline-block",
            backgroundColor: "#fff",
            color: "#16120E",
            borderRadius: 999,
            padding: "16px 28px",
            fontWeight: 800,
            fontSize: 36,
            whiteSpace: "nowrap",
          }}
        >
          Shop now • Link in bio
        </div>
        <div style={{ marginTop: 26, fontWeight: 700, fontSize: 40, color: WARM }}>@zorevhousing</div>
      </div>
    </AbsoluteFill>
  );
};

export const ZorevAd: React.FC<{ ad: ProductAd }> = ({ ad }) => {
  const t = ad.timing;
  const hookEnd = msToFrame(t.hookEndMs);
  const split = msToFrame(t.splitMs);
  const cta = msToFrame(t.ctaStartMs);

  const posAt = (ms: number): CaptionPos => {
    if (ms < t.hookEndMs) return "bottom";
    if (ms < t.splitMs) return ad.demo.captionPos;
    if (ms < t.ctaStartMs) return ad.detail.captionPos;
    return "top"; // closing: above her head, clear of the end card
  };

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {/* 1. Hook: presenter + product inset + headline */}
      <Sequence durationInFrames={hookEnd} name="Hook (presenter)">
        <PresenterAt ad={ad} fromFrame={0} />
        <ProductInset src={ad.inset} bg={ad.insetBg} name={ad.name} />
        <Headline lines={ad.headline} durationInFrames={hookEnd} />
      </Sequence>

      {/* 2. Main demonstration */}
      <Sequence from={hookEnd} durationInFrames={split - hookEnd} name="Demo">
        <Cover src={ad.demo.src} startFromSec={ad.demo.startFromSec} />
      </Sequence>

      {/* 3. Detail / room context */}
      <Sequence from={split} durationInFrames={cta - split} name="Detail">
        <Cover src={ad.detail.src} startFromSec={ad.detail.startFromSec} />
      </Sequence>

      {/* 4. Presenter returns with the product, CTA and account */}
      <Sequence from={cta} durationInFrames={DURATION_FRAMES - cta} name="Close (presenter + CTA)">
        <PresenterAt ad={ad} fromFrame={cta} />
        <EndCard ad={ad} />
      </Sequence>

      <Captions captions={t.captions} posAt={posAt} />

      <Audio src={staticFile(ad.voice)} />
      <Audio
        src={staticFile("audio/zorev-bed.wav")}
        volume={(f) =>
          MUSIC_VOLUME *
          interpolate(f, [0, 12, DURATION_FRAMES - 36, DURATION_FRAMES - 2], [0, 1, 1, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          })
        }
      />
    </AbsoluteFill>
  );
};
