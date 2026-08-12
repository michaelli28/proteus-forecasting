import { test } from "@playwright/test";

/**
 * Screenshot pass, for eyes rather than assertions.
 *
 * Kept separate from the audit and tagged so it does not run by default: it
 * asserts nothing, and a suite that mixes checks with artefact generation makes
 * a green run ambiguous. Run it with `npx playwright test shots`.
 */

const PAGES = ["/", "/live", "/exposure", "/calibration", "/runs"];

test("desktop", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  for (const path of PAGES) {
    await page.goto(path, { waitUntil: "networkidle" });
    await page.screenshot({
      path: `e2e-shots/desktop${path === "/" ? "/overview" : path}.png`,
      fullPage: true,
    });
  }
});

test("mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of PAGES) {
    await page.goto(path, { waitUntil: "networkidle" });
    await page.screenshot({
      path: `e2e-shots/mobile${path === "/" ? "/overview" : path}.png`,
      fullPage: true,
    });
  }
});
