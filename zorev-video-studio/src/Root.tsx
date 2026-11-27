import { Composition } from "remotion";
import { MyComposition } from "./Composition";
import { DURATION_FRAMES, FPS, ZorevAd } from "./zorev/ZorevAd";
import { PRODUCTS } from "./zorev/products";
import { SKITS } from "./zorev/skits";
import { ZorevSkit } from "./zorev/ZorevSkit";
import { SKIT_TIMELINES } from "./zorev/skitTimelines";
import { SkitTimeline } from "./zorev/SkitTimeline";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <MyComposition />
      {PRODUCTS.map((ad) => (
        <Composition
          key={ad.id}
          id={ad.id}
          component={ZorevAd}
          durationInFrames={DURATION_FRAMES}
          fps={FPS}
          width={1080}
          height={1920}
          defaultProps={{ ad }}
        />
      ))}
      {SKITS.map((skit) => (
        <Composition
          key={skit.id}
          id={skit.id}
          component={ZorevSkit}
          durationInFrames={Math.round(skit.data.seconds * FPS)}
          fps={FPS}
          width={1080}
          height={1920}
          defaultProps={{ skit }}
        />
      ))}
      {SKIT_TIMELINES.map((skit) => (
        <Composition
          key={skit.id}
          id={skit.id}
          component={SkitTimeline}
          durationInFrames={Math.round(skit.seconds * FPS)}
          fps={FPS}
          width={1080}
          height={1920}
          defaultProps={{ skit }}
        />
      ))}
    </>
  );
};
