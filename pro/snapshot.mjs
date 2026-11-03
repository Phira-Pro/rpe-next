// GPL-3.0-only. Convert only the independent native playback snapshot.
import { bakeChartAnimationCurves } from '../src/application/animation-curve-export.mjs';
import { chartHasAnimationCurves } from '../src/core/chart-animation-curves.mjs';
import { TempoMap } from '../src/core/tempo.mjs';

export function nativePlaybackChart(chart) {
  const snapshot = chartHasAnimationCurves(chart)
    ? bakeChartAnimationCurves(chart, new TempoMap(chart.BPMList)) : chart;
  if (chartHasAnimationCurves(snapshot)) throw Error('当前谱面的噪域或扩展事件含 Pro 尚不支持的自定义动画曲线，请在编辑器中预览或导出 RPEN 工程');
  return { ...snapshot, META: { ...snapshot.META, useRpen: true } };
}
