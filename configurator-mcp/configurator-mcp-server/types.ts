export const CONFIGURATOR_MCP_PORT = 3100;

// 2: the page executes configurator methods, the tool logic runs in the server
export const BRIDGE_PROTOCOL = 2;

export interface McpBridgeHello {
  kind: 'hello';
  example: string;
  url: string;
  protocol?: number;
  clientId?: string;
}

export interface McpBridgeReady {
  kind: 'ready';
}

export interface McpBridgeCall {
  kind: 'call';
  id: number;
  method: string;
  args: unknown[];
}

// The page relays the configurator's onHistoryChange callback, and its last
// state right after the server accepted the page.
export interface McpBridgeEvent {
  kind: 'event';
  name: 'historyChange';
  undo: boolean;
  redo: boolean;
}

export interface McpBridgeResult {
  kind: 'result';
  id: number;
  ok: boolean;
  result?: unknown;
  error?: string;
}

export type McpBridgeMessage =
  | McpBridgeHello
  | McpBridgeReady
  | McpBridgeCall
  | McpBridgeEvent
  | McpBridgeResult;
