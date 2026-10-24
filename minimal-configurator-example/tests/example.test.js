import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const script = html
  .match(/<script type="module">([\s\S]*?)<\/script>/)[1]
  .replace(/^\s*import .+;$/gm, '');

const runExample = async (search, model) => {
  const calls = [];
  const instance = {
    ui: {
      loadObject: async (id) => {
        calls.push(['load', id]);
      },
    },
    extended: {
      planningAssistantOutput: (part) => {
        calls.push(['output', part]);
      },
    },
  };
  const window = { addEventListener: () => {} };
  await runInNewContext(`(async () => { ${script} })()`, {
    RoomleConfiguratorApi: {
      createConfigurator: async (_id, _element, options) => {
        calls.push(['create', options]);
        return instance;
      },
    },
    startConfiguratorPlanningAssistant: async (endpoints, config, signal) => {
      calls.push(['start', endpoints, config, signal]);
    },
    URLSearchParams,
    AbortController,
    location: { search },
    document: { getElementById: () => ({}) },
    window,
    fetch: async () => ({ ok: true, json: async () => model }),
  });
  return { calls, instance, window };
};

test('the example enables configurationAssistant and starts the agent on the loaded configurator', async () => {
  const model = { provider: 'mistral', model: 'test', apiKey: 'test-key' };
  const { calls, instance, window } = await runExample(
    '?chat=true&id=test:product',
    model
  );
  assert.equal(calls[0][1].featureFlags.configurationAssistant, true);
  assert.equal(calls[0][1].featureFlags.planningAssistant, undefined);
  assert.deepEqual(calls[1], ['load', 'test:product']);
  assert.equal(calls[2][0], 'start');
  assert.equal(calls[2][1].configurator, instance.extended);
  assert.equal(calls[2][1].window, instance.extended);
  assert.equal(calls[2][2], model);
  assert.equal(window.instance, instance);
});

for (const apiKey of [undefined, '', '   ']) {
  test(`the example does not start an agent without a non-empty API key (${JSON.stringify(apiKey)})`, async () => {
    const { calls } = await runExample('?chat=true', {
      provider: 'mistral',
      model: 'test',
      apiKey,
    });
    assert.equal(
      calls.some(([action]) => action === 'start'),
      false
    );
    const output = calls.find(([action]) => action === 'output')[1];
    assert.equal(output.type, 'availability');
    assert.equal(output.available, false);
  });
}

test('the example keeps the assistant disabled when chat is not requested', async () => {
  const { calls } = await runExample('', undefined);
  assert.equal(calls[0][1].featureFlags, undefined);
  assert.equal(
    calls.some(([action]) => action === 'start'),
    false
  );
});
