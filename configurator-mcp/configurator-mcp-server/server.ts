import { fstatSync } from 'node:fs';
import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { WebSocketServer } from 'ws';
import { createConfiguratorApi } from './configurator-api';
import { createConfiguratorMcpServer } from './configurator-mcp-server';
import { connectHistoryState, historyState } from './history-state';
import { PageBridge } from './page-bridge';
import { CONFIGURATOR_MCP_PORT } from './types';

const bridge = new PageBridge();
connectHistoryState(bridge, historyState);

const serverPort =
  Number(process.env.CONFIGURATOR_MCP_PORT) || CONFIGURATOR_MCP_PORT;
const pageOrigins = process.env.CONFIGURATOR_MCP_PAGE_ORIGINS
  ? process.env.CONFIGURATOR_MCP_PAGE_ORIGINS.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean)
  : ['http://localhost:3000', 'http://127.0.0.1:3000'];

const requestHandler = async (
  request: IncomingMessage,
  response: ServerResponse
) => {
  if (!request.url?.startsWith('/mcp')) {
    response.writeHead(404, { 'Content-Type': 'text/plain' });
    response.end('Not found - the MCP endpoint is /mcp');
    return;
  }
  const clientId = new URL(request.url, 'http://localhost').searchParams.get(
    'client'
  );
  if (clientId && !bridge.isClientActive(clientId)) {
    response.writeHead(409, { 'Content-Type': 'text/plain' });
    response.end('This chat is not connected to its configurator page');
    return;
  }
  try {
    const mcpServer = createConfiguratorMcpServer(
      createConfiguratorApi(bridge, clientId ?? undefined),
      historyState
    );
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    response.on('close', () => {
      transport.close();
      mcpServer.close();
    });
    await mcpServer.connect(transport);
    await transport.handleRequest(request, response);
  } catch (error) {
    console.error('[configurator-mcp] request failed', error);
    if (!response.headersSent) {
      response.writeHead(500, { 'Content-Type': 'text/plain' });
      response.end('Internal server error');
    }
  }
};

const httpServer = createServer(requestHandler);

const webSocketServer = new WebSocketServer({ noServer: true });
httpServer.on('upgrade', (request, socket, head) => {
  const { origin } = request.headers;
  const { pathname } = new URL(request.url ?? '', 'http://localhost');
  if (pathname !== '/bridge' || (origin && !pageOrigins.includes(origin))) {
    console.error(
      `[configurator-mcp] rejected websocket upgrade (url: ${request.url}, origin: ${origin})`
    );
    socket.destroy();
    return;
  }
  webSocketServer.handleUpgrade(request, socket, head, (pageSocket) =>
    bridge.attachPage(pageSocket)
  );
});

// vite-node keeps running when the process that started it dies, which leaves
// an orphaned server holding the port. When stdin is the pipe of that process,
// the pipe ends with it and this instance shuts down; a start from a terminal
// arms no guard.
try {
  const stdinStat = fstatSync(0);
  if (!process.stdin.isTTY && (stdinStat.isFIFO() || stdinStat.isSocket())) {
    process.stdin.resume();
    process.stdin.on('end', () => {
      console.log('[configurator-mcp] parent process ended - shutting down');
      process.exit(0);
    });
    process.stdin.on('error', () => {});
  }
} catch {
  // stdin is not inspectable - run without the orphan guard
}

httpServer.on('error', (error: NodeJS.ErrnoException) => {
  if (error.code === 'EADDRINUSE') {
    console.error(
      `[configurator-mcp] port ${serverPort} is already in use - a previous MCP server instance is still running.`
    );
    console.error(
      `[configurator-mcp] stop it first: lsof -ti tcp:${serverPort} | xargs kill`
    );
  } else {
    console.error('[configurator-mcp] server failed to start', error);
  }
  process.exit(1);
});

httpServer.listen(serverPort, () => {
  console.log('');
  console.log('  Configurator MCP server ready');
  console.log('');
  console.log(`  ➜  Local:   http://localhost:${serverPort}/mcp`);
  console.log('');
  console.log(
    '[configurator-mcp] waiting for the configurator example page (npm start opens it)'
  );
});
