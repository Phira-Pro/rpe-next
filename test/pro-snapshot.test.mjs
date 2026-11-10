import test from 'node:test';
import assert from 'node:assert/strict';
import { nativePlaybackChart, nativePlaybackExport } from '../pro/snapshot.mjs';
import { copyExport } from '../pro/library.mjs';
import { readZip } from '../src/platform/archive.mjs';
import { readFile } from 'node:fs/promises';
import { createChart, createEvent } from '../src/core/chart.mjs';
import { withCustomEasing } from '../src/core/event-easing.mjs';
import { chartHasAnimationCurves } from '../src/core/chart-animation-curves.mjs';
import { EventTrack } from '../src/core/events.mjs';
import { TempoMap } from '../src/core/tempo.mjs';
import { videoDownload } from '../src/platform/video-output.mjs';

const curve = {version:1, nodes:[{x:0,y:0,mode:'corner',out:[.2,.8]},{x:1,y:1,mode:'corner',in:[.8,.2]}]};
test('Pro snapshot bakes custom curves without changing the saved project', () => {
  const chart = createChart();
  const source = withCustomEasing(createEvent(0, 100, 0, 4), curve);
  chart.judgeLineList[0].eventLayers[0].moveXEvents = [source];
  const before = JSON.stringify(chart), snapshot = nativePlaybackChart(chart);
  assert.equal(chartHasAnimationCurves(snapshot), false);
  assert.equal(JSON.stringify(chart), before);
  assert.equal(snapshot.META.useRpen, true);
  const tempo = new TempoMap(chart.BPMList);
  const expected = new EventTrack([source], tempo), actual = new EventTrack(snapshot.judgeLineList[0].eventLayers[0].moveXEvents, tempo);
  for (let time = 0; time < 2; time += .025) assert.ok(Math.abs(expected.value(time)-actual.value(time)) < .12);
});
test('Pro rejects custom extension curves before producing a misleading snapshot', () => {
  const chart = createChart();
  chart.globalEvents = {types:{fixture:{columns:{value:{events:[withCustomEasing(createEvent(0,1,0,4),curve)]}}}}};
  assert.throws(() => nativePlaybackChart(chart), /尚不支持/);
});
test('video download uses the Pro host instead of a blob link', () => {
  let received;
  globalThis.phiraEditor = {download(blob,name){received={blob,name};}};
  try {
    const blob = new Blob(['fixture'],{type:'video/webm'});
    const result = videoDownload(blob,'render.webm');
    assert.deepEqual(received,{blob,name:'render.webm'});
    assert.equal(result.bytes,blob.size);
  } finally {delete globalThis.phiraEditor;}
});

test('native exports carry 0.14 builtin and custom shader sources without editing the project', async t => {
  t.mock.method(globalThis, 'fetch', async url => new Response(await readFile(new URL(url))));
  const chart = createChart(); chart.META.song = 'music.wav';
  chart.shaderEvents = [
    { startTime: [0,0,1], endTime: [4,0,1], shader: 'wave_pr.glsl' },
    { startTime: [0,0,1], endTime: [4,0,1], shader: '/shaders/custom.glsl' },
  ];
  const custom = new TextEncoder().encode('void main() { gl_FragColor = vec4(1.0); }');
  const assets = new Map([['music.wav', new Uint8Array([1,2,3])], ['shaders/custom.glsl', custom]]);
  const before = JSON.stringify(chart), names = [...assets.keys()];
  for (const blob of [(await nativePlaybackExport(chart, assets, 'chart.json')).blob,
    await copyExport({chart, assets, chartName:'chart.json'})]) {
    const files = await readZip(await blob.arrayBuffer());
    assert.ok(files.get('shaders/builtin/wave.glsl')?.byteLength);
    assert.deepEqual(files.get('shaders/custom.glsl'), custom);
    const saved = JSON.parse(new TextDecoder().decode(files.get('chart.json')));
    assert.equal(saved.shaderEvents[0].shader, '/shaders/builtin/wave.glsl');
    assert.equal(saved.shaderEvents[1].shader, '/shaders/custom.glsl');
  }
  assert.equal(JSON.stringify(chart), before); assert.deepEqual([...assets.keys()], names);
});

test('native exports reject missing custom shaders before producing a package', async () => {
  const chart = createChart();
  chart.shaderEvents = [{startTime:[0,0,1],endTime:[4,0,1],shader:'/shaders/missing.glsl'}];
  await assert.rejects(nativePlaybackExport(chart, new Map(), 'chart.json'), /missing.glsl/);
});
