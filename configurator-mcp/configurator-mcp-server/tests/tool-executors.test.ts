import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  ConfiguratorApi,
  ConfigurationOperationName,
  ConfigurationOperationPayload,
  ConfigurationOperationQueryPayload,
  ConfigurationOperationQueryType,
} from '../configurator-api';
import { createConfiguratorApi } from '../configurator-api';
import { connectHistoryState, HistoryState } from '../history-state';
import { ConfiguratorCallTimedOutError, PageBridge } from '../page-bridge';
import {
  HISTORY_EVENT_WAIT_MS,
  runConfigurationOperationQuery,
  runConfigurationOperationWrite,
  runHistoryStep,
  readConfiguratorCapabilities,
} from '../tool-executors';
import { attachPage, historyEvent } from './fake-page-socket';

// A configurator page whose operations report the history as the configurator
// does: the event comes before the call returns.
const createConfigurator = (history: HistoryState) => {
  const api: ConfiguratorApi = {
    extended: {
      queryConfigurationOperation: vi.fn(
        async (type: ConfigurationOperationQueryType) => ({
          type,
          context: {},
          capabilities: { complete: true, unresolved: [] },
        })
      ),
      executeConfigurationOperation: vi.fn(
        async (name: ConfigurationOperationName) => {
          if (name === 'undo') history.changed(false, true);
          else history.changed(true, false);
          return { type: name, context: {}, configurationHash: 'after' };
        }
      ),
    },
  };
  return api;
};

afterEach(() => {
  vi.useRealTimers();
});

describe('readConfiguratorCapabilities', () => {
  it('reads complete or partial capabilities through the query API without waiting for a history event', async () => {
    const history = new HistoryState();
    const api = createConfigurator(history);
    const operations = vi.spyOn(history, 'waitForOperation');
    const query = vi.mocked(api.extended.queryConfigurationOperation);
    for (const complete of [true, false]) {
      const capabilities = {
        complete,
        unresolved: complete ? [] : [{ id: 'missing' }],
      };
      query.mockResolvedValueOnce({
        type: 'capabilities',
        context: {},
        capabilities,
      });
      expect(await readConfiguratorCapabilities(api, ['materials'])).toBe(
        capabilities
      );
    }
    expect(operations).not.toHaveBeenCalled();
    expect(api.extended.executeConfigurationOperation).not.toHaveBeenCalled();
    expect(query).toHaveBeenNthCalledWith(1, 'capabilities', {
      include: ['materials'],
    });
    expect(query).toHaveBeenNthCalledWith(2, 'capabilities', {
      include: ['materials'],
    });
    query.mockRejectedValueOnce(new Error('stale'));
    await expect(readConfiguratorCapabilities(api)).rejects.toThrow('stale');
    expect(query).toHaveBeenLastCalledWith('capabilities', {});
  });
});

