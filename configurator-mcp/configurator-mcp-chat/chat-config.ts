export const DEFAULT_CHAT_PORT = 3200;
export const DEFAULT_MCP_URL = 'http://localhost:3100/mcp';
// A turn ends with a message to the user when the model has not answered
// within this time.
export const DEFAULT_TURN_TIMEOUT_MS = 5 * 60_000;
const CHAT_ROLES = ['user', 'assistant'] as const;

export class ChatRequestError extends Error {}

/** The chat models, by the name the launcher takes (npm start <name> <api-key>). */
export const CHAT_MODELS: Record<string, string> = {
  'mistral-medium': 'mistral-medium-latest',
  'mistral-large': 'mistral-large-latest',
};

export const SYSTEM_PROMPT =
  'You are the assistant of a Roomle product configurator: the user configures a product in the configurator page ' +
  'beside this chat. Your tools are get-configurator-capabilities, undo and redo. For product questions, use ' +
  'get-configurator-capabilities to inspect relevant sections. Distinguish declared alternatives from current kernel choices; ' +
  'declared alternatives can be conditional or inactive. If complete is false, acknowledge unresolved information and do not invent options. ' +
  'Docking choices do not prove a placement is valid. Only undo and redo can change the configuration. ' +
  'When the user asks to undo or to take back a change, call ' +
  'undo; when the user asks to redo or to bring a change back, call redo. Then say in one sentence what happened ' +
  'and whether a further undo or redo is possible, from the tool result only. Explain that other changes are not supported yet. Answer in the language of the user.';

export const resolveChatModel = (name: string | undefined): string => {
  const modelId = name ? CHAT_MODELS[name.toLowerCase()] : undefined;
  if (!modelId) {
    throw new ChatRequestError(
      `Unknown chat model "${name ?? ''}" - supported: ${Object.keys(CHAT_MODELS).join(', ')}`
    );
  }
  return modelId;
};

export interface ChatMessage {
  role: (typeof CHAT_ROLES)[number];
  content: string;
}

export interface ChatConfig {
  port: number;
  apiToken: string | undefined;
  modelId: string;
  mcpUrl: string;
  pageOrigins: string[];
  turnTimeoutMs: number;
}

export const getChatConfig = (env: NodeJS.ProcessEnv): ChatConfig => ({
  port: Number(env.CONFIGURATOR_CHAT_PORT) || DEFAULT_CHAT_PORT,
  apiToken: env.CONFIGURATOR_CHAT_TOKEN || undefined,
  modelId: resolveChatModel(env.CONFIGURATOR_CHAT_MODEL),
  mcpUrl: env.CONFIGURATOR_MCP_URL || DEFAULT_MCP_URL,
  pageOrigins: env.CONFIGURATOR_CHAT_PAGE_ORIGINS
    ? env.CONFIGURATOR_CHAT_PAGE_ORIGINS.split(',')
        .map((origin) => origin.trim())
        .filter(Boolean)
    : ['http://localhost:3000', 'http://127.0.0.1:3000'],
  turnTimeoutMs:
    Number(env.CONFIGURATOR_CHAT_TURN_TIMEOUT_MS) || DEFAULT_TURN_TIMEOUT_MS,
});

export const parseChatMessages = (body: unknown): ChatMessage[] => {
  if (typeof body !== 'object' || body === null) {
    throw new ChatRequestError(
      'Request body must be JSON with a messages array'
    );
  }
  const { messages } = body as { messages?: unknown };
  if (!Array.isArray(messages)) {
    throw new ChatRequestError(
      'Request body must be JSON with a messages array'
    );
  }
  return messages.map((message: unknown) => {
    if (typeof message !== 'object' || message === null) {
      throw new ChatRequestError(
        'Each message must be an object with role and content'
      );
    }
    const { role, content, images } = message as {
      role?: unknown;
      content?: unknown;
      images?: unknown;
    };
    if (
      typeof role !== 'string' ||
      !CHAT_ROLES.includes(role as ChatMessage['role'])
    ) {
      throw new ChatRequestError(`Invalid message role: ${role}`);
    }
    if (typeof content !== 'string') {
      throw new ChatRequestError('Message content must be a string');
    }
    if (Array.isArray(images) && images.length > 0) {
      throw new ChatRequestError('The configurator chat reads no images');
    }
    return { role: role as ChatMessage['role'], content };
  });
};
