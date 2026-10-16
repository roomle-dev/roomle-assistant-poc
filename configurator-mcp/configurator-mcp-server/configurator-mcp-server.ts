import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ConfiguratorApi } from './configurator-api';
import type { HistoryState } from './history-state';
import { type HistoryDirection, runHistoryStep } from './tool-executors';

export const INSTRUCTIONS =
  'You assist the user of a Roomle product configurator: the product the user configures in the configurator page. ' +
  'The tools undo and redo are your only tools. undo reverts the last change of the configuration, as the ' +
  "configurator's undo button does; redo brings back the change the last undo reverted. Nothing else of the " +
  'configuration can be read or changed yet - when the user asks for more, say that only undo and redo are available.';

const UNDO_DESCRIPTION =
  "Reverts the last change of the configuration, as the configurator's undo button does; call it again to revert " +
  'the change before. Returns undone - whether a change was reverted -, canUndo and canRedo - whether a further undo ' +
  'or redo is possible -, and a hint when nothing was reverted.';

const REDO_DESCRIPTION =
  "Brings back the change the last undo reverted, as the configurator's redo button does. A new change of the " +
  'configuration ends redo. Returns redone - whether a change was brought back -, canUndo and canRedo, and a hint ' +
  'when nothing was brought back.';

const textResult = (result: unknown) => ({
  content: [{ type: 'text' as const, text: JSON.stringify(result) }],
});

export const createConfiguratorMcpServer = (
  configuratorApi: ConfiguratorApi,
  history: HistoryState
): McpServer => {
  const server = new McpServer(
    { name: 'configurator-mcp', version: '0.1.0' },
    { instructions: INSTRUCTIONS }
  );

  const runTool = async (direction: HistoryDirection) => {
    console.log(`[configurator-mcp] tool ${direction}`);
    const result = await runHistoryStep(configuratorApi, history, direction);
    console.log(
      `[configurator-mcp] tool ${direction} result ${JSON.stringify(result)}`
    );
    return textResult(result);
  };

  server.registerTool(
    'undo',
    { description: UNDO_DESCRIPTION, inputSchema: {} },
    () => runTool('undo')
  );

  server.registerTool(
    'redo',
    { description: REDO_DESCRIPTION, inputSchema: {} },
    () => runTool('redo')
  );

  return server;
};
