// Render the explainer video from explainer.html, frame by frame (needs Google Chrome and ffmpeg).
// Usage: node docs/media/explainer/render.mjs              -> docs/media/explainer.{mp4,gif}, explainer-poster.png
//        node docs/media/explainer/render.mjs --at 3,12.5  -> one PNG per time (seconds) in --out, for checking frames
//        node docs/media/explainer/render.mjs --gif        -> only the GIF again, from the existing MP4 and poster
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { chromium } from "playwright-core";

const here = import.meta.dirname,
  media = resolve(here, "..");
const { values } = parseArgs({
  options: { at: { type: "string" }, out: { type: "string" }, gif: { type: "boolean" } },
});
const FPS = 30,
  POSTER_AT = 21;
const mp4 = join(media, "explainer.mp4"),
  poster = join(media, "explainer-poster.png");
const ff = (...a) => execFileSync("ffmpeg", ["-loglevel", "error", "-y", ...a], { stdio: "inherit" });

// The GIF drops to 12 fps and 880 px (GitHub's README column) to stay under ~4 MB. It opens on the
// poster, held 1 s: frame 0 is what a static preview, a first paint or a client that doesn't animate
// shows, and the video's own first frame is an empty page.
function gif() {
  const fit = "fps=12,scale=880:-1:flags=lanczos,setsar=1";
  ff(
    "-loop",
    "1",
    "-t",
    "1",
    "-framerate",
    "12",
    "-i",
    poster,
    "-i",
    mp4,
    "-filter_complex",
    `[0]${fit}[a];[1]${fit}[b];[a][b]concat=n=2:v=1,split[c][d];[c]palettegen=max_colors=128:stats_mode=diff[p];[d][p]paletteuse=dither=none:diff_mode=rectangle`,
    join(media, "explainer.gif"),
  );
}

if (values.gif) {
  gif();
  process.exit(0);
}

const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.addInitScript(() => {
  window.__RENDERING__ = true;
});
await page.goto(pathToFileURL(join(here, "explainer.html")).href);
await page.evaluate(() => document.fonts.ready);
const duration = await page.evaluate(() => DURATION);
const shot = async (t, path) => {
  await page.evaluate((t) => window.render(t), t);
  await page.screenshot({ path });
};

if (values.at) {
  const dir = values.out ?? join(here, "frames");
  mkdirSync(dir, { recursive: true });
  for (const t of values.at.split(",").map(Number)) {
    const path = join(dir, `explainer-${t.toFixed(2)}.png`);
    await shot(t, path);
    console.log(path);
  }
  await browser.close();
  process.exit(0);
}

const frames = join(here, "frames");
rmSync(frames, { recursive: true, force: true });
mkdirSync(frames, { recursive: true });
const n = Math.round(duration * FPS);
for (let i = 0; i < n; i++) await shot(i / FPS, join(frames, `${String(i).padStart(5, "0")}.png`));
await shot(POSTER_AT, poster);
await browser.close();

ff(
  "-framerate",
  String(FPS),
  "-i",
  join(frames, "%05d.png"),
  "-c:v",
  "libx264",
  "-preset",
  "slow",
  "-tune",
  "animation",
  "-crf",
  "24",
  "-pix_fmt",
  "yuv420p",
  "-movflags",
  "+faststart",
  mp4,
);
gif();
rmSync(frames, { recursive: true, force: true });
console.log(JSON.stringify({ frames: n, seconds: n / FPS }));
