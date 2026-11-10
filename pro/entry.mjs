// GPL-3.0-only. Restore language before UI imports on a new loopback origin.
const KEY = 'rpe-next-locale-v1';
export async function restoreNativeLocale(host, storage) {
  const { result } = await host.request('storage', JSON.stringify(['read', 'preferences', 'ui-settings']));
  const locale = result?.data?.values?.[KEY];
  if (typeof locale === 'string' && locale.length <= 40) storage.setItem(KEY, locale);
  else storage.removeItem(KEY);
}
if (typeof document !== 'undefined') {
  const host = globalThis.phiraEditor;
  try {
    await host.boot.wait(restoreNativeLocale(host, globalThis.localStorage), '正在恢复界面语言');
    await import('./editor.mjs');
  } catch (error) { host.boot.fail(error); }
}
