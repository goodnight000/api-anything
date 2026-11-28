/**
 * Site traffic through an outbound proxy: `API_ANYTHING_PROXY` (an http or https URL, credentials
 * allowed in it) and `API_ANYTHING_NO_PROXY`. The standard HTTPS_PROXY/HTTP_PROXY/NO_PROXY are
 * ignored, and catalog traffic (registry.ts, report.ts) never comes here: someone who sets
 * HTTPS_PROXY expects everything to use it, and this routes only what is sent to a site.
 *
 * One config feeds tier 1 and the guest probe (`siteFetch`, undici's own fetch with a ProxyAgent,
 * loaded only when a proxy is set) and the browser (`browserProxy`, Playwright's `proxy` option), so
 * the two never disagree about which host goes through it.
 */
import { BlockList, isIP } from "node:net";
import type { LaunchOptions } from "playwright-core";

export interface ProxyConfig {
  url: URL;
  /** API_ANYTHING_NO_PROXY's entries, lower-cased; `<-loopback>` included as written */
  noProxy: string[];
}

/** The proxy's address as it may be shown: host and port, never its credentials. */
export const shownProxy = (cfg: ProxyConfig) => cfg.url.host;

/** The configured proxy, or undefined. An unusable value throws, naming neither its credentials nor its text. */
export function proxyConfig(env: NodeJS.ProcessEnv = process.env): ProxyConfig | undefined {
  const raw = env.API_ANYTHING_PROXY?.trim();
  if (!raw) return undefined;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("API_ANYTHING_PROXY is not a URL: set it to http://host:port (credentials may go in the URL)");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:")
    throw new Error(`API_ANYTHING_PROXY must be an http:// or https:// proxy, not ${url.protocol}//${url.host}`);
  try {
    decodeURIComponent(url.username);
    decodeURIComponent(url.password);
  } catch {
    throw new Error(`API_ANYTHING_PROXY's credentials for ${url.host} are not validly percent-encoded`);
  }
  const noProxy = (env.API_ANYTHING_NO_PROXY ?? "")
    .split(/[\s,]+/)
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  for (const e of noProxy) {
    if (e === LOOPBACK || e === "*") continue;
    if (e.includes("/") && !parseCidr(e))
      throw new Error(
        `API_ANYTHING_NO_PROXY entry ${e} is not supported: use host names, wildcard host patterns, CIDR ranges, host:port, IP addresses, or *`,
      );
  }
  return { url, noProxy };
}

const LOOPBACK = "<-loopback>";

const stripBrackets = (host: string) => (host.startsWith("[") && host.endsWith("]") ? host.slice(1, -1) : host);

function parseCidr(entry: string): { net: string; prefix: number; family: "ipv4" | "ipv6" } | undefined {
  const slash = entry.indexOf("/");
  if (slash <= 0 || entry.indexOf("/", slash + 1) !== -1) return undefined;
  const net = stripBrackets(entry.slice(0, slash));
  const rawPrefix = entry.slice(slash + 1);
  if (!/^\d+$/.test(rawPrefix)) return undefined;
  const kind = isIP(net);
  if (!kind) return undefined;
  const prefix = Number(rawPrefix);
  const maxPrefix = kind === 4 ? 32 : 128;
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > maxPrefix) return undefined;
  return { net, prefix, family: kind === 4 ? "ipv4" : "ipv6" };
}

/** Chrome's own default, kept for tier 1 too: a proxy cannot reach this machine's loopback. */
function loopback(host: string): boolean {
  return host === "localhost" || host.endsWith(".localhost") || /^127\.\d+\.\d+\.\d+$/.test(host) || host === "[::1]";
}

