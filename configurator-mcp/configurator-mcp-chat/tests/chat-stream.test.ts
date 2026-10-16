import { jsonSchema, tool, type ToolSet } from 'ai';
import { convertArrayToReadableStream, MockLanguageModelV3 } from 'ai/test';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getChatConfig, SYSTEM_PROMPT } from '../chat-config';
import { createStreamChat } from '../chat-stream';

const mocks = vi.hoisted(() => ({
  model: undefined as unknown,
  modelId: undefined as string | undefined,
  apiKey: undefined as string | undefined,
  tools: {} as ToolSet,
  close: vi.fn(),
  mcpUrl: undefined as URL | undefined,
}));
vi.mock('@ai-sdk/mistral', () => ({
  createMistral: ({ apiKey }: { apiKey: string }) => {
    mocks.apiKey = apiKey;
    return (modelId: string) => {
      mocks.modelId = modelId;
      return mocks.model;
    };
  },
}));
vi.mock('@ai-sdk/mcp', () => ({
  createMCPClient: async () => ({
    tools: async () => mocks.tools,
    close: mocks.close,
  }),
}));
vi.mock('@modelcontextprotocol/sdk/client/streamableHttp.js', () => ({
  StreamableHTTPClientTransport: class {
    constructor(url: URL) {
      mocks.mcpUrl = url;
    }
  },
}));

const usage = {
  inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 1, text: 1, reasoning: 0 },
};
type Part =
  Awaited<
    ReturnType<MockLanguageModelV3['doStream']>
  >['stream'] extends ReadableStream<infer P>
    ? P
    : never;
const finish = (reason: 'stop' | 'tool-calls'): Part => ({
  type: 'finish',
  usage,
  finishReason: { unified: reason, raw: reason },
});
const call = (name: string, id = name): Part => ({
  type: 'tool-call',
  toolCallId: id,
  toolName: name,
  input: '{}',
});
const text = (answer: string): Part[] => [
  { type: 'text-start', id: 'answer' },
  { type: 'text-delta', id: 'answer', delta: answer },
  { type: 'text-end', id: 'answer' },
];
const mcpResult = (result: unknown, isError = false) => ({
  content: [{ type: 'text', text: JSON.stringify(result) }],
  isError,
});
const fakeTool = (execute: () => Promise<unknown>) =>
  tool({
    inputSchema: jsonSchema({ type: 'object', properties: {} }),
    execute,
  });
// A model that calls the given tools in its first step and answers in the
// second.
const toolThenAnswer = (calls: Part[], answer: string) => {
  let step = 0;
  return new MockLanguageModelV3({
    doStream: async () => ({
      stream: convertArrayToReadableStream(
        step++ === 0
          ? [...calls, finish('tool-calls')]
          : [...text(answer), finish('stop')]
      ),
    }),
  });
};
// A model that calls the given tools in its first step and fails in the second.
const failingModel = (calls: Part[], mode: 'error' | 'throw' = 'error') => {
  let step = 0;
  return new MockLanguageModelV3({
    doStream: async () => {
      if (step++ === 0)
        return {
          stream: convertArrayToReadableStream([
            ...calls,
            finish('tool-calls'),
          ]),
        };
      const error = new Error('Failed to process successful response');
      if (mode === 'error')
        return {
          stream: convertArrayToReadableStream([{ type: 'error', error }]),
        };
      return {
        stream: new ReadableStream({
          start(controller) {
            controller.error(error);
          },
        }),
      };
    },
  });
};
const response = async (timeout = 1000) => {
  const streamChat = createStreamChat(
    getChatConfig({
      CONFIGURATOR_CHAT_MODEL: 'mistral-medium',
      CONFIGURATOR_CHAT_TOKEN: 'test-key',
      CONFIGURATOR_CHAT_TURN_TIMEOUT_MS: String(timeout),
    })
  );
  return (
    await streamChat([{ role: 'user', content: 'undo' }], 'test-page')
  ).text();
};

afterEach(() => {
  vi.restoreAllMocks();
  mocks.close.mockClear();
  mocks.model = undefined;
  mocks.tools = {};
  mocks.mcpUrl = undefined;
});

