import { copyFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = resolve(root, '.publish/memory-book');
const files = [
  'index.html', 'love-story.html', 'map-memory.html', 'auth-modern.html', 'README.md', '.gitignore',
  'assets/book-open.svg', 'assets/memory-cover.jpg', 'assets/china-regions.json',
  'assets/css/journal.css', 'assets/css/modern-auth.css', 'assets/js/journal.js', 'assets/js/record-store.js', 'assets/js/modern-auth.js',
  'assets/js/supabase.min.js', 'assets/js/supabase-config.js',
  'assets/js/lucide.min.js', 'assets/js/echarts.min.js',
  'scripts/build.mjs', 'scripts/preview.mjs', 'scripts/prepare-release.mjs',
  'tests/record-store.test.cjs', 'tests/sync.test.cjs', 'tests/browser-smoke.mjs', '.github/workflows/pages.yml', 'docs/RELEASE.md', 'docs/UPGRADE.md'
];
for (const file of files) {
  const target = resolve(output, file);
  await mkdir(dirname(target), { recursive: true });
  await copyFile(resolve(root, file), target);
}
console.log(`Prepared ${files.length} source files in .publish/memory-book/`);
