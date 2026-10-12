import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, test } from "node:test";
import { browserAvailable, browserChoice } from "../src/browser.js";

/**
 * A hermetic check of the browser resolver: `API_ANYTHING_BROWSER` must override the default
 * order, by path (any Chromium executable, portable or not) or by name. Skipped where the
 * machine has no browser at all.
 */
describe("browserChoice", () => {
  const saved = process.env.API_ANYTHING_BROWSER;
  const cleanup = () => {
    if (saved === undefined) delete process.env.API_ANYTHING_BROWSER;
    else process.env.API_ANYTHING_BROWSER = saved;
  };

  test("without the variable, an installed browser is found", () => {
    cleanup();
    const c = browserChoice();
    if (!c) return; // a browserless machine skips the browser suite anyway
    assert.ok(existsSync(c.bin), `the chosen binary must exist: ${c.bin}`);
    assert.equal(browserAvailable(), true);
  });

  test("a path in API_ANYTHING_BROWSER wins, and so does its name", () => {
    cleanup();
    const c = browserChoice();
    if (!c) return; // needs a default to override
    process.env.API_ANYTHING_BROWSER = c.bin;
    const byPath = browserChoice();
    assert.ok(byPath, "the existing path must be accepted");
    assert.equal(byPath!.bin, c.bin);
    process.env.API_ANYTHING_BROWSER = byPath!.name;
    assert.equal(browserChoice()?.bin, c.bin, "the browser's name must resolve to the same binary");
    cleanup();
  });

  test("an unknown name finds nothing (a path would)", () => {
    cleanup();
    process.env.API_ANYTHING_BROWSER = "no-such-browser-xyz";
    assert.equal(browserChoice(), undefined);
    assert.equal(browserAvailable(), false);
    cleanup();
  });

  test("a missing path finds nothing", () => {
    cleanup();
    process.env.API_ANYTHING_BROWSER = join(tmpdir(), "definitely-not-installed", "browser");
    assert.equal(browserChoice(), undefined);
    cleanup();
  });
});
