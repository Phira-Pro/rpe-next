import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,statSync} from 'node:fs';
import {posix} from 'node:path';
import {parse} from '../src/core/vendor/acorn.mjs';

test('Pro bundle includes every relative module, worker and URL asset dependency', () => {
  const root = new URL('../',import.meta.url);
  const {schema,files} = JSON.parse(readFileSync(new URL('phira-pro-bundle.json',root)));
  assert.equal(schema,1);
  const names = new Set(files);
  assert.equal(names.size,files.length);
  const check = (owner,name) => {
    if (!name.startsWith('.')) return;
    const resolved = posix.normalize(posix.join(posix.dirname(owner),name.split(/[?#]/)[0]));
    assert.ok(name.endsWith('/') ? resolved === './' || files.some(file=>file.startsWith(resolved)) : names.has(resolved),`${owner} needs ${resolved}`);
  };
  for (const name of files) {
    assert.ok(!name.startsWith('test/') && !name.startsWith('desktop/') && !name.startsWith('src/dev/'));
    assert.ok(statSync(new URL(name,root)).isFile());
    if (!name.endsWith('.mjs')) continue;
    const tree = parse(readFileSync(new URL(name,root),'utf8'),{ecmaVersion:'latest',sourceType:'module'});
    const stack = [tree];
    while (stack.length) {
      const node = stack.pop();
      if (['ImportDeclaration','ExportNamedDeclaration','ExportAllDeclaration'].includes(node.type) && node.source) check(name,node.source.value);
      if (node.type === 'ImportExpression' && node.source.type === 'Literal') check(name,node.source.value);
      if (node.type === 'NewExpression' && node.callee.name === 'URL' && node.arguments[0]?.type === 'Literal' && node.arguments[1]?.object?.type === 'MetaProperty') check(name,node.arguments[0].value);
      for (const value of Object.values(node)) {
        if (Array.isArray(value)) stack.push(...value.filter(item=>item?.type));
        else if (value?.type) stack.push(value);
      }
    }
  }
  for (const name of ['LICENSE','NOTICE','pro/editor.mjs','pro/snapshot.mjs','assets/vendor/basic-pitch/model/model.json','assets/vendor/basic-pitch/model/group1-shard1of1.bin','assets/vendor/basic-pitch/tfjs-backend-wasm.wasm','assets/vendor/basic-pitch/tfjs-backend-wasm-simd.wasm','assets/vendor/mediabunny/LICENSE.txt']) assert.ok(names.has(name),name);
});
