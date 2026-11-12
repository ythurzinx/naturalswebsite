import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/browser",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  forbidOnly: !!process.env.CI,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3217",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
      : {},
  },
  projects: [
    {
      name: "mobile-360",
      use: {
        browserName: "chromium",
        viewport: { width: 360, height: 800 },
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: "mobile-390",
      use: {
        browserName: "chromium",
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: "desktop",
      use: { browserName: "chromium", viewport: { width: 1280, height: 900 } },
    },
  ],
  webServer: {
    command: "npm start -- --port 3217",
    url: "http://127.0.0.1:3217/api/health",
    reuseExistingServer: false,
    timeout: 45000,
    env: {
      APP_URL: "https://loja.example",
      DATABASE_URL: "",
      MERCADOPAGO_ACCESS_TOKEN: "",
      MERCADOPAGO_TEST_ACCESS_TOKEN: "",
      MERCADOPAGO_WEBHOOK_SECRET: "",
      ADMIN_PASSWORD_HASH: "",
      ADMIN_SESSION_SECRET: "",
      ADMIN_TOTP_SECRET: "",
    },
  },
});
