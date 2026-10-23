const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { createApp } = require('../src/app');
const { loadAccessConfig } = require('../src/access');
const config = { username: 'test-admin', password: 'isolated-test-password-'.repeat(3), publicOrigin: 'https://information.example.com' };
const authorization = 'Basic ' + Buffer.from(config.username + ':' + config.password).toString('base64');
async function fixture(t, overrides = {}) {
  const calls = { reads: 0, collects: 0, sends: 0, marks: 0 };
  const { app } = createApp({ accessConfig: config,
    collectVTuberInfo: async () => { calls.collects++; return []; },
    getStudentData: async () => [], saveCollectedInfo: async () => {},
    getCollectedInfo: async () => { calls.reads++; return [{ rowIndex: 2, sent: false }]; },
    markAsSent: async () => { calls.marks++; },
    broadcastToActiveStudents: async () => { calls.sends++; return 1; }, ...overrides
  });
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => { server.closeAllConnections(); return new Promise(resolve => server.close(resolve)); });
  const request = (path, options = {}) => fetch(`http://127.0.0.1:${server.address().port}${path}`, options);
  return { calls, request };
}
test('new access configuration has no fallback and validates origin', () => {
  assert.throws(() => loadAccessConfig({}), /INFORMATION_ADMIN_USERNAME/);
  const env = { INFORMATION_ADMIN_USERNAME: config.username, INFORMATION_ADMIN_PASSWORD: config.password, INFORMATION_PUBLIC_ORIGIN: config.publicOrigin };
  assert.equal(loadAccessConfig(env).publicOrigin, config.publicOrigin);
  assert.throws(() => loadAccessConfig({ ...env, INFORMATION_ADMIN_PASSWORD: 'short' }));
  assert.throws(() => loadAccessConfig({ ...env, INFORMATION_PUBLIC_ORIGIN: 'https://information.example.com/path' }));
});
test('runtime entry refuses missing credentials before service initialization', () => {
  const env = { ...process.env };
  for (const key of ['INFORMATION_ADMIN_USERNAME', 'INFORMATION_ADMIN_PASSWORD', 'INFORMATION_PUBLIC_ORIGIN']) delete env[key];
  const result = spawnSync(process.execPath, ['src/server.js'], { cwd: require('node:path').resolve(__dirname, '..'), env, encoding: 'utf8' });
  assert.notEqual(result.status, 0); assert.match(result.stderr, /INFORMATION_ADMIN_USERNAME/);
});
test('health is public; dashboard, assets and all operations require admin', async t => {
  const { request, calls } = await fixture(t);
  assert.equal((await request('/health')).status, 200);
  for (const path of ['/', '/js/app.js', '/api/collect', '/api/send', '/api/collect-on-startup']) {
    const response = await request(path, path.startsWith('/api/') ? { method: 'POST' } : {});
    assert.equal(response.status, 401); assert.match(response.headers.get('www-authenticate'), /^Basic /);
    assert.equal(response.headers.get('cache-control'), 'no-store');
  }
  assert.deepEqual(calls, { reads: 0, collects: 0, sends: 0, marks: 0 });
});
test('wrong credentials, missing CSRF header and foreign origin never invoke services', async t => {
  const { request, calls } = await fixture(t);
  for (const headers of [{ Authorization: 'Basic ' + Buffer.from('bad:wrong').toString('base64') }, { Authorization: authorization }, { Authorization: authorization, 'X-Information-Request': '1', Origin: 'https://attacker.example.com' }]) {
    assert.ok([401, 403].includes((await request('/api/collect', { method: 'POST', headers })).status));
  }
  assert.equal(calls.collects, 0);
});
test('only validated and explicitly confirmed admin broadcast invokes send', async t => {
  const { request, calls } = await fixture(t);
  const headers = { Authorization: authorization, 'X-Information-Request': '1', Origin: config.publicOrigin, 'Content-Type': 'application/json' };
  for (const body of [{ rowIndex: 2 }, { rowIndex: '2x', confirmed: true }, { rowIndex: -1, confirmed: true }]) {
    assert.equal((await request('/api/send', { method: 'POST', headers, body: JSON.stringify(body) })).status, 400);
  }
  assert.equal(calls.sends, 0);
  const response = await request('/api/send', { method: 'POST', headers, body: JSON.stringify({ rowIndex: 2, confirmed: true }) });
  assert.equal(response.status, 200); assert.equal(calls.sends, 1); assert.equal(calls.marks, 1);
});
test('authenticated collection remains supported', async t => {
  const { request, calls } = await fixture(t);
  assert.equal((await request('/', { headers: { Authorization: authorization } })).status, 200);
  assert.equal((await request('/api/collect', { method: 'POST', headers: { Authorization: authorization, 'X-Information-Request': '1' } })).status, 200);
  assert.equal(calls.collects, 1);
});
test('concurrent broadcast is rejected and lock is released after completion', async t => {
  let release;
  const pending = new Promise(resolve => { release = resolve; });
  let started;
  const startedPromise = new Promise(resolve => { started = resolve; });
  const { request } = await fixture(t, { broadcastToActiveStudents: async () => { started(); await pending; return 1; } });
  const options = { method: 'POST', headers: { Authorization: authorization, 'X-Information-Request': '1', 'Content-Type': 'application/json' }, body: JSON.stringify({ rowIndex: 2, confirmed: true }) };
  const first = request('/api/send', options);
  await startedPromise;
  assert.equal((await request('/api/send', options)).status, 409);
  release(); assert.equal((await first).status, 200);
  assert.equal((await request('/api/send', options)).status, 200);
});
