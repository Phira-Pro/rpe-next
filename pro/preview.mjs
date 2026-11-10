// GPL-3.0-only. Native frames share the editor's preview surfaces and audio clock.
import { nativePlaybackExport } from './snapshot.mjs';
import { localPreferences } from '../src/platform/local-preferences.mjs';
import { currentLocale } from '../src/i18n.mjs';

const KEY = 'rpe-next-pro-preview-renderer';
const text = (zh, en, ja) => currentLocale().base === 'ja' ? ja : currentLocale().base === 'zh' ? zh : en;
export function decodePreviewFrame(buffer) {
  if (buffer.byteLength < 16) throw Error('Incomplete native preview frame');
  const view = new DataView(buffer);
  if (view.getUint32(0, true) !== 0x56505250) throw Error('Invalid native preview frame');
  const width = view.getUint32(4, true), height = view.getUint32(8, true);
  if (width < 64 || width > 1280 || height < 64 || height > 720 || buffer.byteLength !== 16 + width * height * 4) throw Error('Invalid native preview dimensions');
  return { width, height, revision: view.getUint32(12, true), pixels: new Uint8ClampedArray(buffer, 16) };
}
export function previewSize(width, height, ratio = width / Math.max(1, height)) {
  ratio = Number.isFinite(ratio) && ratio > 0 ? ratio : 1.5;
  width = Math.min(width, height * ratio); height = width / ratio;
  const factor = Math.min(1, 960 / Math.max(1, width), 720 / Math.max(1, height));
  return { width: Math.max(64, Math.floor(width * factor / 2) * 2), height: Math.max(64, Math.floor(height * factor / 2) * 2) };
}
export function installNativePreview({ editor, host }) {
  let mode = localPreferences.getItem(KEY) === 'phira' ? 'phira' : 'rpen';
  let id = '', generation = 0, chart, assets, assetValues = [], size = '', revision = -1, failed = false, stopped = false;
  let changedAt = 0, timer;
  const section = document.createElement('section'); section.className = 'settings-group'; section.dataset.settingsCategory = 'preview';
  const title = document.createElement('h3'); title.textContent = text('预览渲染器', 'Preview renderer', 'プレビューレンダラー');
  const label = document.createElement('label'); label.className = 'field'; label.textContent = title.textContent;
  const select = document.createElement('select'); select.id = 'pro-preview-renderer'; select.setAttribute('aria-label', title.textContent);
  select.append(new Option('RPEN', 'rpen'), new Option('Phira Pro', 'phira')); select.value = mode; label.append(select);
  const hint = document.createElement('p'); hint.className = 'hint'; hint.textContent = text('Pro 模式在相同区域显示原生渲染画面，编辑修改会自动同步。音乐仍由 RPEN 播放。扩展运行时效果需原生端支持。', 'Pro mode displays native frames in the same region and synchronizes edits automatically. RPEN plays the audio. Runtime effects require native support.', 'Pro モードは同じ領域にネイティブ描画を表示し、編集内容を自動同期します。音楽は RPEN が再生します。拡張効果にはネイティブ側の対応が必要です。');
  section.append(title, label, hint); document.querySelector('#settings-content').append(section);
  const surfaces = ['#realtime-preview', '#preview'].map(selector => {
    const original = document.querySelector(selector), canvas = document.createElement('canvas');
    canvas.className = 'pro-native-preview'; canvas.hidden = true; original.after(canvas);
    const message = document.createElement('div'); message.className = 'pro-native-preview-message'; message.hidden = true; canvas.after(message);
    return { original, canvas, message, context: canvas.getContext('2d'), fullscreen: selector === '#preview' };
  });
  const scratch = document.createElement('canvas'), scratchContext = scratch.getContext('2d');
  function visible() { return mode === 'phira' && editor.hasDocument && !editor.home && !document.hidden; }
  function setMessage(message) {
    for (const surface of surfaces) { surface.message.textContent = message; surface.message.hidden = !message; }
  }
  function layout() {
    for (const surface of surfaces) {
      const style = getComputedStyle(surface.original);
      const active = visible() && (surface.fullscreen ? editor.preview.visible : document.querySelector('#realtime-enabled').checked);
      surface.canvas.hidden = !active; surface.original.classList.toggle('pro-native-source', active);
      surface.original.parentElement.classList.toggle('pro-native-active', active);
      surface.message.hidden = !active || !surface.message.textContent;
      for (const target of [surface.canvas, surface.message]) Object.assign(target.style, { left: surface.original.offsetLeft + 'px', top: surface.original.offsetTop + 'px', width: surface.original.clientWidth + 'px', height: surface.original.clientHeight + 'px' });
      surface.canvas.style.opacity = surface.fullscreen ? '1' : style.opacity;
    }
  }
  async function stop() { const previous = id; id = ''; generation++; revision = -1; if (previous) await host.request('preview', JSON.stringify({ action: 'stop', id: previous })).catch(() => {}); }
  function invalidate() { chart = null; failed = false; changedAt = performance.now(); }
  select.onchange = () => { mode = select.value; localPreferences.setItem(KEY, mode); invalidate(); void stop(); layout(); };
  const retry = document.createElement('button'); retry.type = 'button'; retry.textContent = text('重新连接预览', 'Reconnect preview', 'プレビューを再接続'); retry.onclick = invalidate; section.append(retry);
  async function tick() {
    try {
      layout();
      if (!visible() || !surfaces.some(surface => !surface.canvas.hidden)) { if (id) await stop(); return; }
      const target = surfaces.find(surface => !surface.canvas.hidden && surface.fullscreen) ?? surfaces[0];
      const dimensions = previewSize(target.original.width || target.original.clientWidth, target.original.height || target.original.clientHeight, editor.preview.aspectRatio ?? 1.5);
      const nextSize = `${dimensions.width},${dimensions.height}`;
      const values = [...editor.assets.values()];
      if (chart !== editor.chart || assets !== editor.assets || values.length !== assetValues.length || values.some((value, index) => value !== assetValues[index]) || nextSize !== size) {
        chart = editor.chart; assets = editor.assets; assetValues = values; size = nextSize; changedAt = performance.now(); failed = false;
        await stop();
        for (const surface of surfaces) surface.context.clearRect(0, 0, surface.canvas.width, surface.canvas.height);
        setMessage(text('正在同步原生预览', 'Synchronizing native preview', 'ネイティブプレビューを同期中'));
      }
      if (failed || performance.now() - changedAt < 250) return;
      if (!id) {
        const token = generation;
        const { blob } = await nativePlaybackExport(editor.chart, editor.assets, editor.chartName);
        if (token !== generation || !visible()) return;
        const snapshot = await host.request('snapshot', blob, 'application/zip');
        const result = await host.request('preview', JSON.stringify({ action: 'start', snapshot: snapshot.id, ...dimensions }));
        if (token !== generation || !visible()) { await host.request('preview', JSON.stringify({ action: 'stop', id: result.id })); return; }
        id = result.id;
      }
      const token = generation;
      const state = await host.request('preview', JSON.stringify({ action: 'seek', id, time: Math.max(0, editor.audio.time || 0), showHud: Boolean(editor.preview.showGameUI) }));
      if (token !== generation) return;
      if (state.error) throw Error(state.error);
      if (state.ready && state.revision !== revision) {
        const response = await fetch(new URL('pro/preview-frame', host.root), { signal: AbortSignal.timeout(5000) });
        if (!response.ok) throw Error('Native preview connection failed');
        const frame = decodePreviewFrame(await response.arrayBuffer());
        if (token !== generation) return;
        revision = frame.revision;
        scratch.width = frame.width; scratch.height = frame.height;
        scratchContext.putImageData(new ImageData(frame.pixels, frame.width, frame.height), 0, 0);
        for (const surface of surfaces) {
          surface.canvas.width = frame.width; surface.canvas.height = frame.height;
          surface.context.setTransform(1, 0, 0, -1, 0, frame.height);
          surface.context.drawImage(scratch, 0, 0);
        }
        setMessage('');
      }
    } catch (error) { failed = true; setMessage(text('原生预览不可用：', 'Native preview unavailable: ', 'ネイティブプレビューを利用できません：') + error.message); }
    finally { if (!stopped) timer = setTimeout(tick, 50); }
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden) void stop(); });
  window.addEventListener('pagehide', () => { stopped = true; clearTimeout(timer); void stop(); });
  void tick();
}
