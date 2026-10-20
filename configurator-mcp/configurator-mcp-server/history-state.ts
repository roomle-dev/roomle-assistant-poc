import type { PageBridge } from './page-bridge';

// The configurator's undo history as the page reports it: whether an undo and
// a redo are possible, from the last history event. Until a page reports it,
// the state is unknown. A history event also confirms the oldest operation
// the server sent that is still waiting, so the late event of a timed-out
// operation cannot confirm the operation after it.
export class HistoryState {
  private _reported = false;
  private _canUndo = false;
  private _canRedo = false;
  private _sentOperations = 0;
  private _confirmedOperations = 0;
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

  public changed(undo: boolean, redo: boolean): void {
    this._reported = true;
    this._canUndo = undo;
    this._canRedo = redo;
    if (this._confirmedOperations < this._sentOperations) {
      this._confirmedOperations += 1;
    }
    for (const wake of this._waiters) {
      wake();
    }
  }

  /** A page was accepted or lost: nothing is known of the history until a page reports it. */
  public reset(): void {
    this._reported = false;
    this._canUndo = false;
    this._canRedo = false;
    this._sentOperations = 0;
    this._confirmedOperations = 0;
  }

  /** Registers an operation sent to the page and returns its serial. */
  public operationSent(): number {
    this._sentOperations += 1;
    return this._sentOperations;
  }

  /** The operation will not be confirmed by a history event; its slot is released. */
  public operationFailed(): void {
    this._sentOperations = Math.max(
      this._confirmedOperations,
      this._sentOperations - 1
    );
  }

  /** Resolves true once the operation with the serial is confirmed, false after the timeout. */
  public waitForOperation(serial: number, timeoutMs: number): Promise<boolean> {
    if (this._confirmedOperations >= serial) {
      return Promise.resolve(true);
    }
    return new Promise((resolve) => {
      const finish = (reached: boolean) => {
        clearTimeout(timer);
        this._waiters.delete(wake);
        resolve(reached);
      };
      const wake = () => {
        if (this._confirmedOperations >= serial) {
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