describe('runConfigurationOperationQuery', () => {
  it.each([
    ['configuration', {}, {}],
    ['componentParameters', { runtimeId: 7 }, { runtimeId: 7 }],
    ['globalParameters', {}, {}],
    ['possibleChildren', {}, {}],
    ['possibleChildren', { runtimeId: 3 }, { runtimeId: 3 }],
    [
      'dockingPositions',
      { child: { componentId: 'usm:shelf' } },
      { child: { componentId: 'usm:shelf' } },
    ],
    [
      'dockingPositions',
      { child: { itemId: 'usm:shelf' }, allowInsertInBetween: true },
      { child: { itemId: 'usm:shelf' }, allowInsertInBetween: true },
    ],
    [
      'dockingPositions',
      { child: { configuration: '{"rootComponent":{}}' } },
      { child: { configuration: '{"rootComponent":{}}' } },
    ],
    ['componentDockingPositions', { runtimeId: 5 }, { runtimeId: 5 }],
    [
      'componentDockingPositions',
      { runtimeId: 5, allowInsertInBetween: true },
      { runtimeId: 5, allowInsertInBetween: true },
    ],
    [
      'deleteImpact',
      { runtimeId: 5, redockChildrenToParent: true },
      { runtimeId: 5, redockChildrenToParent: true },
    ],
    [
      'deleteImpact',
      { runtimeId: 5, redockChildrenToParent: false },
      { runtimeId: 5, redockChildrenToParent: false },
    ],
  ] as [
    ConfigurationOperationQueryType,
    ConfigurationOperationQueryPayload,
    ConfigurationOperationQueryPayload,
  ][])(
    'relays %s with payload %j and never touches the history',
    async (type, payload, expected) => {
      const history = new HistoryState();
      const api = createConfigurator(history);
      const operations = vi.spyOn(history, 'waitForOperation');
      const result = { type, context: {}, dockPairs: [] };
      vi.mocked(api.extended.queryConfigurationOperation).mockResolvedValueOnce(
        result
      );

      await expect(
        runConfigurationOperationQuery(api, type, payload)
      ).resolves.toBe(result);
      expect(
        api.extended.queryConfigurationOperation
      ).toHaveBeenCalledExactlyOnceWith(type, expected);
      expect(operations).not.toHaveBeenCalled();
      expect(api.extended.executeConfigurationOperation).not.toHaveBeenCalled();
    }
  );

  it.each([
    ['capabilities', { include: ['nope'] }],
    ['capabilities', { include: 'parameters' }],
    ['componentParameters', {}],
    ['componentParameters', { runtimeId: 'x' }],
    ['possibleChildren', { runtimeId: 'x' }],
    ['dockingPositions', {}],
    ['dockingPositions', { child: {} }],
    ['dockingPositions', { child: { componentId: 'a', itemId: 'b' } }],
    ['dockingPositions', { child: { componentId: 4 } }],
    [
      'dockingPositions',
      { child: { itemId: 'usm:shelf' }, allowInsertInBetween: 'yes' },
    ],
    ['componentDockingPositions', {}],
    ['componentDockingPositions', { runtimeId: 5, allowInsertInBetween: 1 }],
    ['deleteImpact', { runtimeId: 5 }],
    ['deleteImpact', { runtimeId: 5, redockChildrenToParent: 1 }],
  ] as [ConfigurationOperationQueryType, ConfigurationOperationQueryPayload][])(
    'rejects the %s payload %j before any page call',
    async (type, payload) => {
      const history = new HistoryState();
      const api = createConfigurator(history);

      await expect(
        runConfigurationOperationQuery(api, type, payload)
      ).rejects.toThrow(/invalid/i);
      expect(api.extended.queryConfigurationOperation).not.toHaveBeenCalled();
      expect(api.extended.executeConfigurationOperation).not.toHaveBeenCalled();
    }
  );
});

