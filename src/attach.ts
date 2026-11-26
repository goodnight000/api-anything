/**
 * `API_ANYTHING_CDP`: the browser tiers in a Chromium the user started with a DevTools port on this
 * machine, instead of one api-anything launches. A DevTools endpoint is full control of a browser,
 * so only a loopback one is used, and nothing is ever discovered: unset, nothing here runs.
 */
import { lookup } from "node:dns/promises";
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

const loopback = (ip: string) => (isIP(ip) === 4 ? ip.startsWith("127.") : ip === "::1" || /^::ffff:127\./i.test(ip));

/**
 * The lock one api-anything process holds while it is attached to the browser at `host` (host:port).
 * Machine-wide, not under a home: two processes driving one browser see each other's tabs as the
 * browser's own and answer their dialogs, whichever home each runs from.
 */
export const attachLock = (host: string) => join(tmpdir(), `api-anything-cdp-${host.replace(/[^\w.-]/g, "_")}`);

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
