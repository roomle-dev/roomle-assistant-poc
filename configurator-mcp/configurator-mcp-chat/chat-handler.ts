import type { IncomingMessage, ServerResponse } from 'node:http';
import { Readable } from 'node:stream';
import type { ChatConfig, ChatMessage } from './chat-config';
import { ChatRequestError, parseChatMessages } from './chat-config';

export type StreamChat = (
  messages: ChatMessage[],
  clientId: string
) => Promise<Response>;

const corsHeaders = (origin: string | undefined, pageOrigins: string[]) =>
  origin && pageOrigins.includes(origin)
    ? {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        Vary: 'Origin',
      }
    : {};

const readBody = (request: IncomingMessage) =>
  new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    request.on('data', (chunk) => chunks.push(chunk));
    request.on('end', () => resolve(Buffer.concat(chunks)));
    request.on('error', reject);
  });

export const createChatRequestHandler =
  (config: ChatConfig, streamChat: StreamChat) =>
  async (request: IncomingMessage, response: ServerResponse) => {
    const cors = corsHeaders(request.headers.origin, config.pageOrigins);
    const send = (status: number, text: string) => {
      response.writeHead(status, {
        'Content-Type': 'text/plain; charset=utf-8',
        ...cors,
      });
      response.end(text);
    };

    const { pathname } = new URL(request.url ?? '/', 'http://localhost');
    if (pathname === '/health') {
      send(200, 'ok');
      return;
    }
    if (pathname !== '/chat') {
      send(404, 'Not found - the chat endpoint is /chat');
      return;
    }
    if (request.method === 'OPTIONS') {
      response.writeHead(Object.keys(cors).length ? 204 : 403, cors);
      response.end();
      return;
    }
    if (request.method !== 'POST') {
      send(405, 'Method not allowed - the chat endpoint accepts POST');
      return;
    }
    if (request.headers.origin && !Object.keys(cors).length) {
      send(403, 'Origin not allowed');
      return;
    }
    if (!config.apiToken) {
      send(
        503,
        'No API token configured - start with: npm start mistral-medium <api-key> (or set CONFIGURATOR_CHAT_TOKEN)'
      );
      return;
    }
    try {
      let body: unknown;
      try {
        body = JSON.parse((await readBody(request)).toString('utf8'));
      } catch {
        throw new ChatRequestError('Request body must be valid JSON');
      }
      const messages = parseChatMessages(body);
      const { clientId } = body as { clientId?: unknown };
      if (typeof clientId !== 'string' || !clientId.trim()) {
        throw new ChatRequestError('Chat request requires a page clientId');
      }
      const stream = await streamChat(messages, clientId);
      const headers = Object.fromEntries(stream.headers);
      response.writeHead(stream.status, { ...headers, ...cors });
      const nodeStream = Readable.fromWeb(
        stream.body as unknown as import('node:stream/web').ReadableStream
      );
      nodeStream.on('error', (error) => {
        console.error('[configurator-chat] stream failed', error);
        response.destroy(error);
      });
      nodeStream.pipe(response);
    } catch (error) {
      if (error instanceof ChatRequestError) {
        send(400, error.message);
        return;
      }
      console.error('[configurator-chat] chat request failed', error);
      send(
        500,
        `Chat failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  };
