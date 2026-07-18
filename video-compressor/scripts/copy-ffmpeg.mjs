import { copyFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const coreEntry = fileURLToPath(import.meta.resolve("@ffmpeg/core"));
const coreDirectory = dirname(coreEntry);
const outputDirectory = join(projectRoot, "public", "ffmpeg");

await mkdir(outputDirectory, { recursive: true });
await Promise.all(
  ["ffmpeg-core.js", "ffmpeg-core.wasm"].map((fileName) =>
    copyFile(join(coreDirectory, fileName), join(outputDirectory, fileName)),
  ),
);
