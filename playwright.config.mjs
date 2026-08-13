import { defineConfig } from "@playwright/test";
import process from "node:process";

const port = Number.parseInt(process.env.XIANGXU_STAGE8_HTTP_PORT ?? "43117", 10);
const evidenceGate = process.env.XIANGXU_BROWSER_EVIDENCE_GATE ?? "gate-4.2-stage-1";

export default defineConfig({
  testDir: "./packages/testing/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  outputDir: `./test-results/${evidenceGate}`,
  snapshotPathTemplate: `./artifacts/browser/${evidenceGate}/visual-baselines/{projectName}/{arg}{ext}`,
  reporter: [["line"]],
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    browserName: "chromium",
    locale: "zh-CN",
    timezoneId: "Asia/Shanghai",
    colorScheme: "light",
    reducedMotion: "no-preference",
    serviceWorkers: "block",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
  },
  projects: [{ name: "chromium" }],
});
