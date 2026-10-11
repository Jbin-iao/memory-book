# Local-storage release

## Scope

- The root URL serves the journal. `love-story.html` remains available.
- `map-memory.html` opens the journal's footprint section.
- The site ships icons, photograph, map library and map geometry locally.
- No login, cloud-sync or shared-account features are included.
- Private exports, legacy auth pages, demos and test pages are excluded.
- The build recreates `dist/` from an explicit file allowlist.

## Data

Records and photos use the browser's localStorage. Browser profile, protocol,
hostname and port determine the storage location. Moving from a local preview
to the live site does not transfer existing records automatically. Export from
the old address and import at the new address. Different paths on the same
origin share storage. Exported JSON contains private text and photos.

## Publishing

The original working folder contains unrelated material. Prepare a clean source
checkout with `node scripts/prepare-release.mjs`; use `.publish/memory-book/`
for GitHub commits and pushes. Do not publish the original folder wholesale.

GitHub Actions runs the storage test, syntax check and build before deploying
only `dist/` to Pages. GitHub supplies HTTPS. After a deployment, verify the root
URL, legacy map URL, photos, map rendering and refresh persistence.

## Verification (2026-10-11)

- Node storage tests passed: save/delete, photo backup round trip, duplicate
  import, invalid import atomicity, quota preservation and legacy migration.
- Desktop browser: empty state, image and map loading, photo upload, save,
  refresh persistence, editing, deletion, export and import passed.
- Mobile viewport checks and deployment result are recorded after final QA.
