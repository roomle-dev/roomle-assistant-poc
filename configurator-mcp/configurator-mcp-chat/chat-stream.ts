import { createMCPClient } from '@ai-sdk/mcp';
import { createMistral } from '@ai-sdk/mistral';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { streamText } from 'ai';
import { type ChatConfig, SYSTEM_PROMPT } from './chat-config';
import { type StreamChat } from './chat-handler';
import { createChatRecovery } from './chat-recovery';
import {
  chatSteps,
  createStepLog,
  isTurnTimeout,
  turnTimeoutMessage,
} from './chat-steps';

// [tool] lines are status, not answer text: the page shows them in the
// status line of the window while the tool call runs and keeps them out of
// the reply.
const TOOL_STATUS_PREFIX = '[tool] ';

export const createStreamChat =
  (config: ChatConfig): StreamChat =>
  async (messages, clientId) => {
    const apiKey = config.apiToken;
    if (!apiKey) {
      throw new Error('No API token configured');
    }
    const startedAt = Date.now();
    console.log(
      `[configurator-chat] chat request: ${messages.length} messages`
    );
    const mcpUrl = new URL(config.mcpUrl);
    mcpUrl.searchParams.set('client', clientId);
    const mcpClient = await createMCPClient({
      transport: new StreamableHTTPClientTransport(mcpUrl),
    });
    let mcpClientClosed = false;
    const closeMcpClient = async () => {
      if (!mcpClientClosed) {
        mcpClientClosed = true;
        await mcpClient.close();
      }
    };
    let emit = (_text: string) => {};
    try {
      const mcpTools = await mcpClient.tools();
      const recovery = createChatRecovery(mcpTools);
      const toolNames = Object.keys(mcpTools);
      console.log(
        `[configurator-chat] MCP connected (${toolNames.length} tools: ${toolNames.join(', ')})`
      );
      const tools = Object.fromEntries(
        Object.entries(recovery.tools).map(([name, tool]) => {
          if (!tool.execute) {
            return [name, tool];
          }
          const execute = tool.execute.bind(tool);
          return [
            name,
            {
              ...tool,
              execute: async (input: never, options: never) => {
                emit(`\n${TOOL_STATUS_PREFIX}${name}\n`);
                const toolStartedAt = Date.now();
                console.log(`[configurator-chat] tool call: ${name}`);
                try {
                  const result = await execute(input, options);
                  try {
                    console.log(
                      `[configurator-chat] tool done: ${name} (${Date.now() - toolStartedAt}ms)`
                    );
                  } catch {}
                  return result;
                } catch (error) {
                  try {
                    console.error(
                      `[configurator-chat] tool failed: ${name} (${Date.now() - toolStartedAt}ms)`,
                      error instanceof Error ? error.message : error
                    );
                  } catch {}
                  throw error;
                }
              },
            },
          ];
        })
      );
      const stepLog = createStepLog();
      const result = streamText({
        model: createMistral({ apiKey })(config.modelId),
        instructions: SYSTEM_PROMPT,
        messages,
        tools,
        // Without this the stream stops after the first step: tool calls are
        // never executed and never sent back to the model, so tool-driving
        // prompts produce an empty answer.
        ...chatSteps,
        // A turn that does not answer in time ends with a message instead of
        // "assistant is working…" without end.
        abortSignal: AbortSignal.timeout(config.turnTimeoutMs),
        onStepEnd: stepLog.onStepEnd,
      });
      // Mid-stream failures (Mistral auth, tool relay) surface as [error] parts
      // in the stream - the response has already started by then.
      const encoder = new TextEncoder();
      const errorText = (error: unknown) =>
        `\n[error] ${
          isTurnTimeout(error)
            ? turnTimeoutMessage(config.turnTimeoutMs)
            : error instanceof Error
              ? error.message
              : String(error)
        }`;
      const body = new ReadableStream<Uint8Array>({
        async start(controller) {
          emit = (text: string) => controller.enqueue(encoder.encode(text));
          let failed = false;
          let failure: unknown;
          try {
            for await (const part of result.stream) {
              if (part.type === 'text-delta') {
                controller.enqueue(encoder.encode(part.text));
              }
              if (part.type === 'error') {
                stepLog.onError(part.error);
                failed = true;
                failure = part.error;
              }
              // the turn timeout ends the stream with an abort part
              if (part.type === 'abort') {
                failed = true;
                failure = new DOMException('Turn aborted', 'AbortError');
                stepLog.onError(failure);
              }
            }
          } catch (error) {
            // a provider answer the SDK cannot process ends the stream with a
            // throw, not with an error part
            stepLog.onError(error);
            failed = true;
            failure = error;
          } finally {
            if (failed) emit(`${errorText(failure)}\n\n${recovery.summary()}`);
            controller.close();
            await closeMcpClient();
            console.log(
              `[configurator-chat] chat done (${Date.now() - startedAt}ms)`
            );
          }
        },
      });
      return new Response(body, {
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    } catch (error) {
      await closeMcpClient();
      throw error;
    }
  };
