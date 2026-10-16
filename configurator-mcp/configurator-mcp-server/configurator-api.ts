import type { PageBridge } from './page-bridge';

// The configurator methods the tools call. The connected page executes them on
// instance.extended and no other - its allow-list in
// minimal-configurator-example/index.html names the same methods.
export const CONFIGURATOR_METHODS = ['undo', 'redo'] as const;

export interface ConfiguratorApi {
  extended: {
    undo(): Promise<void>;
    redo(): Promise<void>;
  };
}

export const createConfiguratorApi = (
  bridge: PageBridge,
  clientId?: string
): ConfiguratorApi => {
  const call = async (method: (typeof CONFIGURATOR_METHODS)[number]) => {
    await (clientId
      ? bridge.call(method, [], undefined, clientId)
      : bridge.call(method, []));
  };
  return {
    extended: {
      undo: () => call('undo'),
      redo: () => call('redo'),
    },
  };
};
