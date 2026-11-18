# Bugs

Known bugs and gaps in The Aperture, newest first. The Cartographer weekly review reads this file, so the helper can answer "any open bugs?" from any project. Add bugs here, not in GitHub issues; a copy in Trilium is for safekeeping only.

Move a bug to "Fixed" in the same pull request as its fix, and add one line on what fixed it.

## Open

| Found | Bug | Where | Notes |
| --- | --- | --- | --- |
| 2026-10-27 | Pull request previews and local builds without `PHOTOS_MANIFEST_URL` show the old committed photos, not the Immich albums | `content/photos.json`, Vercel previews | Expected fallback, but it can look like a bug when reviewing a preview |
| 2026-10-27 | New photos take up to an hour to appear after a sync | `lib/photos.js` (manifest cache) | The site re-reads the manifest at most once an hour; a shorter cache is on the roadmap |

## Fixed

| Fixed | Bug | What fixed it |
| --- | --- | --- |
| 2026-10-29 | Floating photos jumped slightly when they landed back in the walk | PR #19: photos land exactly where they stay |
| 2026-10-28 | The walk stuttered on phones | PR #15: walk sized to the small viewport, textures uploaded one per frame, far photos unloaded |
| 2026-10-28 | Browsers that cannot draw 3D had no way to see the photos | PR #13: falls back to All photos |
| 2026-10-27 | The sync crashed when the Overview album was empty | PR #6 |
