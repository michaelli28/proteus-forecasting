import { expect, test } from "@playwright/test";

/**
 * Do the controls actually DO something?
 *
 * The audit suite proves nothing throws. That is a weaker claim than it sounds:
 * a button wired to nothing passes it perfectly. These tests assert that each
 * control changes the thing it is supposed to change, which is the difference
 * between "no errors" and "works".
 */

test("exposure: choosing a different system changes the table beneath it", async ({
  page,
}) => {
  await page.goto("/exposure", { waitUntil: "networkidle" });

  // The system selectors are the buttons above the ranked table.
  const selectors = page.locator("button").filter({ hasNotText: /^$/ });
  const count = await selectors.count();
  expect(count, "no system selectors found").toBeGreaterThan(1);

  const table = page.locator("table").first();
  const before = await table.innerText();

  let changed = false;
  for (let index = 0; index < count; index++) {
    const button = selectors.nth(index);
    if (!(await button.isVisible())) continue;
    await button.click();
    await page.waitForTimeout(200);
    const after = await table.innerText();
    if (after !== before) {
      changed = true;
      break;
    }
  }

  expect(
    changed,
    "clicking every selector left the ranked table identical — the controls are inert",
  ).toBe(true);
});

/**
 * Selection state must be announced, not just coloured.
 *
 * Which ARIA attribute is correct depends on the widget: a tablist uses
 * role="tab" + aria-selected, an independent toggle uses aria-pressed. Both are
 * accepted here — the assertion is that SOME accessible signal exists, not that
 * one particular pattern was chosen.
 */
const SELECTED_STATE =
  "[aria-selected='true'], [aria-pressed='true'], [aria-current='true']";

test("exposure: the selected system announces itself, not just colours itself", async ({
  page,
}) => {
  await page.goto("/exposure", { waitUntil: "networkidle" });
  await expect(page.locator(SELECTED_STATE).first()).toBeVisible();
});

test("live: the chosen actors announce themselves", async ({ page }) => {
  await page.goto("/live", { waitUntil: "networkidle" });

  const selected = page.locator(`button${SELECTED_STATE}`);
  await expect(
    selected.first(),
    "no actor pill exposes its selected state accessibly",
  ).toBeVisible();

  const before = await selected.count();
  await page
    .locator("button")
    .filter({ hasText: /Federation|Republic|States/ })
    .first()
    .click();
  await page.waitForTimeout(150);

  expect(
    await selected.count(),
    "toggling a pill did not change the announced selection",
  ).not.toBe(before);
});

test("run detail: the scrubber moves the run and play advances it", async ({
  page,
}) => {
  await page.goto("/runs", { waitUntil: "networkidle" });

  const firstRun = page.locator('a[href^="/runs/"]').first();
  await expect(firstRun, "no run links on /runs").toBeVisible();
  await firstRun.click();
  await page.waitForURL(/\/runs\/[0-9a-f]{8,}/, { timeout: 15_000 });

  const scrubber = page.locator('input[type="range"]');
  await expect(scrubber, "run detail has no scrubber").toBeVisible();

  const max = await scrubber.getAttribute("max");
  expect(Number(max), "scrubber has no usable range").toBeGreaterThan(1);

  const body = page.locator("body");
  const before = await body.innerText();

  await scrubber.fill(String(Math.floor(Number(max) / 2)));
  await page.waitForTimeout(300);
  const after = await body.innerText();

  expect(after, "dragging the scrubber changed nothing on the page").not.toBe(
    before,
  );

  // The transport button must toggle its own label, or the user cannot tell
  // whether playback is running.
  const transport = page.locator("button").first();
  const labelBefore = (await transport.innerText()).trim();
  await transport.click();
  await page.waitForTimeout(400);
  const labelAfter = (await transport.innerText()).trim();

  expect(
    labelAfter,
    `transport button label did not change on click (stayed "${labelBefore}")`,
  ).not.toBe(labelBefore);
});

test("live: actor pills toggle on and off, and gate the run button", async ({
  page,
}) => {
  await page.goto("/live", { waitUntil: "networkidle" });

  const pills = page.locator("button").filter({
    hasText: /Federation|States|Republic|syndicate|collective|network|actor/,
  });
  const count = await pills.count();
  expect(count, "no actor pills found").toBeGreaterThan(2);

  const first = pills.first();
  const before = await first.getAttribute("class");
  await first.click();
  await page.waitForTimeout(120);
  const after = await first.getAttribute("class");

  expect(
    after,
    "clicking an actor pill did not change its appearance",
  ).not.toBe(before);

  // With every actor deselected, the run must be refused rather than started.
  for (let index = 0; index < count; index++) {
    const pill = pills.nth(index);
    const cls = (await pill.getAttribute("class")) ?? "";
    if (cls.includes("accent")) await pill.click();
  }
  await page.waitForTimeout(150);

  const run = page.getByRole("button", { name: /run it/i });
  await expect(
    run,
    "the run button is enabled with no actors selected",
  ).toBeDisabled();
});

test("live: changing the situation updates the defensive measures offered", async ({
  page,
}) => {
  await page.goto("/live", { waitUntil: "networkidle" });

  const situation = page.locator("select").first();
  const defense = page.locator("select").nth(1);

  const packs = await situation
    .locator("option")
    .evaluateAll((options) =>
      options.map((option) => (option as HTMLOptionElement).value),
    );
  expect(packs.length, "only one situation offered").toBeGreaterThan(1);

  const seen = new Set<string>();
  for (const pack of packs) {
    await situation.selectOption(pack);
    await page.waitForTimeout(150);
    const defenses = await defense
      .locator("option")
      .evaluateAll((options) =>
        options
          .map((option) => (option as HTMLOptionElement).value)
          .filter(Boolean),
      );
    expect(
      defenses.length,
      `situation "${pack}" offers no defensive measures`,
    ).toBeGreaterThan(0);
    seen.add(defenses.join("|"));
  }

  // Different domains must offer different mitigations, or the control is
  // decorative and the ROI comparison is meaningless across packs.
  expect(
    seen.size,
    "every situation offered the identical set of measures",
  ).toBeGreaterThan(1);
});

test("live: switching situation resets a stale defence selection", async ({
  page,
}) => {
  await page.goto("/live", { waitUntil: "networkidle" });

  const situation = page.locator("select").first();
  const defense = page.locator("select").nth(1);

  const packs = await situation
    .locator("option")
    .evaluateAll((options) =>
      options.map((option) => (option as HTMLOptionElement).value),
    );

  await situation.selectOption(packs[0]!);
  const firstDefenses = await defense
    .locator("option")
    .evaluateAll((options) =>
      options.map((o) => (o as HTMLOptionElement).value).filter(Boolean),
    );
  await defense.selectOption(firstDefenses[0]!);

  await situation.selectOption(packs[1]!);
  await page.waitForTimeout(200);

  // A defence from the previous pack would be rejected by the engine, so the
  // control must not still be holding one.
  const current = await defense.inputValue();
  const nowValid = await defense
    .locator("option")
    .evaluateAll((options) =>
      options.map((o) => (o as HTMLOptionElement).value),
    );
  expect(
    nowValid,
    `defence "${current}" survived a situation change but is not offered by the new pack`,
  ).toContain(current);
});
