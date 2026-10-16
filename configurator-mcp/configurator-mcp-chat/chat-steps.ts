import { stepCountIs, type LanguageModelUsage } from 'ai';

export const MAX_CHAT_STEPS = 16;

/**
 * The step loop of a chat turn: tool calls are executed and sent back to the
 * model for up to MAX_CHAT_STEPS steps. The last step may not call a tool, so
 * a turn that uses every step still ends with the model's answer.
 */
export const chatSteps = {
  stopWhen: stepCountIs(MAX_CHAT_STEPS),
  prepareStep: ({ stepNumber }: { stepNumber: number }) =>
    stepNumber === MAX_CHAT_STEPS - 1
      ? { toolChoice: 'none' as const }
      : undefined,
};

interface StepUsage {
  usage?: Pick<
    LanguageModelUsage,
    'inputTokens' | 'outputTokens' | 'outputTokenDetails'
  >;
  toolCalls?: { toolName?: string; input?: unknown }[];
  finishReason?: unknown;
}

const LOGGED_BODY_CHARS = 2000;

const shortened = (value: unknown): string => {
  let text: string | undefined;
  try {
    text = typeof value === 'string' ? value : JSON.stringify(value);
  } catch {
    text = Object.prototype.toString.call(value);
  }
  return text !== undefined && text.length > LOGGED_BODY_CHARS
    ? `${text.slice(0, LOGGED_BODY_CHARS)}... (${text.length} chars)`
    : String(text);
};

const REQUEST_ID_HEADERS = ['x-request-id', 'apim-request-id', 'request-id'];

/**
 * What a failed provider call tells, cause by cause: the error, the HTTP
 * status, the url, the provider's request id, and the body, text or value the
 * SDK could not process. "Failed to process successful response" carries the
 * status of the answer; its cause names what in the answer failed.
 */
export const describeStepError = (error: unknown): string => {
  const causes: string[] = [];
  const seen = new Set<unknown>();
  for (
    let current: any = error;
    typeof current === 'object' && current !== null && !seen.has(current);
    current = current.cause
  ) {
    seen.add(current);
    const requestId = REQUEST_ID_HEADERS.map(
      (header) => current.responseHeaders?.[header]
    ).find((value) => value !== undefined);
    causes.push(
      [
        `${current.name ?? 'Error'}: ${current.message ?? String(current)}`,
        current.statusCode !== undefined && `status ${current.statusCode}`,
        current.url !== undefined && `url ${current.url}`,
        requestId !== undefined && `request ${requestId}`,
        current.responseBody !== undefined &&
          `body ${shortened(current.responseBody)}`,
        current.text !== undefined && `text ${shortened(current.text)}`,
        current.value !== undefined && `value ${shortened(current.value)}`,
      ]
        .filter((field) => field !== false)
        .join(', ')
    );
  }
  return causes.length > 0 ? causes.join(' <- caused by ') : String(error);
};

/**
 * Logs what the model produced in every step - the tokens in, out and spent
 * on reasoning, the tools it called with the size of their input, and the
 * step's duration - so a long turn shows where its time goes; and the step
 * that failed, with what the provider answered.
 */
export const createStepLog = (
  log: (line: string) => void = console.log,
  logError: (line: string) => void = console.error
) => {
  let step = 0;
  let startedAt = Date.now();
  const onStepEnd = (result: StepUsage) => {
    step += 1;
    try {
      const tools = (result.toolCalls ?? []).map(
        (call) =>
          `${call.toolName} (${JSON.stringify(call.input ?? {}).length} chars)`
      );
      const finish =
        typeof result.finishReason === 'string'
          ? result.finishReason
          : JSON.stringify(result.finishReason ?? '');
      const usage = result.usage;
      log(
        `[configurator-chat] step ${step}: ${usage?.inputTokens ?? 0} in, ` +
          `${usage?.outputTokens ?? 0} out, ${usage?.outputTokenDetails.reasoningTokens ?? 0} reasoning tokens; ` +
          `${tools.length > 0 ? `tools: ${tools.join(', ')}` : 'no tool'}; ${finish}; ${Date.now() - startedAt} ms`
      );
    } catch {}
    startedAt = Date.now();
  };
  const onError = (error: unknown) => {
    try {
      logError(
        `[configurator-chat] step ${step + 1} failed after ${Date.now() - startedAt} ms: ${describeStepError(error)}`
      );
    } catch {}
  };
  return { onStepEnd, onError };
};

// AbortSignal.timeout rejects with a TimeoutError, a manual abort with an
// AbortError; the SDK may wrap either as the cause of its own error.
export const isTurnTimeout = (error: unknown): boolean => {
  if (typeof error !== 'object' || error === null) {
    return false;
  }
  const { name, cause } = error as { name?: string; cause?: unknown };
  return (
    name === 'TimeoutError' ||
    name === 'AbortError' ||
    (cause !== error && isTurnTimeout(cause))
  );
};

export const turnTimeoutMessage = (timeoutMs: number): string =>
  `the turn took longer than ${Math.round(timeoutMs / 60_000)} minutes and was ended - the configuration holds what the tools changed so far`;
