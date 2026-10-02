// Playwright configuration for the ZOREV theme.
//
//   npx playwright test                              live theme
//   PREVIEW_THEME_ID=1234 npx playwright test        an unpublished draft
//
// Every test navigates through helpers.go(), which appends preview_theme_id
// when set. Requests made from a test's own context share the browser's
// cookies, so the real cart (and the real discount engine) is what gets
// tested — nothing is mocked.
const { defineConfig, devices } = require('@playwright/test');

const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;

module.exports = defineConfig({
  testDir: './specs',
  timeout: 90000,
  expect: { timeout: 15000 },
  fullyParallel: false,
  workers: 1,
  // No automatic retries: a retry doubles the traffic a failing test sends
  // the store, and a pricing failure is a real finding, not noise.
  retries: Number(process.env.RETRIES || 0),
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'report' }]],
  use: {
    baseURL: process.env.BASE_URL || 'https://www.zorev.org',
    ignoreHTTPSErrors: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    actionTimeout: 20000,
    navigationTimeout: 45000,
    ...(proxy ? { proxy: { server: proxy } } : {}),
    launchOptions: { args: ['--ignore-certificate-errors'] },
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'mobile', use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } } },
  ],
});
