import { Composition } from "remotion";
import { MyComposition } from "./Composition";
import { DURATION_FRAMES, FPS, ZorevAd } from "./zorev/ZorevAd";
import { PRODUCTS } from "./zorev/products";

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
    </>
  );
};
