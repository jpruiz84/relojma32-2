import { defineConfig } from "@playwright/test";
import { existsSync } from "node:fs";
// Set CHROME_PATH for a system browser, or run `npx playwright install chromium`.
const executablePath =
  process.env.CHROME_PATH ||
  (existsSync("/usr/bin/google-chrome") ? "/usr/bin/google-chrome" : undefined);
// A deployment URL must include its complete private prefix and trailing slash.
const deploymentURL = process.env.SIMULATOR_URL;
export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  workers: 1,
  timeout: 45000,
  expect: { timeout: 10000 },
  use: {
    baseURL: deploymentURL || "http://127.0.0.1:5173/",
    viewport: { width: 1366, height: 1000 },
    launchOptions: {
      executablePath,
      args: [
        "--no-sandbox",
        "--use-angle=swiftshader",
        "--enable-unsafe-swiftshader",
      ],
    },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: deploymentURL
    ? undefined
    : {
        command: "npm run dev -- --port 5173 --strictPort",
        url: "http://127.0.0.1:5173",
        reuseExistingServer: !process.env.CI,
      },
  reporter: "list",
});
