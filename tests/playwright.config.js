const {defineConfig} = require('@playwright/test');
module.exports = defineConfig({
  testDir: '.', testMatch: 'smoke.spec.js', timeout: 20000, workers: 1,
  reporter: [['list']], outputDir: 'artifacts/smoke',
  projects: ['chromium', 'webkit'].flatMap(browserName => [390, 360].map(width => ({
    name: browserName + '-' + width,
    use: {browserName, viewport: {width, height: width === 390 ? 844 : 640},
      launchOptions: browserName === 'chromium' ? {
        executablePath: process.env.SDP_BROWSER_BIN,
        args: ['--no-sandbox', '--disable-dev-shm-usage']
      } : {}}
  })))
});
