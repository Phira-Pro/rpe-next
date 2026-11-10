// GPL-3.0-only. Convert only the independent native playback snapshot.
import { bakeChartAnimationCurves } from '../src/application/animation-curve-export.mjs';
import { chartHasAnimationCurves } from '../src/core/chart-animation-curves.mjs';
import { TempoMap } from '../src/core/tempo.mjs';
import { packageEntries } from '../src/platform/files.mjs';
import { prepareShaderExport } from '../src/platform/shader-export.mjs';
import { writeZip } from '../src/platform/archive.mjs';

export function nativePlaybackChart(chart) {
  const snapshot = chartHasAnimationCurves(chart)
    ? bakeChartAnimationCurves(chart, new TempoMap(chart.BPMList)) : chart;
  if (chartHasAnimationCurves(snapshot)) throw Error('当前谱面的噪域或扩展事件含 Pro 尚不支持的自定义动画曲线，请在编辑器中预览或导出 RPEN 工程');
  return { ...snapshot, META: { ...snapshot.META, useRpen: true } };
}

export async function nativePlaybackExport(chart, assets, chartName, options = {}) {
  const prepared = await prepareShaderExport(nativePlaybackChart(chart), assets, chartName);
  const entries = packageEntries(prepared.chart, prepared.assets, chartName, { ...options, includeUnusedFiles: true });
  // RPEN writes the same effects into both the main chart and extra.json for
  // other players. Pro already loads them from the main chart, including typed
  // uniforms and startTime/endTime aliases. Do not parse or apply them twice.
  const mirrored = Array.isArray(prepared.chart.effects)
    || [prepared.chart.shaderEvents, prepared.chart.META?.effects].some(events => events?.length)
    || prepared.chart.judgeLineList.some(line => line.extended?.paintEvents?.length);
  if (mirrored) {
    const directory = chartName.replaceAll('\\', '/').split('/').slice(0, -1).join('/');
    const extraName = (directory ? directory + '/' : '') + 'extra.json';
    const path = [...entries.keys()].find(name => name.replaceAll('\\', '/').toLowerCase() === extraName.toLowerCase());
    if (path) {
      const extra = JSON.parse(new TextDecoder().decode(entries.get(path)));
      delete extra.effects;
      entries.set(path, new TextEncoder().encode(JSON.stringify(extra)));
    }
  }
  return { blob: writeZip(entries) };
}
