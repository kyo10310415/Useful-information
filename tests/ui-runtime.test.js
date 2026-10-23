const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { runInNewContext } = require('node:vm');

function browserFixture(confirmed) {
  const calls = [];
  const button = { innerHTML: 'send', disabled: false };
  const context = {
    document: { addEventListener() {}, getElementById: () => ({}) },
    event: { target: { closest: () => button } },
    bootstrap: { Toast: class { show() {} } },
    confirm: () => confirmed,
    fetch: async (path, options) => {
      calls.push({ path, options });
      return { json: async () => ({ success: false, error: 'test-only' }) };
    },
    console: { log() {}, error() {} },
  };
  runInNewContext(readFileSync(require.resolve('../public/js/app.js'), 'utf8'), context);
  return { context, calls, button };
}

test('browser cancellation does not send a broadcast request', async () => {
  const { context, calls } = browserFixture(false);
  await context.sendToDiscord('2');
  assert.equal(calls.length, 0);
});

test('browser confirmation sends the CSRF header and numeric confirmed row', async () => {
  const { context, calls, button } = browserFixture(true);
  await context.sendToDiscord('2');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].path, '/api/send');
  assert.equal(calls[0].options.method, 'POST');
  assert.equal(calls[0].options.headers['X-Information-Request'], '1');
  assert.deepEqual(JSON.parse(calls[0].options.body), { rowIndex: 2, confirmed: true });
  assert.equal(button.disabled, false);
});

test('browser collection sends the CSRF header', async () => {
  const { context, calls } = browserFixture(true);
  await context.collectNow();
  assert.equal(calls.length, 1);
  assert.equal(calls[0].path, '/api/collect');
  assert.equal(calls[0].options.headers['X-Information-Request'], '1');
});

test('runtime schedules the injected collection task directly without an HTTP job', async () => {
  let collected = 0;
  let initialized = 0;
  let scheduled;
  let dependencies;
  const services = {
    initializeSheetsAPI() { initialized++; }, getStudentData() {},
    saveCollectedInfo() {}, getCollectedInfo() {}, markAsSent() {},
  };
  const modules = {
    dotenv: { config() {} },
    './access': { loadAccessConfig: () => ({ publicOrigin: 'https://example.test' }) },
    './app': { createApp: injected => {
      dependencies = injected;
      return { app: { listen() {} }, collectInformationTask: async () => { collected++; } };
    } },
    'node-cron': { schedule: (expression, callback, options) => { scheduled = { expression, callback, options }; } },
    './services/searchService': { collectVTuberInfo() {} },
    './services/sheetsService': services,
    './services/discordService': { broadcastToActiveStudents() {} },
  };
  runInNewContext(readFileSync(require.resolve('../src/server.js'), 'utf8'), {
    require: name => {
      assert.ok(Object.hasOwn(modules, name), `unexpected runtime dependency: ${name}`);
      return modules[name];
    },
    process: { env: {} }, module: { exports: {} }, console: { log() {} },
  });
  assert.equal(initialized, 1);
  assert.equal(dependencies.getStudentData, services.getStudentData);
  assert.equal(scheduled.expression, '0 9 * * 1');
  assert.equal(scheduled.options.timezone, 'Asia/Tokyo');
  assert.equal(collected, 0);
  await scheduled.callback();
  assert.equal(collected, 1);
});
