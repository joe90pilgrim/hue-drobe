// One-off setup: stores the shared password in Secret Manager and lets Cloud Run read it.
// Run from the repo root:  node deploy/set-password.mjs [--project id]
// Run it again to change the password, then redeploy. The password is typed at a hidden prompt, so it is never
// in the repo, on the command line or in shell history.
import { DEFAULTS, gcloudValue, parseFlags, resolveProject, run } from './gcloud.mjs';

const flags = parseFlags(process.argv.slice(2));
const secret = flags.secret ?? DEFAULTS.secret;

function askHidden(question) {
  return new Promise((resolve) => {
    process.stdout.write(question);
    const stdin = process.stdin;
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    let text = '';
    const onData = (chunk) => {
      for (const c of chunk) {
        if (c === '\r' || c === '\n') {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.off('data', onData);
          process.stdout.write('\n');
          return resolve(text);
        }
        if (c === '\u0003') process.exit(1); // Ctrl+C
        if (c === '\u007f' || c === '\b') text = text.slice(0, -1);
        else text += c;
      }
    };
    stdin.on('data', onData);
  });
}

if (!process.stdin.isTTY) {
  console.error('Run this in a terminal so the password can be typed at a hidden prompt.');
  process.exit(1);
}
const project = resolveProject(flags);
const password = await askHidden('New password (at least 16 characters, hidden): ');
if (password.length < 16) {
  console.error('Too short. This is the only thing between the internet and your avatar: use 16 or more characters.');
  process.exit(1);
}
if ((await askHidden('Type it again: ')) !== password) {
  console.error('The two did not match.');
  process.exit(1);
}

console.log(`Enabling the services Cloud Run needs in ${project} (can take a minute the first time)`);
let r = run('gcloud', ['services', 'enable', 'run.googleapis.com', 'cloudbuild.googleapis.com', 'artifactregistry.googleapis.com', 'secretmanager.googleapis.com', '--project', project]);
if (r.status !== 0) process.exit(1);

const exists = gcloudValue(['secrets', 'describe', secret, '--project', project, '--format=value(name)']);
if (!exists) {
  r = run('gcloud', ['secrets', 'create', secret, '--replication-policy=automatic', '--project', project]);
  if (r.status !== 0) process.exit(1);
}
// The password goes in on standard input, not on the command line.
r = run('gcloud', ['secrets', 'versions', 'add', secret, '--data-file=-', '--project', project], { input: password });
if (r.status !== 0) process.exit(1);

// Cloud Run runs as the project's default compute service account unless told otherwise.
const number = gcloudValue(['projects', 'describe', project, '--format=value(projectNumber)']);
if (!number) process.exit(1);
r = run('gcloud', ['secrets', 'add-iam-policy-binding', secret, '--project', project,
  `--member=serviceAccount:${number}-compute@developer.gserviceaccount.com`, '--role=roles/secretmanager.secretAccessor']);
process.exit(r.status);
