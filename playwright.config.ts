import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 90_000,
  webServer: {
    command: 'npx vite --host 127.0.0.1 --port 5173',
    cwd: 'apps/web',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: true,
    timeout: 180_000,
  },
  use: {
    baseURL: 'http://127.0.0.1:5173',
  },
});
