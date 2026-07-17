import { defineConfig, devices } from "@playwright/test";

const port = 3100;
const baseURL = `http://127.0.0.1:${port}`;
const managedServer = process.env.PLAYWRIGHT_MANAGED_SERVER === "1";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  use: {
    baseURL,
    trace: "on-first-retry"
  },
  webServer: managedServer
    ? undefined
    : {
        command:
          process.platform === "win32"
            ? `node node_modules\\next\\dist\\bin\\next dev --port ${port}`
            : `node ./node_modules/next/dist/bin/next dev --port ${port}`,
        url: baseURL,
        reuseExistingServer: false,
        gracefulShutdown: {
          signal: "SIGTERM",
          timeout: 5000
        }
      },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    }
  ]
});
