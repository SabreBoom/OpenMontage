// Word-level captions on CPU with Remotion's official whisper.cpp package.
//   node scripts/transcribe-local.mjs <input audio/video> <out captions.json>
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { toCaptions, transcribe } from "@remotion/install-whisper-cpp";

const [input, out] = process.argv.slice(2);
const whisperPath = path.join(process.cwd(), ".tools", "whisper.cpp");
const wav = path.join(mkdtempSync(path.join(os.tmpdir(), "zv-")), "in16k.wav");
execFileSync("ffmpeg", ["-v", "error", "-y", "-i", input, "-ar", "16000", "-ac", "1", wav]);
const whisperCppOutput = await transcribe({
  inputPath: wav, whisperPath, whisperCppVersion: "1.7.5", model: "base.en",
  tokenLevelTimestamps: true, splitOnWord: true, printOutput: false,
});
const { captions } = toCaptions({ whisperCppOutput });
writeFileSync(out, JSON.stringify(captions, null, 2));
console.log(captions.map((c) => c.text).join("").trim());
