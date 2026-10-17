import type { PageBridge } from './page-bridge';

// The configurator methods the tools call. The connected page executes them on
// instance.extended and no other - its allow-list in
// minimal-configurator-example/index.html names the same methods.
export const CONFIGURATOR_METHODS = [
  'undo',
  'redo',
  'getConfiguratorCapabilities',
] as const;
export const CAPABILITY_SECTIONS = [
  'configuration',
  'components',
  'items',
  'parameters',
  'materials',
  'docking',
] as const;
export type ConfiguratorCapabilitySection =
  (typeof CAPABILITY_SECTIONS)[number];

export interface ConfiguratorApi {
  extended: {
    undo(): Promise<void>;
    redo(): Promise<void>;
    getConfiguratorCapabilities(
      include?: ConfiguratorCapabilitySection[]
    ): Promise<unknown>;
  };
}

export const createConfiguratorApi = (
  bridge: PageBridge,
  clientId?: string
): ConfiguratorApi => {
  const call = (
    method: (typeof CONFIGURATOR_METHODS)[number],
    args: unknown[]
  ) =>
    clientId
      ? bridge.call(method, args, undefined, clientId)
      : bridge.call(method, args);
  return {
    extended: {
      undo: async () => {
        await call('undo', []);
      },
      redo: async () => {
        await call('redo', []);
      },
      getConfiguratorCapabilities: (include) =>
        call(
          'getConfiguratorCapabilities',
          include === undefined ? [] : [include]
        ),
    },
  };
};
