import test from 'node:test';
import assert from 'node:assert/strict';
import { decodePreviewFrame, previewSize } from '../pro/preview.mjs';
import { setLocale, t, BUILTIN_LOCALES } from '../src/i18n.mjs';
import { pt } from '../pro/locale.mjs';
import { readFile } from 'node:fs/promises';
import { rewriteModModule, resolveModImport } from '../src/core/mod-package.mjs';

test('native frame transport validates size and exposes bottom-up RGBA without copying', () => {
  const buffer = new ArrayBuffer(16 + 64 * 64 * 4), view = new DataView(buffer);
  for (const [index, value] of [0x56505250,64,64,9].entries()) view.setUint32(index * 4,value,true);
  const frame = decodePreviewFrame(buffer);
  assert.equal(frame.width,64); assert.equal(frame.revision,9); assert.equal(frame.pixels.buffer,buffer);
  assert.throws(()=>decodePreviewFrame(buffer.slice(1)),/Invalid|Incomplete/);
  view.setUint32(4,8192,true); assert.throws(()=>decodePreviewFrame(buffer),/dimensions/);
  assert.deepEqual(previewSize(1920,1080),{width:960,height:540});
  assert.deepEqual(previewSize(2000,1000,1.5),{width:960,height:640});
  for(const ratio of [0.5,1,1.5,16/9,3]) { const size=previewSize(3000,2000,ratio); assert.ok(size.width<=960&&size.height<=720); assert.equal(size.width%2,0); assert.equal(size.height%2,0); }
});

test('Classic translations resolve through the allowed shared locale interface', async () => {
  const source = await readFile(new URL('../assets/mods/rpe-classic-layout/messages.mjs',import.meta.url),'utf8');
  const imports = [];
  rewriteModModule(source,'messages.mjs',specifier => { imports.push(specifier); return resolveModImport(specifier,'messages.mjs',new Map(),'@rpen-mod/test/','https://editor.invalid/'); },'test');
  assert.deepEqual(imports,['@rpen/core/i18n-core.mjs']);
});

test('Japanese locale maps regional tags, preserves placeholders and localizes host actions', context => {
  context.after(()=>setLocale('zh-CN'));
  assert.equal(setLocale('ja').locale,'ja-JP'); assert.equal(setLocale('ja_JP').locale,'ja-JP');
  assert.equal(t('settings.language'),'表示言語'); assert.equal(pt('触控操作'),'タッチ操作');
  assert.equal(t('settings.s7d6ffba',{p0:'Example'}),'「Example」を初期設定に戻しますか？');
  const japanese=BUILTIN_LOCALES.find(c=>c.locale==='ja-JP'), english=BUILTIN_LOCALES.find(c=>c.locale==='en-US');
  assert.deepEqual(Object.keys(japanese.messages).sort(),Object.keys(english.messages).sort());
  for(const [key,value] of Object.entries(japanese.messages)) assert.deepEqual([...value.matchAll(/\{(\w+)\}/g)].map(m=>m[1]).sort(),[...english.messages[key].matchAll(/\{(\w+)\}/g)].map(m=>m[1]).sort(),key);
});
