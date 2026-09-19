import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

/**
 * What the pages claim about themselves.
 *
 * The audit suite proves the site does not break. This one proves it does not
 * lie — the two failure modes it covers both shipped, and neither raised a
 * console error on the way out:
 *
 *  - A preset offering a question above controls that no longer answer it.
 *  - Research documents printed with their Markdown showing, and source counts
 *    that included the researcher's own section headings.
 */

const ACTORS = [
  "us",
  "russia",
  "china",
  "iran",
  "dprk",
  "criminal-syndicate",
  "ideological-nonstate",
  "state-proxy",
  "hacktivist",
];

async function firstPreset(page: Page) {
  return page.locator("section", { hasText: "Start from a question" }).first();
}

test.describe("the preset picker", () => {
  test("offers questions, and picking one configures the run", async ({
    page,
  }) => {
    await page.goto("/live", { waitUntil: "networkidle" });

    const picker = await firstPreset(page);
    const buttons = picker.locator("button[aria-pressed]");
    const count = await buttons.count();
    expect(count, "no presets are offered").toBeGreaterThanOrEqual(3);

    // Nothing is selected until asked for — a page that lands pre-committed to
    // a reading is making the choice for the reader.
    for (let index = 0; index < count; index++) {
      await expect(buttons.nth(index)).toHaveAttribute("aria-pressed", "false");
    }

    await buttons.first().click();
    await expect(buttons.first()).toHaveAttribute("aria-pressed", "true");

    // The finding appears only once a question is chosen, and it is a claim of
    // substance rather than a label.
    const finding = picker.getByText(/What to watch for/i);
    await expect(finding).toBeVisible();
    const panelText = await picker.innerText();
    expect(panelText.length, "the finding panel is empty").toBeGreaterThan(300);
  });

  test("each preset actually changes what is configured", async ({ page }) => {
    await page.goto("/live", { waitUntil: "networkidle" });

    const picker = await firstPreset(page);
    const buttons = picker.locator("button[aria-pressed]");
    const seed = page.locator('input[type="text"], input:not([type])').first();

    const seen = new Set<string>();
    for (let index = 0; index < (await buttons.count()); index++) {
      await buttons.nth(index).click();
      await page.waitForTimeout(80);

      const pack = await page.locator("select").first().inputValue();
      const actors = await page
        .locator('button[aria-pressed="true"]')
        .evaluateAll((nodes) =>
          nodes.map((node) => (node.textContent ?? "").trim()).join("|"),
        );
      seen.add(`${pack}::${actors}::${await seed.inputValue()}`);
    }

    // Five buttons that all set the same thing would be five buttons pretending
    // to be a choice.
    expect(seen.size, "presets do not differ from one another").toBeGreaterThan(
      2,
    );
  });

  test("editing a control drops the preset that no longer describes the run", async ({
    page,
  }) => {
    await page.goto("/live", { waitUntil: "networkidle" });

    const picker = await firstPreset(page);
    const preset = picker.locator("button[aria-pressed]").first();
    await preset.click();
    await expect(preset).toHaveAttribute("aria-pressed", "true");

    // Change the scenario by hand. The question above it was answered by the
    // configuration that just went away, so it must stop claiming to be current.
    const pack = page.locator("select").first();
    const options = await pack
      .locator("option")
      .evaluateAll((entries) =>
        entries.map((entry) => (entry as HTMLOptionElement).value),
      );
    const current = await pack.inputValue();
    const other = options.find((value) => value !== current);
    expect(other, "only one scenario exists to switch to").toBeTruthy();

    await pack.selectOption(other!);
    await expect(
      preset,
      "the preset stayed selected after its configuration was edited",
    ).toHaveAttribute("aria-pressed", "false");
    await expect(picker.getByText(/What to watch for/i)).toHaveCount(0);
  });
});

test.describe("the mitigation comparison", () => {
  test("reports a spread per measure, not one harm-avoided number", async ({
    page,
  }) => {
    await page.goto("/live", { waitUntil: "networkidle" });

    const section = page.locator("section", {
      hasText: "One run cannot tell you",
    });
    await expect(section.first()).toBeVisible();

    // One table per scenario, each with a baseline row and its measures.
    const tables = section.first().locator("table");
    expect(await tables.count(), "a table per scenario").toBeGreaterThanOrEqual(
      3,
    );

    const body = await section.first().innerText();
    expect(body, "baseline arm is shown").toContain("no defense");
    // The finding is the spread. A range on every row is what makes it visible.
    expect(
      (body.match(/\bto\b/g) ?? []).length,
      "per-measure ranges",
    ).toBeGreaterThan(5);
  });

  test("counts ties apart from losses, and names neighbours it cannot separate", async ({
    page,
  }) => {
    await page.goto("/live", { waitUntil: "networkidle" });
    const section = page
      .locator("section", { hasText: "One run cannot tell you" })
      .first();
    const body = await section.innerText();

    // Every defense row splits its worlds three ways, and the three add up.
    const splits = [
      ...body.matchAll(
        /better in (\d+), no change in (\d+),\s+worse in (\d+)/g,
      ),
    ];
    expect(splits.length, "a split per defense").toBeGreaterThanOrEqual(12);
    const worlds = Number(
      body.match(/replayed across the same (\d+) worlds/)![1],
    );
    for (const [, won, tied, lost] of splits) {
      expect(Number(won) + Number(tied) + Number(lost)).toBe(worlds);
    }
    // A tie counted as a loss is how "worse in 3 of 6" once read as a coin flip.
    expect(body).not.toMatch(/worse in \d+ of \d+/);
    expect(body, "unseparable neighbours are named").toMatch(
      /cannot tell apart/,
    );
    // Every defense loses somewhere at this many worlds, so a warning colour on
    // the losses would mark every row and tell a reader nothing.
    expect(await section.locator("tbody .text-warn").count()).toBe(0);
  });

  test("does not ship the per-seed data to the browser", async ({ page }) => {
    await page.goto("/live", { waitUntil: "networkidle" });
    // The comparison is server-rendered; its raw per-seed arrays should never
    // appear in a client payload. `beatBaseline` is the giveaway field name.
    const html = await page.content();
    expect(html).not.toContain("beatBaseline");
  });
});

