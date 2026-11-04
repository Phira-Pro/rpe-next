import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const bridge = await readFile(new URL('../pro/bridge.js', import.meta.url), 'utf8');
const notices = await readFile(new URL('../pro/connection.js', import.meta.url), 'utf8');
const ok = result => ({ ok: true, json: async () => ({ ok: true, result }) });
function setup(fetch) {
  let serial = 0;
  const timers = new Map(), states = [], elements = [];
  const document = {
    currentScript: { src: 'http://127.0.0.1:1234/session/pro/bridge.js' },
    createElement(tag) {
      const element = { tag, hidden: false, dataset: {}, children: [], textContent: '', setAttribute() {}, append(...items) { this.children.push(...items); } };
      elements.push(element); return element;
    },
    body: { append() {} },
  };
  const context = { URL, AbortController, DOMException, TextEncoder, Uint8Array, btoa, atob, document, fetch, window: { addEventListener() {} },
    setTimeout(fn, ms) { const id = ++serial; timers.set(id, { fn, ms }); return id; }, clearTimeout(id) { timers.delete(id); } };
  vm.createContext(context); vm.runInContext(bridge, context);
  context.phiraEditor.connection.subscribe(state => states.push(state));
  const flush = async () => { for (let i = 0; i < 15; i++) await Promise.resolve(); };
  return { context, states, timers, elements, flush,
    async tick(ms) {
      const next = [...timers].find(([, timer]) => timer.ms === ms);
      assert.ok(next, `Expected a ${ms} ms timer`); timers.delete(next[0]); next[1].fn(); await flush();
    },
    showNotices() { vm.runInContext(notices, context); return elements.find(element => element.id === 'pro-connection'); },
  };
}

test('a disconnected read retries the same request and recovers without another caller action', async () => {
  const calls = [];
  const state = setup(async (url, options) => { calls.push([String(url), options]); if (calls.length < 3) throw new TypeError('Failed to fetch'); return ok(['chart']); });
  const notice = state.showNotices();
  const task = state.context.rpenDesktopStorage.call('list', 'projects', false);
  await state.flush(); assert.equal(notice.hidden, false); assert.match(notice.children[0].textContent, /自动重试/);
  await state.tick(400); await state.tick(1200);
  const response = await task;
  assert.equal(response.ok, true); assert.deepEqual(response.result, ['chart']);
  assert.equal(calls.length, 3); assert.equal(calls[0][0], calls[2][0]);
  assert.equal(calls[0][1].body, calls[2][1].body); assert.equal(calls[0][1].signal, calls[2][1].signal);
  assert.equal(state.states.at(-1).phase, 'recovered'); assert.match(notice.children[0].textContent, /已恢复/);
  await state.tick(5000); assert.equal(notice.hidden, true); assert.equal(state.timers.size, 0);
});

test('persistent network failure stops after three retries and offers recovery guidance', async () => {
  let calls = 0;
  const state = setup(async () => { calls++; throw new TypeError('Failed to fetch'); });
  const notice = state.showNotices(), task = state.context.rpenDesktopStorage.call('read', 'preferences', 'current');
  await state.flush(); for (const delay of [400, 1200, 2400]) await state.tick(delay);
  const result = await task;
  assert.equal(calls, 4); assert.equal(result.ok, false); assert.equal(result.error.name, 'LocalConnectionError');
  assert.match(result.error.message, /自动重试未能完成/); assert.match(result.error.message, /备份未保存内容/);
  assert.equal(state.states.at(-1).phase, 'failed'); assert.equal(state.timers.size, 0);
  assert.equal(notice.hidden, false); assert.equal(notice.children[1].hidden, false);
  notice.children[1].onclick(); assert.equal(notice.hidden, true);
});

test('only audited storage reads are replayed, including binary chunk reads', async () => {
  for (const command of ['read', 'list', 'listDrafts', 'readRevision', 'blob', 'status', 'legacyMigrationPending', 'migrationDone']) {
    let calls = 0;
    const state = setup(async () => { if (++calls === 1) throw new TypeError('Failed to fetch'); return ok(null); });
    const task = state.context.phiraEditor.request('storage', JSON.stringify([command]));
    await state.flush(); await state.tick(400); await task; assert.equal(calls, 2, command);
  }
  for (const command of ['begin', 'parts', 'binaryBegin', 'binaryChunk', 'commit', 'abort', 'remove', 'setLocalPreference', 'restore', 'purge', 'rebuild', 'collect', 'markMigration', 'unknown']) {
    let calls = 0;
    const state = setup(async () => { calls++; throw new TypeError('Failed to fetch'); });
    const args = command === 'binaryChunk' ? [command, 'transaction', 'binary', 0, new Uint8Array([1])] : [command];
    const result = await state.context.rpenDesktopStorage.call(...args);
    assert.equal(calls, 1, command); assert.equal(result.ok, false); assert.match(result.error.message, /结果尚未确认/); assert.equal(state.timers.size, 0);
  }
  for (const [path, body] of [['export/file', 'data'], ['play', '{}'], ['snapshot', 'data'], ['close', '{}'], ['library', '{}'], ['linked', '{}'], ['storage', '{}'], ['storage', 'invalid']]) {
    let calls = 0;
    const state = setup(async () => { calls++; throw new TypeError('Failed to fetch'); });
    await assert.rejects(state.context.phiraEditor.request(path, body), /结果尚未确认/); assert.equal(calls, 1, path);
  }
});

