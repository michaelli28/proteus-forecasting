import { defineConfig, devices } from "@playwright/test";

/**
 * E2E config for the dashboard audit.
 *
 * `baseURL` points at an ALREADY-RUNNING server rather than starting one, so the
 * audit can be pointed at a dev server, a production build, or a deployed
 * instance without editing anything. Set PROTEUS_BASE_URL to redirect it.
 *
 * Retries are 0 on purpose: this suite exists to find real breakage, and a
 * retry that turns an intermittent failure green is exactly the wrong outcome
 * for an audit.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: [["list"], ["html", { open: "never", outputFolder: "e2e-report" }]],
  timeout: 90_000,
  use: {
    baseURL: process.env.PROTEUS_BASE_URL ?? "http://127.0.0.1:3411",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    viewport: { width: 1440, height: 900 },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
