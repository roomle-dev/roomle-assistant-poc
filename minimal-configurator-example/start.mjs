// Serves the minimal configurator example page:
//   - serves this directory on port 3000 and opens the browser
//
// Start it with:  npm start   (from the repository root or this directory)
// No browser:     npm start -- --no-open
// Other port:     EXAMPLE_PORT=3001 npm start
// Local Rubens UI: npm run dev  (overrideServerUrl=http://localhost:5173/,
//                  override via EXAMPLE_SERVER_URL)

import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const EXAMPLE_DIR = dirname(fileURLToPath(import.meta.url));
const STATIC_PORT = Number(process.env.EXAMPLE_PORT ?? 3000);
const DEV_SERVER_URL = 'http://localhost:5173/';
const EXAMPLE_SERVER_URL =
  process.env.EXAMPLE_SERVER_URL ??
  (process.argv.includes('--dev') ? DEV_SERVER_URL : undefined);
const EXAMPLE_URL = `http://localhost:${STATIC_PORT}/${
  EXAMPLE_SERVER_URL
    ? `?overrideServerUrl=${encodeURIComponent(EXAMPLE_SERVER_URL)}`
    : ''
}`;
const STATIC_CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};

const serveStatic = (response, pathname) => {
  const relativePath = pathname === '/' ? 'index.html' : pathname.slice(1);
  const filePath = normalize(join(EXAMPLE_DIR, relativePath));
  const contentType = STATIC_CONTENT_TYPES[extname(filePath)];
  if (!filePath.startsWith(EXAMPLE_DIR) || !contentType) {
    response.writeHead(404, { 'Content-Type': 'text/plain' });
    response.end('Not found');
    return;
  }
  readFile(filePath)
    .then((content) => {
      response.writeHead(200, { 'Content-Type': contentType });
      response.end(content);
    })
    .catch(() => {
      response.writeHead(404, { 'Content-Type': 'text/plain' });
      response.end('Not found');
    });
};

const startExampleServer = () =>
  new Promise((resolve, reject) => {
    const server = createServer((request, response) => {
      serveStatic(
        response,
        new URL(request.url, `http://localhost:${STATIC_PORT}`).pathname
      );
    });
    server.on('error', reject);
    server.listen(STATIC_PORT, () => resolve(server));
  });

const openInBrowser = (url) => {
  const command =
    process.platform === 'darwin'
      ? 'open'
      : process.platform === 'win32'
        ? 'cmd'
        : 'xdg-open';
  const args = process.platform === 'win32' ? ['/c', 'start', '', url] : [url];
  const child = spawn(command, args, { stdio: 'ignore', detached: true });
  child.on('error', () => {});
  child.unref();
};

const main = async () => {
  try {
    await startExampleServer();
  } catch (error) {
    if (error.code === 'EADDRINUSE') {
      console.error(
        `[configurator-example] port ${STATIC_PORT} is already in use.`
      );
      console.error(
        '[configurator-example] pick another port: EXAMPLE_PORT=3001 npm start'
      );
    } else {
      console.error(
        '[configurator-example] the example server failed to start',
        error
      );
    }
    process.exit(1);
  }
  console.log('');
  console.log('  Configurator example ready');
  console.log('');
  console.log(`  ➜  Example:  ${EXAMPLE_URL}`);
  console.log('');
  if (!process.argv.includes('--no-open')) {
    openInBrowser(EXAMPLE_URL);
  }
  const shutdown = () => {
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
};

main();
