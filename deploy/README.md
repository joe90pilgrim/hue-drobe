# Deploy to Google Cloud (MVP-10, V2-05)

Puts the app on **Cloud Run** behind **Identity-Aware Proxy (IAP)**. Google does the sign-in in front of the app, and only two Google accounts, Joe's and B's, are let in. Each person's avatar files are served only to that person.

- `server.mjs` is a small static server with no dependencies. On every request (page, manifest, service worker, avatar files) it checks IAP's signed header (`x-goog-iap-jwt-assertion`: ES256, Google's published keys, audience, issuer, expiry) and its own allow list. So it fails closed even if IAP's access list were ever widened. Someone else's avatar pack returns 404. `GET /api/me` returns `{"person": "joe"}` or `{"person": "b"}` for the app (used from V2-06).
- `deploy.mjs` builds the app, copies each person's pack in from `private/pack/<person>/` (never committed): every `.glb` and `manifest.json` there, after checking the core files exist (`pack-files.mjs`; `pack-files.test.mjs` stops the lists drifting) and printing which optional files went in and which are absent, deploys with IAP on, and grants access to the emails in `private/users.json` (never committed).
- Staging goes in `deploy/out/` (git-ignored).

- `datastore.mjs` holds each person's synced data (V2-06b): Firestore on Cloud Run, a JSON file for local trials, memory for tests. `GET /api/data` returns the signed-in person's data and `PUT /api/data/{key}` writes one key. The person always comes from IAP's signed header, never from the request.
- `firestore-setup.mjs` is run by `deploy.mjs`: it creates the Firestore database, deploys rules that refuse everything, and makes the server's own service account.

The server makes two kinds of outgoing call: it fetches Google's IAP public keys from `https://www.gstatic.com/iap/verify/public_key-jwk` about once an hour, and it reads and writes Firestore (`firestore.googleapis.com`) with a token from Cloud Run's metadata server.

- `identify.mjs` (V4-01) is `POST /api/identify`: the app sends one shrunk garment photo and the list of garments it ships, the server makes one Gemini call (structured JSON) and returns `{ templateId, variant, hexColor, confidence }`, checked against the list. The photo is held in memory for the request only: never written, logged or sent back. Only the signed-in people can call it, from the app's own pages. From V4-02 the image may also be a crop of a retailer's product page (made on the phone, so only the chosen part is sent); the prompt tells Gemini to ignore page text, prices and other products, and to describe the garment, not a model wearing it (V4-00, amended 22 Nov 2026).

- `packing.mjs` (V6-01) is `POST /api/packing-template`: the app sends a trip name, its two dates (up to 90 days) and, only if the colour quiz is complete, the season name and its palette as hex colours. The server makes one Gemini call (structured JSON, text only) and returns `{ items: [{ label, quantity?, group? }] }`. It refuses a request that is not from a signed-in person on the app's own pages, is not JSON, is over 4 KB, or has anything beyond those fields. It refuses a model answer that is not JSON, is empty or over 60 lines, or has a line that is blank, over 40 characters (group over 24), or holds control characters, markup or a web address; the app then shows a plain message and the trip is unchanged. The trip name is quoted in the prompt as data. Nothing is written to disk, and the error log holds neither the trip, the dates, the palette nor the answer. No photos, measurements or wardrobe contents are sent (V4-00, amended 23 Nov 2026).

## Gemini key (V4-01, also used by V6-01)

