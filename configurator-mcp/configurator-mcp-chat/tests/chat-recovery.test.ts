import { jsonSchema, tool } from 'ai';
import { describe, expect, it, vi } from 'vitest';
import { createChatRecovery } from '../chat-recovery';

const options = { toolCallId: 'read', messages: [], context: undefined };
const result = (data: unknown, isError = false) => ({
  content: [{ type: 'text', text: JSON.stringify(data) }],
  isError,
});
const fakeTool = (execute: () => Promise<unknown>) =>
  tool({
    inputSchema: jsonSchema({ type: 'object', properties: {} }),
    execute,
  });

describe('capabilities read recovery', () => {
  it.each([true, false])(
    'summarizes returned data with complete=%s without dumping the catalog',
    async (complete) => {
      const execute = vi.fn(async () =>
        result({ complete, components: { largeCatalog: 'private-payload' } })
      );
      const recovery = createChatRecovery({
        'get-configurator-capabilities': fakeTool(execute),
      });
      await recovery.tools['get-configurator-capabilities'].execute!(
        {},
        options
      );
      const summary = recovery.summary();
      expect(summary).toContain('Completed Capabilities read');
      expect(summary).toContain('read did not change the configuration');
      expect(summary.includes('unresolved')).toBe(!complete);
      expect(summary).not.toContain('private-payload');
      expect(summary).not.toContain('Unconfirmed');
      expect(execute).toHaveBeenCalledTimes(1);
    }
  );

  it.each(['pending', 'rejected', 'error-result'])(
    'describes a %s read as incomplete, independently of mutation outcomes',
    async (status) => {
      let resolveRead!: (value: unknown) => void;
      const pendingRead = new Promise<unknown>((resolve) => {
        resolveRead = resolve;
      });
      const execute =
        status === 'pending'
          ? () => pendingRead
          : status === 'rejected'
            ? async () => {
                throw new Error('stale');
              }
            : async () => result('stale', true);
      const recovery = createChatRecovery({
        'get-configurator-capabilities': fakeTool(execute),
        undo: fakeTool(async () =>
          result({ undone: true, canUndo: false, canRedo: true })
        ),
        redo: fakeTool(async () => {
          throw new Error('disconnected');
        }),
      });
      const read = recovery.tools['get-configurator-capabilities'].execute!(
        {},
        options
      );
      const settled =
        status === 'pending'
          ? Promise.resolve('pending')
          : Promise.resolve(read).then(
              () => 'returned',
              () => 'rejected'
            );
      expect(await settled).toBe(
        status === 'error-result' ? 'returned' : status
      );
      await recovery.tools.undo.execute!({}, options);
      await expect(recovery.tools.redo.execute!({}, options)).rejects.toThrow(
        'disconnected'
      );
      const summary = recovery.summary();
      expect(summary).toContain('Incomplete Capabilities read');
      expect(summary).not.toContain('Unconfirmed Capabilities read');
      expect(summary).toContain('Completed Undo: undone: true');
      expect(summary).toContain('Unconfirmed Redo');
      expect(summary).toContain('no operation was repeated automatically');
      resolveRead(result({ complete: true }));
      if (status === 'pending') await read;
    }
  );
});

describe('configuration query read recovery', () => {
  it('summarizes a returned read without dumping its payload', async () => {
    const execute = vi.fn(async () =>
      result({
        type: 'configuration',
        context: {},
        configuration: { rootComponent: 'private-payload' },
      })
    );
    const recovery = createChatRecovery({
      'get-configuration': fakeTool(execute),
    });
    await recovery.tools['get-configuration'].execute!({}, options);
    const summary = recovery.summary();
    expect(summary).toContain('Completed Configuration read');
    expect(summary).toContain('information was returned');
    expect(summary).toContain('read did not change the configuration');
    expect(summary).not.toContain('private-payload');
    expect(summary).not.toContain('Unconfirmed');
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it.each(['pending', 'rejected', 'error-result'])(
    'describes a %s read as incomplete, never as an unconfirmed change',
    async (status) => {
      let resolveRead!: (value: unknown) => void;
      const pendingRead = new Promise<unknown>((resolve) => {
        resolveRead = resolve;
      });
      const execute =
        status === 'pending'
          ? () => pendingRead
          : status === 'rejected'
            ? async () => {
                throw new Error('stale');
              }
            : async () => result('stale', true);
      const recovery = createChatRecovery({
        'get-docking-positions': fakeTool(execute),
        undo: fakeTool(async () =>
          result({ undone: true, canUndo: false, canRedo: true })
        ),
      });
      const read = recovery.tools['get-docking-positions'].execute!(
        {},
        options
      );
      const settled =
        status === 'pending'
          ? Promise.resolve('pending')
          : Promise.resolve(read).then(
              () => 'returned',
              () => 'rejected'
            );
      expect(await settled).toBe(
        status === 'error-result' ? 'returned' : status
      );
      await recovery.tools.undo.execute!({}, options);
      const summary = recovery.summary();
      expect(summary).toContain('Incomplete Docking positions read');
      expect(summary).toContain('The read did not change the configuration.');
      expect(summary).not.toContain('Unconfirmed Docking positions read');
      expect(summary).toContain('Completed Undo: undone: true');
      resolveRead(result({ type: 'dockingPositions', dockPairs: [] }));
      if (status === 'pending') await read;
    }
  );
});

describe('configuration write recovery', () => {
  it('summarizes a confirmed write with its confirmation and history state', async () => {
    const execute = vi.fn(async () =>
      result({
        type: 'dockComponent',
        context: { configurationHash: 'before' },
        configurationHash: 'after',
        runtimeId: 42,
        confirmed: true,
        canUndo: true,
        canRedo: false,
      })
    );
    const recovery = createChatRecovery({
      'dock-component': fakeTool(execute),
    });
    await recovery.tools['dock-component'].execute!({}, options);
    const summary = recovery.summary();
    expect(summary).toContain('Completed Component dock');
    expect(summary).toContain('confirmed: true');
    expect(summary).toContain('canUndo: true');
    expect(summary).toContain('canRedo: false');
    expect(summary).not.toContain('Unconfirmed');
    expect(summary).not.toContain('configurationHash');
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('describes an unconfirmed write with its hint instead of a completion', async () => {
    const execute = vi.fn(async () =>
      result({
        type: 'deleteComponent',
        context: {},
        configurationHash: 'after',
        confirmed: false,
        canUndo: true,
        canRedo: false,
        hint: 'The configurator did not report the change - the configuration may be unchanged.',
      })
    );
    const recovery = createChatRecovery({
      'delete-component': fakeTool(execute),
    });
    await recovery.tools['delete-component'].execute!({}, options);
    const summary = recovery.summary();
    expect(summary).toContain('Unconfirmed Component deletion');
    expect(summary).toContain('The configurator did not report the change');
    expect(summary).toContain(
      'Check the configuration before trying this operation again.'
    );
    expect(summary).not.toContain('Completed Component deletion');
  });

  it('keeps the wording of the undo and redo results without a confirmed key', async () => {
    const recovery = createChatRecovery({
      undo: fakeTool(async () =>
        result({
          undone: false,
          canUndo: true,
          canRedo: false,
          hint: 'The configurator did not report the undo - the configuration may be unchanged.',
        })
      ),
    });
    await recovery.tools.undo.execute!({}, options);
    const summary = recovery.summary();
    expect(summary).toContain('Completed Undo: undone: false');
    expect(summary).toContain('The configurator did not report the undo');
    expect(summary).not.toContain('Unconfirmed Undo');
  });
});
