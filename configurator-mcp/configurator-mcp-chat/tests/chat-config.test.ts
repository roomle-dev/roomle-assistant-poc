import { describe, expect, it } from 'vitest';
import {
  CHAT_MODELS,
  DEFAULT_TURN_TIMEOUT_MS,
  getChatConfig,
  parseChatMessages,
  resolveChatModel,
  SYSTEM_PROMPT,
} from '../chat-config';

describe('resolveChatModel', () => {
  it('resolves mistral-medium and mistral-large to their models', () => {
    expect(resolveChatModel('mistral-medium')).toBe('mistral-medium-latest');
    expect(resolveChatModel('mistral-large')).toBe('mistral-large-latest');
    expect(resolveChatModel('Mistral-Large')).toBe('mistral-large-latest');
    expect(Object.keys(CHAT_MODELS)).toEqual([
      'mistral-medium',
      'mistral-large',
    ]);
  });

  it('rejects every other provider or model name, naming the two', () => {
    for (const name of [
      undefined,
      '',
      'mistral',
      'mistral-small-latest',
      'mistral-large-latest',
      'gpt-5-mini',
      'azure',
      'claude',
    ]) {
      expect(() => resolveChatModel(name)).toThrow(
        /Unknown chat model .* - supported: mistral-medium, mistral-large$/
      );
    }
  });
});

describe('getChatConfig', () => {
  it('reads the overrides from the environment and falls back to the defaults', () => {
    const defaults = getChatConfig({
      CONFIGURATOR_CHAT_MODEL: 'mistral-medium',
    });
    expect(defaults).toEqual({
      port: 3200,
      apiToken: undefined,
      modelId: 'mistral-medium-latest',
      mcpUrl: 'http://localhost:3100/mcp',
      pageOrigins: ['http://localhost:3000', 'http://127.0.0.1:3000'],
      turnTimeoutMs: DEFAULT_TURN_TIMEOUT_MS,
    });
    expect(DEFAULT_TURN_TIMEOUT_MS).toBe(5 * 60_000);

    expect(
      getChatConfig({
        CONFIGURATOR_CHAT_PORT: '3300',
        CONFIGURATOR_CHAT_TOKEN: 'secret',
        CONFIGURATOR_CHAT_MODEL: 'mistral-large',
        CONFIGURATOR_MCP_URL: 'http://localhost:3101/mcp',
        CONFIGURATOR_CHAT_PAGE_ORIGINS:
          'http://localhost:3005, http://127.0.0.1:3005',
        CONFIGURATOR_CHAT_TURN_TIMEOUT_MS: '60000',
      })
    ).toEqual({
      port: 3300,
      apiToken: 'secret',
      modelId: 'mistral-large-latest',
      mcpUrl: 'http://localhost:3101/mcp',
      pageOrigins: ['http://localhost:3005', 'http://127.0.0.1:3005'],
      turnTimeoutMs: 60_000,
    });
  });

  it('serves the system prompt for product inspection, configuration writes and history changes', () => {
    expect(SYSTEM_PROMPT).toContain('Roomle product configurator');
    for (const tool of [
      'get-configuration',
      'get-component-parameters',
      'get-global-parameters',
      'get-possible-children',
      'get-docking-positions',
      'get-component-docking-positions',
      'get-delete-impact',
      'get-configurator-capabilities',
      'change-component-parameter',
      'change-global-parameter',
      'dock-component',
      'drag-component',
      'delete-component',
      'load-configuration',
      'undo',
      'redo',
    ]) {
      expect(SYSTEM_PROMPT).toContain(tool);
    }
    expect(SYSTEM_PROMPT).toContain(
      'declared alternatives from current kernel choices'
    );
    expect(SYSTEM_PROMPT).toContain('unresolved');
    expect(SYSTEM_PROMPT).toContain(
      'Every write lands one step in the undo history'
    );
    expect(SYSTEM_PROMPT).toContain('confirmed');
    expect(SYSTEM_PROMPT).toContain('unconfirmed change');
  });
});

describe('parseChatMessages', () => {
  it('keeps valid messages', () => {
    expect(
      parseChatMessages({
        messages: [
          { role: 'user', content: 'undo' },
          { role: 'assistant', content: 'The last change is reverted.' },
        ],
      })
    ).toEqual([
      { role: 'user', content: 'undo' },
      { role: 'assistant', content: 'The last change is reverted.' },
    ]);
  });

  it('rejects bodies without a messages array', () => {
    expect(() => parseChatMessages({})).toThrow(/messages array/);
    expect(() => parseChatMessages(null)).toThrow(/messages array/);
  });

  it('rejects roles outside the user/assistant conversation', () => {
    expect(() =>
      parseChatMessages({ messages: [{ role: 'system', content: 'nope' }] })
    ).toThrow('Invalid message role: system');
  });

  it('rejects non-string content', () => {
    expect(() =>
      parseChatMessages({ messages: [{ role: 'user', content: 42 }] })
    ).toThrow('Message content must be a string');
  });

  it('reports no image input', () => {
    expect(() =>
      parseChatMessages({
        messages: [
          {
            role: 'user',
            content: 'like this',
            images: ['data:image/jpeg;base64,/9j/4AAQSkZJRg=='],
          },
        ],
      })
    ).toThrow('The configurator chat reads no images');
    expect(
      parseChatMessages({
        messages: [{ role: 'user', content: 'undo', images: [] }],
      })
    ).toEqual([{ role: 'user', content: 'undo' }]);
  });
});
