import { isIOS } from '../src/platform/device.mjs';
import { directoryFiles } from './folders.mjs';
import { pt } from './locale.mjs';

// iOS Files can disable valid files based on the provider's type metadata.
// Let the editor's importers validate the selected bytes and keep the same
// single/multiple selection and change handlers for static and dynamic inputs.
export function installFileInputs(report, root = document, device = globalThis.navigator) {
  if (!isIOS(device)) return;
  let folderPicker;
  root.addEventListener('click', event => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || input.type !== 'file') return;
    if (!input.webkitdirectory) {
      input.removeAttribute('accept');
      return;
    }
    if (!globalThis.phiraIOSFolderZip) return;
    event.preventDefault();
    if (folderPicker || input.disabled) return;
    const dialog = root.createElement('dialog');
    const message = root.createElement('p');
    message.textContent = pt('此 iOS 版本不能直接选择文件夹。请先在「文件」中压缩文件夹，再选择生成的 ZIP。');
    const choose = root.createElement('button'), cancel = root.createElement('button');
    choose.textContent = pt('选择 ZIP'); cancel.textContent = pt('取消');
    const picker = root.createElement('input');
    folderPicker = picker;
    picker.type = 'file'; picker.hidden = true;
    let selecting = false;
    const clean = () => { dialog.remove(); picker.remove(); folderPicker = null; };
    dialog.addEventListener('close', () => { if (!selecting) clean(); }, { once: true });
    cancel.onclick = () => dialog.close();
    choose.onclick = () => { selecting = true; dialog.close(); picker.click(); };
    picker.addEventListener('cancel', clean, { once: true });
    picker.addEventListener('change', async () => {
      try {
        const archive = picker.files[0];
        if (!archive || !input.isConnected) return;
        if (archive.size > 513 * 1024 ** 2) throw Error(pt('ZIP 文件过大'));
        const files = await directoryFiles(await archive.arrayBuffer(), archive.name);
        if (!input.isConnected) return;
        // Older iOS can strip relative paths from DataTransfer FileLists.
        // Existing handlers capture the selected files during this event.
        Object.defineProperty(input, 'files', { value: files, configurable: true });
        try { input.dispatchEvent(new Event('change', { bubbles: true })); }
        finally { delete input.files; }
      } catch (error) { report(error); }
      finally { clean(); }
    }, { once: true });
    dialog.append(message, choose, cancel);
    root.body.append(dialog, picker);
    dialog.showModal();
  }, true);
}
