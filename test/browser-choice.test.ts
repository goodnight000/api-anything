import assert from "node:assert/strict";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, beforeEach, describe, test } from "node:test";
import { browserAvailable, browserChoice } from "../src/browser.js";

describe("browserChoice", () => {
  const saved = process.env.API_ANYTHING_BROWSER;
  const dir = mkdtempSync(join(tmpdir(), "api-anything-browser-choice-"));
  beforeEach(() => {
    delete process.env.API_ANYTHING_BROWSER;
  });
  after(() => {
    if (saved === undefined) delete process.env.API_ANYTHING_BROWSER;
    else process.env.API_ANYTHING_BROWSER = saved;
    rmSync(dir, { recursive: true, force: true });
  });

  test("a path in API_ANYTHING_BROWSER is used as is, even for a browser outside the list", () => {
    const bin = join(dir, "My Portable Chromium");
    writeFileSync(bin, "");
    process.env.API_ANYTHING_BROWSER = bin;
    assert.deepEqual(browserChoice(), { name: "My Portable Chromium", bin });
    assert.equal(browserAvailable(), true);
  });

  test("a missing path or an unknown name finds nothing", () => {
    process.env.API_ANYTHING_BROWSER = join(dir, "not-installed", "browser");
    assert.equal(browserChoice(), undefined);
    process.env.API_ANYTHING_BROWSER = "no-such-browser";
    assert.equal(browserChoice(), undefined);
    assert.equal(browserAvailable(), false);
  });

  test("without the variable the first installed browser is chosen, and its name selects it", (t) => {
    const c = browserChoice();
    if (!c) return t.skip("no Chromium browser installed");
    assert.ok(existsSync(c.bin));
    for (const name of [c.name, c.name.toUpperCase(), c.name.toLowerCase().replace(/ /g, "-")]) {
      process.env.API_ANYTHING_BROWSER = name;
      assert.equal(browserChoice()?.bin, c.bin, name);
    }
  });
});
