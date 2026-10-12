/**
 * Builds the class exercise apps into public/atlas/<slug>/ so the Guixu site serves them
 * as atlas entries (https://guixu-yt684.web.app/atlas/class03/ ...).
 * Run before `npm run build` when the class apps change:  npm run atlas
 * The output is generated, so public/atlas/ is git-ignored.
 */
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '../..');
const out = resolve(here, '../public/atlas');

const APPS = ['class03', 'class04', 'class05', 'class06', 'class07'];

for (const slug of APPS) {
  const app = resolve(repo, `class_${slug.slice(5)}/react-app-ts`);
  if (!existsSync(resolve(app, 'node_modules'))) execSync('npm install', { cwd: app, stdio: 'inherit' });
  console.log(`\n▸ ${slug}`);
  execSync(`npx vite build --base /atlas/${slug}/ --outDir "${resolve(out, slug)}" --emptyOutDir --logLevel warn`, { cwd: app, stdio: 'inherit' });
}
console.log(`\nAtlas apps written to ${out}`);
