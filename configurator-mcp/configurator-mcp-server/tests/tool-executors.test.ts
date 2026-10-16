import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ConfiguratorApi } from '../configurator-api';
import { HistoryState } from '../history-state';
import { HISTORY_EVENT_WAIT_MS, runHistoryStep } from '../tool-executors';

// A configurator page whose undo and redo report the history as the
// configurator does: the event comes before the call returns.
const createConfigurator = (history: HistoryState) => {
  const api: ConfiguratorApi = {
    extended: {
      undo: vi.fn(async () => history.changed(false, true)),
      redo: vi.fn(async () => history.changed(true, false)),
    },
  };
  return api;
};

afterEach(() => {
  vi.useRealTimers();
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

  it('knows nothing of a page before it reports its history', async () => {
    const history = new HistoryState();
    history.changed(true, true);
    history.reset();
    const api = createConfigurator(history);

    expect((await runHistoryStep(api, history, 'undo')).undone).toBe(false);
    expect(api.extended.undo).not.toHaveBeenCalled();
  });

  it('reports a failed page call to the caller', async () => {
    const history = new HistoryState();
    history.changed(true, false);
    const api: ConfiguratorApi = {
      extended: {
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
      extended: { undo: vi.fn(async () => undefined), redo: vi.fn() },
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
