import { isIOS } from './device.mjs';

// Keep the original file in the project. The loopback host only creates a
// temporary PCM representation when WebKit cannot decode the selected bytes.
export async function nativeAudioWave(bytes, { host = globalThis.phiraEditor, device = globalThis.navigator, signal } = {}) {
  if (!host || !isIOS(device)) return null;
  const input = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const ogg = input[0] === 79 && input[1] === 103 && input[2] === 103 && input[3] === 83;
  const flac = input[0] === 102 && input[1] === 76 && input[2] === 97 && input[3] === 67;
  if (!ogg && !flac) return null;
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) abort();
  signal?.addEventListener('abort', abort, { once: true });
  const timeout = setTimeout(abort, 20000);
  try {
    const response = await fetch(new URL('pro/decode-audio', host.root), {
      method: 'POST', body: input, headers: { 'Content-Type': 'application/octet-stream' }, signal: controller.signal,
    });
    if (!response.ok || response.headers.get('Content-Type') !== 'audio/wav') return null;
    return await response.arrayBuffer();
  } finally { clearTimeout(timeout); signal?.removeEventListener('abort', abort); }
}

export async function decodeEditorAudio(context, bytes, options) {
  const input = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  try { return await context.decodeAudioData(input.slice().buffer); }
  catch (error) {
    const wave = await nativeAudioWave(input, options);
    if (!wave) throw error;
    return context.decodeAudioData(wave);
  }
}
