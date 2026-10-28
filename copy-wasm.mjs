import { cp, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";

const source = "node_modules/@mediapipe/tasks-vision/wasm";
const destination = "public/wasm";
if (!existsSync(source)) {
  console.error("MediaPipe WASM folder was not found. Run npm install again.");
  process.exit(1);
}
await mkdir("public", { recursive: true });
await cp(source, destination, { recursive: true });
console.log("Copied MediaPipe WASM files into public/wasm.");
