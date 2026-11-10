// `npm run prints` gera todos os prints; `npm run prints -- radar` só os da tela pedida.
import { spawnSync } from 'node:child_process';

const tela = process.argv[2];
const args = ['playwright', 'test', '-c', 'e2e/playwright.config.ts', 'e2e/prints.spec.ts'];
if (tela) args.push('--grep', `print ${tela} `);
const r = spawnSync('npx', args, { stdio: 'inherit' });
process.exit(r.status ?? 1);
