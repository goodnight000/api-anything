/**
 * `API_ANYTHING_CDP`: the browser tiers in a Chromium the user started with a DevTools port on this
 * machine, instead of one api-anything launches. A DevTools endpoint is full control of a browser,
 * so only a loopback one is used, and nothing is ever discovered: unset, nothing here runs.
 */
import { lookup } from "node:dns/promises";
import { lstatSync, mkdirSync } from "node:fs";
import { isIP } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { proxyConfig } from "./proxy.js";

/** The attached browser could not be used; nothing was sent through it. `next` says what to do. */
export class AttachError extends Error {
  constructor(
    message: string,
    readonly next: string,
  ) {
    super(message);
    this.name = "AttachError";
  }
}

/** The setting, as written, or undefined when it is not set. */
export const attachSetting = (env: NodeJS.ProcessEnv = process.env): string | undefined =>
  env.API_ANYTHING_CDP?.trim() || undefined;

/** Whether the browser tiers attach to a running browser instead of launching api-anything's own. */
export const attached = (env: NodeJS.ProcessEnv = process.env): boolean => !!attachSetting(env);

const START =
  "start a Chromium browser with --remote-debugging-port=9222 and --user-data-dir set to a directory of its own, then set API_ANYTHING_CDP=http://127.0.0.1:9222; or unset API_ANYTHING_CDP";

/** What an own-profile action answers while attached: api-anything's profile is not the browser in use. */
export const ownProfileRefused = (what: string) =>
  new AttachError(
    `${what} uses api-anything's own browser profile, which is not opened while API_ANYTHING_CDP is set`,
    "unset API_ANYTHING_CDP to use api-anything's own browser profile",
  );

/**
 * What a hint that sends the user to the sign-in window adds while attached: the window is a tab of
 * api-anything's own context in the browser they run, not a window of api-anything's own browser.
 */
export const windowWhere = (env: NodeJS.ProcessEnv = process.env): string =>
  attached(env) ? " (a new window of the browser the user runs, API_ANYTHING_CDP)" : "";

/**
 * How to learn a page once the window got the user past its wall (`again`: the same learning again).
 * Attached, `capture`'s and `learn_site`'s runs (`what`) start with none of the site's stored cookies,
 * so they would meet the wall again; `add`'s runs for the user's own site carry what the window kept.
 */
export const learnAgain = (again: string, what: string, site = "<site>", op = "<op>"): string =>
  attached()
    ? `learn it with api-anything add ${site} ${op} --trigger <url> --example k=v instead: its runs in the attached browser carry what the window kept, and ${what}'s start with none of it`
    : again;

const loopback = (ip: string) => (isIP(ip) === 4 ? ip.startsWith("127.") : ip === "::1" || /^::ffff:127\./i.test(ip));

/**
 * The directory of this OS user's attach locks: one of its own in the temp directory, 0700. The temp
 * directory is shared on Linux, so a lock there that another user made would be one this process may
 * not open (seen: "unable to open database file" on every attached call), and one this user made would
 * lock the other out. Throws AttachError when what is there is not a directory of this user's alone.
 * Windows has no uid, and its temp directory is the user's own.
 */
function lockDir(): string {
  const uid = process.getuid?.();
  if (uid === undefined) return tmpdir();
  const dir = join(tmpdir(), `api-anything-${uid}`);
  const refused = (why: string) =>
    new AttachError(
      `${dir}, where api-anything keeps the lock that lets one of its processes at a time use an attached browser, is not a directory of this user's alone: ${why}`,
      `remove ${dir}, or set TMPDIR to a directory of your own, then retry`,
    );
  try {
    mkdirSync(dir, { mode: 0o700 });
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw refused((e as Error).message);
  }
  const s = lstatSync(dir);
  if (!s.isDirectory()) throw refused("it is not a directory");
  if (s.uid !== uid) throw refused(`another user (uid ${s.uid}) owns it`);
  if (s.mode & 0o077) throw refused(`other users may use it (mode ${(s.mode & 0o777).toString(8)})`);
  return dir;
}

