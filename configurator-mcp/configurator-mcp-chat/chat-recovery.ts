import type { ToolExecutionOptions, ToolSet } from 'ai';

const TOOL_LABELS: Record<string, string> = {
  undo: 'Undo',
  redo: 'Redo',
  'change-component-parameter': 'Component parameter change',
  'change-global-parameter': 'Global parameter change',
  'dock-component': 'Component dock',
  'drag-component': 'Component drag',
  'delete-component': 'Component deletion',
  'load-configuration': 'Configuration load',
  'get-configurator-capabilities': 'Capabilities read',
  'get-configuration': 'Configuration read',
  'get-component-parameters': 'Component parameters read',
  'get-global-parameters': 'Global parameters read',
  'get-possible-children': 'Possible children read',
  'get-docking-positions': 'Docking positions read',
  'get-component-docking-positions': 'Component docking positions read',
  'get-delete-impact': 'Delete impact read',
};

// The read-only tools: a failed or pending read never changed the configuration.
const READ_TOOLS: ReadonlySet<string> = new Set([
  'get-configurator-capabilities',
  'get-configuration',
  'get-component-parameters',
  'get-global-parameters',
  'get-possible-children',
  'get-docking-positions',
  'get-component-docking-positions',
  'get-delete-impact',
]);

interface Outcome {
  toolName: string;
  status: 'pending' | 'returned' | 'threw';
  result?: any;
  error?: unknown;
}

const textOf = (value: unknown): string => {
  if (value instanceof Error) return value.message;
  try {
    return typeof value === 'string'
      ? value
      : (JSON.stringify(value) ?? String(value));
  } catch {
    return Object.prototype.toString.call(value);
  }
};

const resultData = (result: any): any => {
  if (result?.structuredContent !== undefined) return result.structuredContent;
  const text = result?.content
    ?.filter((part: any) => part.type === 'text')
    .map((part: any) => part.text)
    .join('\n');
  if (text === undefined) return result;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

const resultDetails = (data: any): string[] => {
  if (!data || typeof data !== 'object')
    return data == null ? [] : [textOf(data)];
  const details: string[] = [];
  for (const key of ['undone', 'redone', 'confirmed', 'canUndo', 'canRedo']) {
    if (data[key] !== undefined) details.push(`${key}: ${textOf(data[key])}`);
  }
  if (data.hint) details.push(textOf(data.hint));
  return details;
};

/**
 * Records tool execution independently of whether the model finishes its
 * step, so an interrupted reply can say what the tools changed.
 */
export const createChatRecovery = (tools: ToolSet) => {
  const outcomes: Outcome[] = [];
  const recordedTools: ToolSet = Object.fromEntries(
    Object.entries(tools).map(([toolName, tool]) => {
      if (!tool.execute) return [toolName, tool];
      const execute = tool.execute.bind(tool);
      return [
        toolName,
        {
          ...tool,
          execute: async (
            input: unknown,
            options: ToolExecutionOptions<unknown>
          ) => {
            const outcome: Outcome = { toolName, status: 'pending' };
            outcomes.push(outcome);
            try {
              const result = await execute(input, options);
              outcome.result = result;
              outcome.status = 'returned';
              return result;
            } catch (error) {
              outcome.error = error;
              outcome.status = 'threw';
              throw error;
            }
          },
        },
      ];
    })
  );

  const summary = (): string => {
    const lines = [
      "The assistant's reply was interrupted. Any text above is incomplete.",
    ];
    if (!outcomes.length) {
      lines.push('No tool ran, so the configuration was not changed.');
      return lines.join('\n\n');
    }
    for (const outcome of outcomes) {
      const label = TOOL_LABELS[outcome.toolName] ?? outcome.toolName;
      if (READ_TOOLS.has(outcome.toolName)) {
        const successful =
          outcome.status === 'returned' && !outcome.result?.isError;
        const data = successful ? resultData(outcome.result) : undefined;
        lines.push(
          successful
            ? `- Completed ${label}: ${data?.complete === false ? 'some requested information was unresolved' : 'information was returned'}. The read did not change the configuration.`
            : `- Incomplete ${label}: ${outcome.status === 'pending' ? 'no result was received' : 'the read failed'}. The read did not change the configuration.`
        );
        continue;
      }
      if (outcome.status === 'returned' && !outcome.result?.isError) {
        const data = resultData(outcome.result);
        // A write the configurator did not confirm may have left the
        // configuration unchanged; the undo and redo results carry no
        // confirmed key and keep the wording below.
        if (data?.confirmed === false) {
          lines.push(
            `- Unconfirmed ${label}: ${data?.hint ?? 'the configurator did not report the change'}. Check the configuration before trying this operation again.`
          );
          continue;
        }
        const details = resultDetails(data);
        lines.push(
          `- Completed ${label}: ${details.length ? details.join('; ') : 'the tool returned successfully.'}`
        );
      } else {
        const detail =
          outcome.status === 'threw'
            ? textOf(outcome.error)
            : outcome.status === 'returned'
              ? textOf(resultData(outcome.result))
              : 'no result was received';
        lines.push(
          `- Unconfirmed ${label}: ${detail}. Check the configuration before trying this operation again.`
        );
      }
    }
    lines.push(
      'These are the recorded tool outcomes; no operation was repeated automatically.'
    );
    return lines.join('\n\n');
  };

  return { tools: recordedTools, summary };
};