describe('chat stream', () => {
  it('passes the system prompt of the backend as instructions and the MCP tools to streamText', async () => {
    const undo = vi.fn(async () =>
      mcpResult({ undone: true, canUndo: false, canRedo: true })
    );
    mocks.tools = { undo: fakeTool(undo) };
    const model = toolThenAnswer(
      [call('undo')],
      'The last change is reverted.'
    );
    mocks.model = model;

    expect(await response()).toBe(
      '\n[tool] undo\nThe last change is reverted.'
    );
    expect(mocks.apiKey).toBe('test-key');
    expect(mocks.modelId).toBe('mistral-medium-latest');
    expect(model.doStreamCalls[0].prompt[0]).toEqual({
      role: 'system',
      content: SYSTEM_PROMPT,
    });
    expect(model.doStreamCalls[0].tools?.map((t) => t.name)).toEqual(['undo']);
    expect(undo).toHaveBeenCalledTimes(1);
    expect(mocks.close).toHaveBeenCalledTimes(1);
  });

  it('connects the MCP client with the page client ID', async () => {
    mocks.model = toolThenAnswer([], 'Nothing to do.');
    await response();
    expect(mocks.mcpUrl?.toString()).toBe(
      'http://localhost:3100/mcp?client=test-page'
    );
  });
});

describe('chat response recovery', () => {
  it('keeps a successful answer unchanged', async () => {
    mocks.model = new MockLanguageModelV3({
      doStream: async () => ({
        stream: convertArrayToReadableStream([
          ...text('I can only undo and redo changes.'),
          finish('stop'),
        ]),
      }),
    });
    expect(await response()).toBe('I can only undo and redo changes.');
  });

  it.each(['error', 'throw'] as const)(
    'says that nothing changed when the reply fails before a tool ran (%s)',
    async (mode) => {
      mocks.model = new MockLanguageModelV3({
        doStream: async () => {
          const error = new Error('Failed to process successful response');
          return mode === 'error'
            ? {
                stream: convertArrayToReadableStream([
                  { type: 'error', error },
                ]),
              }
            : {
                stream: new ReadableStream({
                  start(controller) {
                    controller.error(error);
                  },
                }),
              };
        },
      });
      vi.spyOn(console, 'error').mockImplementation(() => {});
      const answer = await response();
      expect(answer).toContain('[error] Failed to process successful response');
      expect(answer).toContain('reply was interrupted');
      expect(answer).toContain(
        'No tool ran, so the configuration was not changed.'
      );
      expect(mocks.close).toHaveBeenCalledTimes(1);
    }
  );

  it('reports a completed undo with its result when the reply fails after it', async () => {
    const undo = vi.fn(async () =>
      mcpResult({ undone: true, canUndo: false, canRedo: true })
    );
    mocks.tools = { undo: fakeTool(undo) };
    mocks.model = failingModel([call('undo')]);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const answer = await response();
    expect(answer).toContain(
      '- Completed Undo: undone: true; canUndo: false; canRedo: true'
    );
    expect(answer).toContain('no operation was repeated automatically');
    expect(undo).toHaveBeenCalledTimes(1);
  });

  it('marks an error result or thrown call as unconfirmed beside a successful call', async () => {
    mocks.tools = {
      undo: fakeTool(async () =>
        mcpResult({ undone: true, canUndo: true, canRedo: true })
      ),
      redo: fakeTool(async () =>
        mcpResult('Configurator call timed out', true)
      ),
    };
    mocks.model = failingModel([call('undo'), call('redo')]);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const answer = await response();
    expect(answer).toContain('- Completed Undo: undone: true');
    expect(answer).toContain(
      '- Unconfirmed Redo: Configurator call timed out. Check the configuration before trying this operation again.'
    );
  });

  it('keeps partial text, emits one recovery notice, and survives throwing diagnostics', async () => {
    const error = Object.assign(new Error('Provider failed'), {
      value: { count: 1n },
    });
    mocks.model = new MockLanguageModelV3({
      doStream: async () => ({
        stream: convertArrayToReadableStream([
          ...text('I started.'),
          { type: 'error', error },
        ]),
      }),
    });
    vi.spyOn(console, 'error').mockImplementation(() => {
      throw new Error('Logger failed');
    });
    const answer = await response();
    expect(answer).toContain('I started.');
    expect(answer.match(/reply was interrupted/g)).toHaveLength(1);
    expect(answer).toContain('No tool ran');
    expect(mocks.close).toHaveBeenCalledTimes(1);
  });

  it('reports a call whose request was aborted as unconfirmed on timeout', async () => {
    const undo = vi.fn(
      (_input, { abortSignal }) =>
        new Promise((_, reject) => {
          abortSignal.addEventListener('abort', () =>
            reject(abortSignal.reason)
          );
        })
    );
    mocks.tools = {
      undo: tool({
        inputSchema: jsonSchema({ type: 'object', properties: {} }),
        execute: undo,
      }),
    };
    mocks.model = new MockLanguageModelV3({
      doStream: async () => ({
        stream: convertArrayToReadableStream([
          call('undo'),
          finish('tool-calls'),
        ]),
      }),
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const answer = await response(50);
    expect(answer).toContain('the turn took longer than');
    expect(answer).toContain('Unconfirmed Undo');
    expect(undo).toHaveBeenCalledTimes(1);
  });
});
