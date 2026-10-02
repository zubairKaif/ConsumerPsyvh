// @ts-check
const { defineConfig } = require('@playwright/test');

const PORT = 4173;

module.exports = defineConfig({
  testDir: 'tests/e2e',
  timeout: 180000,
  expect: { timeout: 15000 },
  workers: 3,
  reporter: [['list']],
  use: {
    browserName: 'chromium',
    baseURL: `http://localhost:${PORT}/`,
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
    acceptDownloads: true,
  },
  webServer: {
    command: `node scripts/serve.js ${PORT}`,
    url: `http://127.0.0.1:${PORT}/QuikKart_Stimulus_App.html`,
    reuseExistingServer: true,
  },
});
