# Roadmap: The Aperture

- **Updated:** 2026-11-26

## Now
Being built this week or next. At most three items.
- Nothing in progress. Question for Rahul: which item from "Next" should come first?

## Next
Agreed and waiting for a slot.
- Heat-map tile: shows where Rahul shoots, from the coarse grid counts the sync already writes to the manifest (no exact locations).
- Scheduled sync: new Immich photos reach the site without redeploying the stack by hand. Question for Rahul: nightly on the NAS, or another time?
- Shorter manifest cache: new photos appear sooner than the current one hour.

## Later
Ideas worth keeping, not yet agreed.
- Metering cursor (parked 2026-10-29): mockups at https://claude.ai/artifact/SoCWAc345BsobPACd2dY5L.
- Right-click photo details (parked 2026-10-29): same mockups as above.
- Real email link: only once Rahul has an address he wants on the site.
- Caption writer: fills Immich descriptions automatically, since Rahul prefers not to write them by hand. As an AI feature it will need an on/off switch and a usage limit (shared rule).
- Tailscale for reaching Immich instead of the Synology reverse proxy.
- Repository tidy-up: delete merged branches, set the repository's website link, and decide whether the full-size photos in `assets/zz_categorised-photos` stay in the public repository.

## Done recently
- 2026-11-26: Cartographer updated to 0.35.1 (this pull request).
- 2026-11-26: image publishing limited to `main`, and `/photo-files/` serves photos only (PR #24).
- 2026-11-21: slimmer sync container and Next.js 16.4.6 (PR #23).
- 2026-11-18: Cartographer updated to 0.16.0; `npm test` builds first; README brought up to date (PR #22).
- 2026-11-16: Cartographer set up: project rules, bug list, and roadmap (PR #21).
- 2026-11-02: repeated values worked out from one place (PR #20).
- 2026-10-29: floating photos land exactly where they stay (PR #19); floating photos out of the walk (PR #18).
- 2026-10-29: turning mode dial on right-click (PR #17).
- 2026-10-29: behind the scenes page (PR #16).
- 2026-10-28: custom domains, www.the-aperture.app and photos.the-aperture.app (PR #12).
- 2026-10-28: smoother walk on phones (PR #15), touch and hold for the mode dial (PR #14), performance and accessibility fixes (PR #13).
- 2026-10-28: Drift redesign, the 3D walk (PR #11).

## Decisions
- 2026-10-29: mode dial order is Start, Photos, About, The making of, Socials.
- 2026-10-28: Cloudflare DNS records stay proxied (orange cloud) on purpose.
- 2026-10-28: no "Email me" link until there is a real address.
- 2026-10-27: place names only under photos; exact GPS never leaves Immich.
- 2026-10-27: no scroll snapping: it felt jerky.
