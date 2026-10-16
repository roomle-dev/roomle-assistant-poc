import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { networkInterfaces } from 'node:os';
import { setTimeout } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const launcherPath = fileURLToPath(
  new URL('../../../minimal-configurator-example/start.mjs', import.meta.url)
);

const unusedPorts = async () => {
  const servers = Array.from({ length: 3 }, () => createServer());
  await Promise.all(
    servers.map(
      (server) =>
        new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    )
  );
  const ports = servers.map((server) => {
    const address = server.address();
    if (!address || typeof address === 'string') {
      throw new Error('Expected a TCP address');
    }
    return address.port;
  });
  await Promise.all(
    servers.map(
      (server) => new Promise<void>((resolve) => server.close(() => resolve()))
    )
  );
  return ports;
};

const waitUntil = async (
  condition: () => Promise<boolean>,
  diagnostic: () => string
) => {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (await condition()) {
      return;
    }
    await setTimeout(50);
  }
  throw new Error(`Launcher check timed out: ${diagnostic()}`);
};

const reachable = (url: string) =>
  fetch(url, { signal: AbortSignal.timeout(1000) }).then(
    async (response) => {
      await response.arrayBuffer();
      return true;
    },
    () => false
  );

const lanAddress = () =>
  Object.values(networkInterfaces())
    .flat()
    .find((address) => address?.family === 'IPv4' && !address.internal)
    ?.address;

const startLauncher = ([pagePort, mcpPort, chatPort]: number[]) => {
  const launcher = spawn(
    process.execPath,
    [launcherPath, '--no-open', 'mistral-medium', 'test-key'],
    {
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        EXAMPLE_PORT: String(pagePort),
        CONFIGURATOR_MCP_PORT: String(mcpPort),
        CONFIGURATOR_CHAT_PORT: String(chatPort),
      },
    }
  );
  let output = '';
  launcher.stdout.on('data', (chunk) => {
    output += chunk;
  });
  launcher.stderr.on('data', (chunk) => {
    output += chunk;
  });
  return { launcher, exited: once(launcher, 'exit'), output: () => output };
};

const serversReady =
  ([pagePort, mcpPort, chatPort]: number[]) =>
  async () => {
    try {
      const responses = await Promise.all([
        fetch(`http://127.0.0.1:${pagePort}/`, {
          signal: AbortSignal.timeout(1000),
        }),
        fetch(`http://127.0.0.1:${mcpPort}/`, {
          signal: AbortSignal.timeout(1000),
        }),
        fetch(`http://127.0.0.1:${chatPort}/health`, {
          signal: AbortSignal.timeout(1000),
        }),
      ]);
      await Promise.all(responses.map((response) => response.arrayBuffer()));
      return responses[0].ok && responses[1].status === 404 && responses[2].ok;
    } catch {
      return false;
    }
  };

// The process id of the launcher's child that runs the given entry point.
const childPid = (parentPid: number, entrypoint: string): number => {
  const line = execFileSync('ps', ['-A', '-o', 'pid=,ppid=,command='], {
    encoding: 'utf8',
  })
    .split('\n')
    .map((row) => row.trim().split(/\s+/))
    .find(
      ([, ppid, ...command]) =>
        Number(ppid) === parentPid && command.join(' ').includes(entrypoint)
    );
  if (!line) {
    throw new Error(`no child of ${parentPid} runs ${entrypoint}`);
  }
  return Number(line[0]);
};

const canBind = (port: number) =>
  new Promise<boolean>((resolve) => {
    const server = createServer();
    server.once('error', () => resolve(false));
    server.listen(port, '127.0.0.1', () => server.close(() => resolve(true)));
  });

describe.skipIf(process.platform === 'win32')('example launcher', () => {
  it.each(['SIGTERM', 'SIGINT'] as const)(
    'serves the example page and starts the MCP server and the chat on the given ports, on loopback only, and releases them on %s',
    async (signal) => {
      const ports = await unusedPorts();
      const [pagePort, mcpPort, chatPort] = ports;
      const { launcher, exited, output } = startLauncher(ports);
      try {
        await waitUntil(
          serversReady(ports),
          () => `servers did not become ready\n${output()}`
        );
        const lan = lanAddress();
        const reachableFromTheNetwork = lan
          ? [
              await reachable(`http://${lan}:${mcpPort}/`),
              await reachable(`http://${lan}:${chatPort}/health`),
            ]
          : [false, false];
        expect(reachableFromTheNetwork).toEqual([false, false]);
        expect(output()).toContain(
          `http://localhost:${pagePort}/?chat=true&mcp_port=${mcpPort}&chat_port=${chatPort}`
        );

        launcher.kill(signal);
        await waitUntil(
          async () =>
            launcher.exitCode !== null || launcher.signalCode !== null,
          () => `launcher did not exit\n${output()}`
        );
        expect(await exited).toEqual([0, null]);
        await waitUntil(
          async () => (await Promise.all(ports.map(canBind))).every(Boolean),
          () => `server ports still occupied\n${output()}`
        );
      } finally {
        try {
          process.kill(-launcher.pid!, 'SIGKILL');
        } catch {}
      }
    },
    120_000
  );

  it('stops the MCP server when the chat backend ends unexpectedly', async () => {
    const ports = await unusedPorts();
    const { launcher, exited, output } = startLauncher(ports);
    try {
      await waitUntil(
        serversReady(ports),
        () => `servers did not become ready\n${output()}`
      );

      process.kill(childPid(launcher.pid!, 'chat-server.ts'), 'SIGKILL');

      expect(await exited).toEqual([1, null]);
      await waitUntil(
        async () => (await Promise.all(ports.map(canBind))).every(Boolean),
        () => `server ports still occupied\n${output()}`
      );
    } finally {
      try {
        process.kill(-launcher.pid!, 'SIGKILL');
      } catch {}
    }
  }, 120_000);

  it('refuses a model name other than mistral-medium and mistral-large', () => {
    const result = spawnSync(
      process.execPath,
      [launcherPath, '--no-open', 'gpt-5-mini', 'test-key'],
      { encoding: 'utf8' }
    );
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      'unsupported chat model "gpt-5-mini" - supported: mistral-medium, mistral-large'
    );
  });
});
