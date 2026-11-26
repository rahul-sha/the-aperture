# Project rules: The Aperture

Rules for this project only. They add to, or override, the shared rules from the Cartographer plugin (`DESIGN.md` and the shared skills). Claude Code loads this file automatically because it sits in `.claude/rules/`.

Cartographer plugin: 0.35.1 (the version this project last took in; the setup-project skill sets it, and the version check compares it at the start of each session)

Keep each rule to one line, with the reason after a colon. Tag each one so the weekly review can sort it.

## Adds
Rules the shared base does not cover.

- [design] Use the `frontend-design` skill for visual work and never the `rahulll-design-rules` skill: the portfolio has its own design (Drift), separate from rahulll.com.
- [design] Read `docs/DESIGN-SYSTEM.md` before any visual change and update it in the same pull request: it is the project's design system file.
- [design] Photos keep their real aspect ratio everywhere: cropping changes Rahul's compositions.
- [design] No footer, no photo counts on the page, and no scroll snapping: Rahul tried snapping and it jerked.
- [design] Pink means "here" or "now" and nothing else: it is the only accent in the palette.
- [data] Exact GPS never leaves Immich; the site shows only a place name and the manifest only coarse grid counts: privacy for Rahul and the places he photographs.
- [data] Do not add an "Email me" link unless Rahul gives a real address: he asked for it removed on 2026-10-28.
- [workflow] When site changes ship, also update the behind the scenes page (no system names), the build map, and the Trilium notes under Vibe Coding Projects: Rahul's standing request from 2026-10-29.
- [deploy] A change to the sync script needs merge, the GitHub image build (about 3 minutes), then "Pull + recreate" on the Dockhand stack; site-only changes need only the merge: the sync runs on the NAS, not on Vercel.
- [testing] Run `npm test` (it builds first) before asking for review, and use `npm test` rather than the webapp-testing helper script: the helper leaves a stale server on port 3000.
- [safety] Settings that hold secrets (`IMMICH_API_KEY`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`) live only in the Dockhand stack or a local `.env`: the repository is public.

## Overrides
Rules that replace a shared one for this project. Name the shared rule being replaced.

- [design] Overrides DESIGN.md section 3 (light and dark): the site stays dark in both modes: the design is a walk through a dark space, and it tells the browser it is dark.
- [design] Overrides DESIGN.md section 5 (heavy libraries load only where needed): three.js loads for the walk, which is the whole home page: the walk is the site; there is a no-WebGL fallback to All photos.

## Tags
Use one of: `design`, `workflow`, `safety`, `testing`, `writing`, `deploy`, `data`.
