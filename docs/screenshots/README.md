# Screenshots

Every screen of the app at phone (412 x 915, 2x) and laptop (1280 x 800). Files are named `<size>-<order>-<screen>.png`, where size is `phone` or `laptop`.

The avatar stage is empty on purpose: the script blocks the private avatar pack so Joe's body shape never enters a committed image. The stage's "couldn't load" line is hidden too, so the empty stage looks as it should.

Regenerate from the repo (start the dev server first):

```bash
npm --prefix app run dev -- --port 5174
node app/scripts/screenshots.mjs http://localhost:5174
```

To compare with the design files, which are 390 × 844 at 1x, pass a folder and the size: `node app/scripts/screenshots.mjs http://localhost:5174 <folder> 390x844`.
