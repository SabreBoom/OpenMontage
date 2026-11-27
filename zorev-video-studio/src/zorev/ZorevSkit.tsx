// Skit-style 15 s ads: a roommate's double take, the product reveal, then the
// presenter's pitch and the usual end card. Timings come from
// public/skit/<name>/skit.json (scripts/skit/prepare-skit.py), the on-camera
// takes from scripts/skit/make-takes.sh. Sound effects and music are original
// (scripts/skit/make-sfx.py).
import React from "react";
import { AbsoluteFill, Sequence, interpolate, random, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Audio } from "@remotion/media";
import type { ProductAd } from "./products";
import { Cover, EndCard, FPS, HandheldMotion, SAFE_TOP, fontFamily } from "./ZorevAd";

type Word = { text: string; startMs: number; endMs: number };
type Line = { who: string; text: string; startMs: number; endMs: number; words: Word[] };
export type SkitData = { seconds: number; lines: Line[]; takes: Record<string, { startSec: number; endSec: number }> };

export type SkitConfig = {
  id: string;
  dir: string; // folder in public/ with voice.wav, skit.json and takes/
  data: SkitData;
  product: ProductAd; // for the end card
  hook: string; // on-screen setup line while the roommate reacts
  punchWord: string; // crash zoom + boom on this word
  reveal: { src: string; startFromSec: number }; // product shot under the deadpan line
  broll: { src: string; startFromSec: number; fromWord: string; toWord: string }; // cutaway inside the pitch
  keywords: string[]; // words shown big in the accent colour
};

const ACCENT = "#7FF3FF";
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const toF = (ms: number) => Math.round((ms / 1000) * FPS);
const wordAt = (line: Line, w: string) => line.words.find((x) => norm(x.text) === norm(w)) ?? line.words[0];

const Sfx: React.FC<{ at: number; src: string; volume?: number }> = ({ at, src, volume = 1 }) => (
  <Sequence from={Math.max(0, at)} durationInFrames={FPS * 2} layout="none">
    <Audio src={staticFile(src)} volume={volume} />
  </Sequence>
);

// Roommate cam: slow push, then a crash zoom + shake + flash on the punch word.
const ReactionCam: React.FC<{ src: string; punchFrame: number }> = ({ src, punchFrame }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const hit = frame >= punchFrame;
  const zoomIn = spring({ frame: frame - punchFrame, fps, config: { damping: 16, stiffness: 320 } });
  const scale = 1.14 + 0.03 * (frame / Math.max(punchFrame, 1)) + (hit ? 0.34 * zoomIn : 0);
  const shake = hit ? interpolate(frame - punchFrame, [0, 3, 24], [16, 9, 2.5], clamp) : 0;
  const sx = (random(`sx${frame}`) - 0.5) * 2 * shake;
  const sy = (random(`sy${frame}`) - 0.5) * 2 * shake;
  const rot = (random(`r${frame}`) - 0.5) * 0.12 * shake;
  const flash = hit ? interpolate(frame - punchFrame, [0, 4], [0.45, 0], clamp) : 0;
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <AbsoluteFill
        style={{ transform: `translate(${sx}px, ${sy}px) rotate(${rot}deg) scale(${scale})`, transformOrigin: "47% 36%" }}
      >
        <Cover src={src} startFromSec={0} />
      </AbsoluteFill>
      <AbsoluteFill style={{ backgroundColor: "#fff", opacity: flash }} />
    </AbsoluteFill>
  );
};

// Product reveal: whips in from the right, then a slow push-in.
const RevealShot: React.FC<{ src: string; startFromSec: number; frames: number }> = ({ src, startFromSec, frames }) => {
  const frame = useCurrentFrame();
  const whip = interpolate(frame, [0, 7], [1, 0], clamp);
  const push = 1.06 + 0.06 * (frame / Math.max(frames, 1));
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <AbsoluteFill style={{ transform: `translateX(${whip * 320}px) scale(${push})`, filter: `blur(${whip * 12}px)` }}>
        <Cover src={src} startFromSec={startFromSec} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const HookText: React.FC<{ text: string }> = ({ text }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 200 }, durationInFrames: 10 });
  return (
    <AbsoluteFill style={{ alignItems: "center" }}>
      <div
        style={{
          position: "absolute",
          top: SAFE_TOP + 24,
          opacity: s,
          transform: `translateY(${(1 - s) * 14}px)`,
          backgroundColor: "#fff",
          color: "#111",
          fontFamily,
          fontWeight: 800,
          fontSize: 50,
          padding: "16px 30px",
          borderRadius: 18,
          boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
        }}
      >
        {text}
      </div>
    </AbsoluteFill>
  );
};

// Bold pop captions: short chunks, the current word lit, keywords in accent caps.
type Chunk = { words: Word[]; startMs: number; endMs: number };
const chunkLines = (lines: Line[]): Chunk[] => {
  const out: Chunk[] = [];
  for (const line of lines) {
    let cur: Word[] = [];
    line.words.forEach((w, i) => {
      cur.push(w);
      const last = i === line.words.length - 1;
      if (last || /[.,?!]$/.test(w.text) || cur.length === 4) {
        out.push({ words: cur, startMs: cur[0].startMs, endMs: cur[cur.length - 1].endMs });
        cur = [];
      }
    });
  }
  return out;
};

