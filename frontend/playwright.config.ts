import { defineConfig, devices } from '@playwright/test';

// CI 會自己把 MySQL、migrate、後端與 Ollama stub 都起好，並設定 E2E_BASE_URL；
// 本機直接跑時則由 Playwright 自行啟動 vite preview。
const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:4173';
const managesOwnServer = !process.env.E2E_BASE_URL;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false, // 共用同一個資料庫，平行執行會互相干擾
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  // UB-03：跨瀏覽器相容性不能只靠宣稱。CI 預設只跑 Chromium 以控制時間，
  // 設定 E2E_ALL_BROWSERS=1 時再補上 Firefox 與 WebKit。
  projects: process.env.E2E_ALL_BROWSERS
    ? [
        { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
        { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
        { name: 'webkit', use: { ...devices['Desktop Safari'] } },
      ]
    : [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: managesOwnServer
    ? {
        command: 'npm run build && npm run preview -- --port 4173 --strictPort',
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      }
    : undefined,
});
