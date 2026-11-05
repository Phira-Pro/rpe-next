import test from 'node:test';
import assert from 'node:assert/strict';
import { installPanels } from '../pro/panels.mjs';

function setup(saved) {
  const key='rpe-next-pro-panel-folds-v2', values=new Map([[key,JSON.stringify(saved)]]);
  globalThis.localStorage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)};
  class Element {
    constructor(){this.dataset={};this.attributes={};this.children=[];this.hidden=false;this.classList={add(){}};}
    setAttribute(k,v){this.attributes[k]=v;}
    append(child){this.children.push(child);}
    prepend(child){this.children.unshift(child);}
    after(child){this.afterNode=child;}
    click(){this.onclick?.();}
  }
  const selectors=['body > header','.transport','.editor-toolbar','.timeline-head','.inspector','.editor-footer','body > footer','.workspace'];
  const nodes=new Map(selectors.map(s=>[s,new Element()]));
  globalThis.document={querySelector:s=>nodes.get(s),createElement:()=>new Element()};
  globalThis.window={dispatchEvent(){}};globalThis.MutationObserver=class{observe(){}};
  installPanels({invalidate(){}});
  return {nodes,dock:nodes.get('body > header').afterNode,saved:()=>JSON.parse(values.get(key))};
}
test('playback and tools remain expanded together and persist across installation',()=>{
  let s=setup({active:'transport'});
  assert.equal(s.nodes.get('.transport').dataset.proFolded,'false');
  assert.equal(s.dock.hidden,false);
  s.dock.children.find(b=>b.dataset.proShortcut==='tools').click();
  assert.equal(s.nodes.get('.transport').dataset.proFolded,'false');
  assert.equal(s.nodes.get('.editor-toolbar').dataset.proFolded,'false');
  assert.equal(s.nodes.get('.timeline-head').dataset.proFolded,'true');
  assert.deepEqual(s.saved().open,['transport','tools']);
  s=setup(s.saved());
  assert.equal(s.nodes.get('.transport').dataset.proFolded,'false');
  assert.equal(s.nodes.get('.editor-toolbar').dataset.proFolded,'false');
  s.dock.children.find(b=>b.dataset.proShortcut==='transport').click();
  assert.equal(s.nodes.get('.transport').dataset.proFolded,'true');
  assert.equal(s.nodes.get('.editor-toolbar').dataset.proFolded,'false');
  s.dock.children.find(b=>b.dataset.proShortcut==='tools').click();
  assert.equal(s.dock.hidden,false);
  assert.deepEqual(s.dock.children.map(b=>b.textContent),['播放 ▼','工具 ▼','轨道 ▼']);
});
