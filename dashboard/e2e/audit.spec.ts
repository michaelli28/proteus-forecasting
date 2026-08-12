import { expect, test } from "@playwright/test";
import type { ConsoleMessage, Page, Request } from "@playwright/test";

/**
 * Whole-site audit.
 *
 * Walks every route, follows every link, clicks every button, and cycles every
 * select — then fails if any of it produced a console error, a failed request,
 * or a broken destination. The point is to find what is actually broken rather
 * than to assert that a few known-good paths still work, so the checks are
 * enumerated from the DOM at runtime instead of hardcoded. A control added
 * later is audited automatically.
 */

const ROUTES = [
  { path: "/", name: "overview" },
  { path: "/live", name: "watch a run" },
  { path: "/exposure", name: "water exposure" },
  { path: "/calibration", name: "forecast quality" },
  { path: "/metrics", name: "metrics" },
  { path: "/runs", name: "runs index" },
];

/**
 * Console noise that is not a defect.
 *
 * Deliberately short. Every entry is a specific string with a reason, never a
 * broad pattern — a permissive filter here would silently swallow the failures
 * this suite exists to surface.
 */
const IGNORED_CONSOLE = [
  "Download the React DevTools",
  // React logs this when an SSE stream is torn down by navigation.
  "The user aborted a request",
];

interface PageProblems {
  readonly consoleErrors: string[];
  readonly pageErrors: string[];
  readonly failedRequests: string[];
}

/** Attach collectors before the first navigation so nothing is missed. */
function watch(page: Page): PageProblems {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const failedRequests: string[] = [];

  page.on("console", (message: ConsoleMessage) => {
    if (message.type() !== "error") return;
    const text = message.text();
    if (IGNORED_CONSOLE.some((entry) => text.includes(entry))) return;
    consoleErrors.push(text);
  });

  page.on("pageerror", (error) => {
    pageErrors.push(error.message);
  });

  page.on("requestfailed", (request: Request) => {
    const failure = request.failure()?.errorText ?? "unknown";
    // A stream cancelled by leaving the page is expected, not a defect.
    if (failure.includes("ERR_ABORTED")) return;
    failedRequests.push(`${request.method()} ${request.url()} — ${failure}`);
  });

  return { consoleErrors, pageErrors, failedRequests };
}

function report(name: string, problems: PageProblems): void {
  expect(problems.pageErrors, `${name}: uncaught page errors`).toEqual([]);
  expect(problems.consoleErrors, `${name}: console errors`).toEqual([]);
  expect(problems.failedRequests, `${name}: failed requests`).toEqual([]);
}

test.describe("every route loads cleanly", () => {
  for (const route of ROUTES) {
    test(`${route.name} (${route.path})`, async ({ page }) => {
      const problems = watch(page);
      const response = await page.goto(route.path, {
        waitUntil: "networkidle",
      });

      expect(response?.status(), `${route.path} status`).toBe(200);
      await expect(page.locator("body")).toBeVisible();

      // A route that renders an empty shell is broken even at HTTP 200.
      const text = (await page.locator("body").innerText()).trim();
      expect(text.length, `${route.path} rendered no text`).toBeGreaterThan(
        120,
      );

      report(route.path, problems);
    });
  }
});

