import { describe, expect, it, vi } from 'vitest';
import { WebSocket } from 'ws';
import { DEFAULT_CALL_TIMEOUT_MS, PageBridge } from '../page-bridge';
import { BRIDGE_PROTOCOL } from '../types';
import { attachPage, FakePageSocket, historyEvent } from './fake-page-socket';

describe('PageBridge.call', () => {
  it('round-trips capability arguments and structured JSON and propagates SDK errors', async () => {
    const bridge = new PageBridge();
    const socket = attachPage(bridge, { clientId: 'reader' });
    const result = {
      complete: true,
      unresolved: [],
      components: { 'test:root': { label: 'Root' } },
    };
    socket.respond = vi.fn(() => result);
    expect(
      await bridge.call(
        'getConfiguratorCapabilities',
        [['components']],
        undefined,
        'reader'
      )
    ).toEqual(result);
    expect(socket.respond).toHaveBeenCalledExactlyOnceWith(
      'getConfiguratorCapabilities',
      [['components']]
    );
    socket.respond = undefined;
    const pending = bridge.call('getConfiguratorCapabilities', []);
    const call = JSON.parse(socket.sent.at(-1)!);
    socket.receive({
      kind: 'result',
      id: call.id,
      ok: false,
      error: 'Update the Rubens UI',
    });
    await expect(pending).rejects.toThrow('Update the Rubens UI');
    socket.close();
  });

  it('round-trips configuration query arguments and structured dock-pair results', async () => {
    const bridge = new PageBridge();
    const socket = attachPage(bridge, { clientId: 'reader' });
    const result = {
      type: 'dockingPositions',
      context: { configurationHash: 'abc' },
      allowInsertInBetween: false,
      dockPairs: [
        {
          parentId: 1,
          parentDockId: 'd1',
          childDockId: 'd2',
          position: { x: 0, y: 0, z: 0 },
          lineSegments: [],
          displacedComponents: [],
        },
      ],
    };
    socket.respond = vi.fn(() => result);
    expect(
      await bridge.call(
        'queryConfigurationOperation',
        ['dockingPositions', { child: { itemId: 'usm:shelf' } }],
        undefined,
        'reader'
      )
    ).toEqual(result);
    expect(socket.respond).toHaveBeenCalledExactlyOnceWith(
      'queryConfigurationOperation',
      ['dockingPositions', { child: { itemId: 'usm:shelf' } }]
    );
    socket.respond = undefined;
    const pending = bridge.call('queryConfigurationOperation', [
      'configuration',
    ]);
    const call = JSON.parse(socket.sent.at(-1)!);
    socket.receive({
      kind: 'result',
      id: call.id,
      ok: false,
      error: 'Configuration or selection changed while reading; read again',
    });
    await expect(pending).rejects.toThrow(
      'Configuration or selection changed while reading; read again'
    );
    socket.close();
  });

  it('rejects with the example URL when no page is connected', async () => {
    vi.stubEnv('CONFIGURATOR_MCP_PAGE_URL', undefined);
    vi.stubEnv('CONFIGURATOR_MCP_PORT', undefined);
    try {
      await expect(new PageBridge().call('undo', [])).rejects.toThrow(
        /No configurator page connected.*http:\/\/localhost:3000\/ - the page connects/s
      );
      vi.stubEnv('CONFIGURATOR_MCP_PORT', '3101');
      await expect(new PageBridge().call('undo', [])).rejects.toThrow(
        'http://localhost:3000/?mcp_port=3101 - '
      );
      vi.stubEnv('CONFIGURATOR_MCP_PAGE_URL', 'http://localhost:3005/');
      await expect(new PageBridge().call('undo', [])).rejects.toThrow(
        'http://localhost:3005/ - '
      );
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('relays the configurator call to the page and resolves on the result', async () => {
    const bridge = new PageBridge();
    const socket = attachPage(bridge);

    const promise = bridge.call('undo', []);
    expect(JSON.parse(socket.sent[0])).toEqual({ kind: 'ready' });
    expect(JSON.parse(socket.sent[1])).toEqual({
      kind: 'call',
      id: 1,
      method: 'undo',
      args: [],
    });

    socket.receive({ kind: 'result', id: 1, ok: true });
    await expect(promise).resolves.toBeUndefined();
  });

  it('rejects calls with a reload hint when the page runs another bridge protocol', async () => {
    const bridge = new PageBridge();
    const socket = attachPage(bridge, { protocol: undefined });
    await expect(bridge.call('undo', [])).rejects.toThrow(
      /another protocol than 2.*reload the configurator example/s
    );
    expect(socket.sent).toHaveLength(1);
  });

  it('rejects on an error result and correlates ids', async () => {
    const bridge = new PageBridge();
    const socket = attachPage(bridge);

    const first = bridge.call('undo', []);
    const second = bridge.call('redo', []);
    socket.receive({ kind: 'result', id: 2, ok: false, error: 'boom' });
    await expect(second).rejects.toThrow('boom');
    socket.receive({ kind: 'result', id: 1, ok: true, result: 'undone' });
    await expect(first).resolves.toBe('undone');
  });

  it('times out a call that the page never answers', async () => {
    vi.useFakeTimers();
    try {
      const bridge = new PageBridge();
      attachPage(bridge);
      const promise = bridge.call('undo', [], 500);
      vi.advanceTimersByTime(500);
      await expect(promise).rejects.toThrow(
        "Configurator call 'undo' timed out after 500ms"
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it('uses the default timeout of 30 seconds', async () => {
    vi.useFakeTimers();
    try {
      const bridge = new PageBridge();
      attachPage(bridge);
      const promise = bridge.call('undo', []);
      vi.advanceTimersByTime(DEFAULT_CALL_TIMEOUT_MS - 1);
      const settled = await Promise.race([
        promise.then(
          () => 'settled',
          () => 'settled'
        ),
        Promise.resolve('pending'),
      ]);
      expect(settled).toBe('pending');
      vi.advanceTimersByTime(1);
      await expect(promise).rejects.toThrow(
        `timed out after ${DEFAULT_CALL_TIMEOUT_MS}ms`
      );
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('PageBridge page lifecycle', () => {
  it('ignores malformed frames and a JSON null frame instead of throwing from the socket listener', () => {
    const bridge = new PageBridge();
    const socket = attachPage(bridge);
    expect(() => socket.receive(null)).not.toThrow();
    expect(() => socket.receive('not an object')).not.toThrow();
  });

  it('rejects a second page without disrupting the active call', async () => {
    const bridge = new PageBridge();
    const first = attachPage(bridge);
    const pending = bridge.call('undo', []);

    const second = new FakePageSocket();
    bridge.attachPage(second as unknown as WebSocket);
    second.receive({
      kind: 'hello',
      example: 'minimal-configurator-example',
      url: 'http://localhost:3000/',
      protocol: BRIDGE_PROTOCOL,
    });

    expect(second.readyState).toBe(WebSocket.CLOSED);
    expect(second.sent).toHaveLength(0);
    expect(first.readyState).toBe(WebSocket.OPEN);
    first.receive({ kind: 'result', id: 1, ok: true });
    await expect(pending).resolves.toBeUndefined();
  });

  it('only lets the matching browser chat call its page', async () => {
    const bridge = new PageBridge();
    const socket = attachPage(bridge, { clientId: 'first' });
    expect(bridge.isClientActive('first')).toBe(true);
    expect(bridge.isClientActive('second')).toBe(false);
    await expect(bridge.call('undo', [], undefined, 'second')).rejects.toThrow(
      'This chat is not connected to its configurator page'
    );
    expect(socket.sent).toHaveLength(1);
    const pending = bridge.call('undo', [], undefined, 'first');
    socket.receive({ kind: 'result', id: 1, ok: true });
    await expect(pending).resolves.toBeUndefined();
    socket.close();
    expect(bridge.isClientActive('first')).toBe(false);
  });

  it('drops a page whose socket fails instead of ending the server', async () => {
    const bridge = new PageBridge();
    const socket = attachPage(bridge);
    const pending = bridge.call('undo', []);
    vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() =>
      socket.fail(new Error('Invalid WebSocket frame: RSV1 must be clear'))
    ).not.toThrow();
    expect(socket.readyState).toBe(WebSocket.CLOSED);
    await expect(pending).rejects.toThrow('The configurator page disconnected');
    vi.restoreAllMocks();
  });

  it('rejects pending calls when the page disconnects', async () => {
    const bridge = new PageBridge();
    const socket = attachPage(bridge);
    const pending = bridge.call('undo', []);
    socket.close();
    await expect(pending).rejects.toThrow('The configurator page disconnected');
  });

  it('relays the history events of the active page to its listeners', () => {
    const bridge = new PageBridge();
    const listener = vi.fn();
    bridge.onHistoryChange(listener);
    const socket = attachPage(bridge);
    socket.receive(historyEvent(true, false));
    expect(listener).toHaveBeenCalledWith(true, false);
  });

  it('ignores history events from another socket and events of another name', () => {
    const bridge = new PageBridge();
    const listener = vi.fn();
    bridge.onHistoryChange(listener);
    const active = attachPage(bridge);
    const other = attachPage(bridge);
    other.receive(historyEvent(true, false));
    active.receive({ kind: 'event', name: 'selectionChange' });
    expect(listener).not.toHaveBeenCalled();
  });

  it('tells its listeners that a page is accepted before the page hears it is ready', () => {
    const bridge = new PageBridge();
    const readyAtAcceptance: boolean[] = [];
    let socket: FakePageSocket | undefined;
    bridge.onPageAccepted(() =>
      readyAtAcceptance.push(socket?.sent.length !== 0)
    );
    socket = new FakePageSocket();
    bridge.attachPage(socket as unknown as WebSocket);
    socket.receive({
      kind: 'hello',
      example: 'minimal-configurator-example',
      url: 'http://localhost:3000/',
      protocol: BRIDGE_PROTOCOL,
    });
    expect(readyAtAcceptance).toEqual([false]);
    expect(JSON.parse(socket.sent[0])).toEqual({ kind: 'ready' });
  });

  it('tells its listeners when the active page is lost, not when another socket closes', () => {
    const bridge = new PageBridge();
    const listener = vi.fn();
    bridge.onPageLost(listener);
    const active = attachPage(bridge);
    const other = attachPage(bridge);
    other.close();
    expect(listener).not.toHaveBeenCalled();
    active.close();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('ignores results for unknown call ids', async () => {
    const bridge = new PageBridge();
    const socket = attachPage(bridge);
    socket.receive({ kind: 'result', id: 99, ok: true, result: 1 });
    const promise = bridge.call('undo', []);
    socket.receive({ kind: 'result', id: 1, ok: true, result: 'done' });
    await expect(promise).resolves.toBe('done');
  });
});
