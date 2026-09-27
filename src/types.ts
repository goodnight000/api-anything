/**
 * Shared contract between the browser layer (which produces exchanges) and the core
 * (which learns and executes operations from them). Both sides import only this file.
 */

/** One request/response pair observed in a real browser. Bodies are raw UTF-8 text. */
export interface Exchange {
  id: number;
  /** Playwright resource type: "document" | "xhr" | "fetch" | "script" | ... */
  resourceType: string;
  request: {
    method: string;
    url: string;
    /** lower-cased names; includes cookie and sec-fetch-* as the browser sent them */
    headers: Record<string, string>;
    body?: string;
  };
  response?: {
    status: number;
    headers: Record<string, string>;
    /** raw body text, read inside the response handler; absent for redirects/beacons */
    body?: string;
    contentType: string;
  };
  /** true when the request was intercepted and aborted before leaving the browser (write learning) */
  aborted?: boolean;
}

/** A Playwright-shaped cookie, stored in the per-site jar. */
export interface StoredCookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires: number;
  httpOnly: boolean;
  secure: boolean;
  sameSite?: "Strict" | "Lax" | "None";
}

/** Everything the browser layer hands back from one trigger run. */
export interface CaptureResult {
  exchanges: Exchange[];
  cookies: StoredCookie[];
  /** final page URL after the trigger ran */
  finalUrl: string;
  /** the final page origin's localStorage and sessionStorage, so learning can ref a token kept there */
  storage?: Record<string, string>;
  /** every URL the page had, history API changes (an SPA's pushState) included: echoes of them are not evidence */
  locations?: string[];
}

/** How to make the site's own frontend fire a request. */
export interface TriggerStep {
  action: "click" | "fill" | "press" | "wait" | "goto";
  selector?: string;
  value?: string;
  /** milliseconds for "wait" */
  ms?: number;
}
