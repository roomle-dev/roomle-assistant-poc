import { z } from 'zod';
import {
  CAPABILITY_SECTIONS,
  type ConfiguratorApi,
  type ConfiguratorCapabilitySection,
  type ConfigurationOperationName,
  type ConfigurationOperationPayload,
  type ConfigurationOperationQueryPayload,
  type ConfigurationOperationQueryType,
} from './configurator-api';
import type { HistoryState } from './history-state';
import { ConfiguratorCallTimedOutError } from './page-bridge';

export type HistoryDirection = 'undo' | 'redo';

// The payload shapes of the read-only queryConfigurationOperation, one per
// query type. The server registers the same shapes as each tool's inputSchema;
// the executor validates again before any page call.
const dockingChildSchema = z.union([
  z.strictObject({ componentId: z.string() }),
  z.strictObject({ itemId: z.string() }),
  z.strictObject({ configuration: z.string() }),
]);

const positionSchema = z.strictObject({
  x: z.number(),
  y: z.number(),
  z: z.number(),
});

export const configurationQueryInputSchemas: Record<
  ConfigurationOperationQueryType,
  z.ZodRawShape
> = {
  capabilities: {
    include: z.array(z.enum(CAPABILITY_SECTIONS)).optional(),
  },
  configuration: {},
  componentParameters: { runtimeId: z.number() },
  globalParameters: {},
  possibleChildren: { runtimeId: z.number().optional() },
  dockingPositions: {
    child: dockingChildSchema,
    allowInsertInBetween: z.boolean().optional(),
  },
  componentDockingPositions: {
    runtimeId: z.number(),
    allowInsertInBetween: z.boolean().optional(),
  },
  deleteImpact: {
    runtimeId: z.number(),
    redockChildrenToParent: z.boolean(),
  },
};

// The payload shapes of executeConfigurationOperation, one per operation. The
// server registers the same shapes as each write tool's inputSchema; the
// executor validates again before any page call. The shapes are not strict, so
// a dock pair a get-docking-positions read returned pastes unchanged - the
// keys the operation does not take are stripped before the page call.
export const configurationOperationInputSchemas: Record<
  ConfigurationOperationName,
  z.ZodRawShape
> = {
  changeComponentParameter: {
    runtimeId: z.number(),
    key: z.string(),
    value: z.string(),
  },
  changeGlobalParameter: { key: z.string(), value: z.string() },
  dockComponent: {
    child: dockingChildSchema,
    parentId: z.number(),
    parentDockId: z.number(),
    position: positionSchema.optional(),
    insertInBetween: z.boolean().optional(),
  },
  dragComponent: {
    runtimeId: z.number(),
    parentId: z.number(),
    parentDockId: z.number(),
    childDockId: z.number(),
    position: positionSchema.optional(),
    insertInBetween: z.boolean().optional(),
  },
  deleteComponent: {
    runtimeId: z.number(),
    redockChildrenToParent: z.boolean(),
  },
  loadConfiguration: { configuration: z.string() },
  undo: {},
  redo: {},
};

/** One read of the active configuration through queryConfigurationOperation; never enters the history queue. */
export const runConfigurationOperationQuery = async (
  api: ConfiguratorApi,
  type: ConfigurationOperationQueryType,
  payload?: ConfigurationOperationQueryPayload
): Promise<unknown> => {
  const parsed = z
    .object(configurationQueryInputSchemas[type])
    .parse(payload ?? {});
  return api.extended.queryConfigurationOperation(type, parsed);
};

// The capabilities read routes through the generic query API and returns the
// capabilities JSON unchanged, preserving the tool's result contract.
export const readConfiguratorCapabilities = (
  api: ConfiguratorApi,
  include?: ConfiguratorCapabilitySection[]
): Promise<unknown> =>
  runConfigurationOperationQuery(
    api,
    'capabilities',
    include === undefined ? undefined : { include }
  ).then((result) => (result as { capabilities: unknown }).capabilities);

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

// One operation at a time: each is confirmed by its own history event, so two
// at once would take each other's event.
let historySteps: Promise<unknown> = Promise.resolve();

const oneAtATime = <T>(run: () => Promise<T>): Promise<T> => {
  const next = historySteps.then(run);
  historySteps = next.catch(() => undefined);
  return next;
};

// One executeConfigurationOperation call, confirmed by the history event it
// causes: the event of an earlier timed-out operation arrives late and is
// consumed by that operation's slot, so it cannot confirm this one. A call
// that fails without a timeout, or reports no event in time, releases its
// slot, so its possible late event cannot confirm the next operation either.
const runConfirmedOperation = async (
  api: ConfiguratorApi,
  history: HistoryState,
  name: ConfigurationOperationName,
  payload?: ConfigurationOperationPayload
): Promise<{ result: unknown; confirmed: boolean }> => {
  const serial = history.operationSent();
  let result: unknown;
  try {
    result =
      payload === undefined
        ? await api.extended.executeConfigurationOperation(name)
        : await api.extended.executeConfigurationOperation(name, payload);
  } catch (error) {
    if (!(error instanceof ConfiguratorCallTimedOutError)) {
      history.operationFailed();
    }
    throw error;
  }
  const confirmed = await history.waitForOperation(
    serial,
    HISTORY_EVENT_WAIT_MS
  );
  if (!confirmed) {
    history.operationFailed();
  }
  return { result, confirmed };
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
    // An unknown history is the page's to answer: without a page the call
    // fails with the bridge's connection error.
    if (history.reported && !possible) {
      return { [done]: false, ...state(), hint: NOTHING_TO[direction] };
    }
    const { confirmed } = await runConfirmedOperation(
      configuratorApi,
      history,
      direction
    );
    return {
      [done]: confirmed,
      ...state(),
      ...(!confirmed && { hint: NOT_CONFIRMED[direction] }),
    };
  });

const NOT_CONFIRMED_WRITE =
  'The configurator did not report the change - the configuration may be unchanged.';

/**
 * One write of the active configuration through executeConfigurationOperation.
 * Every write lands one step in the undo history; the result reports the page's
 * result plus the confirmation of that step and the history state after it.
 */
export const runConfigurationOperationWrite = (
  api: ConfiguratorApi,
  history: HistoryState,
  name: ConfigurationOperationName,
  payload?: ConfigurationOperationPayload
): Promise<Record<string, unknown>> =>
  oneAtATime(async () => {
    const parsed = z
      .object(configurationOperationInputSchemas[name])
      .parse(payload ?? {});
    const { result, confirmed } = await runConfirmedOperation(
      api,
      history,
      name,
      parsed
    );
    return {
      ...(result as Record<string, unknown>),
      confirmed,
      canUndo: history.canUndo,
      canRedo: history.canRedo,
      ...(!confirmed && { hint: NOT_CONFIRMED_WRITE }),
    };
  });
