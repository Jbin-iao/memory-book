import { copyFile, mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = resolve(root, 'dist');
const files = [
  'love-story.html', 'map-memory.html', 'auth-modern.html',
  'assets/book-open.svg', 'assets/memory-cover.jpg', 'assets/china-regions.json',
  'assets/css/journal.css', 'assets/css/modern-auth.css', 'assets/js/journal.js', 'assets/js/record-store.js', 'assets/js/modern-auth.js',
  'assets/js/supabase.min.js', 'assets/js/supabase-config.js',
  'assets/js/lucide.min.js', 'assets/js/echarts.min.js'
];

// Publish an explicit allowlist so private exports and obsolete pages stay local.
await rm(output, { recursive: true, force: true });
for (const file of files) {
  const target = resolve(output, file);
  await mkdir(dirname(target), { recursive: true });
  await copyFile(resolve(root, file), target);
}
await copyFile(resolve(root, 'love-story.html'), resolve(output, 'index.html'));
await writeFile(resolve(output, '.nojekyll'), '');
console.log(`Built ${files.length + 2} public files in dist/`);
