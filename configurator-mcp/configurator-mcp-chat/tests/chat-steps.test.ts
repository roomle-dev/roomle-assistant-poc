import {
  APICallError,
  jsonSchema,
  streamText,
  tool,
  TypeValidationError,
} from 'ai';
import { convertArrayToReadableStream, MockLanguageModelV3 } from 'ai/test';
import { describe, expect, it, vi } from 'vitest';
import {
  chatSteps,
  createStepLog,
  isTurnTimeout,
  MAX_CHAT_STEPS,
  turnTimeoutMessage,
} from '../chat-steps';

type StreamPart =
  Awaited<
    ReturnType<MockLanguageModelV3['doStream']>
  >['stream'] extends ReadableStream<infer Part>
    ? Part
    : never;

const usage = {
  inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 1, text: 1, reasoning: 0 },
};

const answer: StreamPart[] = [
  { type: 'text-start', id: 'answer' },
  {
    type: 'text-delta',
    id: 'answer',
    delta: 'The last change is reverted.',
  },
  { type: 'text-end', id: 'answer' },
  { type: 'finish', usage, finishReason: { unified: 'stop', raw: 'stop' } },
];

const toolCall = (toolCallId: string): StreamPart[] => [
  { type: 'tool-call', toolCallId, toolName: 'undo', input: '{}' },
  {
    type: 'finish',
    usage,
    finishReason: { unified: 'tool-calls', raw: 'tool_calls' },
  },
];

// A model that makes one tool call per step and keeps calling tools as long
// as it may.
const modelThatAlwaysCallsATool = () => {
  let calls = 0;
  return new MockLanguageModelV3({
    doStream: async ({ toolChoice }) => ({
      stream: convertArrayToReadableStream(
        toolChoice?.type === 'none' ? answer : toolCall(`call-${++calls}`)
      ),
    }),
  });
};

const tools = {
  undo: tool({
    inputSchema: jsonSchema({ type: 'object', properties: {} }),
    execute: async () => ({ undone: true }),
  }),
};

describe('chatSteps', () => {
  it('ends a turn that uses every step with the model answer', async () => {
    const model = modelThatAlwaysCallsATool();

    const result = streamText({
      model,
      messages: [{ role: 'user', content: 'undo' }],
      tools,
      ...chatSteps,
    });

    expect(await result.text).toBe('The last change is reverted.');
    expect(model.doStreamCalls).toHaveLength(MAX_CHAT_STEPS);
    expect(
      model.doStreamCalls.map((call) => call.toolChoice?.type === 'none')
    ).toEqual([...Array(MAX_CHAT_STEPS - 1).fill(false), true]);
  });

  it('logs the usage of every step', async () => {
    const log = vi.fn();
    const result = streamText({
      model: modelThatAlwaysCallsATool(),
      messages: [{ role: 'user', content: 'undo' }],
      tools,
      ...chatSteps,
      onStepEnd: createStepLog(log).onStepEnd,
    });
    await result.text;
    expect(log).toHaveBeenCalledTimes(MAX_CHAT_STEPS);
    expect(log.mock.calls[0][0]).toMatch(
      /^\[configurator-chat\] step 1: 1 in, 1 out, 0 reasoning tokens; tools: undo \(2 chars\); tool-calls; \d+ ms$/
    );
    expect(log.mock.calls[MAX_CHAT_STEPS - 1][0]).toMatch(
      /^\[configurator-chat\] step 16: 1 in, 1 out, 0 reasoning tokens; no tool; stop; \d+ ms$/
    );
  });

  it('logs the reasoning tokens of a step', async () => {
    const log = vi.fn();
    const result = streamText({
      model: new MockLanguageModelV3({
        doStream: async () => ({
          stream: convertArrayToReadableStream([
            ...answer.slice(0, -1),
            {
              type: 'finish',
              usage: {
                inputTokens: {
                  total: 100,
                  noCache: 100,
                  cacheRead: 0,
                  cacheWrite: 0,
                },
                outputTokens: { total: 50, text: 10, reasoning: 40 },
              },
              finishReason: { unified: 'stop', raw: 'stop' },
            },
          ]),
        }),
      }),
      messages: [{ role: 'user', content: 'undo' }],
      onStepEnd: createStepLog(log).onStepEnd,
    });
    await result.text;
    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0][0]).toMatch(
      /^\[configurator-chat\] step 1: 100 in, 50 out, 40 reasoning tokens; no tool; stop; \d+ ms$/
    );
  });

  it('logs the step that failed with what the provider answered', async () => {
    // a model that fails in its second step the way the SDK reports an answer
    // it cannot process
    let calls = 0;
    const failure = new APICallError({
      message: 'Failed to process successful response',
      url: 'https://provider.example/chat/completions',
      requestBodyValues: {},
      statusCode: 200,
      responseHeaders: { 'apim-request-id': 'req-42' },
      cause: new TypeValidationError({
        value: { choices: [{ delta: { content: null } }] },
        cause: new Error('Invalid input: expected string'),
      }),
    });
    const model = new MockLanguageModelV3({
      doStream: async () => {
        calls += 1;
        if (calls === 2) {
          throw failure;
        }
        return { stream: convertArrayToReadableStream(toolCall('call-1')) };
      },
    });
    const log = vi.fn();
    const logError = vi.fn();
    const stepLog = createStepLog(log, logError);
    const result = streamText({
      model,
      messages: [{ role: 'user', content: 'undo' }],
      tools,
      ...chatSteps,
      onStepEnd: stepLog.onStepEnd,
    });
    for await (const part of result.stream) {
      if (part.type === 'error') {
        stepLog.onError(part.error);
      }
    }
    expect(log).toHaveBeenCalledTimes(1);
    expect(logError).toHaveBeenCalledTimes(1);
    const line = logError.mock.calls[0][0] as string;
    expect(line).toMatch(/^\[configurator-chat\] step 2 failed after \d+ ms: /);
    expect(line).toContain(
      'AI_APICallError: Failed to process successful response, status 200, ' +
        'url https://provider.example/chat/completions, request req-42'
    );
    expect(line).toContain(' <- caused by AI_TypeValidationError: ');
    expect(line).toContain('value {"choices":[{"delta":{"content":null}}]}');
    expect(line).toContain(
      ' <- caused by Error: Invalid input: expected string'
    );
  });

  it('ends a turn that never answers after the turn timeout', async () => {
    // a model that answers only when the turn is aborted
    const model = new MockLanguageModelV3({
      doStream: ({ abortSignal }) =>
        new Promise((_, reject) => {
          abortSignal?.addEventListener('abort', () =>
            reject(abortSignal.reason)
          );
        }),
    });
    const result = streamText({
      model,
      messages: [{ role: 'user', content: 'undo' }],
      tools,
      ...chatSteps,
      abortSignal: AbortSignal.timeout(50),
    });
    // the SDK ends the stream with an abort part, without an error
    const types: string[] = [];
    for await (const part of result.stream) {
      types.push(part.type);
    }
    expect(types).toEqual(['start', 'abort']);
    expect(isTurnTimeout(new DOMException('timed out', 'TimeoutError'))).toBe(
      true
    );
    expect(
      isTurnTimeout(
        new Error('wrapped', {
          cause: new DOMException('aborted', 'AbortError'),
        })
      )
    ).toBe(true);
    expect(isTurnTimeout(new Error('refused'))).toBe(false);
    expect(turnTimeoutMessage(5 * 60_000)).toBe(
      'the turn took longer than 5 minutes and was ended - the configuration holds what the tools changed so far'
    );
  });
});
