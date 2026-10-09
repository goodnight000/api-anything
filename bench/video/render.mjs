// Render the race video from timeline.json and the recorded browser footage.
// Usage: node bench/video/render.mjs <raw-runN>   (needs ffmpeg and Google Chrome)
// Copies that run's trimmed timeline to bench/video/timeline.json and writes
// docs/media/agent-race.mp4 and agent-race.gif.
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright-core";

const here = import.meta.dirname,
  repo = resolve(here, "../..");
const out = join(repo, "docs/media"),
  frames = join(here, "frames");
const run = join(here, process.argv[2] ?? "raw");
copyFileSync(join(run, "timeline.json"), join(here, "timeline.json"));
const T = JSON.parse(readFileSync(join(here, "timeline.json"), "utf8"));
// SPEED: recorded seconds per video second. The on-screen timers always show recorded time.
const FPS = 15,
  SPEED = 3,
  HOLD_MS = 5000 * SPEED;
// Playwright creates the page, and starts recording, when the agent's first browser tool call runs.
const footageOffsetMs = T.browser.calls[0].t;
const day = T.recordedAt.slice(0, 10);
const timeline = {
  ...T,
  footageOffsetMs,
  footageSrc: pathToFileURL(join(run, "footage", T.footage[0])).href,
  credit:
    `Recorded ${day} · Claude Opus 5.5 in Claude Code · shown at ${SPEED}× speed, no cuts · browser footage by Playwright · ` +
    `of 3 recorded races, the one whose browser time was closest to the benchmark median`,
};
const endMs = Math.max(T.browser.end.t, T.api.end.t) + HOLD_MS;

rmSync(frames, { recursive: true, force: true });
mkdirSync(frames, { recursive: true });
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: ["--autoplay-policy=no-user-gesture-required"],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(pathToFileURL(join(here, "race.html")).href);
await page.evaluate(async (tl) => {
  window.TIMELINE = tl;
  await document.fonts.ready;
}, timeline);
await page.evaluate(() => document.fonts.ready);
let n = 0;
for (let t = 0; t <= endMs; t += (1000 / FPS) * SPEED) {
  await page.evaluate((t) => window.render(t), t);
  await page.screenshot({ path: join(frames, `${String(n++).padStart(5, "0")}.png`) });
}
await browser.close();

const ff = (...a) => execFileSync("ffmpeg", ["-loglevel", "error", "-y", ...a], { stdio: "inherit" });
ff(
  "-framerate",
  String(FPS),
  "-i",
  join(frames, "%05d.png"),
  "-c:v",
  "libx264",
  "-pix_fmt",
  "yuv420p",
  "-crf",
  "20",
  "-movflags",
  "+faststart",
  join(out, "agent-race.mp4"),
);
ff(
  "-i",
  join(out, "agent-race.mp4"),
  "-vf",
  "fps=10,scale=1024:-1:flags=lanczos,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle",
  join(out, "agent-race.gif"),
);
console.log(JSON.stringify({ frames: n, videoSeconds: n / FPS }));