describe('runHistoryStep', () => {
  it('runs undo on the page through the execute API and reports the history state the page sent after it', async () => {
    const history = new HistoryState();
    history.changed(true, false);
    const api = createConfigurator(history);

    await expect(runHistoryStep(api, history, 'undo')).resolves.toEqual({
      undone: true,
      canUndo: false,
      canRedo: true,
    });
    expect(
      api.extended.executeConfigurationOperation
    ).toHaveBeenCalledExactlyOnceWith('undo');
  });

  it('runs redo on the page through the execute API and reports the history state', async () => {
    const history = new HistoryState();
    history.changed(false, true);
    const api = createConfigurator(history);

    await expect(runHistoryStep(api, history, 'redo')).resolves.toEqual({
      redone: true,
      canUndo: true,
      canRedo: false,
    });
    expect(
      api.extended.executeConfigurationOperation
    ).toHaveBeenCalledExactlyOnceWith('redo');
  });

  it('answers nothing to undo as a result, not an error, without calling the page', async () => {
    const history = new HistoryState();
    history.changed(false, false);
    const api = createConfigurator(history);

    await expect(runHistoryStep(api, history, 'undo')).resolves.toEqual({
      undone: false,
      canUndo: false,
      canRedo: false,
      hint: 'Nothing to undo: the configuration has no change that undo can revert.',
    });
    expect(api.extended.executeConfigurationOperation).not.toHaveBeenCalled();
  });

  it('answers nothing to redo as a result, not an error', async () => {
    const history = new HistoryState();
    history.changed(true, false);
    const api = createConfigurator(history);

    const result = await runHistoryStep(api, history, 'redo');
    expect(result).toEqual({
      redone: false,
      canUndo: true,
      canRedo: false,
      hint: expect.stringMatching(/^Nothing to redo: /),
    });
    expect(api.extended.executeConfigurationOperation).not.toHaveBeenCalled();
  });

  it('asks the page while it has not reported its history', async () => {
    const history = new HistoryState();
    history.changed(false, false);
    history.reset();
    const api = createConfigurator(history);

    await expect(runHistoryStep(api, history, 'undo')).resolves.toEqual({
      undone: true,
      canUndo: false,
      canRedo: true,
    });
    expect(
      api.extended.executeConfigurationOperation
    ).toHaveBeenCalledExactlyOnceWith('undo');
  });

  it('fails with the connection error, not with nothing to undo, while no page is connected', async () => {
    const bridge = new PageBridge();
    const history = new HistoryState();
    connectHistoryState(bridge, history);
    const api = createConfiguratorApi(bridge);
    vi.spyOn(console, 'log').mockImplementation(() => {});

    await expect(runHistoryStep(api, history, 'undo')).rejects.toThrow(
      /^No configurator page connected/
    );

    const socket = attachPage(bridge);
    socket.receive(historyEvent(false, false));
    expect(history.reported).toBe(true);
    socket.close();
    expect(history.reported).toBe(false);
    await expect(runHistoryStep(api, history, 'redo')).rejects.toThrow(
      /^No configurator page connected/
    );
    vi.restoreAllMocks();
  });

  it('reports a failed page call to the caller', async () => {
    const history = new HistoryState();
    history.changed(true, false);
    const api: ConfiguratorApi = {
      extended: {
        queryConfigurationOperation: vi.fn(),
        executeConfigurationOperation: vi.fn(
          async (name: ConfigurationOperationName) => {
            if (name === 'undo') {
              throw new Error('The configurator page disconnected');
            }
          }
        ),
      },
    };

    await expect(runHistoryStep(api, history, 'undo')).rejects.toThrow(
      'The configurator page disconnected'
    );
  });

  it('reports the last known history state when the page sends no event in time', async () => {
    vi.useFakeTimers();
    const history = new HistoryState();
    history.changed(true, false);
    const api: ConfiguratorApi = {
      extended: {
        queryConfigurationOperation: vi.fn(),
        executeConfigurationOperation: vi.fn(async () => undefined),
      },
    };

    const step = runHistoryStep(api, history, 'undo');
    await vi.advanceTimersByTimeAsync(HISTORY_EVENT_WAIT_MS);

    await expect(step).resolves.toEqual({
      undone: false,
      canUndo: true,
      canRedo: false,
      hint: 'The configurator did not report the undo - the configuration may be unchanged.',
    });
  });

  it('runs undo and redo one at a time', async () => {
    const history = new HistoryState();
    history.changed(true, false);
    const order: string[] = [];
    let finishUndo = () => {};
    const api: ConfiguratorApi = {
      extended: {
        queryConfigurationOperation: vi.fn(),
        executeConfigurationOperation: vi.fn(
          (name: ConfigurationOperationName) => {
            if (name === 'undo') {
              return new Promise<void>((resolve) => {
                order.push('undo started');
                finishUndo = () => {
                  history.changed(false, true);
                  order.push('undo done');
                  resolve();
                };
              });
            }
            order.push('redo started');
            history.changed(true, false);
            return Promise.resolve();
          }
        ),
      },
    };

    const undo = runHistoryStep(api, history, 'undo');
    const redo = runHistoryStep(api, history, 'redo');
    await vi.waitFor(() => expect(order).toEqual(['undo started']));
    finishUndo();

    await expect(undo).resolves.toMatchObject({ undone: true });
    await expect(redo).resolves.toMatchObject({ redone: true });
    expect(order).toEqual(['undo started', 'undo done', 'redo started']);
  });
});

