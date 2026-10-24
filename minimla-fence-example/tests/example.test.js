import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const script = html
  .match(/<script type="module">([\s\S]*?)<\/script>/)[1]
  .replace(/^\s*import .+;$/gm, '');

const runExample = async ({
  search = '',
  loadError,
  exportError,
  plans = [],
} = {}) => {
  const calls = [];
  const downloads = [];
  const revoked = [];
  const blobs = new Map();
  const elements = new Map();
  for (const id of [
    'rubens-planner',
    'actions',
    'status',
    'construction-overview',
    'construction-bom',
    'elevation-plan',
  ]) {
    elements.set(id, {
      disabled: id === 'actions',
      textContent: '',
      addEventListener: (_event, handler) => {
        elements.get(id).click = handler;
      },
    });
  }
  const overview = {
    objects: [{ id: 'post' }],
    parts: { fullList: [{ articleNumber: 'post', count: 2 }] },
  };
  const instance = {
    ui: {
      loadObject: async (id) => {
        calls.push(['load', id]);
        assert.equal(elements.get('actions').disabled, true);
        if (loadError) throw new Error(loadError);
      },
    },
    extended: {
      getConstructionOverview: async () => {
        if (exportError) throw new Error(exportError);
        return overview;
      },
      create2DElevationPlan: async () => ({ plans }),
    },
  };
  const window = { location: { search } };
  await runInNewContext(`(async () => { ${script} })()`, {
    RoomleConfiguratorApi: {
      createPlanner: async (id, container, options) => {
        calls.push([
          'create',
          id,
          container,
          JSON.parse(JSON.stringify(options)),
        ]);
        return instance;
      },
    },
    URLSearchParams,
    URL: {
      createObjectURL: (blob) => {
        const url = `blob:${blobs.size}`;
        blobs.set(url, blob);
        return url;
      },
      revokeObjectURL: (url) => revoked.push(url),
    },
    Blob,
    setTimeout: (callback) => callback(),
    document: {
      getElementById: (id) => elements.get(id),
      createElement: () => ({
        click() {
          downloads.push({
            filename: this.download,
            blob: blobs.get(this.href),
          });
        },
      }),
    },
    window,
  });
  return { calls, downloads, revoked, elements, window, instance, overview };
};

test('loads the Biohort snapshot with its catalog and exposes the ready planner', async () => {
  const { calls, elements, window, instance } = await runExample();
  assert.deepEqual(calls, [
    [
      'create',
      'biohort_fence',
      elements.get('rubens-planner'),
      { catalogRootTag: 'biohort_fence_root' },
    ],
    ['load', 'ps_mpzobaibjtz9034jbpurb6t98fab0w8'],
  ]);
  assert.equal(elements.get('actions').disabled, false);
  assert.equal(elements.get('status').textContent, '');
  assert.equal(window.instance, instance);
});

test('uses URL overrides and keeps host-only parameters out of planner init options', async () => {
  const { calls } = await runExample({
    search:
      '?configuratorId=fence&id=ps_custom&catalogRootTag=fence_catalog_root&locale=de&overrideServerUrl=http%3A%2F%2Flocalhost%3A5173%2F',
  });
  assert.equal(calls[0][1], 'fence');
  assert.deepEqual(calls[0][3], {
    catalogRootTag: 'fence_catalog_root',
    locale: 'de',
    overrideServerUrl: 'http://localhost:5173/',
  });
  assert.deepEqual(calls[1], ['load', 'ps_custom']);
});

test('keeps exports disabled and reports a failed snapshot load', async () => {
  const { elements, window } = await runExample({
    loadError: 'Snapshot not found',
  });
  assert.equal(elements.get('actions').disabled, true);
  assert.equal(elements.get('status').textContent, 'Snapshot not found');
  assert.equal(window.instance, undefined);
});

test('downloads the full overview and only the full parts list for the bill of materials', async () => {
  const { elements, downloads, revoked, overview } = await runExample();
  await elements.get('construction-overview').click();
  await elements.get('construction-bom').click();
  assert.deepEqual(
    downloads.map(({ filename }) => filename),
    ['construction-overview.json', 'construction-bom.json']
  );
  assert.deepEqual(JSON.parse(await downloads[0].blob.text()), overview);
  assert.deepEqual(
    JSON.parse(await downloads[1].blob.text()),
    overview.parts.fullList
  );
  assert.equal(downloads[0].blob.type, 'application/json');
  assert.equal(downloads[1].blob.type, 'application/json');
  assert.equal(revoked.length, 2);
});

test('names floor and elevation SVGs by view type rather than array order', async () => {
  const plans = [
    { planSvg: '<svg>side</svg>', viewType: { value: 1 } },
    { planSvg: '<svg>floor</svg>', viewType: { value: 0 } },
    { planSvg: '<svg>other</svg>' },
  ];
  const { elements, downloads, revoked } = await runExample({ plans });
  await elements.get('elevation-plan').click();
  assert.deepEqual(
    downloads.map(({ filename }) => filename),
    [
      'roomle-elevation-plan-1.svg',
      'roomle-floor-plan.svg',
      'roomle-elevation-plan-2.svg',
    ]
  );
  for (const [index, { blob }] of downloads.entries()) {
    assert.equal(blob.type, 'image/svg+xml');
    assert.equal(await blob.text(), plans[index].planSvg);
  }
  assert.equal(revoked.length, 3);
});

test('handles an empty set of 2D plans without downloading files', async () => {
  const { elements, downloads } = await runExample();
  await elements.get('elevation-plan').click();
  assert.equal(downloads.length, 0);
  assert.equal(elements.get('status').textContent, '');
});

test('reports export failures without downloading invalid data', async () => {
  const { elements, downloads } = await runExample({
    exportError: 'Export unavailable',
  });
  await elements.get('construction-overview').click();
  assert.equal(elements.get('status').textContent, 'Export unavailable');
  assert.equal(downloads.length, 0);
});
