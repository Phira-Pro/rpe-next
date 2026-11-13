// GPL-3.0-only. Restore language before UI imports on a new loopback origin.
const KEY = 'rpe-next-locale-v1';
function applyNativeLocale({ result }, storage) {
  const locale = result?.data?.values?.[KEY];
  if (typeof locale === 'string' && locale.length <= 40) storage.setItem(KEY, locale);
  else storage.removeItem(KEY);
}
const readLocale = host => host.request('storage', JSON.stringify(['read', 'preferences', 'ui-settings']));
export async function restoreNativeLocale(host, storage) {
  applyNativeLocale(await readLocale(host), storage);
}
export async function startEditor(host, storage, load = () => import('./editor.mjs')) {
  try {
    const preferences = await host.boot.wait(readLocale(host), '正在恢复界面语言', 4000);
    applyNativeLocale(preferences, storage);
  } catch (error) { console.warn('RPEN locale restore:', error); }
  return host.boot.wait(load(), '正在启动制谱器', 40000);
}

if (typeof document !== 'undefined') {
  const host = globalThis.phiraEditor;
  try {
    await startEditor(host, globalThis.localStorage);
  } catch (error) {
    console.error('RPEN startup:', error);
    host.boot.fail();
  }
}
