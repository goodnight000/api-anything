/**
 * A Chromium with a DevTools port and a temporary profile of its own, started by a test to stand in for
 * the browser a user runs (API_ANYTHING_CDP), and what the user sees of it: its tabs and its cookies.
 */
import type { ChildProcess } from "node:child_process";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer as createNet } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright-core";

export async function freePort(): Promise<number> {
  const s = createNet();
  await new Promise<void>((r) => s.listen(0, "127.0.0.1", r));
  const { port } = s.address() as { port: number };
  await new Promise((r) => s.close(r));
  return port;
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** A Chromium with a DevTools port, its own profile and one tab open at `url`: the user's browser. */
export interface UserBrowser {
  proc: ChildProcess;
  port: number;
  dir: string;
}
export async function startUserBrowser(bin: string, port: number, url: string): Promise<UserBrowser> {
  const dir = mkdtempSync(join(tmpdir(), "api-anything-attach-user-"));
  const proc = spawn(
    bin,
    [
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${dir}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--no-sandbox",
      // a user can allow a site's pop-ups: the guards on the tabs a run opens are proven with them allowed
      "--disable-popup-blocking",
      ...(process.env.DISPLAY ? [] : ["--headless=new"]),
      url,
    ],
    // a process group of its own, so stopping it stops its helper processes too
    { stdio: "ignore", detached: true },
  );
  for (const end = Date.now() + 20_000; Date.now() < end; ) {
    if (proc.exitCode !== null) throw new Error(`the browser exited with ${proc.exitCode}`);
    try {
      if ((await fetch(`http://127.0.0.1:${port}/json/version`)).ok && (await userTabs(port)).length)
        return { proc, port, dir };
    } catch {
      /* not up yet */
    }
    await sleep(100);
  }
  kill(proc);
  throw new Error("the browser did not open its DevTools port");
}
/** The browser and every helper process it started (a killed browser's orphaned helpers keep writing to its profile). */
function kill(proc: ChildProcess): void {
  try {
    process.kill(-proc.pid!, "SIGKILL");
  } catch {
    proc.kill("SIGKILL");
  }
}

export async function stopUserBrowser(b: UserBrowser | undefined): Promise<void> {
  if (!b) return;
  if (b.proc.exitCode === null && b.proc.signalCode === null) {
    const exited = new Promise((r) => b.proc.once("exit", r));
    kill(b.proc);
    await exited;
  }
  // Its helpers may still be writing for a moment after they went (seen under a full suite's load:
  // ENOTEMPTY). A temporary profile left behind fails nothing.
  try {
    rmSync(b.dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  } catch {
    /* left in the temp directory */
  }
}

/** The browser's open tabs, as its own DevTools endpoint lists them. */
export async function userTabs(port: number): Promise<{ id: string; url: string }[]> {
  const list = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()) as {
    id: string;
    url: string;
    type: string;
  }[];
  return list.filter((t) => t.type === "page").map(({ id, url }) => ({ id, url }));
}

/** The user's own cookies, read as the user would, from a connection of the test's. */
export async function userCookies(port: number): Promise<string[]> {
  const b = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
  try {
    return (await b.contexts()[0]!.cookies()).map((c) => `${c.name}=${c.value}`);
  } finally {
    await b.close();
  }
}

/** The user signs in to `url` in their own browser: `cookie` ("name=value") in its default context. */
export async function userSignIn(port: number, url: string, cookie: string): Promise<void> {
  const b = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
  const [name, value] = cookie.split("=");
  await b.contexts()[0]!.addCookies([{ name: name!, value: value!, url }]);
  await b.close();
}
