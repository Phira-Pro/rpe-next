import { currentLocale } from '@rpen/core/i18n-core.mjs';
import { japaneseText } from '@rpen/locales/ja-JP.mjs';

export const classicText=(chinese,english)=>currentLocale().base==='ja'?(japaneseText[english]??english):currentLocale().locale.startsWith('zh')?chinese:english;
