// Bundle OverlayScrollbars' base styles (MIT, license header kept) with the
// package styles so applications import a single `style.css`.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const overlay = await readFile(require.resolve('overlayscrollbars/overlayscrollbars.css'), 'utf8');
const own = await readFile(resolve(root, 'src/next/style.css'), 'utf8');
await mkdir(resolve(root, 'dist'), { recursive: true });
await writeFile(resolve(root, 'dist/style.css'), `${overlay.trim()}\n\n${own.trim()}\n`);
