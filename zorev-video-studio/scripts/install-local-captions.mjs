// Free, CPU-only captions: installs whisper.cpp and an English model with
// Remotion's official @remotion/install-whisper-cpp. Used when there is no GPU
// for @remotion/whisper-webgpu and no ElevenLabs key for Scribe.
//   node scripts/install-local-captions.mjs
import path from "node:path";
import { downloadWhisperModel, installWhisperCpp } from "@remotion/install-whisper-cpp";

const to = path.join(process.cwd(), ".tools", "whisper.cpp");
await installWhisperCpp({ to, version: "1.7.5", printOutput: false });
await downloadWhisperModel({ model: "base.en", folder: to, printOutput: false });
console.log("whisper.cpp ready in", to);
