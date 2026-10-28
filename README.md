# Memory Book

Live site: https://jbin-iao.github.io/memory-book/

A personal memory journal with photos, a timeline and a province-level map.
Supabase provides account login and cloud sync; signed-out use falls back to the current browser.
JSON export/import includes photos and can transfer records between devices.
Search, tags, favorites, a monthly calendar, On This Day memories, and local draft recovery are available.
Cloud sync uses three-way merging and preserves conflicting edits; accounts have separate local storage.
See [upgrade notes](docs/UPGRADE.md) for migration behavior and verification.
Clearing browser data removes local records; export a backup regularly.

## Preview

Requires Node.js 24. No package installation is needed.

```sh
node tests/record-store.test.cjs
node tests/sync.test.cjs
node scripts/build.mjs
node scripts/preview.mjs
```

Open http://127.0.0.1:4173/ . Set `PORT` to choose another port.

## Publish

GitHub Pages uses `.github/workflows/pages.yml` on pushes to `main`.
In repository Settings > Pages, select GitHub Actions as the source.
Only the generated `dist/` directory is deployed.

When working in the original mixed project folder, run
`node scripts/prepare-release.mjs` and commit/push from `.publish/memory-book/`.
That directory contains only the approved source files, not private exports or
obsolete pages. See [release notes](docs/RELEASE.md).

For Supabase setup, database RLS, auth redirects and China network checks, see
[SUPABASE_SETUP.md](SUPABASE_SETUP.md).

## Assets

Lucide 0.468.0 (ISC) and ECharts 5.4.3 (Apache-2.0) retain their bundled license
notices. Province geometry comes from Alibaba DataV's `100000_full.json`.
The empty-state photograph is Unsplash `photo-1441974231531-c6227db76b6e`.