test('HTTP errors, conflicts and malformed JSON do not cause automatic replay', async () => {
  for (const fetch of [
    async () => ({ ok: false, json: async () => ({ error: { name: 'ProjectConflictError', message: 'changed' } }) }),
    async () => ({ ok: true, json: async () => ({ ok: false, error: { name: 'TypeError', message: 'business error' } }) }),
    async () => ({ ok: true, json: async () => { throw new SyntaxError('invalid JSON'); } }),
  ]) {
    let calls = 0; const state = setup((...args) => { calls++; return fetch(...args); });
    const result = await state.context.rpenDesktopStorage.call('read', 'projects', 'example');
    assert.equal(calls, 1); assert.equal(result.ok, false); assert.notEqual(result.error.name, 'LocalConnectionError'); assert.equal(state.timers.size, 0);
  }
});

test('the original deadline aborts an in-flight read without resetting its budget', async () => {
  let calls = 0;
  const state = setup((_, { signal }) => {
    calls++; if (calls === 1) return Promise.reject(new TypeError('Failed to fetch'));
    return new Promise((_, reject) => signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError'))));
  });
  const task = state.context.rpenDesktopStorage.call('list', 'projects');
  await state.flush(); const deadline = [...state.timers].find(([, timer]) => timer.ms === 60000)[0];
  await state.tick(400); assert.equal(state.timers.has(deadline), true);
  await state.tick(60000); const result = await task;
  assert.equal(calls, 2); assert.equal(result.ok, false); assert.equal(result.error.name, 'LocalConnectionError'); assert.equal(state.timers.size, 0);
});

test('deadline expiry during backoff cancels the delay and never starts a new attempt', async () => {
  let calls = 0; const state = setup(async () => { calls++; throw new TypeError('Failed to fetch'); });
  const task = state.context.rpenDesktopStorage.call('status'); await state.flush();
  await state.tick(60000); const result = await task;
  assert.equal(result.ok, false); assert.equal(calls, 1); assert.equal(state.timers.size, 0);
});

test('one concurrent read recovering does not hide another read still retrying', async () => {
  const counts = new Map();
  const state = setup(async (_, { body }) => { const count = (counts.get(body) ?? 0) + 1; counts.set(body, count); if (count === 1) throw new TypeError('Failed to fetch'); return ok(null); });
  const first = state.context.rpenDesktopStorage.call('list', 'projects'), second = state.context.rpenDesktopStorage.call('status');
  await state.flush(); assert.equal(state.states.at(-1).pending, 2);
  await state.tick(400); await first; assert.equal(state.states.at(-1).phase, 'retrying'); assert.equal(state.states.at(-1).pending, 1);
  await state.tick(400); await second; assert.equal(state.states.at(-1).phase, 'recovered'); assert.equal(state.states.at(-1).pending, 0);
});

test('successful writes and business responses establish connectivity without encouraging duplicate writes', async () => {
  for (const response of [ok(null), { ok: false, json: async () => ({ ok: false, error: { name: 'ProjectConflictError', message: 'changed' } }) }]) {
    let calls = 0;
    const state = setup(async () => { if (++calls === 1) throw new TypeError('Failed to fetch'); return response; });
    const notice = state.showNotices();
    await state.context.rpenDesktopStorage.call('commit', 'transaction');
    assert.equal(state.states.at(-1).phase, 'failed');
    await state.context.rpenDesktopStorage.call('commit', 'another-transaction');
    assert.equal(state.states.at(-1).phase, 'recovered');
    assert.match(notice.children[0].textContent, /保存、导出或删除.*先确认结果/);
    assert.doesNotMatch(notice.children[0].textContent, /重试尚未完成的操作/);
  }
});

test('concurrent transport failure and a business response leave no stale recovery count', async () => {
  let calls = 0;
  const state = setup(async () => { if (++calls <= 3) throw new TypeError('Failed to fetch'); return { ok: false, json: async () => ({ ok: false, error: { message: 'changed' } }) }; });
  const read = state.context.rpenDesktopStorage.call('list', 'projects'); await state.flush();
  await state.context.rpenDesktopStorage.call('commit', 'transaction');
  await state.tick(400); await state.tick(1200); await read;
  assert.equal(state.states.at(-1).phase, 'recovered'); assert.equal(state.states.at(-1).pending, 0);
});

test('response body network failures retry but body timeouts use the original deadline', async () => {
  for (const timeout of [false, true]) {
    let calls = 0;
    const state = setup(async (_, { signal }) => {
      if (++calls > 1) return ok('complete');
      return { ok: true, json: () => timeout
        ? new Promise((_, reject) => signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError'))))
        : Promise.reject(new TypeError('body disconnected')) };
    });
    const task = state.context.rpenDesktopStorage.call('read', 'projects', 'example'); await state.flush();
    if (timeout) { await state.tick(60000); assert.equal((await task).ok, false); assert.equal(calls, 1); }
    else { await state.tick(400); assert.equal((await task).result, 'complete'); assert.equal(calls, 2); }
    assert.equal(state.timers.size, 0);
  }
});
