import { createServer, type Server } from 'node:http';
import { describe, expect, it, vi } from 'vitest';
import { getChatConfig } from '../chat-config';
import { createChatRequestHandler, type StreamChat } from '../chat-handler';

const PAGE_ORIGIN = 'http://localhost:3000';
const MODEL = { CONFIGURATOR_CHAT_MODEL: 'mistral-medium' };

const startServer = (env: NodeJS.ProcessEnv, streamChat: StreamChat) =>
  new Promise<{ server: Server; url: string }>((resolve, reject) => {
    const server = createServer(
      createChatRequestHandler(getChatConfig({ ...MODEL, ...env }), streamChat)
    );
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (typeof address !== 'object' || address === null) {
        reject(new Error('no listen address'));
        return;
      }
      resolve({ server, url: `http://127.0.0.1:${address.port}` });
    });
  });

const withServer = async (
  env: NodeJS.ProcessEnv,
  streamChat: StreamChat,
  run: (url: string) => Promise<void>
) => {
  const { server, url } = await startServer(env, streamChat);
  try {
    await run(url);
  } finally {
    server.close();
  }
};

const postChat = (url: string, body: unknown, origin?: string) =>
  fetch(`${url}/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(origin && { Origin: origin }),
    },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

describe('chat request handler', () => {
  it('answers /health with ok', async () => {
    await withServer({}, vi.fn(), async (url) => {
      const response = await fetch(`${url}/health`);
      expect(response.status).toBe(200);
      expect(await response.text()).toBe('ok');
    });
  });

  it('rejects unknown paths', async () => {
    await withServer({}, vi.fn(), async (url) => {
      expect((await fetch(`${url}/nope`)).status).toBe(404);
      expect((await fetch(`${url}/capabilities`)).status).toBe(404);
    });
  });

  it('rejects POST /chat without a configured token', async () => {
    await withServer({}, vi.fn(), async (url) => {
      const response = await postChat(
        url,
        { messages: [{ role: 'user', content: 'undo' }], clientId: 'page' },
        PAGE_ORIGIN
      );
      expect(response.status).toBe(503);
      expect(await response.text()).toMatch(/CONFIGURATOR_CHAT_TOKEN/);
    });
  });

  it('answers CORS preflight for allowed origins only', async () => {
    await withServer(
      { CONFIGURATOR_CHAT_TOKEN: 'secret' },
      vi.fn(),
      async (url) => {
        const allowed = await fetch(`${url}/chat`, {
          method: 'OPTIONS',
          headers: { Origin: PAGE_ORIGIN },
        });
        expect(allowed.status).toBe(204);
        expect(allowed.headers.get('Access-Control-Allow-Origin')).toBe(
          PAGE_ORIGIN
        );

        const rejected = await fetch(`${url}/chat`, {
          method: 'OPTIONS',
          headers: { Origin: 'https://evil.example' },
        });
        expect(rejected.status).toBe(403);
        expect(rejected.headers.get('Access-Control-Allow-Origin')).toBeNull();
      }
    );
  });

  it('rejects POST /chat from disallowed origins', async () => {
    await withServer(
      { CONFIGURATOR_CHAT_TOKEN: 'secret' },
      vi.fn(),
      async (url) => {
        const response = await postChat(
          url,
          { messages: [{ role: 'user', content: 'undo' }], clientId: 'page' },
          'https://evil.example'
        );
        expect(response.status).toBe(403);
      }
    );
  });

  it('rejects invalid chat requests with 400', async () => {
    const streamChat = vi.fn();
    await withServer(
      { CONFIGURATOR_CHAT_TOKEN: 'secret' },
      streamChat,
      async (url) => {
        for (const body of [
          '{}',
          'null',
          '{oops',
          { messages: [{ role: 'tool', content: 'x' }], clientId: 'page' },
          {
            messages: [{ role: 'user', content: 'x', images: ['data:'] }],
            clientId: 'page',
          },
        ]) {
          expect((await postChat(url, body)).status).toBe(400);
        }
        expect(streamChat).not.toHaveBeenCalled();
      }
    );
  });

  it('requires a page client ID before starting a chat', async () => {
    const streamChat = vi.fn();
    await withServer(
      { CONFIGURATOR_CHAT_TOKEN: 'secret' },
      streamChat,
      async (url) => {
        for (const clientId of [undefined, '', 42]) {
          const response = await postChat(url, {
            messages: [{ role: 'user', content: 'undo' }],
            clientId,
          });
          expect(response.status).toBe(400);
          expect(await response.text()).toMatch(/clientId/);
        }
        expect(streamChat).not.toHaveBeenCalled();
      }
    );
  });

  it('accepts a request without prompts and streams the assistant answer with CORS headers', async () => {
    const streamChat = vi.fn(async () => new Response('Reverted.'));
    await withServer(
      { CONFIGURATOR_CHAT_TOKEN: 'secret' },
      streamChat,
      async (url) => {
        const response = await postChat(
          url,
          { messages: [{ role: 'user', content: 'undo' }], clientId: 'page' },
          PAGE_ORIGIN
        );
        expect(response.status).toBe(200);
        expect(await response.text()).toBe('Reverted.');
        expect(response.headers.get('Access-Control-Allow-Origin')).toBe(
          PAGE_ORIGIN
        );
        expect(streamChat).toHaveBeenCalledWith(
          [{ role: 'user', content: 'undo' }],
          'page'
        );
      }
    );
  });

  it('relays stream errors as 500', async () => {
    const streamChat = vi.fn(async () => {
      throw new Error('MCP server unreachable');
    });
    await withServer(
      { CONFIGURATOR_CHAT_TOKEN: 'secret' },
      streamChat,
      async (url) => {
        const response = await postChat(url, {
          messages: [{ role: 'user', content: 'undo' }],
          clientId: 'page',
        });
        expect(response.status).toBe(500);
        expect(await response.text()).toMatch(/MCP server unreachable/);
      }
    );
  });
});
