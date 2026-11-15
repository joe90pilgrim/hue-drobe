# Deploy to Google Cloud (MVP-10)

Puts the app on **Cloud Run** behind one shared username and password (HTTP basic auth, HTTPS only). Basic auth is a stop-gap until there are individual logins.

- `server.mjs` is a small static server with no dependencies. It asks for the password on every request, including the manifest, service worker and avatar files.
- `deploy.mjs` builds the app, copies the avatar pack in from `private/pack/joe/` (never committed), and runs `gcloud run deploy`.
- `set-password.mjs` stores the password in Secret Manager. The password is typed at a hidden prompt and never appears in the repo.
- Staging goes in `deploy/out/` (git-ignored).

## One-off setup

Needs the [Google Cloud CLI](https://cloud.google.com/sdk/docs/install) and a project with billing on. From the repo root:

```bash
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
node deploy/set-password.mjs
```

Use a long password (16 or more characters, the script insists). Cloud Run is the only thing between the internet and your avatar.

## Deploy (and redeploy)

```bash
node deploy/deploy.mjs
```

It prints the service URL at the end. Defaults: region `europe-west2` (London), service `huedrobe`, username `huedrobe`, at most one instance, 256 MiB. Change them with `--region`, `--service`, `--user` and `--project`.

To change the password, run `set-password.mjs` again, then redeploy.

## Try it locally first

```bash
node deploy/deploy.mjs --stage-only
```

then, in PowerShell: `$env:BASIC_AUTH_PASSWORD='something'; node deploy/out/server.mjs` (bash: `BASIC_AUTH_PASSWORD=something node deploy/out/server.mjs`) and open http://localhost:8080 (user `huedrobe`).

## Tests

`node --test deploy/server.test.mjs` (also part of `npm run check`) covers the password check, wrong and missing passwords on every path including the avatar files, path traversal, and the https redirect.

## Basic auth and the installed app

- The manifest link has `crossorigin="use-credentials"`. Without it the browser fetches the manifest without the password, gets a 401, and the app cannot be installed.
- The service worker (`app/vite.config.ts`) caches the built files and the avatar pack. Pages and the pack are fetched from the server first, so a redeploy shows up and the browser can ask for the password; the cache is only the offline fallback.
- After you have installed the app, opening it offline never asks for the password.
