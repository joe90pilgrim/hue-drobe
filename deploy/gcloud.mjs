// Shared helper: runs gcloud (or any command) from Node, working in PowerShell and bash alike.
import { spawnSync } from 'node:child_process';

/** Runs a command and returns { status, stdout }. On Windows gcloud and npm are .cmd files, which need a shell. */
export function run(cmd, args, { input, inherit = true, quietErrors = false } = {}) {
  const r = spawnSync(cmd, args, {
    input,
    encoding: 'utf8',
    shell: process.platform === 'win32',
    stdio: [input === undefined ? 'inherit' : 'pipe', inherit ? 'inherit' : 'pipe', quietErrors ? 'pipe' : 'inherit'],
  });
  if (r.error) {
    console.error(`Could not run ${cmd}: ${r.error.message}`);
    return { status: 1, stdout: '' };
  }
  return { status: r.status ?? 1, stdout: r.stdout ?? '' };
}

/** Runs gcloud and returns its trimmed output, or null if it failed. */
export function gcloudValue(args) {
  const r = run('gcloud', args, { inherit: false });
  return r.status === 0 ? r.stdout.trim() : null;
}

/** The project to use: --project, else HUEDROBE_GCP_PROJECT, else gcloud's current project. */
export function resolveProject(flags) {
  const p = flags.project ?? process.env.HUEDROBE_GCP_PROJECT ?? gcloudValue(['config', 'get-value', 'project', '--quiet']);
  if (!p || p === '(unset)') {
    console.error('No Google Cloud project. Pass --project <id>, set HUEDROBE_GCP_PROJECT, or run: gcloud config set project <id>');
    process.exit(1);
  }
  return p;
}

/** Parses "--name value" pairs and "--flag" switches. */
export function parseFlags(argv) {
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) continue;
    const key = argv[i].slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) flags[key] = true;
    else flags[key] = argv[++i];
  }
  return flags;
}

export const DEFAULTS = { region: 'europe-west2', service: 'huedrobe' };
