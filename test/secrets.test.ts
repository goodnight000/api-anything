import assert from "node:assert/strict";
import { test } from "node:test";
import { captureLive, REDACTED, redact, signInFills } from "../src/secrets.js";

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

test("redact named: each live value becomes the ref that would stand there", () => {
  const url = `https://x.test/api?q=pizza&access_token=${TOKEN}&c=${encodeURIComponent(SPACED)}`;
  assert.equal(
    redact(url, session, { named: true }),
    "https://x.test/api?q=pizza&access_token=[cookie:sid]&c=[session:csrf]",
  );
});

test("captureLive: a capture's cookies and storage, without the user's own example values", () => {
  const cookie = (name: string, value: string) => ({ ...session.cookies[0]!, name, value });
  const live = captureLive(
    {
      cookies: [cookie("sid", TOKEN), cookie("last", "Pizza-Place")],
      storage: { tok: "st0r3dT0kenValue9", q: "pizza-place" },
    },
    ["pizza-place"],
  );
  assert.deepEqual(
    live.cookies.map((c) => c.name),
    ["sid"],
  );
  assert.deepEqual(live.values, { tok: "st0r3dT0kenValue9" });
  assert.equal(
    redact("/api?q=pizza-place&t=st0r3dT0kenValue9", live, { named: true }),
    "/api?q=pizza-place&t=[session:tok]",
  );
});

test("signInFills: a step typing into a password or code field, or a password-like literal, is a sign-in's", () => {
  const fill = (selector: string, value = "{q}") => ({ action: "fill" as const, selector, value });
  for (const selector of [
    "#pw",
    "input[type=password]",
    'input[type="password"]',
    "#login_pwd",
    "input[name=passwd]",
    "#user-password",
    "[autocomplete=current-password]",
    "[autocomplete=one-time-code]",
    "#otp",
    "input[name=totp_code]",
    "#mfa-code",
    "input[name=pass]",
    "#user_pass",
    "input[name='pass']",
  ])
    assert.equal(signInFills([fill(selector, "x")]).length, 1, selector);
  const [why] = signInFills([{ action: "click", selector: "#go" }, fill("#q", "Hunter2-RealPassw0rd!")]);
  assert.match(
    why!,
    /^steps\[1\] types a literal that looks like a password: a sign-in is the user's: ask them to run api-anything login/,
  );
  // a search box, a footprint filter, a passport number field, params the call fills, words
  for (const s of [
    fill("#q"),
    fill("#footprint"),
    fill("input[name=passport]"),
    fill("input[name=passenger]"),
    fill("#compass"),
    fill("#bypass-cache"),
    fill("#search", "{user}-{q}"),
    fill("#q", "new york pizza"),
  ])
    assert.deepEqual(signInFills([s]), [], s.selector);
});
