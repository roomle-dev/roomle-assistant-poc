import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { request } from 'node:http';
import { createServer } from 'node:net';
import { describe, test } from 'node:test';
import { setTimeout } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const launcherPath = fileURLToPath(new URL('../start.mjs', import.meta.url));

const unusedPort = async () => {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  await new Promise((resolve) => server.close(resolve));
  return port;
};

const waitUntil = async (condition, diagnostic) => {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (await condition()) {
      return;
    }
    await setTimeout(50);
  }
  throw new Error(`Launcher check timed out: ${diagnostic()}`);
};

const canBind = (port) =>
  new Promise((resolve) => {
    const server = createServer();
    server.once('error', () => resolve(false));
    server.listen(port, '127.0.0.1', () => server.close(() => resolve(true)));
  });

// The status of a request to this machine that names another site as its
// Host, as a page of a DNS-rebinding site sends it (fetch cannot set Host).
const statusWithHost = (port, path, host) =>
  new Promise((resolve, reject) => {
    request(
      { host: '127.0.0.1', port, path, headers: { host } },
      (response) => {
        response.resume();
        resolve(response.statusCode);
      }
    )
      .on('error', reject)
      .end();
  });

// Starts the launcher with the arguments on an unused page port and waits
// until it serves the page.
const startLauncher = async (args) => {
  const port = await unusedPort();
  const launcher = spawn(
    process.execPath,
    [launcherPath, '--no-open', ...args],
    {
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, EXAMPLE_PORT: String(port) },
    }
  );
  let output = '';
  launcher.stdout.on('data', (chunk) => {
    output += chunk;
  });
  launcher.stderr.on('data', (chunk) => {
    output += chunk;
  });
  const exited = once(launcher, 'exit');
  const fetchPath = (path) =>
    fetch(`http://127.0.0.1:${port}${path}`, {
      signal: AbortSignal.timeout(1000),
    });
  const kill = () => {
    try {
      process.kill(-launcher.pid, 'SIGKILL');
    } catch {}
  };
  try {
    await waitUntil(
      async () => {
        try {
          return (await fetchPath('/')).ok;
        } catch {
          return false;
        }
      },
      () => `the page was not served\n${output}`
    );
  } catch (error) {
    kill();
    throw error;
  }
  return { launcher, port, exited, fetchPath, kill, output: () => output };
};

describe('example launcher', { skip: process.platform === 'win32' }, () => {
  test(
    'serves the planning assistant config of the model to this machine',
    { timeout: 90_000 },
    async () => {
      const withModel = await startLauncher(['mistral-medium', 'test-key']);
      const withoutModel = await startLauncher([]);
      try {
        const config = await withModel.fetchPath(
          '/planning-assistant-config.json'
        );
        assert.equal(config.headers.get('cache-control'), 'no-store');
        assert.deepEqual(await config.json(), {
          provider: 'mistral',
          model: 'mistral-medium-latest',
          apiKey: 'test-key',
          readsImages: false,
        });
        assert.ok(withModel.output().includes('?chat=true'));
        assert.ok(!withModel.output().includes('test-key'));
        assert.equal(
          (await withoutModel.fetchPath('/planning-assistant-config.json'))
            .status,
          404
        );
        assert.equal(
          await statusWithHost(
            withModel.port,
            '/planning-assistant-config.json',
            `rebinding.example:${withModel.port}`
          ),
          403
        );
      } finally {
        withModel.kill();
        withoutModel.kill();
      }
    }
  );

  for (const signal of ['SIGTERM', 'SIGINT']) {
    test(
      `releases the page port when only the launcher receives ${signal}`,
      { timeout: 90_000 },
      async () => {
        const { launcher, port, exited, kill, output } = await startLauncher([
          'mistral',
          'test-key',
        ]);
        try {
          launcher.kill(signal);
          await waitUntil(
            async () =>
              launcher.exitCode !== null || launcher.signalCode !== null,
            () => `launcher did not exit\n${output()}`
          );
          assert.deepEqual(await exited, [0, null]);
          await waitUntil(
            () => canBind(port),
            () => `the page port is still occupied\n${output()}`
          );
        } finally {
          kill();
        }
      }
    );
  }
});
