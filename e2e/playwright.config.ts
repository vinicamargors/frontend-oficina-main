import { defineConfig } from '@playwright/test';
import { chromium } from '@playwright/test';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const PORTA = 5179;

/** Só aponta para o Chromium pré-instalado quando o do Playwright não existe (nunca rodamos `playwright install`). */
function executavelDeFallback(): string | undefined {
  if (existsSync(chromium.executablePath())) return undefined;
  const raiz = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
  const candidatos = [join(raiz, 'chromium', 'chrome-linux64', 'chrome')];
  if (existsSync(raiz)) {
    for (const d of readdirSync(raiz).filter((n) => /^chromium-\d+$/.test(n))) {
      candidatos.push(join(raiz, d, 'chrome-linux64', 'chrome'));
    }
  }
  return candidatos.find((c) => existsSync(c));
}

const executablePath = executavelDeFallback();

const base = {
  baseURL: `http://localhost:${PORTA}`,
  trace: 'off' as const,
  screenshot: 'off' as const,
  video: 'off' as const,
  deviceScaleFactor: 1,
  locale: 'pt-BR',
  timezoneId: 'America/Sao_Paulo',
  launchOptions: executablePath ? { executablePath } : {},
};

export default defineConfig({
  testDir: '.',
  testMatch: /.*\.spec\.ts/,
  outputDir: '../test-results',
  reporter: [['list']],
  fullyParallel: true,
  retries: 0,
  timeout: 45_000,
  expect: { timeout: 8_000 },
  use: base,
  webServer: {
    command: `npx vite --port ${PORTA} --strictPort`,
    cwd: '..',
    url: `http://localhost:${PORTA}`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    env: {
      VITE_SUPABASE_URL: 'http://mock.supabase.local',
      VITE_SUPABASE_ANON_KEY: 'mock',
      VITE_API_URL: 'http://mock.api.local/api/v1',
    },
  },
  projects: [
    { name: 'claro-1440', use: { viewport: { width: 1440, height: 900 }, colorScheme: 'light' } },
    { name: 'escuro-1440', use: { viewport: { width: 1440, height: 900 }, colorScheme: 'dark' } },
    { name: 'claro-390', use: { viewport: { width: 390, height: 844 }, colorScheme: 'light', isMobile: false, hasTouch: true } },
    { name: 'escuro-390', use: { viewport: { width: 390, height: 844 }, colorScheme: 'dark', isMobile: false, hasTouch: true } },
  ],
});
