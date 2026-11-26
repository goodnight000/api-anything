/**
 * Server-sent events (`text/event-stream`): an answer that arrives in pieces over one HTTP request.
 * The bounds every read of one keeps to, at every tier and in a capture, and its decoding into a list
 * of events, which the rest of the code reads like any JSON answer. Pure: the registry Worker bundles it.
 */
import { BodyTooDeep, parseJson } from "./codec.js";

/**
 * A stream that sends no event for this long has sent what it has for now (a search's results, then a
 * held connection), and is read no further. Comment lines (a heartbeat) do not count as an event. Long
 * enough for a generator's slow first event.
 */
export const STREAM_IDLE_MS = 3000;

/**
 * The most time one read of a stream takes. A stream that never ends (live prices, ticks) answers with
 * what arrived by then: a call reads one at each tier it tries, and three of them fit in its default
 * 30 s timeout, and in the 25 s an MCP call waits before it hands back a job.
 */
export const STREAM_MAX_MS = 10_000;

/** Why a read stopped before the stream ended. */
export type StreamCut = "idle" | "time" | "bytes" | "ended";

/** A response's content type says it is an event stream. */
export const isEventStream = (contentType: string | null | undefined): boolean =>
  /^\s*text\/event-stream\s*(;|$)/i.test(contentType ?? "");

/** Whether a piece of a stream carries a field line (an event on its way), not only comments and blank lines. */
export const carriesField = (text: string): boolean => /(?:^|[\r\n])[^:\r\n]/.test(text);

/** What a call or a capture says of a read of a stream that stopped at a bound, in `truncated`. */
export function streamCut(cut: StreamCut, ms: number): string {
  const s = Math.round(ms / 100) / 10;
  switch (cut) {
    case "idle":
      return `the event stream sent no event for ${STREAM_IDLE_MS / 1000} s and was still open, so it was read no further`;
    case "time":
      return `the event stream was still open after ${s} s, so it was read no further`;
    case "bytes":
      return "the event stream passed the cap on a response's size, so it was read no further";
    case "ended":
      return `the browser run ended with the event stream still open after ${s} s`;
  }
}

/**
 * A body that is an event stream by its own syntax: it opens with a comment or one of the stream's
 * fields, which JSON never does, and it holds a line break, as every finished stream line does. Without
 * one it is a line of text that happens to open so (a `data:` URL, an "id: 5 not found"), read as it
 * always was.
 */
export const looksLikeEventStream = (body: string): boolean =>
  /^\uFEFF?(?::|(?:data|event|id|retry)(?::|\r|\n))/.test(body) && /[\r\n]/.test(body);

/**
 * Whether a body is read as an event stream. Its content type decides wherever there is one (a live
 * answer, a captured exchange): `text/event-stream` always is, whatever its first line and even empty;
 * any other type never is. Only a body that comes with no content type at all is judged by its syntax.
 */
export const readsAsEventStream = (body: string, contentType?: string | null): boolean =>
  contentType?.trim() ? isEventStream(contentType) : looksLikeEventStream(body.trimStart());

export interface StreamEvent {
  /** the `event:` field, "message" when the event names none */
  event: string;
  /** the last `id:` the stream gave, when it gave one */
  id?: string;
  /** an object or array parsed as JSON; any other text as it is, so a stream of text tokens keeps one type */
  data: unknown;
}

function dataOf(text: string): unknown {
  if (!/^\s*[[{]/.test(text)) return text;
  try {
    return parseJson(text);
  } catch (e) {
    if (e instanceof BodyTooDeep) throw e;
    return text;
  }
}

/**
 * The events of a stream, as the WHATWG event-stream rules dispatch them: lines end with CRLF, LF or
 * CR; a line starting with `:` is a comment; `data:` lines join with a line feed; `retry:` and unknown
 * fields are ignored; an `id:` holding a NUL is ignored, and an id carries over to later events; an
 * event with no data is not dispatched; what follows the last blank line (an event still arriving when
 * the stream ended or was cut) is dropped.
 */
export function parseEventStream(text: string): StreamEvent[] {
  const out: StreamEvent[] = [];
  const lines = text.replace(/^\uFEFF/, "").split(/\r\n|\r|\n/);
  // the text after the last line break is no line yet
  lines.pop();
  let data = "";
  let type = "";
  let id = "";
  for (const line of lines) {
    if (line === "") {
      if (data !== "") out.push({ event: type || "message", ...(id ? { id } : {}), data: dataOf(data.slice(0, -1)) });
      data = "";
      type = "";
      continue;
    }
    if (line.startsWith(":")) continue;
    const colon = line.indexOf(":");
    const field = colon < 0 ? line : line.slice(0, colon);
    let value = colon < 0 ? "" : line.slice(colon + 1);
    if (value.startsWith(" ")) value = value.slice(1);
    if (field === "data") data += `${value}\n`;
    else if (field === "event") type = value;
    else if (field === "id" && !value.includes("\0")) id = value;
  }
  return out;
}