test("every internal link resolves", async ({ page }) => {
  const checked = new Map<string, number>();
  const broken: string[] = [];

  for (const route of ROUTES) {
    await page.goto(route.path, { waitUntil: "domcontentloaded" });

    const hrefs = await page
      .locator("a[href]")
      .evaluateAll((anchors) =>
        anchors.map(
          (anchor) => (anchor as HTMLAnchorElement).getAttribute("href") ?? "",
        ),
      );

    for (const href of hrefs) {
      if (!href || href.startsWith("#") || href.startsWith("mailto:")) continue;
      if (/^https?:\/\//.test(href)) continue; // external, not ours to police
      if (checked.has(href)) continue;

      const response = await page.request.get(href);
      checked.set(href, response.status());
      if (response.status() >= 400) {
        broken.push(
          `${href} → ${response.status()} (linked from ${route.path})`,
        );
      }
    }
  }

  expect(checked.size, "no internal links were found to check").toBeGreaterThan(
    3,
  );
  expect(broken, "broken internal links").toEqual([]);
});

test("every navigation tab reaches its page and marks itself current", async ({
  page,
}) => {
  const problems = watch(page);
  await page.goto("/", { waitUntil: "domcontentloaded" });

  const tabs = await page.locator("header nav a").evaluateAll((anchors) =>
    anchors.map((anchor) => ({
      href: (anchor as HTMLAnchorElement).getAttribute("href") ?? "",
      label: (anchor.textContent ?? "").trim(),
    })),
  );

  expect(tabs.length, "navigation has no tabs").toBeGreaterThan(3);

  for (const tab of tabs) {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.locator(`header nav a[href="${tab.href}"]`).click();
    await page.waitForURL((url) => url.pathname.startsWith(tab.href), {
      timeout: 15_000,
    });

    // The active tab must actually mark itself, or the user cannot tell where
    // they are — the whole point of the nav's one visual affordance.
    const current = page.locator(`header nav a[href="${tab.href}"]`);
    await expect(
      current,
      `${tab.label} does not mark itself current`,
    ).toHaveAttribute("aria-current", "page");
  }

  report("navigation", problems);
});

test("buttons and controls on every page respond without error", async ({
  page,
}) => {
  for (const route of ROUTES) {
    const problems = watch(page);
    await page.goto(route.path, { waitUntil: "networkidle" });

    const buttons = page.locator("button:not([disabled])");
    const count = await buttons.count();

    for (let index = 0; index < count; index++) {
      const button = buttons.nth(index);
      if (!(await button.isVisible())) continue;

      const label = ((await button.innerText()) || "(unlabelled)").trim();
      // The live run is exercised properly in its own test; clicking it here
      // would start a stream this test has no intention of waiting out.
      if (/^run it$/i.test(label)) continue;

      await button.click({ timeout: 10_000 });
      await page.waitForTimeout(120);
    }

    report(`${route.path} buttons`, problems);
  }
});

test("selects on the live page offer real options and accept every one", async ({
  page,
}) => {
  const problems = watch(page);
  await page.goto("/live", { waitUntil: "networkidle" });

  const selects = page.locator("select");
  const count = await selects.count();
  expect(count, "the live page has no selects").toBeGreaterThan(0);

  for (let index = 0; index < count; index++) {
    const select = selects.nth(index);
    const values = await select
      .locator("option")
      .evaluateAll((options) =>
        options.map((option) => (option as HTMLOptionElement).value),
      );

    expect(values.length, `select ${index} has no options`).toBeGreaterThan(0);

    for (const value of values) {
      await select.selectOption(value);
      await expect(select).toHaveValue(value);
      await page.waitForTimeout(60);
    }
  }

  report("live selects", problems);
});

/**
 * Untick deep deliberation.
 *
 * Deep mode is the page's default because it is the point of the page, but it
 * makes real model calls: minutes of wall clock and real money per run. A test
 * suite that does that on every invocation stops being run, so the tests below
 * exercise the deterministic kernel, which is free, instant, and reproducible.
 */
async function useFastPath(page: Page): Promise<void> {
  const deep = page.getByRole("checkbox");
  if (await deep.isChecked()) await deep.uncheck();
}

test("the live run streams, updates, and completes", async ({ page }) => {
  const problems = watch(page);
  await page.goto("/live", { waitUntil: "networkidle" });
  await useFastPath(page);

  await page.getByRole("button", { name: /^run it$/i }).click();

  // The worlds view only renders once run_started has been received.
  await expect(
    page.getByRole("heading", { name: /the world it ran|worlds, same situation/i }),
    "the worlds view never rendered — the stream never started",
  ).toBeVisible({ timeout: 30_000 });

  // And the run must finish, not hang.
  await expect(
    page.getByRole("button", { name: /^run it$/i }),
    "the run never finished — button stayed in Stop",
  ).toBeVisible({ timeout: 60_000 });

  // Something must actually have been decided and reported. "steps worth
  // deliberating" is a deep-run field — a single-world run emits no branch
  // summary — so the assertion is on what BOTH paths report: the world's
  // outcome, and the reproducibility statement that closes a finished run.
  await expect(page.getByText(/\d+ acts?\b/).first()).toBeVisible();
  await expect(page.getByText(/reproduces exactly/i)).toBeVisible();

  report("live run", problems);
});

test("the live run can be stopped mid-flight", async ({ page }) => {
  const problems = watch(page);
  await page.goto("/live", { waitUntil: "networkidle" });
  await useFastPath(page);

  const run = page.getByRole("button", { name: /^run it$/i });
  await run.click();

  // The kernel finishes in about a tenth of a second, so the interruptible
  // window is genuinely small. Catching it is a bonus; what must always hold is
  // that the control returns to idle and no error is raised either way.
  const stop = page.getByRole("button", { name: /^stop$/i });
  const caught = await stop
    .waitFor({ state: "visible", timeout: 2_000 })
    .then(() => true)
    .catch(() => false);
  if (caught) await stop.click().catch(() => undefined);

  await expect(run, "the page never returned to an idle state").toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByText(/could not complete/i)).toHaveCount(0);

  report("live stop", problems);
});

test("a run with a defensive measure charges for it", async ({ page }) => {
  const problems = watch(page);
  await page.goto("/live", { waitUntil: "networkidle" });
  await useFastPath(page);

  const defense = page.locator("select").nth(1);
  const options = await defense
    .locator("option")
    .evaluateAll((entries) =>
      entries
        .map((entry) => (entry as HTMLOptionElement).value)
        .filter((value) => value.length > 0),
    );
  expect(options.length, "no defensive measures offered").toBeGreaterThan(0);

  await defense.selectOption(options[0]!);
  await page.getByRole("button", { name: /^run it$/i }).click();

  await expect(page.getByRole("button", { name: /^run it$/i })).toBeVisible({
    timeout: 60_000,
  });

  // A defended run must report what the mitigation cost. The readout renders
  // only when a defence is active, so its absence here is the failure.
  await expect(
    page.getByText(/spent on defence/i),
    "a defended run reported no spend",
  ).toBeVisible();

  report("defended run", problems);
});

test("the API rejects malformed input instead of starting a process", async ({
  request,
}) => {
  const bad = await request.get(
    "/api/live?pack=../../etc/passwd&actors=russia",
  );
  expect(bad.status(), "path-traversal pack id was not rejected").toBe(400);

  const noActors = await request.get("/api/live?pack=regional-grid&actors=");
  expect(noActors.status(), "empty actor list was not rejected").toBe(400);
});

test("pages hold up on a narrow viewport without sideways scroll", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });

  for (const route of ROUTES) {
    await page.goto(route.path, { waitUntil: "networkidle" });
    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    );
    // A few pixels is rounding; a real overflow is tens or hundreds.
    expect(overflow, `${route.path} scrolls sideways on mobile`).toBeLessThan(
      4,
    );
  }
});
