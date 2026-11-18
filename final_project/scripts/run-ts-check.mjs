import { createServer } from 'vite';

const [file, ...args] = process.argv.slice(2);
if (!file) throw new Error('Usage: node scripts/run-ts-check.mjs scripts/check-world.ts [args]');
process.argv = [process.argv[0], file, ...args];
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
try {
  await server.ssrLoadModule(`/${file.replaceAll('\\', '/')}`);
} finally {
  await server.close();
}
