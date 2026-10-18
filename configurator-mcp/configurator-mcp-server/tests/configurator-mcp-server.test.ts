import { describe, expect, it, vi } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type {
  ConfiguratorApi,
  ConfigurationOperationQueryType,
} from '../configurator-api';
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
    queryConfigurationOperation: vi.fn(
      async (type: ConfigurationOperationQueryType) => ({
        type,
        context: {},
        capabilities: { complete: true, unresolved: [] },
      })
    ),
    undo: vi.fn(async () => history.changed(false, true)),
    redo: vi.fn(async () => history.changed(true, false)),
  },
});

describe('configurator-mcp-server', () => {
  it('exposes the eight read tools and undo and redo', async () => {
    const history = new HistoryState();
    const client = await connectClient(configuratorWith(history), history);
    const { tools } = await client.listTools();
    expect(tools.map((tool) => tool.name).sort()).toEqual([
      'get-component-docking-positions',
      'get-component-parameters',
      'get-configuration',
      'get-configurator-capabilities',
      'get-delete-impact',
      'get-docking-positions',
      'get-global-parameters',
      'get-possible-children',
      'redo',
      'undo',
    ]);
    const readOnly = {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    };
    const readTools = tools.filter((tool) => tool.name.startsWith('get-'));
    expect(readTools).toHaveLength(8);
    for (const tool of readTools) {
      expect(tool.annotations).toEqual(readOnly);
    }
    const capabilities = tools.find(
      (tool) => tool.name === 'get-configurator-capabilities'
    );
    expect(capabilities?.inputSchema.properties?.include).toMatchObject({
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
    const byName = (name: string) =>
      tools.find((tool) => tool.name === name)?.inputSchema;
    expect(byName('get-component-parameters')).toMatchObject({
      type: 'object',
      properties: { runtimeId: { type: 'number' } },
      required: ['runtimeId'],
    });
    expect(byName('get-docking-positions')).toMatchObject({
      type: 'object',
      required: ['child'],
    });
    expect(
      byName('get-docking-positions')?.properties?.allowInsertInBetween
    ).toMatchObject({ type: 'boolean' });
    expect(byName('get-component-docking-positions')).toMatchObject({
      type: 'object',
      properties: { runtimeId: { type: 'number' } },
      required: ['runtimeId'],
    });
    expect(byName('get-delete-impact')).toMatchObject({
      type: 'object',
      required: ['runtimeId', 'redockChildrenToParent'],
    });
    await client.close();
  });

  it('serves instructions for the reads and the two history tools', async () => {
    const history = new HistoryState();
    const client = await connectClient(configuratorWith(history), history);
    const instructions = client.getInstructions() ?? '';
    expect(instructions).toContain('Roomle product configurator');
    for (const tool of [
      'get-configuration',
      'get-component-parameters',
      'get-global-parameters',
      'get-possible-children',
      'get-docking-positions',
      'get-component-docking-positions',
      'get-delete-impact',
      'get-configurator-capabilities',
    ]) {
      expect(instructions).toContain(tool);
    }
    expect(instructions).toContain('Only undo and redo can change');
    expect(instructions).toContain('unresolved');
    await client.close();
  });

  it('validates read arguments, preserves partial JSON and reports SDK errors', async () => {
    const history = new HistoryState();
    const api = configuratorWith(history);
    const client = await connectClient(api, history);
    const query = vi.mocked(api.extended.queryConfigurationOperation);
    const partial = {
      complete: false,
      unresolved: [{ resourceType: 'component', id: 'missing' }],
    };
    query.mockResolvedValueOnce({
      type: 'capabilities',
      context: {},
      capabilities: partial,
    });
    const result = await client.callTool({
      name: 'get-configurator-capabilities',
      arguments: { include: ['components'] },
    });
    expect(result.isError).toBeFalsy();
    expect(JSON.parse(textOf(result))).toEqual(partial);
    expect(query).toHaveBeenCalledExactlyOnceWith('capabilities', {
      include: ['components'],
    });
    for (const include of [['invalid'], 'parameters', [1]]) {
      const invalid = await client.callTool({
        name: 'get-configurator-capabilities',
        arguments: { include },
      });
      expect(invalid.isError).toBe(true);
    }
    expect(query).toHaveBeenCalledTimes(1);
    query.mockRejectedValueOnce(new Error('read again'));
    const failed = await client.callTool({
      name: 'get-configurator-capabilities',
      arguments: {},
    });
    expect(failed.isError).toBe(true);
    expect(textOf(failed)).toContain('read again');
    await client.close();
  });

  it('relays every query tool with its fixed type and validated payload', async () => {
    const history = new HistoryState();
    const api = configuratorWith(history);
    const client = await connectClient(api, history);
    const query = vi.mocked(api.extended.queryConfigurationOperation);
    const cases: [
      string,
      Record<string, unknown>,
      ConfigurationOperationQueryType,
      Record<string, unknown>,
    ][] = [
      ['get-configuration', {}, 'configuration', {}],
      [
        'get-component-parameters',
        { runtimeId: 7 },
        'componentParameters',
        { runtimeId: 7 },
      ],
      ['get-global-parameters', {}, 'globalParameters', {}],
      ['get-possible-children', {}, 'possibleChildren', {}],
      [
        'get-possible-children',
        { runtimeId: 3 },
        'possibleChildren',
        { runtimeId: 3 },
      ],
      [
        'get-docking-positions',
        { child: { itemId: 'usm:shelf' } },
        'dockingPositions',
        { child: { itemId: 'usm:shelf' } },
      ],
      [
        'get-docking-positions',
        { child: { componentId: 'usm:shelf' }, allowInsertInBetween: true },
        'dockingPositions',
        { child: { componentId: 'usm:shelf' }, allowInsertInBetween: true },
      ],
      [
        'get-component-docking-positions',
        { runtimeId: 5 },
        'componentDockingPositions',
        { runtimeId: 5 },
      ],
      [
        'get-delete-impact',
        { runtimeId: 5, redockChildrenToParent: false },
        'deleteImpact',
        { runtimeId: 5, redockChildrenToParent: false },
      ],
    ];
    for (const [tool, args, type, expected] of cases) {
      const result = { type, context: { configurationHash: 'abc' } };
      query.mockResolvedValueOnce(result);
      const response = await client.callTool({ name: tool, arguments: args });
      expect(response.isError).toBeFalsy();
      expect(JSON.parse(textOf(response))).toEqual(result);
      expect(query).toHaveBeenCalledWith(type, expected);
    }
    expect(query).toHaveBeenCalledTimes(cases.length);
    expect(api.extended.undo).not.toHaveBeenCalled();
    expect(api.extended.redo).not.toHaveBeenCalled();
    await client.close();
  });

  it('rejects invalid query payloads before any page call', async () => {
    const history = new HistoryState();
    const api = configuratorWith(history);
    const client = await connectClient(api, history);
    const query = vi.mocked(api.extended.queryConfigurationOperation);
    const invalid: [string, Record<string, unknown>][] = [
      ['get-component-parameters', {}],
      ['get-component-parameters', { runtimeId: 'x' }],
      ['get-docking-positions', {}],
      ['get-docking-positions', { child: { componentId: 'a', itemId: 'b' } }],
      ['get-docking-positions', { child: { configuration: 4 } }],
      ['get-delete-impact', { runtimeId: 5 }],
      ['get-configurator-capabilities', { include: ['invalid'] }],
    ];
    for (const [tool, args] of invalid) {
      const result = await client.callTool({ name: tool, arguments: args });
      expect(result.isError).toBe(true);
    }
    expect(query).not.toHaveBeenCalled();
    await client.close();
  });

  it('reports a failed query as a tool error the agent can read', async () => {
    const history = new HistoryState();
    const api = configuratorWith(history);
    const client = await connectClient(api, history);
    vi.mocked(api.extended.queryConfigurationOperation).mockRejectedValueOnce(
      new Error('Configuration or selection changed while reading; read again')
    );
    const result = await client.callTool({
      name: 'get-configuration',
      arguments: {},
    });
    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain(
      'Configuration or selection changed while reading'
    );
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
        queryConfigurationOperation: vi.fn(),
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
