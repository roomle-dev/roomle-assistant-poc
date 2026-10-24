import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';

const page = await readFile(new URL('./index.html', import.meta.url));
const port = Number(process.env.EXAMPLE_PORT ?? 3001);
const serverUrl =
  process.env.EXAMPLE_SERVER_URL ??
  (process.argv.includes('--dev') ? 'http://localhost:5173/' : undefined);
const args = process.argv
  .slice(2)
  .filter((argument) => !argument.startsWith('--'));
const [model, suppliedKey] = args;
const apiKey = (suppliedKey ?? process.env.OPENAI_API_KEY)?.trim();
if (model && !apiKey) {
  console.error(
    '[fence-example] Missing API key: npm run start:fence -- <model> <api-key>'
  );
  process.exit(1);
}
const assistantConfig = model ? { model, apiKey } : undefined;
const query = new URLSearchParams({
  ...(serverUrl && { overrideServerUrl: serverUrl }),
  ...(assistantConfig && { chat: 'true' }),
});
const server = createServer((request, response) => {
  const { pathname } = new URL(request.url, 'http://localhost');
  if (pathname === '/planning-assistant-config.json' && assistantConfig) {
    const boundPort = server.address().port;
    const allowedHosts = ['localhost', '127.0.0.1', '[::1]'].map(
      (host) => host + ':' + boundPort
    );
    if (
      !['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(
        request.socket.remoteAddress
      ) ||
      !allowedHosts.includes(request.headers.host?.toLowerCase())
    ) {
      response.writeHead(403, { 'Content-Type': 'text/plain' });
      response.end('The model is served to this machine only');
      return;
    }
    response.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    });
    response.end(JSON.stringify(assistantConfig));
    return;
  }
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