/**
 * The lock one api-anything process holds while it is attached to the browser at `host` (host:port).
 * Per OS user, not under a home: two processes driving one browser see each other's tabs as the
 * browser's own and answer their dialogs, whichever home each runs from. Throws AttachError (above).
 */
export const attachLock = (host: string) => join(lockDir(), `api-anything-cdp-${host.replace(/[^\w.-]/g, "_")}`);

/** What a lock that could not be opened or held is (`claim` threw): a refusal with nothing sent. */
export const lockRefused = (host: string, file: string, e: unknown) =>
  new AttachError(
    `the lock that lets one api-anything process at a time use the browser at ${host} (API_ANYTHING_CDP) could not be opened: ${file}: ${(e as Error).message.split("\n")[0]}`,
    `check that ${file} is this user's own file and can be written (remove it if it is not, while no api-anything process uses that browser), then retry`,
  );

/** How long attaching may take: the endpoint's answer, then the connection. */
export const ATTACH_MS = 5000;

/**
 * The browser's DevTools WebSocket address, every check passed; throws AttachError having connected to
 * nothing but this machine's loopback. The host is resolved once and the address it resolved to is
 * the one connected to, as is the one the browser names for its socket, so no later answer of DNS or
 * of the endpoint can lead elsewhere.
 */
export async function attachEndpoint(env: NodeJS.ProcessEnv = process.env): Promise<string> {
  const raw = attachSetting(env);
  if (!raw) throw new AttachError("API_ANYTHING_CDP is not set", START);
  if (proxyConfig(env))
    throw new AttachError(
      "API_ANYTHING_CDP and API_ANYTHING_PROXY are both set: an attached browser's traffic does not go through the proxy, and the proxy's cleartext protection cannot be held in it",
      "unset one of API_ANYTHING_CDP and API_ANYTHING_PROXY",
    );
  let url: URL | undefined;
  try {
    url = new URL(raw);
  } catch {
    /* refused below */
  }
  if (!url || (url.protocol !== "http:" && url.protocol !== "ws:"))
    throw new AttachError(
      "API_ANYTHING_CDP is not a DevTools address: set it to http://127.0.0.1:<port> (or the browser's ws:// address)",
      START,
    );
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const addresses = isIP(host)
    ? [host]
    : await lookup(host, { all: true }).then(
        (r) => r.map((a) => a.address),
        () => [],
      );
  if (!addresses.length || !addresses.every(loopback))
    throw new AttachError(
      `API_ANYTHING_CDP must be this machine's loopback address (127.0.0.1, [::1] or localhost), not ${url.host}: a DevTools endpoint is full control of a browser`,
      START,
    );
  // a browser listens on one of them (Chrome on 127.0.0.1, which "localhost" may list after ::1)
  const port = url.port || "80";
  let at = "";
  let socket: unknown;
  let cause = "";
  for (const ip of addresses) {
    at = `${isIP(ip) === 6 ? `[${ip}]` : ip}:${port}`;
    try {
      const res = await fetch(`http://${at}/json/version`, {
        signal: AbortSignal.timeout(ATTACH_MS),
        redirect: "error",
      });
      socket = ((await res.json()) as { webSocketDebuggerUrl?: unknown }).webSocketDebuggerUrl;
      cause = "";
      break;
    } catch (e) {
      cause = (e as { cause?: { code?: string } }).cause?.code ?? (e as Error).name;
    }
  }
  if (cause) throw new AttachError(`nothing answers as a browser at ${url.host} (API_ANYTHING_CDP): ${cause}`, START);
  if (url.protocol === "ws:") return `ws://${at}${url.pathname}`;
  let ws: URL | undefined;
  try {
    ws = typeof socket === "string" ? new URL(socket) : undefined;
  } catch {
    /* refused below */
  }
  if (ws?.protocol !== "ws:")
    throw new AttachError(`${at} (API_ANYTHING_CDP) answers, but not as a Chromium DevTools endpoint`, START);
  return `ws://${at}${ws.pathname}`;
}