test.describe("actor dossiers", () => {
  test("every dossier names its own weakest claim, with the field it indicts", async ({
    page,
  }) => {
    for (const actor of ACTORS) {
      await page.goto(`/actors/${actor}`, { waitUntil: "domcontentloaded" });

      const label = page.getByText("Least defensible claim in this profile");
      await expect(
        label,
        `${actor} does not name a weakest claim`,
      ).toBeVisible();

      // It has to say WHERE. A weakness that names no section is a disclaimer.
      // The section used to print as its stored path (`worldview.adversaryModel`);
      // it now prints as the heading a reader actually saw. So the assertion is
      // that it resolved to one of those headings — which ALSO fails if an
      // unmapped section falls through and leaks a raw field path to the reader,
      // the failure the old path-shaped assertion could not have caught.
      const where = (
        await label.locator("..").locator("span").nth(1).innerText()
      ).trim();
      expect(where, `${actor} weakest-claim section`).toMatch(
        /^(where authority sits|how a decision gets made|what has to be true|how it describes itself|what it says it is trying|what it names as the threat|what it believes the other side|the programme it published|what it has actually done)/,
      );
      expect(where, `${actor} leaks a raw field path`).not.toMatch(
        /^[a-z]+\.[a-zA-Z]/,
      );
    }
  });

  test("research documents render as documents, not as their Markdown source", async ({
    page,
  }) => {
    for (const actor of ACTORS) {
      await page.goto(`/actors/${actor}`, { waitUntil: "domcontentloaded" });
      const body = await page.locator("main").innerText();

      expect(body, `${actor} shows literal heading syntax`).not.toMatch(
        /(^|\n)\s*#{2,6}\s/,
      );
      expect(body, `${actor} shows literal bullet syntax`).not.toMatch(
        /(^|\n)\s*[-*]\s+\*\*/,
      );
      expect(
        (body.match(/`/g) ?? []).length,
        `${actor} shows literal code backticks`,
      ).toBe(0);
    }
  });

  test("the source count matches the citations actually listed", async ({
    page,
  }) => {
    for (const actor of ACTORS) {
      await page.goto(`/actors/${actor}`, { waitUntil: "domcontentloaded" });

      const heading = await page
        .getByRole("heading", { name: /^Sources \(\d+\)/ })
        .innerText();
      const claimed = Number(/\((\d+)\)/.exec(heading)![1]);

      const listed = await page
        .locator("section", { hasText: /^Sources \(/ })
        .locator("ol li")
        .count();

      expect(claimed, `${actor} claims a source count of zero`).toBeGreaterThan(
        0,
      );
      expect(listed, `${actor}: heading says ${claimed}`).toBe(claimed);
    }
  });

  test("a commitment says whether it can ever remove a move", async ({
    page,
  }) => {
    await page.goto("/actors/russia", { waitUntil: "domcontentloaded" });

    // Russia carries one enforceable commitment whose threshold no shipped
    // ladder reaches. The page must say so rather than labelling it "enforced"
    // and leaving a reader to assume it binds.
    await expect(
      page.getByText(/no move in any scenario here goes that far/i),
      "an inert commitment is presented as though it binds",
    ).toBeVisible();
  });
});

test.describe("where the forecast fails", () => {
  test("shows the check's hits, its false alarms and both blind spots", async ({
    page,
  }) => {
    await page.goto("/calibration", { waitUntil: "networkidle" });
    const section = page
      .locator("section", { hasText: "A wrong starting assumption, caught early" })
      .last();
    const body = await section.innerText();
    expect(body).toMatch(/declined none of them/);
    expect(body).toMatch(/69 of 80/);
    expect(body).toMatch(/flags 20 of 320 questions/);
    expect(body).toMatch(/Blind spot: a mistake the activity data cannot show/);
    expect(body).toMatch(/Blind spot: one of the four scenarios/);
  });

  test("says when a score covers fewer questions than were asked", async ({
    page,
  }) => {
    await page.goto("/calibration", { waitUntil: "networkidle" });
    // The misspecified arm's skill is over the 73 questions that resolved.
    await expect(page.getByText("scored on 73 of 80")).toBeVisible();
  });
});
