import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';

const page = await readFile(new URL('./index.html', import.meta.url));
const port = Number(process.env.EXAMPLE_PORT ?? 3001);
const serverUrl =
  process.env.EXAMPLE_SERVER_URL ??
  (process.argv.includes('--dev') ? 'http://localhost:5173/' : undefined);
const query = new URLSearchParams(
  serverUrl ? { overrideServerUrl: serverUrl } : {}
);
const server = createServer((request, response) => {
  const { pathname } = new URL(request.url, 'http://localhost');
  if (pathname !== '/' && pathname !== '/index.html') {
    response.writeHead(404, { 'Content-Type': 'text/plain' });
    response.end('Not found');
    return;
  }
  response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  response.end(page);
});

server.on('error', (error) => {
  console.error('[fence-example]', error.message);
  process.exit(1);
});
server.listen(port, '127.0.0.1', () => {
  const url = `http://localhost:${server.address().port}/${query.size ? '?' + query : ''}`;
  console.log(`Fence example ready: ${url}`);
  if (process.argv.includes('--no-open')) return;
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
});
