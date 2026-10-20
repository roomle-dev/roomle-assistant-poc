import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import {
  CONFIGURATOR_METHODS,
  createConfiguratorApi,
  type ConfiguratorCapabilitySection,
  type ConfigurationOperationName,
  type ConfigurationOperationPayload,
  type ConfigurationOperationQueryPayload,
  type ConfigurationOperationQueryType,
} from '../configurator-api';
import type { PageBridge } from '../page-bridge';

const createMockBridge = () =>
  ({ call: vi.fn(async () => 'from the page') }) as unknown as PageBridge;

const pageAllowList = (): string[] => {
  const page = readFileSync(
    new URL(
      '../../../minimal-configurator-example/index.html',
      import.meta.url
    ),
    'utf8'
  );
  const list = page.match(/const CONFIGURATOR_METHODS = \[([^\]]*)\]/);
  if (!list) {
    throw new Error('the example page has no CONFIGURATOR_METHODS list');
  }
  return [...list[1].matchAll(/'([^']+)'/g)].map((match) => match[1]);
};

describe('createConfiguratorApi', () => {
  it.each([undefined, [], ['parameters', 'materials']] as (
    | ConfiguratorCapabilitySection[]
    | undefined
  )[])(
    'forwards the capabilities query include %j and preserves JSON and browser identity',
    async (include) => {
      const result = {
        complete: false,
        unresolved: [{ id: 'missing' }],
        parameters: { current: {} },
      };
      const bridge = createMockBridge();
      vi.mocked(bridge.call).mockResolvedValue(result);
      expect(
        await createConfiguratorApi(
          bridge,
          'this-page'
        ).extended.queryConfigurationOperation(
          'capabilities',
          include === undefined ? undefined : { include }
        )
      ).toBe(result);
      expect(bridge.call).toHaveBeenCalledExactlyOnceWith(
        'queryConfigurationOperation',
        include === undefined
          ? ['capabilities']
          : ['capabilities', { include }],
        undefined,
        'this-page'
      );
    }
  );

  it.each([
    ['configuration', undefined],
    ['componentParameters', { runtimeId: 7 }],
    ['dockingPositions', { child: { itemId: 'usm:shelf' } }],
  ] as [
    ConfigurationOperationQueryType,
    ConfigurationOperationQueryPayload | undefined,
  ][])(
    'forwards queryConfigurationOperation %s with payload %j and preserves JSON and browser identity',
    async (type, payload) => {
      const result = { type, context: {}, dockPairs: [] };
      const bridge = createMockBridge();
      vi.mocked(bridge.call).mockResolvedValue(result);
      expect(
        await createConfiguratorApi(
          bridge,
          'this-page'
        ).extended.queryConfigurationOperation(type, payload)
      ).toBe(result);
      expect(bridge.call).toHaveBeenCalledExactlyOnceWith(
        'queryConfigurationOperation',
        payload === undefined ? [type] : [type, payload],
        undefined,
        'this-page'
      );
    }
  );

  it.each([
    [
      'dockComponent',
      { child: { itemId: 'usm:shelf' }, parentId: 1, parentDockId: 0 },
    ],
    ['undo', undefined],
    ['redo', undefined],
  ] as [
    ConfigurationOperationName,
    ConfigurationOperationPayload | undefined,
  ][])(
    'forwards executeConfigurationOperation %s with payload %j and preserves JSON and browser identity',
    async (name, payload) => {
      const result = { type: name, context: {}, configurationHash: 'after' };
      const bridge = createMockBridge();
      vi.mocked(bridge.call).mockResolvedValue(result);
      expect(
        await createConfiguratorApi(
          bridge,
          'this-page'
        ).extended.executeConfigurationOperation(name, payload)
      ).toBe(result);
      expect(bridge.call).toHaveBeenCalledExactlyOnceWith(
        'executeConfigurationOperation',
        payload === undefined ? [name] : [name, payload],
        undefined,
        'this-page'
      );
    }
  );

  it('calls exactly the configurator methods the page bridge exposes', () => {
    const { extended } = createConfiguratorApi(createMockBridge());
    expect(Object.keys(extended).sort()).toEqual(
      [...CONFIGURATOR_METHODS].sort()
    );
    expect(pageAllowList().sort()).toEqual([...CONFIGURATOR_METHODS].sort());
  });

  it('passes the browser identity to the calls', async () => {
    const bridge = createMockBridge();
    await createConfiguratorApi(
      bridge,
      'this-page'
    ).extended.executeConfigurationOperation('undo');
    expect(bridge.call).toHaveBeenCalledWith(
      'executeConfigurationOperation',
      ['undo'],
      undefined,
      'this-page'
    );
  });
});
