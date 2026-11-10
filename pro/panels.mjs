// GPL-3.0-only. Fold existing panels in place; never recreate or reorder their controls.
import { localPreferences } from '../src/platform/local-preferences.mjs';
import { pt } from './locale.mjs';

const KEY = 'rpe-next-pro-panel-folds-v2';
const topPanels = ['transport', 'tools', 'tracks'];
export function toggleTopPanel(open, id) {
  const next = new Set(open);
  if (next.has(id)) next.delete(id); else next.add(id);
  return [...next];
}
const definitions = [
  ['files', 'body > header', pt('文件'), false],
  ['transport', '.transport', pt('播放'), true],
  ['tools', '.editor-toolbar', pt('工具'), true],
  ['tracks', '.timeline-head', pt('轨道'), true],
  ['properties', '.inspector', pt('属性'), true],
  ['actions', '.editor-footer', pt('底栏'), false],
  ['status', 'body > footer', pt('状态'), true],
];

export function installPanels(editor) {
  let saved;
  try { saved = JSON.parse(localPreferences.getItem(KEY) ?? localPreferences.getItem('rpe-next-pro-panel-folds-v1')); } catch {}
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) saved = {};
  const resize = () => { window.dispatchEvent(new Event('resize')); editor.invalidate(); };
  const workspace = document.querySelector('.workspace');
  const dock = document.createElement('div');dock.className='pro-panel-dock';dock.setAttribute('aria-label',pt('编辑面板'));
  document.querySelector('body > header').after(dock);
  const grouped = new Map();
  let open = Array.isArray(saved.open) ? saved.open.filter(id => topPanels.includes(id))
    : topPanels.includes(saved.active) ? [saved.active] : topPanels.filter(id => saved[id] === false);
  const sync = () => {
    for(const [id,{set,shortcut}] of grouped){
      const expanded = open.includes(id);
      set(!expanded);shortcut.setAttribute('aria-expanded',String(expanded));
      shortcut.textContent = definitions.find(entry => entry[0] === id)[2] + (expanded ? ' ▲' : ' ▼');
      shortcut.setAttribute('aria-label', (expanded ? pt('收起') : pt('展开')) + definitions.find(entry => entry[0] === id)[2] + pt('面板'));
    }
    dock.hidden=workspace.hidden;
  };
  for (const [id, selector, label, initial] of definitions) {
    const panel = document.querySelector(selector);
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'pro-panel-toggle';
    button.dataset.modInteractive = 'true'; button.dataset.proToggle = id;
    panel.dataset.proPanel = id; panel.classList.add('pro-fold-panel');
    const set = folded => {
      panel.dataset.proFolded = String(folded);
      button.textContent = folded ? `${label} ${id === 'properties' ? '◀' : '▼'}` : '▲';
      button.title = `${folded ? pt('展开') : pt('收起')}${label}面板`;
      button.setAttribute('aria-label', button.title);
      button.setAttribute('aria-expanded', String(!folded));
      if (id === 'properties') document.querySelector('.workspace').dataset.proInspectorFolded = String(folded);
    };
    if(topPanels.includes(id)){
      panel.dataset.proGroup='top';
      const shortcut=document.createElement('button');shortcut.type='button';shortcut.textContent=label+' ▼';shortcut.dataset.proShortcut=id;shortcut.setAttribute('aria-label',pt('展开')+label+pt('面板'));
      grouped.set(id,{set,shortcut});dock.append(shortcut);
      shortcut.onclick=()=>button.click();
    }
    set(typeof saved[id] === 'boolean' ? saved[id] : initial);
    button.onclick = () => {
      if(topPanels.includes(id)){
        open=toggleTopPanel(open,id);saved.open=open;delete saved.active;sync();
        localPreferences.setItem(KEY,JSON.stringify(saved));resize();return;
      }
      const folded = panel.dataset.proFolded !== 'true'; set(folded);
      saved[id] = folded; localPreferences.setItem(KEY, JSON.stringify(saved)); resize();
    };
    panel.prepend(button);
  }
  new MutationObserver(sync).observe(workspace,{attributes:true,attributeFilter:['hidden']});
  sync();
  resize();
}
