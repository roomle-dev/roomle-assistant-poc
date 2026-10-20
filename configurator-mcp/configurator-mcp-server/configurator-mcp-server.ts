import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { CAPABILITY_SECTIONS } from './configurator-api';
import type {
  ConfiguratorApi,
  ConfigurationOperationName,
  ConfigurationOperationQueryType,
} from './configurator-api';
import type { HistoryState } from './history-state';
import {
  type HistoryDirection,
  configurationOperationInputSchemas,
  configurationQueryInputSchemas,
  runConfigurationOperationQuery,
  runConfigurationOperationWrite,
  runHistoryStep,
  readConfiguratorCapabilities,
} from './tool-executors';

export const INSTRUCTIONS =
  'You assist the user of a Roomle product configurator: the product the user configures in the configurator page. ' +
  'Read the current configuration with get-configuration, parameters with get-component-parameters and ' +
  'get-global-parameters, possible children with get-possible-children, docking positions with ' +
  'get-docking-positions and get-component-docking-positions, delete impact with get-delete-impact, and product ' +
  'options with get-configurator-capabilities. ' +
  'Declared alternatives may be conditional or inactive; use current kernel choices for what is available now. ' +
  'Acknowledge unresolved resources when complete is false; never invent missing options or docking placements. ' +
  'Change the configuration with change-component-parameter, change-global-parameter, dock-component, ' +
  'drag-component, delete-component and load-configuration; every change lands one step in the undo history ' +
  'and the tool result reports whether the change was confirmed, and whether a further undo or redo is ' +
  "possible. undo reverts the last change of the configuration, as the configurator's undo button does; redo " +
  'brings back the change the last undo reverted.';

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

const READ_ANNOTATIONS = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
} as const;

const WRITE_ANNOTATIONS = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: true,
} as const;

// Deleting a component and loading a configuration replace parts of the
// configuration that the undo history brings back step by step.
const DESTRUCTIVE_WRITE_ANNOTATIONS = {
  ...WRITE_ANNOTATIONS,
  destructiveHint: true,
} as const;

// One read tool per queryConfigurationOperation query, except capabilities,
// which keeps its own registration and its established result contract.
const CONFIGURATION_QUERY_TOOLS: {
  name: string;
  type: ConfigurationOperationQueryType;
  description: string;
}[] = [
  {
    name: 'get-configuration',
    type: 'configuration',
    description:
      'Reads the current configuration as parsed JSON plus its hash for change detection. Returns the ' +
      'configuration, the hash and the read context. This read changes no configuration, selection or history.',
  },
  {
    name: 'get-component-parameters',
    type: 'componentParameters',
    description:
      'Reads the current parameters and parameter groups of the component with the given runtime id. Runtime ids ' +
      'identify instances; catalog ids identify definitions. Returns the parameters, the groups, the component id ' +
      'and the read context. This read changes no configuration, selection or history.',
  },
  {
    name: 'get-global-parameters',
    type: 'globalParameters',
    description:
      'Reads the current global parameters of the configuration; the result reports whether the plan object or ' +
      'the root component scope was read. This read changes no configuration, selection or history.',
  },
  {
    name: 'get-possible-children',
    type: 'possibleChildren',
    description:
      'Reads the possible children that can be docked: every possible child of the configuration, or of the ' +
      'component with the given runtime id. The result carries the child tags and the default child. This read ' +
      'changes no configuration, selection or history.',
  },
  {
    name: 'get-docking-positions',
    type: 'dockingPositions',
    description:
      'Reads the docking positions a possible child can be docked at, given as a component id, an item id or an ' +
      'assembly configuration; allowInsertInBetween also returns insert positions. The result lists the dock pairs ' +
      '- parent and child dock ids, position, rotation, insertInBetween, displaced components - computed without ' +
      'drawing previews. This read changes no configuration, selection, history or the scene.',
  },
  {
    name: 'get-component-docking-positions',
    type: 'componentDockingPositions',
    description:
      'Reads the docking positions the component with the given runtime id can be moved to; ' +
      'allowInsertInBetween also returns insert positions. The result lists the dock pairs computed without ' +
      'drawing previews. This read changes no configuration, selection, history or the scene.',
  },
  {
    name: 'get-delete-impact',
    type: 'deleteImpact',
    description:
      'Reads the impact of deleting the component with the given runtime id: whether it can be deleted and which ' +
      'component runtime ids are deleted with it; redockChildrenToParent chooses between re-docking the children ' +
      'to the parent and deleting them with the component. This read changes no configuration, selection or ' +
      'history.',
  },
];

