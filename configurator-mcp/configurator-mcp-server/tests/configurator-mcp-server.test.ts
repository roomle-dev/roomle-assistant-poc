import { describe, expect, it, vi } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { ConfiguratorApi } from '../configurator-api';
import { createConfiguratorMcpServer } from '../configurator-mcp-server';
import { createConfiguratorApi } from '../configurator-api';
import { HistoryState } from '../history-state';
import { PageBridge } from '../page-bridge';

const connectClient = async (
  configuratorApi: ConfiguratorApi,
  history: HistoryState
): Promise<Client> => {
  const server = createConfiguratorMcpServer(configuratorApi, history);
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new Client({ name: 'test-client', version: '0.0.0' });
  await client.connect(clientTransport);
  return client;
};

const textOf = (result: unknown): string =>
  ((result as { content?: { type: string; text?: string }[] }).content ?? [])
    .filter((block) => block.type === 'text')
    .map((block) => block.text ?? '')
    .join('');

const configuratorWith = (history: HistoryState): ConfiguratorApi => ({
  extended: {
    getConfiguratorCapabilities: vi.fn(async () => ({
      complete: true,
      unresolved: [],
    })),
    undo: vi.fn(async () => history.changed(false, true)),
    redo: vi.fn(async () => history.changed(true, false)),
  },
});

describe('configurator-mcp-server', () => {
  it('exposes the read tool and undo and redo', async () => {
    const history = new HistoryState();
    const client = await connectClient(configuratorWith(history), history);
    const { tools } = await client.listTools();
    expect(tools.map((tool) => tool.name).sort()).toEqual([
      'get-configurator-capabilities',
      'redo',
      'undo',
    ]);
    const read = tools.find(
      (tool) => tool.name === 'get-configurator-capabilities'
    );
    expect(read?.annotations).toEqual({
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    });
    expect(read?.inputSchema.properties?.include).toMatchObject({
      type: 'array',
      items: {
        enum: [
          'configuration',
          'components',
          'items',
          'parameters',
          'materials',
          'docking',
        ],
      },
    });
  });

  it('serves instructions for inspection and the two history tools', async () => {
    const history = new HistoryState();
    const client = await connectClient(configuratorWith(history), history);
    const instructions = client.getInstructions() ?? '';
    expect(instructions).toContain('Roomle product configurator');
    expect(instructions).toContain('get-configurator-capabilities');
    expect(instructions).toContain('Only undo and redo can change');
    expect(instructions).toContain('unresolved');
  });

  it('validates read arguments, preserves partial JSON and reports SDK errors', async () => {
    const history = new HistoryState();
    const api = configuratorWith(history);
    const client = await connectClient(api, history);
    const read = vi.mocked(api.extended.getConfiguratorCapabilities);
    const partial = {
      complete: false,
      unresolved: [{ resourceType: 'component', id: 'missing' }],
    };
    read.mockResolvedValue(partial);
    const result = await client.callTool({
      name: 'get-configurator-capabilities',
      arguments: { include: ['components'] },
    });
    expect(result.isError).toBeFalsy();
    expect(JSON.parse(textOf(result))).toEqual(partial);
    expect(read).toHaveBeenCalledExactlyOnceWith(['components']);
    for (const include of [['invalid'], 'parameters', [1]]) {
      const invalid = await client.callTool({
        name: 'get-configurator-capabilities',
        arguments: { include },
      });
      expect(invalid.isError).toBe(true);
    }
    expect(read).toHaveBeenCalledTimes(1);
    read.mockRejectedValueOnce(new Error('read again'));
    const failed = await client.callTool({
      name: 'get-configurator-capabilities',
      arguments: {},
    });
    expect(failed.isError).toBe(true);
    expect(textOf(failed)).toContain('read again');
    await client.close();
  });

  it('describes undo and redo with their results and the nothing-to-undo case', async () => {
    const history = new HistoryState();
    const client = await connectClient(configuratorWith(history), history);
    const { tools } = await client.listTools();
    const description = (name: string) =>
      tools.find((tool) => tool.name === name)?.description ?? '';
    expect(description('undo')).toMatch(
      /Reverts the last change.*undone.*canUndo and canRedo.*hint when nothing was reverted/s
    );
    expect(description('redo')).toMatch(
      /Brings back the change the last undo reverted.*redone.*hint when nothing was brought back/s
    );
  });

  it('runs undo and redo through the executors and returns text results', async () => {
    const history = new HistoryState();
    history.changed(true, false);
    const api = configuratorWith(history);
    const client = await connectClient(api, history);

    const undo = await client.callTool({ name: 'undo', arguments: {} });
    expect((undo as { isError?: boolean }).isError).toBeFalsy();
    expect(JSON.parse(textOf(undo))).toEqual({
      undone: true,
      canUndo: false,
      canRedo: true,
    });
    const redo = await client.callTool({ name: 'redo', arguments: {} });
    expect(JSON.parse(textOf(redo))).toEqual({
      redone: true,
      canUndo: true,
      canRedo: false,
    });
    const again = await client.callTool({ name: 'redo', arguments: {} });
    expect((again as { isError?: boolean }).isError).toBeFalsy();
    expect(JSON.parse(textOf(again)).hint).toMatch(/^Nothing to redo/);
  });

  it('answers undo without a page with the connection error, not with nothing to undo', async () => {
    const history = new HistoryState();
    const client = await connectClient(
      createConfiguratorApi(new PageBridge()),
      history
    );

    const result = await client.callTool({ name: 'undo', arguments: {} });
    expect((result as { isError?: boolean }).isError).toBe(true);
    expect(textOf(result)).toContain('No configurator page connected');
    expect(textOf(result)).not.toContain('Nothing to undo');
  });

  it('reports a failed page call as a result the agent can read', async () => {
    const history = new HistoryState();
    history.changed(true, false);
    const api: ConfiguratorApi = {
      extended: {
        getConfiguratorCapabilities: vi.fn(async () => ({
          complete: true,
          unresolved: [],
        })),
        undo: vi.fn(async () => {
          throw new Error('No configurator page connected.');
        }),
        redo: vi.fn(),
      },
    };
    const client = await connectClient(api, history);

    const result = await client.callTool({ name: 'undo', arguments: {} });
    expect((result as { isError?: boolean }).isError).toBe(true);
    expect(textOf(result)).toContain('No configurator page connected.');
  });
});
