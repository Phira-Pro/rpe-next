// GPL-3.0-only. Connection notices remain available before editor modules load.
(() => {
  const notice = document.createElement('div');
  notice.id = 'pro-connection'; notice.hidden = true;
  notice.setAttribute('role', 'status'); notice.setAttribute('aria-live', 'polite');
  const message = document.createElement('span'), dismiss = document.createElement('button');
  dismiss.type = 'button'; dismiss.textContent = '知道了';
  dismiss.onclick = () => { notice.hidden = true; };
  notice.append(message, dismiss); document.body.append(notice);
  let timer;
  globalThis.phiraEditor.connection.subscribe(state => {
    clearTimeout(timer);
    if (state.phase === 'connected') return;
    notice.hidden = false; notice.dataset.phase = state.phase;
    dismiss.hidden = state.phase === 'retrying';
    if (state.phase === 'retrying') {
      message.textContent = `本地服务读取暂时中断，正在自动重试（最多 3 次）${state.attempt ? `，当前第 ${state.attempt} 次` : ''}。请保留当前窗口。`;
    } else if (state.phase === 'recovered') {
      message.textContent = '本地服务连接已恢复。未完成的读取可重试；此前保存、导出或删除如曾报错，请先确认结果，避免重复操作。';
      timer = setTimeout(() => { notice.hidden = true; }, 5000);
    } else {
      message.textContent = '本地服务暂时无法连接。请保留窗口并备份未保存内容，稍后重试；保存、导出或删除的结果请先确认，避免重复操作。';
    }
  });
})();
