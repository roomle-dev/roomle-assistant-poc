import { createServer } from 'node:http';
import { getChatConfig } from './chat-config';
import { createChatRequestHandler } from './chat-handler';
import { createStreamChat } from './chat-stream';

const config = getChatConfig(process.env);
const streamChat = createStreamChat(config);

const server = createServer(createChatRequestHandler(config, streamChat));

server.on('error', (error: NodeJS.ErrnoException) => {
  if (error.code === 'EADDRINUSE') {
    console.error(
      `[configurator-chat] port ${config.port} is already in use - stop the previous instance or pick another with CONFIGURATOR_CHAT_PORT.`
    );
  } else {
    console.error('[configurator-chat] server failed to start', error);
  }
  process.exit(1);
});

// The chat backend holds the provider API key and accepts originless
// requests (curl debugging), so it binds to loopback only - no other device
// on the local network can reach the token-backed endpoint.
server.listen(config.port, '127.0.0.1', () => {
  console.log('');
  console.log('  Configurator example AI chat ready');
  console.log('');
  console.log(`  ➜  Local:   http://localhost:${config.port}/chat`);
  console.log(`  ➜  MCP:     ${config.mcpUrl}`);
  console.log(`  ➜  Model:   mistral:${config.modelId}`);
  console.log('');
  if (!config.apiToken) {
    console.log(
      '[configurator-chat] no API token - POST /chat answers 503 until CONFIGURATOR_CHAT_TOKEN is set'
    );
  }
});
