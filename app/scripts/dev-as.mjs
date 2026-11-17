// Starts the dev server as a given person, the same on PowerShell, Git Bash and cmd: node scripts/dev-as.mjs b
// The dev server answers /api/me as this person and serves private/pack/<person>/ (app/vite.config.ts).
import { spawn } from 'node:child_process';

const who = process.argv[2] ?? 'joe';
console.log(`Dev server as '${who}'`);
const child = spawn(['npx', 'vite', '--host', ...process.argv.slice(3)].join(' '), {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, LOCAL_PERSON: who },
});
child.on('exit', (code) => process.exit(code ?? 0));
