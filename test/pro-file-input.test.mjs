import test from 'node:test';
import assert from 'node:assert/strict';
import { installFileInputs } from '../pro/file-input.mjs';
import { decodeEditorAudio } from '../src/platform/audio-decode.mjs';

test('iOS picker removes provider filters from every file input, including dynamic inputs', () => {
  class FileInput {
    constructor(accept, webkitdirectory = false) { Object.assign(this, { type: 'file', accept, webkitdirectory, multiple: true }); }
    removeAttribute(key) { delete this[key]; }
  }
  globalThis.HTMLInputElement = FileInput;
  try {
    let click;
    const root = { addEventListener(type, handler, capture) {
      assert.equal(type, 'click'); assert.equal(capture, true); click = handler;
    } };
    installFileInputs(assert.fail, root, { userAgent: 'Android' });
    assert.equal(click, undefined);
    installFileInputs(assert.fail, root, { platform: 'MacIntel', maxTouchPoints: 5 });
    for (const filter of ['audio/*', 'image/*', '.pez,.zip', '.rpenskin,.rpenmod', '.glsl,.frag', '.ttf,.otf', '.json,.txt']) {
      const input = new FileInput(filter);
      click({ target: input, preventDefault: assert.fail });
      assert.equal(input.accept, undefined);
      assert.equal(input.multiple, true);
    }
    const directory = new FileInput('.zip', true);
    click({ target: directory, preventDefault: assert.fail });
    assert.equal(directory.accept, '.zip');
  } finally { delete globalThis.HTMLInputElement; }
});

test('iOS fallback only sends unsupported Ogg or FLAC to the local host and keeps the source bytes', async context => {
  const input = new Uint8Array([79, 103, 103, 83, 1, 2]);
  const fallback = new Uint8Array([82, 73, 70, 70]);
  const decoder = { async decodeAudioData(buffer) {
    const bytes = new Uint8Array(buffer);
    if (bytes[0] !== 82) { bytes.fill(0); throw Error('Unsupported format'); }
    return 'decoded PCM';
  } };
  const fetch = context.mock.method(globalThis, 'fetch', async (url, request) => {
    assert.equal(url.href, 'http://127.0.0.1/session/pro/decode-audio');
    assert.deepEqual([...request.body], [79, 103, 103, 83, 1, 2]);
    return new Response(fallback, { headers: { 'Content-Type': 'audio/wav' } });
  });
  const options = { host: { root: 'http://127.0.0.1/session/' }, device: { userAgent: 'iPhone' } };
  assert.equal(await decodeEditorAudio(decoder, input, options), 'decoded PCM');
  assert.deepEqual([...input], [79, 103, 103, 83, 1, 2]);
  assert.equal(await decodeEditorAudio(decoder, fallback, options), 'decoded PCM');
  await assert.rejects(decodeEditorAudio(decoder, input, { ...options, device: { userAgent: 'Android' } }), /Unsupported/);
  await assert.rejects(decodeEditorAudio(decoder, new Uint8Array([1, 2, 3]), options), /Unsupported/);
  assert.equal(fetch.mock.callCount(), 1);
});