/** Split optional `:port` from a non-CIDR host pattern (preserving bare or bracketed IPv6). */
function splitHostPort(e: string): { host: string; port?: string } {
  const v6 = /^(\[[^\]]+\])(?::(\d+))?$/.exec(e);
  if (v6) return { host: v6[1]!, port: v6[2] };
  if (e.includes(":") && !/^[^:]+:\d+$/.test(e)) return { host: `[${e}]` }; // a bare IPv6 address
  const [host, port] = e.split(":");
  return { host: host!, port };
}

const isWildcardPattern = (entry: string): boolean => {
  const { host } = splitHostPort(entry);
  return entry !== "*" && (host.startsWith("*.") ? host.slice(2).includes("*") : host.includes("*"));
};

/** Host and port of one plain NO_PROXY entry: `.a.com` and `*.a.com` are `a.com`, which covers its subdomains. */
function entryOf(entry: string): { host: string; port?: string } {
  return splitHostPort(entry.replace(/^\*?\./, ""));
}

/** Whether a request to `url` goes through the proxy. */
export function proxied(url: string, cfg: ProxyConfig | undefined = proxyConfig()): boolean {
  if (!cfg) return false;
  const u = new URL(url);
  if (u.protocol !== "http:" && u.protocol !== "https:") return false;
  const host = u.hostname.toLowerCase();
  const bareHost = stripBrackets(host);
  const ipKind = isIP(bareHost);
  const port = u.port || (u.protocol === "https:" ? "443" : "80");
  if (!cfg.noProxy.includes(LOOPBACK) && loopback(host)) return false;
  return !cfg.noProxy.some((raw) => {
    if (raw === LOOPBACK) return false;
    if (raw === "*") return true;
    const cidr = parseCidr(raw);
    if (cidr) {
      if (!ipKind || (ipKind === 4 ? "ipv4" : "ipv6") !== cidr.family) return false;
      const bl = new BlockList();
      bl.addSubnet(cidr.net, cidr.prefix, cidr.family);
      return bl.check(bareHost, cidr.family);
    }
    if (isWildcardPattern(raw)) {
      const { host: pat, port: patPort } = splitHostPort(raw);
      if (patPort && patPort !== port) return false;
      const normalized = pat.startsWith(".") ? `*${pat}` : pat;
      const re = new RegExp(`^${normalized.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*")}$`, "i");
      return re.test(host) || re.test(bareHost);
    }
    const e = entryOf(raw);
    if (e.port && e.port !== port) return false;
    return host === e.host || host.endsWith(`.${e.host}`);
  });
}

/**
 * The same rules as Chrome's bypass list. Chrome reads `a.com` as that host alone, so a plain
 * domain entry becomes the host and `*.` its subdomains; CIDRs and wildcard patterns pass through
 * as written, each with its port when it named one.
 */
export function bypassList(noProxy: string[]): string {
  return noProxy
    .flatMap((raw) => {
      if (raw === LOOPBACK || raw === "*") return [raw];
      const cidr = parseCidr(raw);
      if (cidr) return [`${cidr.net}/${cidr.prefix}`];
      if (isWildcardPattern(raw)) return [raw];
      const { host, port } = entryOf(raw);
      const p = port ? `:${port}` : "";
      return host.startsWith("[") || /^\d+(\.\d+){3}$/.test(host) ? [host + p] : [host + p, `*.${host}${p}`];
    })
    .join(",");
}

/** Playwright's `proxy` launch option, or undefined when no proxy is set or every host bypasses it. */
export function browserProxy(cfg: ProxyConfig | undefined = proxyConfig()): LaunchOptions["proxy"] {
  if (!cfg || cfg.noProxy.includes("*")) return undefined;
  // Playwright adds <-loopback> (loopback through the proxy) unless the list names a loopback host
  const direct = cfg.noProxy.includes(LOOPBACK) ? [] : ["localhost", "127.0.0.1", "[::1]"];
  const bypass = [bypassList(cfg.noProxy), ...direct].filter(Boolean).join(",");
  return {
    server: `${cfg.url.protocol}//${cfg.url.host}`,
    ...(bypass ? { bypass } : {}),
    ...(cfg.url.username ? { username: decodeURIComponent(cfg.url.username) } : {}),
    ...(cfg.url.password ? { password: decodeURIComponent(cfg.url.password) } : {}),
  };
}

