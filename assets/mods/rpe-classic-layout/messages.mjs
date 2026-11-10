import { currentLocale, catalogExtras } from '@rpen/core/i18n-core.mjs';

export const classicText=(chinese,english)=>currentLocale().base==='ja'?(catalogExtras(undefined,'classic')?.[english]??english):currentLocale().locale.startsWith('zh')?chinese:english;
