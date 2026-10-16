import type { ConfiguratorApi } from './configurator-api';
import type { HistoryState } from './history-state';

export type HistoryDirection = 'undo' | 'redo';

// The page relays the history event of an undo or redo before the result of
// the call; the wait only bounds a step the configurator did not take.
export const HISTORY_EVENT_WAIT_MS = 1000;

const NOTHING_TO: Record<HistoryDirection, string> = {
  undo: 'Nothing to undo: the configuration has no change that undo can revert.',
  redo: 'Nothing to redo: redo brings back a change that undo reverted, and a new change of the configuration ends redo.',
};

const NOT_CONFIRMED: Record<HistoryDirection, string> = {
  undo: 'The configurator did not report the undo - the configuration may be unchanged.',
  redo: 'The configurator did not report the redo - the configuration may be unchanged.',
};

export interface HistoryStepResult {
  undone?: boolean;
  redone?: boolean;
  canUndo: boolean;
  canRedo: boolean;
  hint?: string;
}

// One undo or redo at a time: each is confirmed by the next history event, so
// two at once would take each other's event.
let historySteps: Promise<unknown> = Promise.resolve();

const oneAtATime = <T>(run: () => Promise<T>): Promise<T> => {
  const next = historySteps.then(run);
  historySteps = next.catch(() => undefined);
  return next;
};

/** One step of the configurator's undo history, as the configurator's own undo and redo buttons take it. */
export const runHistoryStep = (
  configuratorApi: ConfiguratorApi,
  history: HistoryState,
  direction: HistoryDirection
): Promise<HistoryStepResult> =>
  oneAtATime(async () => {
    const done = direction === 'undo' ? 'undone' : 'redone';
    const state = () => ({
      canUndo: history.canUndo,
      canRedo: history.canRedo,
    });
    const possible = direction === 'undo' ? history.canUndo : history.canRedo;
    if (!possible) {
      return { [done]: false, ...state(), hint: NOTHING_TO[direction] };
    }
    const eventsBefore = history.events;
    await configuratorApi.extended[direction]();
    const confirmed = await history.waitForEvents(
      eventsBefore + 1,
      HISTORY_EVENT_WAIT_MS
    );
    return {
      [done]: confirmed,
      ...state(),
      ...(!confirmed && { hint: NOT_CONFIRMED[direction] }),
    };
  });
