import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { get } from 'node:http';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const launcherPath = fileURLToPath(new URL('../start.mjs', import.meta.url));

const startLauncher = async (context, args, serverUrl) => {
  const launcher = spawn(
    process.execPath,
    [launcherPath, '--no-open', ...args],
    {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, EXAMPLE_PORT: '0', EXAMPLE_SERVER_URL: serverUrl },
    }
  );
  const exited = once(launcher, 'exit');
  context.after(async () => {
    launcher.kill();
    await exited;
  });
  let output = '';
  for await (const chunk of launcher.stdout) {
    output += chunk;
    const match = output.match(/Fence example ready: (http:\/\/[^\s]+)/);
    if (match) return { url: new URL(match[1]), launcher, exited };
  }
  throw new Error(`Fence launcher exited without serving a page: ${output}`);
};

test(
  'serves the fence page and refuses paths outside the example',
  { timeout: 10000 },
  async (context) => {
    const { url, launcher, exited } = await startLauncher(context, [], '');
    const response = await fetch(url);
    assert.equal(response.status, 200);
    assert.equal(
      response.headers.get('content-type'),
      'text/html; charset=utf-8'
    );
    assert.match(
      await response.text(),
      /<title>Minimal Fence Example<\/title>/
    );
    assert.equal((await fetch(new URL('/index.html', url))).status, 200);
    for (const path of [
      '/start.mjs',
      '/tests/example.test.js',
      '/planning-assistant-config.json',
      '/../package.json',
    ]) {
      assert.equal((await fetch(new URL(path, url))).status, 404);
    }
    launcher.kill('SIGTERM');
    assert.deepEqual(await exited, [null, 'SIGTERM']);
  }
);

test(
  'dev mode selects the local Rubens UI',
  { timeout: 10000 },
  async (context) => {
    const { url } = await startLauncher(context, ['--dev']);
    assert.equal(
      url.searchParams.get('overrideServerUrl'),
      'http://localhost:5173/'
    );
  }
);

test(
  'an explicit UI deployment overrides dev mode',
  { timeout: 10000 },
  async (context) => {
    const { url } = await startLauncher(
      context,
      ['--dev'],
      'https://www.roomle.com/t/bo-dev/'
    );
    assert.equal(
      url.searchParams.get('overrideServerUrl'),
      'https://www.roomle.com/t/bo-dev/'
    );
  }
);

test(
  'serves credentials only through the local no-store endpoint and keeps them out of URLs',
  { timeout: 10000 },
  async (context) => {
    const { url } = await startLauncher(
      context,
      ['gpt-6-luna', 'fence-test-key'],
      ''
    );
    assert.equal(url.searchParams.get('chat'), 'true');
    assert.equal(url.href.includes('fence-test-key'), false);
    const response = await fetch(
      new URL('/planning-assistant-config.json', url)
    );
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await response.json(), {
      model: 'gpt-6-luna',
      apiKey: 'fence-test-key',
    });
    const status = await new Promise((resolve, reject) => {
      get(
        new URL('/planning-assistant-config.json', url),
        { headers: { Host: 'attacker.invalid' } },
        (response) => {
          response.resume();
          resolve(response.statusCode);
        }
      ).on('error', reject);
    });
    assert.equal(status, 403);
  }
);
