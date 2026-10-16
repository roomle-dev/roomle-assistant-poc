// Starts the configurator example page and the configurator MCP server:
//   - installs (first run) and typechecks the configurator-mcp workspace
//   - serves this directory (the example page) on port 3000 - the origin the
//     MCP server and the chat backend accept by default
//   - spawns the MCP server (vite-node configurator-mcp-server/server.ts) on
//     port 3100 and points its "no page connected" error at the example URL
//
// Start it with:  npm start   (from the repository root or this directory)
// No browser:     npm start -- --no-open
// Other ports:    EXAMPLE_PORT=3001 CONFIGURATOR_MCP_PORT=3101 CONFIGURATOR_CHAT_PORT=3201 npm start
// Local Rubens UI: npm run dev  (overrideServerUrl=http://localhost:5173/,
//                  override via EXAMPLE_SERVER_URL)
// AI chat:        npm start mistral-medium <api-key>   (mistral-medium-latest)
//                  npm start mistral-large <api-key>    (mistral-large-latest)
//                  spawns the chat backend (Vercel AI SDK) on port 3200 and
//                  opens the example with the AI Planning Assistant window

import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const EXAMPLE_DIR = dirname(fileURLToPath(import.meta.url));
const REPOSITORY_DIR = join(EXAMPLE_DIR, '..');
const WORKSPACE_DIR = join(REPOSITORY_DIR, 'configurator-mcp');
const STATIC_PORT = Number(process.env.EXAMPLE_PORT ?? 3000);
const MCP_PORT = process.env.CONFIGURATOR_MCP_PORT ?? '3100';
const CHAT_PORT = process.env.CONFIGURATOR_CHAT_PORT ?? '3200';
const DEV_SERVER_URL = 'http://localhost:5173/';
const EXAMPLE_SERVER_URL =
  process.env.EXAMPLE_SERVER_URL ??
  (process.argv.includes('--dev') ? DEV_SERVER_URL : undefined);
const MCP_URL = `http://localhost:${MCP_PORT}/mcp`;
// The chat models the launcher accepts; the chat backend resolves the same
// names (chat-config.ts CHAT_MODELS).
const CHAT_MODELS = ['mistral-medium', 'mistral-large'];

const parseChatArgs = () => {
  const positionalArgs = process.argv
    .slice(2)
    .filter((arg) => !arg.startsWith('--'));
  if (positionalArgs.length === 0) {
    return undefined;
  }
  const [model, apiKey] = positionalArgs;
  if (!CHAT_MODELS.includes(model.toLowerCase())) {
    console.error(
      `[configurator-example] unsupported chat model "${model}" - supported: ${CHAT_MODELS.join(', ')}`
    );
    process.exit(1);
  }
  if (!apiKey) {
    console.error(
      '[configurator-example] missing API key - start with: npm start <model> <api-key>'
    );
    process.exit(1);
  }
  return { model: model.toLowerCase(), apiKey };
};
const chat = parseChatArgs();
const EXAMPLE_QUERY = new URLSearchParams({
  ...(chat && { chat: 'true' }),
  ...(process.env.CONFIGURATOR_MCP_PORT && { mcp_port: MCP_PORT }),
  ...(process.env.CONFIGURATOR_CHAT_PORT && { chat_port: CHAT_PORT }),
  ...(EXAMPLE_SERVER_URL && { overrideServerUrl: EXAMPLE_SERVER_URL }),
}).toString();
const EXAMPLE_URL = `http://localhost:${STATIC_PORT}/${EXAMPLE_QUERY ? `?${EXAMPLE_QUERY}` : ''}`;
const PAGE_ORIGINS = `http://localhost:${STATIC_PORT},http://127.0.0.1:${STATIC_PORT}`;
const STATIC_CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
let shuttingDown = false;

const runNpm = (args, cwd) => {
  const result = spawnSync(npmCommand, args, { cwd, stdio: 'inherit' });
  if (result.status !== 0) {
    console.error(`[configurator-example] npm ${args.join(' ')} failed`);
    process.exit(result.status ?? 1);
  }
};

const buildWorkspace = () => {
  if (!existsSync(join(REPOSITORY_DIR, 'node_modules'))) {
    console.log('[configurator-example] installing the repository (first run)');
    runNpm(['install'], REPOSITORY_DIR);
  }
  console.log(
    '[configurator-example] typechecking the MCP server and the chat'
  );
  runNpm(['run', 'typecheck'], WORKSPACE_DIR);
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

const startServer = (workspace, entrypoint, env) => {
  const cwd = join(WORKSPACE_DIR, workspace);
  const cli = createRequire(join(cwd, 'package.json')).resolve(
    'vite-node/vite-node.mjs'
  );
  const child = spawn(process.execPath, [cli, entrypoint], {
    cwd,
    stdio: 'inherit',
    env,
  });
  child.on('exit', (code) => {
    if (!shuttingDown) {
      process.exit(code ?? 0);
    }
  });
  return child;
};

const startMcpServer = () =>
  startServer('configurator-mcp-server', 'server.ts', {
    ...process.env,
    CONFIGURATOR_MCP_PORT: MCP_PORT,
    CONFIGURATOR_MCP_PAGE_URL: EXAMPLE_URL,
    CONFIGURATOR_MCP_PAGE_ORIGINS:
      process.env.CONFIGURATOR_MCP_PAGE_ORIGINS ?? PAGE_ORIGINS,
  });

const startChatServer = () =>
  startServer('configurator-mcp-chat', 'chat-server.ts', {
    ...process.env,
    CONFIGURATOR_CHAT_PORT: CHAT_PORT,
    CONFIGURATOR_CHAT_TOKEN: chat.apiKey,
    CONFIGURATOR_CHAT_MODEL: chat.model,
    CONFIGURATOR_MCP_URL: MCP_URL,
    CONFIGURATOR_CHAT_PAGE_ORIGINS:
      process.env.CONFIGURATOR_CHAT_PAGE_ORIGINS ?? PAGE_ORIGINS,
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
  buildWorkspace();
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
  const mcpServer = startMcpServer();
  const chatServer = chat ? startChatServer() : undefined;
  console.log('');
  console.log('  Configurator example ready');
  console.log('');
  console.log(`  ➜  Example:  ${EXAMPLE_URL}`);
  console.log(`  ➜  MCP:      ${MCP_URL}`);
  if (chatServer) {
    console.log(`  ➜  Chat:     http://localhost:${CHAT_PORT}/chat`);
  }
  console.log('');
  if (!process.argv.includes('--no-open')) {
    openInBrowser(EXAMPLE_URL);
  }
  const shutdown = () => {
    shuttingDown = true;
    mcpServer.kill();
    chatServer?.kill();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
};

main();
