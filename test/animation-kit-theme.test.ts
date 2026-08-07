import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_THEME_NAME,
  THEMES,
  UI_SYSTEM_VERSION,
  resolveInitialThemeName,
} from "../src/lib/themes";

test("Animation Kit is Cabinet's explicit, reversible default", () => {
  assert.equal(DEFAULT_THEME_NAME, "animation");
  assert.equal(UI_SYSTEM_VERSION, "animation-v1");
  assert.equal(resolveInitialThemeName(), "animation");
  assert.equal(THEMES[0]?.name, "animation");

  const names = THEMES.map((theme) => theme.name);
  assert.equal(new Set(names).size, names.length);
});

test("Animation Kit keeps the published Kit token authority", () => {
  const animation = THEMES.find((theme) => theme.name === "animation");
  assert.ok(animation);
  assert.equal(animation.type, "dark");
  assert.equal(animation.vars["--background"], "oklch(0.15683 0.01057 285.12)");
  assert.equal(animation.vars["--primary"], "oklch(0.71998 0.17231 303.07)");
  assert.equal(animation.vars["--positive"], "oklch(0.86280 0.15184 159.40)");
  assert.equal(animation.vars["--radius-control"], "0.5625rem");
  assert.equal(animation.vars["--radius-card"], "0.75rem");
  assert.equal(animation.vars["--radius-sheet"], "1rem");
  assert.equal(animation.vars["--dur-short"], "180ms");
  assert.equal(
    animation.vars["--ease-standard"],
    "cubic-bezier(0.23, 1, 0.32, 1)"
  );
});
