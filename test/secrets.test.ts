import assert from "node:assert/strict";
import { test } from "node:test";
import { liveIn, OMITTED, REDACTED, redact, scanSecrets } from "../src/secrets.js";
import type { Session } from "../src/session.js";

const TOKEN = "Tk4Rf9Lp2Wq7Zx3Nm8Vb";
const SPACED = "a b/c+d=e&f Long Enough";
const session = {
  cookies: [
    { name: "sid", value: TOKEN, domain: "x.test", path: "/", expires: -1, httpOnly: true, secure: true },
    {
      name: "last",
      value: "https://www.x.test/",
      domain: "x.test",
      path: "/",
      expires: -1,
      httpOnly: false,
      secure: false,
    },
    { name: "short", value: "abc", domain: "x.test", path: "/", expires: -1, httpOnly: false, secure: false },
  ],
  values: { csrf: `"${SPACED}"` },
};

test("redact: every encoding a body can echo a live value in", () => {
  const b64 = Buffer.from(TOKEN).toString("base64");
  const forms = [
    TOKEN,
    encodeURIComponent(SPACED),
    encodeURIComponent(SPACED).replace(/%20/g, "+"),
    JSON.stringify(SPACED).slice(1, -1),
    SPACED.replace(/&/g, "&amp;"),
    b64,
    Buffer.from(`Basic:${TOKEN}`).toString("base64"), // at another byte offset
    Buffer.from(TOKEN).toString("base64url"),
  ];
  for (const f of forms) {
    const out = redact(`HTTP 401: token ${f} refused`, session);
    assert.ok(out.includes(REDACTED), `${f}: ${out}`);
    assert.ok(!out.includes(TOKEN) && !out.includes(SPACED), out);
  }
});

test("redact: a value a JSON body spells in \\u escapes, all of it or some", () => {
  const u = (c: string) => `\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}`;
  for (const f of [[...TOKEN].map(u).join(""), [...TOKEN].map((c, i) => (i % 2 ? u(c) : c)).join("")]) {
    const out = redact(`{"error":"invalid session ${f}"}`, session);
    assert.ok(out.includes(REDACTED), out);
    assert.ok(!out.includes(f), out);
  }
});

test("redact: the site's own address, short values and ordinary text are left alone", () => {
  const text = "redirected to https://www.x.test/ with abc; no session here";
  assert.equal(redact(text, session), text);
  assert.equal(redact(text, session, { cut: true }), text);
});

test("redact: a value a cut split leaves none of its first characters at the end", () => {
  for (const n of [4, 9, TOKEN.length - 1]) {
    const out = redact(`HTTP 401: session ${TOKEN.slice(0, n)}`, session, { cut: true });
    assert.equal(out, `HTTP 401: session ${REDACTED}`, String(n));
  }
  // under 4 characters says nothing about the value; without cut nothing is dropped
  assert.equal(redact(`ends in ${TOKEN.slice(0, 3)}`, session, { cut: true }), `ends in ${TOKEN.slice(0, 3)}`);
  assert.equal(redact(`ends in ${TOKEN.slice(0, 9)}`, session), `ends in ${TOKEN.slice(0, 9)}`);
});

// A value with the characters encodings treat apart: base64 of it holds / and +, and p and + have entities.
const ODD = "Wq7?Lp2>Wx9~Zr4+Nd8";
const odd = { cookies: [], values: { k: ODD } };

test("redact: a live value left in an encoding the replacements miss takes the response out, the lead kept", () => {
  const b64 = Buffer.from(ODD).toString("base64");
  const leaks: [Pick<Session, "cookies" | "values">, string, string][] = [
    [session, TOKEN, `%54${TOKEN.slice(1)}`], // only the first byte percent-escaped
    [session, TOKEN, `%2554${TOKEN.slice(1)}`], // that escape escaped again
    [session, TOKEN, Buffer.from(`%54${TOKEN.slice(1)}`).toString("base64")],
    [odd, ODD, encodeURIComponent(b64)],
    [odd, ODD, encodeURIComponent(ODD).replace(/%3F/g, "%3f")],
    [odd, ODD, ODD.replace("p", "&#112;")],
    [odd, ODD, ODD.replace("p", "&#x70;")],
    [odd, ODD, ODD.replace("+", "&#43;")], // Go's html/template
  ];
  for (const [s, value, f] of leaks)
    for (const cut of [false, true]) {
      const out = redact(`HTTP 401: invalid session ${f}; try again`, s, { cut });
      assert.equal(out, `HTTP 401: ${OMITTED}`, f);
      assert.ok(!liveIn(out, s), f);
      assert.ok(!out.includes(value), out);
    }
});

test("redact: a lead that holds the value itself is left out with the rest", () => {
  assert.equal(redact(`session %54${TOKEN.slice(1)}: refused`, session), OMITTED);
});

test("redact: text that only looks like a token, and no live value, is left alone", () => {
  // built here, so the secret scan of this repository finds no token-shaped literal
  const part = (s: string) => Buffer.from(s).toString("base64url");
  const jwt = [part('{"alg":"HS256"}'), part('{"sub":"Q7xK2pL9vR4mT8"}'), part("signature-for-this-jwt")].join(".");
  const text = `HTTP 401: token ${jwt} expired at https://www.x.test/ for abc`;
  // only the heuristics see it: a JWT shape, which no live value is
  assert.ok(scanSecrets(text, session).warnings.length);
  assert.ok(!liveIn(text, session));
  assert.equal(redact(text, session), text);
  assert.equal(redact(text, session, { cut: true }), text);
});

test("liveIn: reads HTML character references, the origin and short values are no live value", () => {
  assert.ok(liveIn(`<p>${[...TOKEN].map((c) => `&#${c.charCodeAt(0)};`).join("")}</p>`, session));
  assert.ok(liveIn(`<p>${ODD.replace("+", "&#x2B;")}</p>`, odd));
  assert.ok(!liveIn("see https://www.x.test/ and abc", session));
  assert.ok(scanSecrets(ODD.replace("+", "&#43;"), odd).secrets.length);
});