/** `text` with the proxy's URL and credentials taken out: undici can quote the URL it was given. */
export function redactProxy(text: string, cfg: ProxyConfig | undefined = proxyConfig()): string {
  if (!cfg) return text;
  const { username, password } = cfg.url;
  const secrets = [cfg.url.href, `${username}:${password}@`, password, decodeURIComponent(password)];
  return secrets
    .filter((s) => s.length >= 3 && s !== ":@")
    .sort((a, b) => b.length - a.length)
    .reduce((t, s) => t.replaceAll(s, s === cfg.url.href ? shownProxy(cfg) : "***"), text);
}

/**
 * A request that would show this session to the proxy: plain http through it, carrying a cookie or a
 * session value. Over https the proxy sees only the host.
 */
export class CleartextRefused extends Error {}

/** Throws `CleartextRefused` when `url` goes through the proxy over plain http and `carries` a session. */
export function refuseCleartext(url: string, carries: boolean, cfg: ProxyConfig | undefined = proxyConfig()): void {
  if (!carries || new URL(url).protocol !== "http:" || !proxied(url, cfg)) return;
  throw new CleartextRefused(
    `not sending to ${new URL(url).origin} through the proxy ${cfg ? shownProxy(cfg) : ""}: it is plain http, so the proxy would read this session's cookies`,
  );
}

type Undici = typeof import("undici");
let agent: { href: string; dispatcher: InstanceType<Undici["ProxyAgent"]>; fetch: Undici["fetch"] } | undefined;

async function dispatcherFor(cfg: ProxyConfig) {
  if (agent?.href === cfg.url.href) return agent;
  const { ProxyAgent, fetch } = await import("undici");
  // built from our variable alone: undici's own reading of HTTPS_PROXY is never used, and nothing is global
  // proxyTunnel false: a plain-http request goes to the proxy whole, as Chrome sends it (a stock Squid
  // refuses CONNECT to port 80); a session never goes that way (`refuseCleartext`). The token is ours,
  // since undici sends none for a username with an empty password.
  const { username, password } = cfg.url;
  const token = username
    ? `Basic ${Buffer.from(`${decodeURIComponent(username)}:${decodeURIComponent(password)}`).toString("base64")}`
    : undefined;
  const uri = `${cfg.url.protocol}//${cfg.url.host}`;
  agent = {
    href: cfg.url.href,
    dispatcher: new ProxyAgent({ uri, proxyTunnel: false, ...(token ? { token } : {}) }),
    fetch,
  };
  return agent;
}

const hasCookie = (headers: RequestInit["headers"]) => !!headers && new Headers(headers as HeadersInit).has("cookie");

/**
 * `fetch` for a site: through the proxy when one is set and the host does not bypass it, Node's own
 * fetch otherwise. Registry and report traffic call `fetch` and never this.
 */
export async function siteFetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  const cfg = proxyConfig();
  if (!cfg || !proxied(url, cfg)) return fetch(input, init);
  refuseCleartext(url, hasCookie(init?.headers), cfg);
  const a = await dispatcherFor(cfg);
  try {
    const res = await a.fetch(url, { ...(init as object), dispatcher: a.dispatcher } as Parameters<Undici["fetch"]>[1]);
    return res as unknown as Response;
  } catch (e) {
    const err = e as Error & { cause?: { code?: string; message?: string } };
    if (err.name === "TimeoutError" || err.name === "AbortError") throw e;
    const cause = err.cause ? `${err.cause.code ?? ""} ${err.cause.message ?? ""}`.trim() : "";
    throw new Error(redactProxy(`fetch failed through the proxy ${shownProxy(cfg)}: ${cause || err.message}`, cfg));
  }
}
