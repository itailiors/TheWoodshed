// Review frames: node videos/scripts/frames.mjs <clip-name> [count] → videos/shots/<clip>-<i>.png, evenly spaced.
import { execFileSync } from "node:child_process";

const [name, count = "6"] = process.argv.slice(2);
const src = `videos/clips/${name}.mp4`;
const dur = Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", src]).toString());
const n = Number(count);
// one contact sheet, 3 across, a frame every dur/n seconds
const every = dur / n;
execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-i", src, "-vf", `fps=1/${every.toFixed(3)},scale=720:-1,tile=3x${Math.ceil(n / 3)}:padding=6`, "-frames:v", "1", `videos/shots/${name}-sheet.png`]);
console.log(`${name}: ${dur.toFixed(1)}s, contact sheet of ${n}`);
