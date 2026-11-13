// GPL-3.0-only. Host controls are independent of chart names and asset content.
import { currentLocale } from '../src/i18n.mjs';
const labels = {
  '此 iOS 版本不能直接选择文件夹。请先在「文件」中压缩文件夹，再选择生成的 ZIP。':['This iOS version cannot select a folder directly. Compress the folder in Files, then select the ZIP.','この iOS ではフォルダを直接選択できません。「ファイル」でフォルダを圧縮してから、作成した ZIP を選択してください。'],
  '选择 ZIP':['Choose ZIP','ZIP を選択'], 'ZIP 文件过大':['The ZIP file is too large.','ZIP ファイルが大きすぎます。'],
  'Pro 试玩':['Pro trial','Pro 試遊'], '返回 Pro':['Return to Pro','Pro に戻る'],
  '触控操作':['Touch controls','タッチ操作'], '编辑':['Edit','編集'], '框选':['Box select','範囲選択'], '多选':['Multi-select','複数選択'],
  '放置音符或取点':['Place note / pick point','ノーツ配置 / 点を取得'], '放置事件':['Place event','イベントを配置'],
  '全选':['Select all','すべて選択'], '复制':['Copy','コピー'], '剪切':['Cut','切り取り'], '粘贴':['Paste','貼り付け'],
  '原时间粘贴':['Paste at original time','元の時間に貼り付け'], '镜像粘贴':['Mirror paste','反転して貼り付け'],
  '删除选中':['Delete selection','選択を削除'], '数值取反':['Negate values','値の符号を反転'], '数值填充':['Fill values','値を埋める'],
  '向左微调':['Nudge left','左へ微調整'], '向右微调':['Nudge right','右へ微調整'], '向上微调':['Nudge up','上へ微調整'], '向下微调':['Nudge down','下へ微調整'],
  '上一细分拍':['Previous subdivision','前の分割拍'], '下一细分拍':['Next subdivision','次の分割拍'],
  '撤销':['Undo','元に戻す'], '重做':['Redo','やり直す'], '取消当前操作':['Cancel current action','現在の操作をキャンセル'], '关闭':['Close','閉じる'],
  '文件':['Files','ファイル'], '播放':['Playback','再生'], '工具':['Tools','ツール'], '轨道':['Tracks','トラック'],
  '属性':['Properties','プロパティ'], '底栏':['Footer','下部ツール'], '状态':['Status','状態'], '编辑面板':['Editor panels','編集パネル'],
  '展开':['Expand','展開'], '收起':['Collapse','折りたたむ'], '面板':[' panel','パネル'],
  '从 Pro 导入':['Import from Pro','Pro から読み込む'], '存入 Pro 谱面库':['Save to Pro library','Pro ライブラリに保存'],
  '从 Pro 谱面库导入':['Import from Pro library','Pro ライブラリから読み込む'],
  '导入独立编辑副本，原谱面和成绩保持不变。':['Import an independent copy. The original chart and scores are preserved.','独立した編集用コピーを読み込みます。元の譜面と成績は保持されます。'],
  '搜索曲名、难度或作者':['Search title, difficulty or author','曲名・難易度・制作者を検索'], '搜索 Pro 谱面库':['Search Pro library','Pro ライブラリを検索'],
  '取消':['Cancel','キャンセル'], '开始试玩':['Start trial','試遊開始'], '在 Pro 中试玩':['Trial in Pro','Pro で試遊'],
  '使用当前工程的独立快照。试玩不记录正常成绩。':['Play an independent snapshot. Trial scores are not recorded.','現在のプロジェクトの独立スナップショットを再生します。試遊成績は記録されません。'],
  '开始位置':['Start position','開始位置'], '当前播放头':['Current playhead','現在の再生位置'], '从头开始':['From beginning','先頭から'],
  '指定时间区间':['Time range','時間範囲を指定'], '开始秒数':['Start seconds','開始秒数'], '结束秒数':['End seconds','終了秒数'],
  '请先新建或打开一个工程':['Create or open a project first','先にプロジェクトを作成するか開いてください'],
  '工程已保存':['Project saved','プロジェクトを保存しました'], '保存失败，请重试':['Save failed. Retry.','保存に失敗しました。再試行してください。'],
  '正在准备试玩快照':['Preparing trial snapshot','試遊スナップショットを準備中'], '原生试玩中':['Native trial active','ネイティブ試遊中'],
  '已返回编辑位置':['Returned to editing position','編集位置に戻りました'], '正在读取 Pro 谱面库':['Reading Pro library','Pro ライブラリを読み込み中'],
  '正在创建 Pro 谱面副本':['Creating a Pro chart copy','Pro 譜面コピーを作成中'], '正在读取谱面副本':['Reading chart copy','譜面コピーを読み込み中'],
  '没有匹配的谱面':['No matching charts','該当する譜面がありません'], 'Pro 本地谱面库暂无谱面':['Pro library is empty','Pro ライブラリに譜面がありません'],
  '未命名谱面':['Untitled chart','無題の譜面'], '已导入独立编辑副本':['Independent copy imported','編集用コピーを読み込みました'],
  '已创建新谱面，原谱面未被覆盖':['New chart created. Original preserved.','新しい譜面を作成しました。元の譜面は上書きされません。'],
};
export function pt(value) { const base = currentLocale().base; return base === 'zh' ? value : labels[value]?.[base === 'ja' ? 1 : 0] ?? value; }
export function translateProUi(root) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) { const node = walker.currentNode, value = node.textContent.trim(); if (labels[value]) node.textContent = node.textContent.replace(value, pt(value)); }
  for (const node of root.querySelectorAll('[placeholder],[aria-label],[title]')) for (const attribute of ['placeholder','aria-label','title']) { const value = node.getAttribute(attribute); if (labels[value]) node.setAttribute(attribute, pt(value)); }
}
