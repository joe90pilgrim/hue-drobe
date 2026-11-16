# Screenshots

Every screen of the app at phone (412 x 915, 2x) and desktop (1280 x 800). Files are named `<size>-<order>-<screen>.png`.

The avatar stage is empty on purpose: the script blocks the private avatar pack so Joe's body shape never enters a committed image.

Regenerate from the repo (start the dev server first):

```bash
npm --prefix app run dev -- --port 5174
node app/scripts/screenshots.mjs http://localhost:5174
```
