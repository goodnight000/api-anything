import assert from "node:assert/strict";
import { test } from "node:test";
import { REDACTED, redact } from "../src/secrets.js";

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