describe('runConfigurationOperationWrite', () => {
  it.each([
    [
      'changeComponentParameter',
      { runtimeId: 7, key: 'width', value: '120' },
      { runtimeId: 7, key: 'width', value: '120' },
    ],
    [
      'changeGlobalParameter',
      { key: 'height', value: '80' },
      { key: 'height', value: '80' },
    ],
    [
      'dockComponent',
      { child: { itemId: 'usm:shelf' }, parentId: 1, parentDockId: 0 },
      { child: { itemId: 'usm:shelf' }, parentId: 1, parentDockId: 0 },
    ],
    [
      'dockComponent',
      {
        child: { componentId: 'usm:shelf' },
        parentId: 1,
        parentDockId: 0,
        position: { x: 0, y: 0, z: 0 },
        insertInBetween: true,
      },
      {
        child: { componentId: 'usm:shelf' },
        parentId: 1,
        parentDockId: 0,
        position: { x: 0, y: 0, z: 0 },
        insertInBetween: true,
      },
    ],
    [
      'dragComponent',
      { runtimeId: 7, parentId: 1, parentDockId: 0, childDockId: 2 },
      { runtimeId: 7, parentId: 1, parentDockId: 0, childDockId: 2 },
    ],
    [
      'deleteComponent',
      { runtimeId: 7, redockChildrenToParent: true },
      { runtimeId: 7, redockChildrenToParent: true },
    ],
    [
      'loadConfiguration',
      { configuration: '{"componentId":"usm:frame"}' },
      { configuration: '{"componentId":"usm:frame"}' },
    ],
  ] as [
    ConfigurationOperationName,
    ConfigurationOperationPayload,
    ConfigurationOperationPayload,
  ][])(
    'relays %s with payload %j and confirms the history event',
    async (name, payload, expected) => {
      const history = new HistoryState();
      const api = createConfigurator(history);
      const operations = vi.spyOn(history, 'waitForOperation');
      const execute = vi.mocked(api.extended.executeConfigurationOperation);

      await expect(
        runConfigurationOperationWrite(api, history, name, payload)
      ).resolves.toEqual({
        type: name,
        context: {},
        configurationHash: 'after',
        confirmed: true,
        canUndo: true,
        canRedo: false,
      });
      expect(execute).toHaveBeenCalledExactlyOnceWith(name, expected);
      expect(operations).toHaveBeenCalledExactlyOnceWith(
        1,
        HISTORY_EVENT_WAIT_MS
      );
    }
  );

  it('strips the keys a dock pair read returns but the operation does not take', async () => {
    const history = new HistoryState();
    const api = createConfigurator(history);
    const execute = vi.mocked(api.extended.executeConfigurationOperation);

    await runConfigurationOperationWrite(api, history, 'dockComponent', {
      child: { itemId: 'usm:shelf' },
      parentId: 1,
      parentDockId: 0,
      childDockId: 3,
      lineSegments: [],
      displacedComponents: [],
    });

    expect(execute).toHaveBeenCalledExactlyOnceWith('dockComponent', {
      child: { itemId: 'usm:shelf' },
      parentId: 1,
      parentDockId: 0,
    });
  });

  it.each([
    ['changeComponentParameter', { runtimeId: 7, key: 'width' }],
    ['changeComponentParameter', { runtimeId: 'x', key: 'width', value: '1' }],
    ['changeGlobalParameter', { value: '1' }],
    ['dockComponent', { parentId: 1, parentDockId: 0 }],
    ['dockComponent', { child: {}, parentId: 1, parentDockId: 0 }],
    ['dockComponent', { child: { itemId: 'usm:shelf' } }],
    [
      'dockComponent',
      { child: { itemId: 'usm:shelf' }, parentId: 1, parentDockId: '0' },
    ],
    [
      'dockComponent',
      {
        child: { itemId: 'usm:shelf' },
        parentId: 1,
        parentDockId: 0,
        position: { x: 0, y: 0 },
      },
    ],
    [
      'dockComponent',
      {
        child: { itemId: 'usm:shelf' },
        parentId: 1,
        parentDockId: 0,
        insertInBetween: 1,
      },
    ],
    ['dragComponent', { runtimeId: 7, parentId: 1, parentDockId: 0 }],
    ['deleteComponent', { runtimeId: 7 }],
    ['deleteComponent', { runtimeId: 7, redockChildrenToParent: 'yes' }],
    ['loadConfiguration', {}],
    ['loadConfiguration', { configuration: 4 }],
  ] as [ConfigurationOperationName, ConfigurationOperationPayload][])(
    'rejects the %s payload %j before any page call',
    async (name, payload) => {
      const history = new HistoryState();
      const api = createConfigurator(history);

      await expect(
        runConfigurationOperationWrite(api, history, name, payload)
      ).rejects.toThrow(/invalid/i);
      expect(api.extended.executeConfigurationOperation).not.toHaveBeenCalled();
    }
  );

  it('reports the history state and a hint when the page sends no event in time', async () => {
    vi.useFakeTimers();
    const history = new HistoryState();
    history.changed(true, false);
    const api: ConfiguratorApi = {
      extended: {
        queryConfigurationOperation: vi.fn(),
        executeConfigurationOperation: vi.fn(async () => ({
          type: 'deleteComponent',
          context: {},
          configurationHash: 'after',
          runtimeId: 7,
          redockChildrenToParent: true,
          componentsDeleted: [7],
        })),
      },
    };

    const write = runConfigurationOperationWrite(
      api,
      history,
      'deleteComponent',
      { runtimeId: 7, redockChildrenToParent: true }
    );
    await vi.advanceTimersByTimeAsync(HISTORY_EVENT_WAIT_MS);

    await expect(write).resolves.toEqual({
      type: 'deleteComponent',
      context: {},
      configurationHash: 'after',
      runtimeId: 7,
      redockChildrenToParent: true,
      componentsDeleted: [7],
      confirmed: false,
      canUndo: true,
      canRedo: false,
      hint: 'The configurator did not report the change - the configuration may be unchanged.',
    });
  });

  it('runs writes one at a time', async () => {
    const history = new HistoryState();
    const order: string[] = [];
    let finishDock = () => {};
    const api: ConfiguratorApi = {
      extended: {
        queryConfigurationOperation: vi.fn(),
        executeConfigurationOperation: vi.fn(
          (name: ConfigurationOperationName) => {
            order.push(`${name} started`);
            if (name === 'dockComponent') {
              return new Promise((resolve) => {
                finishDock = () => {
                  history.changed(true, false);
                  order.push('dock done');
                  resolve({ type: name, context: {}, configurationHash: 'a' });
                };
              });
            }
            history.changed(true, false);
            order.push('delete done');
            return Promise.resolve({
              type: name,
              context: {},
              configurationHash: 'b',
            });
          }
        ),
      },
    };

    const dock = runConfigurationOperationWrite(api, history, 'dockComponent', {
      child: { itemId: 'usm:shelf' },
      parentId: 1,
      parentDockId: 0,
    });
    const deletion = runConfigurationOperationWrite(
      api,
      history,
      'deleteComponent',
      { runtimeId: 7, redockChildrenToParent: true }
    );
    await vi.waitFor(() => expect(order).toEqual(['dockComponent started']));
    finishDock();

    await expect(dock).resolves.toMatchObject({ confirmed: true });
    await expect(deletion).resolves.toMatchObject({ confirmed: true });
    expect(order).toEqual([
      'dockComponent started',
      'dock done',
      'deleteComponent started',
      'delete done',
    ]);
  });

  it('does not confirm a write with the late history event of a timed-out write', async () => {
    vi.useFakeTimers();
    const history = new HistoryState();
    let timeOutDock = () => {};
    const api: ConfiguratorApi = {
      extended: {
        queryConfigurationOperation: vi.fn(),
        executeConfigurationOperation: vi.fn(
          (name: ConfigurationOperationName) => {
            if (name === 'dockComponent') {
              // The page received the write but answers too late; the
              // operation still lands and reports its history event later.
              return new Promise((_, reject) => {
                timeOutDock = () =>
                  reject(
                    new ConfiguratorCallTimedOutError(
                      'executeConfigurationOperation',
                      30_000
                    )
                  );
              });
            }
            // The second write's page call resolves without a history event.
            return Promise.resolve({
              type: name,
              context: {},
              configurationHash: 'after',
            });
          }
        ),
      },
    };

    const timedOut = runConfigurationOperationWrite(
      api,
      history,
      'dockComponent',
      { child: { itemId: 'usm:shelf' }, parentId: 1, parentDockId: 0 }
    );
    const second = runConfigurationOperationWrite(
      api,
      history,
      'deleteComponent',
      { runtimeId: 7, redockChildrenToParent: true }
    );
    await vi.advanceTimersByTimeAsync(0);
    timeOutDock();
    await expect(timedOut).rejects.toThrow(/timed out/);
    await vi.advanceTimersByTimeAsync(0);
    // The timed-out write's history event arrives while the second write waits.
    history.changed(true, false);
    await vi.advanceTimersByTimeAsync(HISTORY_EVENT_WAIT_MS);

    await expect(second).resolves.toMatchObject({
      confirmed: false,
      hint: 'The configurator did not report the change - the configuration may be unchanged.',
    });
  });

  it('confirms the write after a failed page call by its own history event', async () => {
    const history = new HistoryState();
    let fail = true;
    const api: ConfiguratorApi = {
      extended: {
        queryConfigurationOperation: vi.fn(),
        executeConfigurationOperation: vi.fn(
          async (name: ConfigurationOperationName) => {
            if (fail) {
              throw new Error('No configurator page connected.');
            }
            history.changed(true, false);
            return { type: name, context: {}, configurationHash: 'after' };
          }
        ),
      },
    };

    await expect(
      runConfigurationOperationWrite(api, history, 'undo', {})
    ).rejects.toThrow('No configurator page connected.');
    fail = false;

    await expect(
      runConfigurationOperationWrite(api, history, 'deleteComponent', {
        runtimeId: 7,
        redockChildrenToParent: true,
      })
    ).resolves.toMatchObject({ confirmed: true });
  });

  it('confirms the write after an unconfirmed one by its own history event', async () => {
    vi.useFakeTimers();
    const history = new HistoryState();
    const api: ConfiguratorApi = {
      extended: {
        queryConfigurationOperation: vi.fn(),
        executeConfigurationOperation: vi.fn(
          async (name: ConfigurationOperationName) => {
            // The first write changes nothing and reports no history event.
            if (name === 'changeComponentParameter') {
              return { type: name, context: {}, configurationHash: 'same' };
            }
            history.changed(true, false);
            return { type: name, context: {}, configurationHash: 'after' };
          }
        ),
      },
    };

    const unchanged = runConfigurationOperationWrite(
      api,
      history,
      'changeComponentParameter',
      { runtimeId: 7, key: 'width', value: '120' }
    );
    await vi.advanceTimersByTimeAsync(HISTORY_EVENT_WAIT_MS);
    await expect(unchanged).resolves.toMatchObject({ confirmed: false });

    const write = runConfigurationOperationWrite(
      api,
      history,
      'deleteComponent',
      { runtimeId: 7, redockChildrenToParent: true }
    );
    await expect(write).resolves.toMatchObject({ confirmed: true });
  });

  it('reports a failed page call to the caller', async () => {
    const history = new HistoryState();
    history.changed(true, false);
    const api: ConfiguratorApi = {
      extended: {
        queryConfigurationOperation: vi.fn(),
        executeConfigurationOperation: vi.fn(async () => {
          throw new Error('No configurator page connected.');
        }),
      },
    };

    await expect(
      runConfigurationOperationWrite(api, history, 'undo', {})
    ).rejects.toThrow('No configurator page connected.');
  });
});
