# Sync release notes

What changed in the photo sync (the container `ghcr.io/rahul-sha/the-aperture-sync` that runs on the NAS). The site itself is not listed here.

When a change to the sync is ready, add a new section at the top with a higher version number: raise the last number for a fix, the middle one for something new, and the first for a change that needs the Dockhand stack edited. After the merge, GitHub builds the image, tags it with that number, and publishes these notes as a release. Dockhand's release notes icon opens that release.

## 1.1.0 (2026-11-27)

- Dockhand's release notes icon now opens these notes instead of a missing GitHub page.
- Each image is labelled with where it comes from, its version, and the code it was built from.
- Images are now tagged with their version number (for example `1.1.0`) as well as `latest`.
- Nothing about the sync itself changed: same albums, same settings, same photos.

## 1.0.0 (2026-11-26)

The first numbered version, covering everything since the sync began on 27 October 2026.

- Copies the photos in your "Portfolio - ..." Immich albums to Cloudflare R2 as web-sized versions, with all location and camera data removed.
- Gives untitled photos a "City, Month Year" title, and shows only a place name, never exact GPS.
- Uploads a photo into every section it belongs to, and removes photos you take out of an album.
- Explains an empty album instead of crashing, and works with newer Immich versions that list album photos differently.
- Runs once and stops, as a small container with only what the sync needs, and Debian's latest security updates applied when it is built.
