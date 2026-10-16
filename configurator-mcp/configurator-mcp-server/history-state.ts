import type { PageBridge } from './page-bridge';

// The configurator's undo history as the page reports it: whether an undo and
// a redo are possible, from the last history event, and the number of events.
// Until a page reports it, the state is unknown.
export class HistoryState {
  private _reported = false;
  private _canUndo = false;
  private _canRedo = false;
  private _events = 0;
  private _waiters = new Set<() => void>();

  public get reported(): boolean {
    return this._reported;
  }

  public get canUndo(): boolean {
    return this._canUndo;
  }

  public get canRedo(): boolean {
    return this._canRedo;
  }

  public get events(): number {
    return this._events;
  }

  public changed(undo: boolean, redo: boolean): void {
    this._reported = true;
    this._canUndo = undo;
    this._canRedo = redo;
    this._events += 1;
    for (const wake of this._waiters) {
      wake();
    }
  }

  /** A page was accepted or lost: nothing is known of the history until a page reports it. */
  public reset(): void {
    this._reported = false;
    this._canUndo = false;
    this._canRedo = false;
  }

  /** Resolves true once `count` events have arrived, false after the timeout. */
  public waitForEvents(count: number, timeoutMs: number): Promise<boolean> {
    if (this._events >= count) {
      return Promise.resolve(true);
    }
    return new Promise((resolve) => {
      const finish = (reached: boolean) => {
        clearTimeout(timer);
        this._waiters.delete(wake);
        resolve(reached);
      };
      const wake = () => {
        if (this._events >= count) {
          finish(true);
        }
      };
      const timer = setTimeout(() => finish(false), timeoutMs);
      this._waiters.add(wake);
    });
  }
}

export const historyState = new HistoryState();

export const connectHistoryState = (
  bridge: PageBridge,
  history: HistoryState
): void => {
  bridge.onHistoryChange((undo, redo) => history.changed(undo, redo));
  bridge.onPageAccepted(() => history.reset());
  bridge.onPageLost(() => history.reset());
};