const PopCaptions: React.FC<{ chunks: Chunk[]; keywords: string[]; topFromMs: number; cutsMs: number[] }> = ({
  chunks,
  keywords,
  topFromMs,
  cutsMs,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const ms = (frame / FPS) * 1000;
  const idx = chunks.findIndex((c, i) => {
    const next = chunks[i + 1];
    const nextCut = cutsMs.find((x) => x >= c.endMs) ?? Infinity; // never carry a caption across a cut
    const until = Math.min(next ? next.startMs : Infinity, c.endMs + (next ? 450 : 600), nextCut);
    return ms >= c.startMs - 50 && ms < until;
  });
  if (idx < 0) return null;
  const c = chunks[idx];
  const pop = spring({ frame: frame - toF(c.startMs - 50), fps, config: { damping: 12, stiffness: 260 } });
  const top = ms >= topFromMs ? SAFE_TOP + 40 : 1250;
  const keys = new Set(keywords.map(norm));
  return (
    <AbsoluteFill style={{ alignItems: "center" }}>
      <div
        style={{
          position: "absolute",
          top,
          maxWidth: 900,
          textAlign: "center",
          fontFamily,
          fontWeight: 900,
          fontSize: 76,
          lineHeight: 1.08,
          letterSpacing: -1,
          transform: `scale(${0.82 + 0.18 * pop})`,
          WebkitTextStroke: "12px #000",
          paintOrder: "stroke fill",
          textShadow: "0 6px 18px rgba(0,0,0,0.45)",
        }}
      >
        {c.words.map((w, i) => {
          const key = keys.has(norm(w.text));
          const lit = ms >= w.startMs && ms < w.endMs + 90;
          return (
            <span key={i} style={{ color: key ? ACCENT : lit ? "#FFE36E" : "#fff" }}>
              {key ? w.text.toUpperCase() : w.text}
              {i < c.words.length - 1 ? " " : ""}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

export const ZorevSkit: React.FC<{ skit: SkitConfig }> = ({ skit }) => {
  const { data, dir } = skit;
  const [react, deadpan, pitch, cta] = data.lines;
  const N = Math.round(data.seconds * FPS);
  const punch = toF(wordAt(react, skit.punchWord).startMs - 40);
  const cutA = toF(react.endMs + 120);
  const cutB = toF(pitch.startMs - 120);
  const brollIn = toF(wordAt(pitch, skit.broll.fromWord).startMs - 60);
  const brollOut = toF(wordAt(pitch, skit.broll.toWord).startMs - 60);
  const endCardAt = toF(cta.startMs - 200);
  const ownerTake = data.takes[pitch.who];
  const chunks = chunkLines(data.lines);

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {/* 1. the double take */}
      <Sequence durationInFrames={cutA} name="Roommate double take">
        <ReactionCam src={`${dir}/takes/${react.who}/presenter.mp4`} punchFrame={punch} />
        <HookText text={skit.hook} />
      </Sequence>

      {/* 2. "It's a lamp." */}
      <Sequence from={cutA} durationInFrames={cutB - cutA} name="Product reveal">
        <RevealShot src={skit.reveal.src} startFromSec={skit.reveal.startFromSec} frames={cutB - cutA} />
      </Sequence>

      {/* 3. the pitch, with a cutaway to the lamp, then the end card */}
      <Sequence from={cutB} durationInFrames={N - cutB} name="Presenter pitch">
        <OwnerCam src={`${dir}/takes/${pitch.who}/presenter.mp4`} fromSec={cutB / FPS - ownerTake.startSec} absFrom={cutB} />
      </Sequence>
      <Sequence from={brollIn} durationInFrames={brollOut - brollIn} name="Cutaway">
        <RevealShot src={skit.broll.src} startFromSec={skit.broll.startFromSec} frames={brollOut - brollIn} />
      </Sequence>
      <Sequence from={endCardAt} durationInFrames={N - endCardAt} name="End card">
        <EndCard ad={skit.product} />
      </Sequence>

      <PopCaptions
        chunks={chunks}
        keywords={skit.keywords}
        topFromMs={cta.startMs - 200}
        cutsMs={[cutA, cutB, brollIn, brollOut, endCardAt].map((f) => (f / FPS) * 1000)}
      />

      <Audio src={staticFile(`${dir}/voice.wav`)} />
      <Audio
        src={staticFile("audio/zorev-fun-bed.wav")}
        volume={(f) => {
          const t = f / FPS;
          const talking = t > react.startMs / 1000 - 0.1 && t < cta.endMs / 1000 + 0.1;
          return (talking ? 0.1 : 0.2) * interpolate(f, [0, 6, N - 30, N - 2], [0, 1, 1, 0], clamp);
        }}
      />
      <Sfx at={punch - 1} src="skit/sfx_boom.wav" volume={0.85} />
      <Sfx at={cutA - 7} src="skit/sfx_whoosh.wav" volume={0.7} />
      <Sfx at={toF(deadpan.startMs) - 2} src="skit/sfx_pop.wav" volume={0.5} />
      <Sfx at={brollIn - 6} src="skit/sfx_whoosh.wav" volume={0.45} />
      <Sfx at={endCardAt} src="skit/sfx_pop.wav" volume={0.55} />
    </AbsoluteFill>
  );
};

const OwnerCam: React.FC<{ src: string; fromSec: number; absFrom: number }> = ({ src, fromSec, absFrom }) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <HandheldMotion absFrame={absFrom + frame}>
        <Cover src={src} startFromSec={fromSec} />
      </HandheldMotion>
    </AbsoluteFill>
  );
};
