import { expect, test, type Page } from "@playwright/test";
import { SEATS, runStubbed } from "./fixtures/canned-run";

/**
 * The councils list, driven by a canned stream.
 *
 * A real deep run costs minutes and real model money, so the suite would never
 * run this against one — which is exactly why the councils view went unchecked
 * long enough to grow into a wall of three dozen open cards. So the stream is
 * stubbed here: the same events the engine emits, delivered instantly and for
 * free, which makes the one claim this view makes testable on every push.
 *
 * The claim: a finished multi-world run surfaces its councils as one line each,
 * grouped by world, with the whole table one click away — not all of it at once.
 */

/** The council rows: every collapsible step inside a world. */
function councilRows(page: Page) {
  return page.getByRole("button", { name: /^step \d+/ });
}

test("a finished run surfaces one line per council, not every table", async ({
  page,
}) => {
  await runStubbed(page);

  // Six councils were held. At most one of their tables may be on screen.
  const openTables = await page
    .getByText(/CHAIR-REASONING-/)
    .filter({ visible: true })
    .count();
  expect(
    openTables,
    "a finished run left more than one council table expanded",
  ).toBeLessThanOrEqual(1);

  // And the worlds are the grouping: w1 and w2 each get a header.
  await expect(
    page.getByRole("button", { name: /^w1 3 councils/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /^w2 3 councils/ }),
  ).toBeVisible();
});

test("a row says how its table divided only when it did", async ({ page }) => {
  await runStubbed(page);

  const w1 = page.getByRole("button", { name: /^w1 3 councils/ });
  if ((await w1.getAttribute("aria-expanded")) !== "true") await w1.click();

  // Step 33 divided 2–1 without parting from the arithmetic; step 11 was
  // unanimous. A unanimous table says nothing rather than saying "all agreed"
  // down every row of a run where nothing divided.
  await expect(
    councilRows(page).filter({ hasText: "step 33" }),
    "a divided table did not report its split",
  ).toContainText("2 of 3 seats agreed");
  await expect(
    councilRows(page).filter({ hasText: "step 11" }),
  ).not.toContainText("seats agreed");

  // Dividing and parting are different facts and get different marks.
  await expect(
    councilRows(page).filter({ hasText: "step 33" }),
  ).not.toContainText("parted from the arithmetic");
  await expect(councilRows(page).filter({ hasText: "step 22" })).toContainText(
    "parted from the arithmetic",
  );
});

test("opening a world lists its councils, and opening one gives the table back", async ({
  page,
}) => {
  await runStubbed(page);

  const w1 = page.getByRole("button", { name: /^w1 3 councils/ });
  if ((await w1.getAttribute("aria-expanded")) !== "true") await w1.click();
  await expect(w1).toHaveAttribute("aria-expanded", "true");

  // Three steps, each one line, none of them showing its chair yet.
  const step11 = councilRows(page).filter({ hasText: "step 11" });
  await expect(step11).toBeVisible();
  await expect(page.getByText("CHAIR-REASONING-w1-t11-russia")).toHaveCount(0);

  await step11.click();
  await expect(step11).toHaveAttribute("aria-expanded", "true");

  // The whole table is back: every seat, and the chair's reasoning.
  await expect(page.getByText("CHAIR-REASONING-w1-t11-russia")).toBeVisible();
  for (const seat of SEATS) {
    await expect(
      page.getByRole("button", { name: new RegExp(seat.office) }).first(),
    ).toBeVisible();
  }

  // Clicking it again puts it away.
  await step11.click();
  await expect(page.getByText("CHAIR-REASONING-w1-t11-russia")).toHaveCount(0);
});

test("the filter narrows the list to the councils that parted from the arithmetic", async ({
  page,
}) => {
  await runStubbed(page);

  const filter = page.getByRole("button", {
    name: /show only the 2 that parted/i,
  });
  await expect(filter, "the filter was not offered").toBeVisible();
  await filter.click();

  // Both worlds still listed — each held one that parted — but one step each.
  await expect(
    page.getByRole("button", { name: /^w1 1 council\b/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /^w2 1 council\b/ }),
  ).toBeVisible();

  await page.getByRole("button", { name: /^w1 1 council\b/ }).click();
  await expect(councilRows(page).filter({ hasText: "step 22" })).toBeVisible();
  await expect(councilRows(page).filter({ hasText: "step 11" })).toHaveCount(0);
});
