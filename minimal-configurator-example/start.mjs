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
const PLANNING_ASSISTANT_CONFIG_PATH = '/planning-assistant-config.json';

const MODEL_ALIASES = {
  mistral: ['mistral', 'mistral-large-latest'],
  'mistral-medium': ['mistral', 'mistral-medium-latest'],
  'mistral-large': ['mistral', 'mistral-large-latest'],
  claude: ['anthropic', 'claude-sonnet-4-5'],
  gemini: ['google', 'gemini-2.5-pro'],
};
const args = process.argv.slice(2).filter((arg) => !arg.startsWith('--'));
const parseConfig = () => {
  if (!args.length) return undefined;
  const [name, apiKey] = args;
  const alias = MODEL_ALIASES[name];
  const provider =
    alias?.[0] ??
    (name.startsWith('mistral-')
      ? 'mistral'
      : name.startsWith('claude-')
        ? 'anthropic'
        : name.startsWith('gemini-')
          ? 'google'
          : name === 'azure'
            ? 'azure'
            : undefined);
  if (!provider) throw new Error('Unsupported model: ' + name);
  if (!apiKey) throw new Error('Missing API key: npm start <model> <api-key>');
  const model = process.env.CONFIGURATOR_CHAT_MODEL || alias?.[1] || name;
  const baseUrl = process.env.AZURE_BASE_URL;
  if (provider === 'azure' && !baseUrl)
    throw new Error(
      'Set AZURE_BASE_URL and CONFIGURATOR_CHAT_MODEL for an Azure deployment.'
    );
  return {
    provider,
    model,
    apiKey,
    readsImages: false,
    ...(baseUrl && provider === 'azure' && { baseUrl }),
  };
};
let chatConfig;
try {
  chatConfig = parseConfig();
} catch (error) {
  console.error('[configurator-example]', error.message);
  process.exit(1);
}
const query = new URLSearchParams({
  ...(chatConfig && { chat: 'true' }),
  ...(EXAMPLE_SERVER_URL && { overrideServerUrl: EXAMPLE_SERVER_URL }),
});
const EXAMPLE_URL =
  'http://localhost:' + STATIC_PORT + '/' + (query.size ? '?' + query : '');
const STATIC_CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};
const LOOPBACK_ADDRESSES = ['127.0.0.1', '::1', '::ffff:127.0.0.1'];
// The authorities the page has on this machine. Another Host is a site whose
// name resolves to this machine (DNS rebinding), which must not read the key.
const LOOPBACK_HOSTS = ['localhost', '127.0.0.1', '[::1]'].map(
  (host) => `${host}:${STATIC_PORT}`
);

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

// The model with its API key, for the page on this machine only.
const servePlanningAssistantConfig = (request, response) => {
  if (!chatConfig) {
    response.writeHead(404, { 'Content-Type': 'text/plain' });
    response.end(
      'No model - start the example with npm start <model> <api-key>'
    );
    return;
  }
  if (
    !LOOPBACK_ADDRESSES.includes(request.socket.remoteAddress) ||
    !LOOPBACK_HOSTS.includes(request.headers.host?.toLowerCase())
  ) {
    response.writeHead(403, { 'Content-Type': 'text/plain' });
    response.end('The model is served to this machine only');
    return;
  }
  response.writeHead(200, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  response.end(JSON.stringify(chatConfig));
};

const startExampleServer = () =>
  new Promise((resolve, reject) => {
    const server = createServer((request, response) => {
      const { pathname } = new URL(
        request.url,
        `http://localhost:${STATIC_PORT}`
      );
      if (pathname === PLANNING_ASSISTANT_CONFIG_PATH) {
        servePlanningAssistantConfig(request, response);
      } else {
        serveStatic(response, pathname);
      }
    });
    server.on('error', reject);
    server.listen(STATIC_PORT, '127.0.0.1', () => resolve(server));
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
        '[configurator-example] pick another port: EXAMPLE_PORT=3101 npm start'
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
  if (chatConfig) {
    console.log(`  ➜  Model:    ${chatConfig.provider} ${chatConfig.model}`);
  }
  console.log('');
  if (!process.argv.includes('--no-open')) {
    openInBrowser(EXAMPLE_URL);
  }
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => process.exit(0));
  }
};

main();
