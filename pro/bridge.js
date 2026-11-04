// GPL-3.0-only. The host exposes editor storage and explicit user actions only.
(() => {
  const root = new URL('../', document.currentScript.src);
  const bytesToBase64 = bytes => {
    let text = '';
    for (let offset = 0; offset < bytes.length; offset += 16384) text += String.fromCharCode(...bytes.subarray(offset, offset + 16384));
    return btoa(text);
  };
  const fromBase64 = text => Uint8Array.from(atob(text), char => char.charCodeAt(0));
  // Only audited storage queries may be replayed. Writes can have succeeded even
  // when their response was lost, so unknown commands are never retried.
  const readCommands = new Set(['read', 'list', 'listDrafts', 'readRevision', 'blob', 'status', 'legacyMigrationPending', 'migrationDone']);
  const retryDelays = [400, 1200, 2400];
  const recovering = new Set(), connectionListeners = new Set();
  let connectionState = Object.freeze({ phase: 'connected', attempt: 0, pending: 0 });
  function connectionChanged(phase, attempt = 0) {
    connectionState = Object.freeze({ phase, attempt, pending: recovering.size });
    for (const listener of connectionListeners) { try { listener(connectionState); } catch {} }
  }
  function connectionAvailable(token) {
    const wasRecovering = recovering.delete(token);
    if (wasRecovering || connectionState.phase === 'failed' || connectionState.phase === 'retrying') {
      connectionChanged(recovering.size ? 'retrying' : 'recovered');
    }
  }
  const connection = Object.freeze({
    subscribe(listener) {
      connectionListeners.add(listener); listener(connectionState);
      return () => connectionListeners.delete(listener);
    },
  });
  function isRead(path, body) {
    if (path !== 'storage' || typeof body !== 'string') return false;
    try { const args = JSON.parse(body); return Array.isArray(args) && readCommands.has(args[0]); }
    catch { return false; }
  }
  function retryDelay(milliseconds, signal) {
    return new Promise((resolve, reject) => {
      const abort = () => { clearTimeout(timer); signal.removeEventListener('abort', abort); reject(new DOMException('Request aborted', 'AbortError')); };
      const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, milliseconds);
      signal.addEventListener('abort', abort, { once: true });
      if (signal.aborted) abort();
    });
  }
  async function request(path, body, type = 'application/json') {
    const readOnly = isRead(path, body), token = {};
    let transportFailure = false;
    const controller = new AbortController();
    // One deadline covers all attempts, including backoff and response bodies.
    const timer = setTimeout(() => controller.abort(), path === 'storage' || path === 'snapshot' ? 60000 : 10000);
    try {
      for (let attempt = 0; ; attempt++) {
        let response, result;
        try {
          response = await fetch(new URL('pro/' + path, root), { method: 'POST', headers: { 'Content-Type': type }, body, signal: controller.signal });
          result = await response.json();
        } catch (error) {
          transportFailure = error.name === 'TypeError' || error.name === 'AbortError' || controller.signal.aborted;
          if (readOnly && (!response || response.ok) && error.name === 'TypeError' && !controller.signal.aborted && attempt < retryDelays.length) {
            recovering.add(token); connectionChanged('retrying', attempt + 1);
            await retryDelay(retryDelays[attempt], controller.signal);
            continue;
          }
          throw error;
        }
        transportFailure = false;
        connectionAvailable(token);
        if (!response.ok || result.ok === false) throw Object.assign(new Error(result.error?.message ?? '编辑器操作未完成'), result.error);
        return result;
      }
    } catch (error) {
      recovering.delete(token);
      if (transportFailure) {
        connectionChanged('failed');
        const message = readOnly
          ? '本地服务读取中断或超时，自动重试未能完成。请保留当前窗口，稍后重试刚才的读取操作；仍无法连接时，先备份未保存内容，再返回 Pro 重新进入。'
          : '本地服务连接中断或超时，操作结果尚未确认。请先检查当前状态，避免重复保存、导出或删除；保留当前窗口并备份未保存内容。';
        throw Object.assign(new Error(message), { name: 'LocalConnectionError' });
      }
      // A successful HTTP exchange with a business error still ends recovery.
      if (connectionState.phase === 'retrying' && !recovering.size) connectionChanged('recovered');
      throw error;
    } finally { clearTimeout(timer); }
  }
  globalThis.rpenDesktopStorage = Object.freeze({ version: 1, async call(...args) {
    try {
      if (args[0] === 'binaryChunk') args[4] = bytesToBase64(args[4]);
      const response = await request('storage', JSON.stringify(args));
      if (args[0] === 'blob' && response.result?.base64 !== undefined) response.result = fromBase64(response.result.base64);
      return response;
    } catch (error) { return { ok: false, error: { name: error.name, message: error.message } }; }
  } });
  globalThis.phiraEditor = {
    root, request, connection,
    pointerMode: 'edit',
    download(blob, name) {
      const encoded = bytesToBase64(new TextEncoder().encode(name)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
      request('export/' + encoded, blob, blob.type || 'application/octet-stream')
        .catch(error => globalThis.rpenMods?.editor.notify(error.message, 'error'));
      return name;
    },
    requestClose() {
      if (globalThis.PhiraEditorShell) globalThis.PhiraEditorShell.closeBoot();
      return request('close', '{}');
    },
  };
  // Project modifiers onto real touch events before editor and mod listeners run.
  // Keyboard and mouse events retain their original properties.
  for(const type of ['pointerdown','pointermove','pointerup'])window.addEventListener(type,event=>{
    if(event.pointerType!=='touch')return;
    const mode=globalThis.phiraEditor.pointerMode;
    if(mode==='box')Object.defineProperty(event,'shiftKey',{value:true,configurable:true});
    if(mode==='multi')Object.defineProperty(event,'ctrlKey',{value:true,configurable:true});
  },true);
})();
