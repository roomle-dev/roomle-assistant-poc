import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { CAPABILITY_SECTIONS } from './configurator-api';
import type { ConfiguratorApi } from './configurator-api';
import type { HistoryState } from './history-state';
import {
  type HistoryDirection,
  runHistoryStep,
  readConfiguratorCapabilities,
} from './tool-executors';

export const INSTRUCTIONS =
  'You assist the user of a Roomle product configurator: the product the user configures in the configurator page. ' +
  'Use get-configurator-capabilities to inspect the current configuration and product options. ' +
  'Declared alternatives may be conditional or inactive; use current kernel choices for what is available now. ' +
  'Acknowledge unresolved resources when complete is false; never invent missing options or docking placements. ' +
  'Only undo and redo can change the configuration. undo reverts the last change of the configuration, as the ' +
  "configurator's undo button does; redo brings back the change the last undo reverted. Nothing else of the " +
  'configuration can be changed yet.';

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

  server.registerTool(
    'get-configurator-capabilities',
    {
      description:
        'Reads the connected native Roomle configuration, recursive component/item alternatives, declared and current parameters, material metadata and docking choices. Optional include selects sections; omitted or empty means all. The result includes context, complete and unresolved. This read changes no configuration, selection or history. Declared alternatives are not guaranteed current choices or valid docking placements.',
      inputSchema: { include: z.array(z.enum(CAPABILITY_SECTIONS)).optional() },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ include }) => {
      console.log(
        '[configurator-mcp] tool get-configurator-capabilities',
        include ?? 'all'
      );
      const result = await readConfiguratorCapabilities(
        configuratorApi,
        include
      );
      console.log(
        '[configurator-mcp] tool get-configurator-capabilities returned'
      );
      return textResult(result);
    }
  );

  return server;
};
