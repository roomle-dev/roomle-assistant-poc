import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import {
  CONFIGURATOR_METHODS,
  createConfiguratorApi,
  type ConfiguratorCapabilitySection,
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
    'forwards capabilities include %j and preserves JSON and browser identity',
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
        ).extended.getConfiguratorCapabilities(include)
      ).toBe(result);
      expect(bridge.call).toHaveBeenCalledExactlyOnceWith(
        'getConfiguratorCapabilities',
        include === undefined ? [] : [include],
        undefined,
        'this-page'
      );
    }
  );

  it('forwards undo and redo without arguments and with the default timeout', async () => {
    const bridge = createMockBridge();
    const { extended } = createConfiguratorApi(bridge);
    await expect(extended.undo()).resolves.toBeUndefined();
    expect(bridge.call).toHaveBeenCalledWith('undo', []);
    await expect(extended.redo()).resolves.toBeUndefined();
    expect(bridge.call).toHaveBeenCalledWith('redo', []);
  });

  it('calls exactly the configurator methods the page bridge exposes', () => {
    const { extended } = createConfiguratorApi(createMockBridge());
    expect(Object.keys(extended).sort()).toEqual(
      [...CONFIGURATOR_METHODS].sort()
    );
    expect(pageAllowList().sort()).toEqual([...CONFIGURATOR_METHODS].sort());
  });

  it('passes the browser identity to the calls', async () => {
    const bridge = createMockBridge();
    await createConfiguratorApi(bridge, 'this-page').extended.undo();
    expect(bridge.call).toHaveBeenCalledWith(
      'undo',
      [],
      undefined,
      'this-page'
    );
  });
});
