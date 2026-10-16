import { WebSocket } from 'ws';
import type { McpBridgeCall, McpBridgeMessage } from './types';
import { BRIDGE_PROTOCOL, CONFIGURATOR_MCP_PORT } from './types';

export const DEFAULT_CALL_TIMEOUT_MS = 30_000;

interface PendingCall {
  resolve: (result: unknown) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}

const serverPort = () =>
  Number(process.env.CONFIGURATOR_MCP_PORT) || CONFIGURATOR_MCP_PORT;

const examplePageUrl = () =>
  process.env.CONFIGURATOR_MCP_PAGE_URL ??
  `http://localhost:3000/${
    serverPort() === CONFIGURATOR_MCP_PORT ? '' : `?mcp_port=${serverPort()}`
  }`;

export class PageBridge {
  private _page: WebSocket | null = null;
  private _pageUrl = '';
  private _pageProtocol: number | undefined;
  private _clientId: string | undefined;
  private _nextCallId = 1;
  private _pendingCalls = new Map<number, PendingCall>();
  private _historyListeners: Array<(undo: boolean, redo: boolean) => void> = [];
  private _pageListeners: Array<() => void> = [];
  private _pageLostListeners: Array<() => void> = [];

  public onHistoryChange(listener: (undo: boolean, redo: boolean) => void) {
    this._historyListeners.push(listener);
  }

  public onPageAccepted(listener: () => void) {
    this._pageListeners.push(listener);
  }

  public onPageLost(listener: () => void) {
    this._pageLostListeners.push(listener);
  }

  public attachPage(socket: WebSocket): void {
    socket.on('message', (data) => {
      let message: McpBridgeMessage;
      try {
        message = JSON.parse(data.toString());
      } catch {
        return;
      }
      if (typeof message !== 'object' || message === null) {
        return;
      }
      if (message.kind === 'hello') {
        if (this._page && this._page !== socket) {
          if (this._page.readyState === WebSocket.OPEN) {
            socket.close(4409, 'Configurator session in use');
            return;
          }
          this._rejectPendingCalls('The configurator page disconnected');
        }
        this._page = socket;
        this._pageUrl = message.url;
        this._pageProtocol = message.protocol;
        this._clientId = message.clientId;
        for (const listener of this._pageListeners) {
          listener();
        }
        socket.send(JSON.stringify({ kind: 'ready' }));
        console.log(`[configurator-mcp] page connected: ${message.url}`);
        return;
      }
      if (
        message.kind === 'event' &&
        message.name === 'historyChange' &&
        socket === this._page
      ) {
        for (const listener of this._historyListeners) {
          listener(message.undo === true, message.redo === true);
        }
        return;
      }
      // every call goes to the active page, so only the active page answers
      if (message.kind === 'result' && socket === this._page) {
        const pendingCall = this._pendingCalls.get(message.id);
        if (!pendingCall) {
          return;
        }
        this._pendingCalls.delete(message.id);
        clearTimeout(pendingCall.timeout);
        if (message.ok) {
          pendingCall.resolve(message.result);
        } else {
          pendingCall.reject(
            new Error(message.error ?? 'Configurator call failed')
          );
        }
      }
    });
    // ws emits 'error' for a malformed frame; unhandled, it would end the
    // whole server. Terminating the socket hands over to the close handler.
    socket.on('error', (error) => {
      console.error(`[configurator-mcp] page socket failed: ${error.message}`);
      socket.terminate();
    });
    socket.on('close', () => {
      if (this._page === socket) {
        console.log(`[configurator-mcp] page disconnected: ${this._pageUrl}`);
        this._page = null;
        this._clientId = undefined;
        this._rejectPendingCalls('The configurator page disconnected');
        for (const listener of this._pageLostListeners) {
          listener();
        }
      }
    });
  }

  private _rejectPendingCalls(reason: string): void {
    for (const pendingCall of this._pendingCalls.values()) {
      clearTimeout(pendingCall.timeout);
      pendingCall.reject(new Error(reason));
    }
    this._pendingCalls.clear();
  }

  public isClientActive(clientId: string): boolean {
    return (
      this._page?.readyState === WebSocket.OPEN && this._clientId === clientId
    );
  }

  public async call(
    method: string,
    args: unknown[],
    timeoutMs: number = DEFAULT_CALL_TIMEOUT_MS,
    clientId?: string
  ): Promise<unknown> {
    if (clientId && !this.isClientActive(clientId)) {
      throw new Error('This chat is not connected to its configurator page');
    }
    const page = this._page;
    if (!page || page.readyState !== WebSocket.OPEN) {
      throw new Error(
        'No configurator page connected. Have the user open the configurator example in their browser at ' +
          examplePageUrl() +
          ' - the page connects to this server on its own, and the tools work in that tab while it stays open.'
      );
    }
    if (this._pageProtocol !== BRIDGE_PROTOCOL) {
      throw new Error(
        `The connected page (${this._pageUrl}) runs a page bridge of another protocol than ${BRIDGE_PROTOCOL}. ` +
          'Have the user reload the configurator example.'
      );
    }
    const id = this._nextCallId++;
    console.log(`[configurator-mcp] call ${id}: ${method}`);
    const call: McpBridgeCall = { kind: 'call', id, method, args };
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this._pendingCalls.delete(id);
        reject(
          new Error(
            `Configurator call '${method}' timed out after ${timeoutMs}ms`
          )
        );
      }, timeoutMs);
      this._pendingCalls.set(id, { resolve, reject, timeout });
      page.send(JSON.stringify(call));
    });
  }
}
