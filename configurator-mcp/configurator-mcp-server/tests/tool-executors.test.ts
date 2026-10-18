import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  ConfiguratorApi,
  ConfigurationOperationQueryPayload,
  ConfigurationOperationQueryType,
} from '../configurator-api';
import { createConfiguratorApi } from '../configurator-api';
import { connectHistoryState, HistoryState } from '../history-state';
import { PageBridge } from '../page-bridge';
import {
  HISTORY_EVENT_WAIT_MS,
  runConfigurationOperationQuery,
  runHistoryStep,
  readConfiguratorCapabilities,
} from '../tool-executors';
import { attachPage, historyEvent } from './fake-page-socket';

// A configurator page whose undo and redo report the history as the
// configurator does: the event comes before the call returns.
const createConfigurator = (history: HistoryState) => {
  const api: ConfiguratorApi = {
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
    const events = vi.spyOn(history, 'waitForEvents');
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
    expect(events).not.toHaveBeenCalled();
    expect(api.extended.undo).not.toHaveBeenCalled();
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
      const events = vi.spyOn(history, 'waitForEvents');
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
      expect(events).not.toHaveBeenCalled();
      expect(api.extended.undo).not.toHaveBeenCalled();
      expect(api.extended.redo).not.toHaveBeenCalled();
      expect(api.extended.getConfiguratorCapabilities).not.toHaveBeenCalled();
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
      expect(api.extended.getConfiguratorCapabilities).not.toHaveBeenCalled();
      expect(api.extended.undo).not.toHaveBeenCalled();
      expect(api.extended.redo).not.toHaveBeenCalled();
    }
  );
});

describe('runHistoryStep', () => {
  it('runs undo on the page and reports the history state the page sent after it', async () => {
    const history = new HistoryState();
    history.changed(true, false);
    const api = createConfigurator(history);

    await expect(runHistoryStep(api, history, 'undo')).resolves.toEqual({
      undone: true,
      canUndo: false,
      canRedo: true,
    });
    expect(api.extended.undo).toHaveBeenCalledTimes(1);
  });

  it('runs redo on the page and reports the history state', async () => {
    const history = new HistoryState();
    history.changed(false, true);
    const api = createConfigurator(history);

    await expect(runHistoryStep(api, history, 'redo')).resolves.toEqual({
      redone: true,
      canUndo: true,
      canRedo: false,
    });
    expect(api.extended.redo).toHaveBeenCalledTimes(1);
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
    expect(api.extended.undo).not.toHaveBeenCalled();
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
    expect(api.extended.redo).not.toHaveBeenCalled();
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
    expect(api.extended.undo).toHaveBeenCalledTimes(1);
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
        getConfiguratorCapabilities: vi.fn(async () => ({
          complete: true,
          unresolved: [],
        })),
        queryConfigurationOperation: vi.fn(),
        undo: vi.fn(async () => {
          throw new Error('The configurator page disconnected');
        }),
        redo: vi.fn(),
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
        getConfiguratorCapabilities: vi.fn(async () => ({
          complete: true,
          unresolved: [],
        })),
        queryConfigurationOperation: vi.fn(),
        undo: vi.fn(async () => undefined),
        redo: vi.fn(),
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
        getConfiguratorCapabilities: vi.fn(async () => ({
          complete: true,
          unresolved: [],
        })),
        queryConfigurationOperation: vi.fn(),
        undo: vi.fn(
          () =>
            new Promise<void>((resolve) => {
              order.push('undo started');
              finishUndo = () => {
                history.changed(false, true);
                order.push('undo done');
                resolve();
              };
            })
        ),
        redo: vi.fn(async () => {
          order.push('redo started');
          history.changed(true, false);
        }),
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