// One write tool per executeConfigurationOperation operation, except undo and
// redo, which keep their own registrations and their established result
// contract. Every write lands one step in the undo history and reports whether
// the configurator confirmed the change.
const CONFIGURATION_OPERATION_TOOLS: {
  name: string;
  operation: ConfigurationOperationName;
  description: string;
  annotations: typeof WRITE_ANNOTATIONS | typeof DESTRUCTIVE_WRITE_ANNOTATIONS;
}[] = [
  {
    name: 'change-component-parameter',
    operation: 'changeComponentParameter',
    description:
      'Changes the parameter key of the component with the given runtime id to the given value; the key ' +
      'must be one of the parameters get-component-parameters returned for the component. The change ' +
      'lands one step in the undo history. Returns confirmed - whether the configurator reported the ' +
      'change -, canUndo and canRedo, and a hint when the change was not confirmed.',
    annotations: WRITE_ANNOTATIONS,
  },
  {
    name: 'change-global-parameter',
    operation: 'changeGlobalParameter',
    description:
      'Changes the global parameter key to the given value; the key must be one of the parameters ' +
      'get-global-parameters returned. The change lands one step in the undo history. Returns confirmed ' +
      '- whether the configurator reported the change -, canUndo and canRedo, and a hint when the ' +
      'change was not confirmed.',
    annotations: WRITE_ANNOTATIONS,
  },
  {
    name: 'dock-component',
    operation: 'dockComponent',
    description:
      'Docks a possible child at a dock pair of the configuration: the child as a component id, an item ' +
      'id or an assembly configuration, the parent runtime id and dock id, and optionally the position ' +
      'and whether to insert between. A dock pair a get-docking-positions read returned can be used ' +
      'unchanged. The docked component lands one step in the undo history. Returns the new component ' +
      'runtime id, confirmed, canUndo and canRedo, and a hint when the change was not confirmed.',
    annotations: WRITE_ANNOTATIONS,
  },
  {
    name: 'drag-component',
    operation: 'dragComponent',
    description:
      'Moves the component with the given runtime id to a dock pair: the parent runtime id and the ' +
      'parent and child dock ids, and optionally the position and whether to insert between, as a ' +
      'get-component-docking-positions read returned. The move lands one step in the undo history. ' +
      'Returns confirmed, canUndo and canRedo, and a hint when the change was not confirmed.',
    annotations: WRITE_ANNOTATIONS,
  },
  {
    name: 'delete-component',
    operation: 'deleteComponent',
    description:
      'Deletes the component with the given runtime id; redockChildrenToParent chooses between ' +
      're-docking the children to the parent and deleting them with the component - read the impact ' +
      'with get-delete-impact first. The deletion lands one step in the undo history. Returns the ' +
      'deleted component runtime ids, confirmed, canUndo and canRedo, and a hint when the change was ' +
      'not confirmed.',
    annotations: DESTRUCTIVE_WRITE_ANNOTATIONS,
  },
  {
    name: 'load-configuration',
    operation: 'loadConfiguration',
    description:
      'Loads an assembly configuration as the new configuration of the configurator; the configuration ' +
      'must be JSON with a root componentId, as a get-configuration read returned it. This replaces ' +
      'the configuration; the load lands one step in the undo history. Returns confirmed, canUndo and ' +
      'canRedo, and a hint when the change was not confirmed.',
    annotations: DESTRUCTIVE_WRITE_ANNOTATIONS,
  },
];

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

  for (const {
    name,
    operation,
    description,
    annotations,
  } of CONFIGURATION_OPERATION_TOOLS) {
    server.registerTool(
      name,
      {
        description,
        inputSchema: configurationOperationInputSchemas[operation],
        annotations,
      },
      async (args) => {
        // The payload can carry an assembly configuration; log the tool name only.
        console.log(`[configurator-mcp] tool ${name}`);
        const result = await runConfigurationOperationWrite(
          configuratorApi,
          history,
          operation,
          args
        );
        console.log(`[configurator-mcp] tool ${name} returned`);
        return textResult(result);
      }
    );
  }

  server.registerTool(
    'get-configurator-capabilities',
    {
      description:
        'Reads the connected native Roomle configuration, recursive component/item alternatives, declared and current parameters, material metadata and docking choices. Optional include selects sections; omitted or empty means all. The result includes context, complete and unresolved. This read changes no configuration, selection or history. Declared alternatives are not guaranteed current choices or valid docking placements.',
      inputSchema: { include: z.array(z.enum(CAPABILITY_SECTIONS)).optional() },
      annotations: READ_ANNOTATIONS,
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

  for (const { name, type, description } of CONFIGURATION_QUERY_TOOLS) {
    server.registerTool(
      name,
      {
        description,
        inputSchema: configurationQueryInputSchemas[type],
        annotations: READ_ANNOTATIONS,
      },
      async (args) => {
        // The payload can carry an assembly configuration; log the tool name only.
        console.log(`[configurator-mcp] tool ${name}`);
        const result = await runConfigurationOperationQuery(
          configuratorApi,
          type,
          args
        );
        console.log(`[configurator-mcp] tool ${name} returned`);
        return textResult(result);
      }
    );
  }

  return server;
};