Get an API key from [Google AI Studio](https://aistudio.google.com/apikey) and save it as `private/gemini-key.txt` (git-ignored, one line). `deploy.mjs` puts it in the service's environment as `GEMINI_API_KEY` (never in the app bundle or the repo). Without the file the deploy works as before, "Add from photo" shows that matching is not switched on, and "Make me a template" on a trip says the same (both routes are 404). There is no spending cap in the app; none is set for now (Joe, 23 Nov 2026), so set a budget alert in Google Cloud if that changes. The model is `gemini-flash-latest` (Google's own alias for its current Flash model) unless `GEMINI_MODEL` is set. `gemini-2.5-flash` appears in the model list but answers 404, so it is not used.

## One-off setup

Needs the [Google Cloud CLI](https://cloud.google.com/sdk/docs/install) and a project with billing on.

1. Copy `deploy/users.example.json` to `private/users.json` and put in the two Google email addresses. The keys (`joe`, `b`) must match the folders in `private/pack/`.
2. Sign in to gcloud and pick the project:

   ```bash
   gcloud auth login
   ```

   ```bash
   gcloud config set project YOUR_PROJECT_ID
   ```

3. Deploy (below). This turns IAP on, but in a project that is not part of an organisation, IAP has no OAuth client yet. Opening the app shows "Empty Google Account OAuth client ID(s) secret(s)" until step 4 is done. Until then nobody can get in, which is the safe way round.
4. **Give IAP an OAuth client (one-off, by hand).** Google cannot create it from the command line in a project without an organisation. Do this in the Console, signed in as the same account gcloud uses, on your project. A new project may not be under **Recent** in the project picker: search for it, or add `?project=YOUR_PROJECT_ID` to the links below.
   1. **Sign-in screen:** go to [Google Auth Platform, Branding](https://console.cloud.google.com/auth/branding) and click **Get started**. Give an app name ("Hue-drobe") and a support email, set **Audience** to **External**, then click **Create**. If it says "Testing", click **Publish app** under **Audience**. It only asks for name and email, so Google does not need to review it. Who can get in is still the two-person list.
   2. **Client:** go to [Credentials](https://console.cloud.google.com/apis/credentials), click **Create credentials**, then **OAuth client ID**, and choose **Web application**. Copy the client ID and secret. Under **Authorized redirect URIs**, add `https://iap.googleapis.com/v1/oauth/clientIds/CLIENT_ID:handleRedirect` with your client ID in place of `CLIENT_ID`, then click **Save**.
   3. **Give it to IAP:** save the following as `private/iap-oauth.yaml` (git-ignored, so the secret never reaches the repo), with your client ID and secret in place of the capitals:

      ```yaml
      accessSettings:
        oauthSettings:
          clientId: CLIENT_ID
          clientSecret: CLIENT_SECRET
      ```

      then run:

      ```bash
      gcloud iap settings set private/iap-oauth.yaml --resource-type=cloud-run --region=europe-west2 --service=huedrobe
      ```

      IAP keeps its own copy of the secret, so you can delete the file afterwards.
   4. Open the app URL in a private window. You should see the Google sign-in, then the app.

## Deploy (and redeploy)

```bash
node deploy/deploy.mjs
```

Each run:

1. Builds and stages the app.
2. Sets up Firestore (`firestore-setup.mjs`): turns on its APIs, creates the `(default)` database in the region if missing (native mode; the region cannot change later), deploys deny-all security rules, and makes the `huedrobe-run` service account with only the Firestore read and write role (`roles/datastore.user`). It then checks that Firestore refuses a request without credentials, and stops if not.
3. Turns on the IAP and Cloud Resource Manager APIs (the IAP access commands need the second), then deploys with `--iap --no-allow-unauthenticated`, as `huedrobe-run`, with `FIRESTORE_PROJECT` set, and drops the old basic-auth password secret from the service.
4. Lets IAP's service agent call the service, and removes the MVP's "anyone may call" setting.
5. Gives the two emails the "IAP-secured Web App User" role.
6. Sets sign-in to expire after 30 days.
7. Prints who may sign in. Check that the list shows exactly two users.

Defaults: region `europe-west2` (London), service `huedrobe`, at most one instance, 256 MiB. Change them with `--region`, `--service` and `--project`.

The 30-day setting is made at project level (`gcloud iap settings set --resource-type=iap_web`). To check it: `gcloud iap settings get --resource-type=iap_web`.

### Removing someone, and cleaning up after the MVP

`deploy.mjs` only adds people. To remove one, delete them from `private/users.json` and run:

```bash
gcloud iap web remove-iam-policy-binding --member=user:EMAIL --role=roles/iap.httpsResourceAccessor --region=europe-west2 --resource-type=cloud-run --service=huedrobe
```

Once logins work, the MVP's password secret is no longer used. You can delete it:

```bash
gcloud secrets delete huedrobe-password
```

## Try it locally first

```bash
node deploy/deploy.mjs --stage-only
```

then, in PowerShell:

```powershell
$env:LOCAL_PERSON='joe'; $env:ALLOWED_USERS=(Get-Content private/users.json -Raw); node deploy/out/server.mjs
```

and open http://localhost:8080. `LOCAL_PERSON` skips the sign-in and acts as that person. The server refuses it on Cloud Run. Synced data goes to `deploy/out/data.json` (git-ignored), not Firestore.

## Tests

`node --test deploy/server.test.mjs deploy/sync.test.mjs deploy/identify.test.mjs deploy/packing.test.mjs` (also part of `npm run check`). It uses a key pair made in the test in place of Google's keys, and synthetic emails. It covers:

- good, forged, expired, wrong-audience, wrong-issuer and `alg` swapped tokens
- strangers and missing sign-in on every path, including the avatar files
- each person's pack hidden from the other, including `..` tricks
- key refresh, path traversal and the https redirect
- the photo call (`identify.test.mjs`, Gemini replaced by a stand-in): template list and photo checks, the request and its schema, answers checked against the list, the key kept out of the address and replies, nothing written to disk, strangers and other sites refused
- the packing template (`packing.test.mjs`, Gemini replaced by a stand-in): request checks (name, dates, season and palette together or not at all, extra fields dropped), the palette reaching Gemini only when sent, answers refused when malformed or unsafe, the key kept out of the address and replies, no trip details in replies or logs, strangers, other sites, non-JSON and oversized bodies refused, 404 without a key
- synced data (`sync.test.mjs`): each person reads and writes only their own, unknown keys, other sites, non-JSON and oversized values refused, last write wins with clashes logged, a failing store, and the Firestore REST calls checked against a stand-in

## Signing in and the installed app

- The manifest link has `crossorigin="use-credentials"`. Without it the browser fetches the manifest without the sign-in cookie, IAP turns it away, and the app cannot be installed.
- The service worker (`app/vite.config.ts`) caches the built files and the avatar pack. Pages and the pack are fetched from the server first, so a redeploy shows up and an expired sign-in sends you to Google. The cache is only the offline fallback.
- After you have installed the app, opening it offline never asks you to sign in.
