// Runs ppixiv's real TagTranslations class with the script's wrappers.  Pass the path to
// ppixiv's web/vview/misc/tag-translations.js if it isn't in ~/scratch/ppixiv-src.
import fs from 'node:fs';
const main = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const ttSrc = fs.readFileSync(process.argv[2] ?? process.env.HOME + '/scratch/ppixiv-src/repo/web/vview/misc/tag-translations.js', 'utf8').replace(/^import .*$/mg, '').replace('export default class', 'class');
class KeyStorage { constructor() { this.m = new Map(); }
  async multiGet(keys) { return keys.map(k => this.m.get(k)); }
  async multiSet(data, { overwrite = true } = {}) { for (const [k, v] of Object.entries(data)) if (overwrite || !this.m.has(k)) this.m.set(k, structuredClone(v)); } }
const TagTranslations = new Function('KeyStorage', 'helpers', 'ppixiv', ttSrc + '; return TagTranslations;')(KeyStorage, {}, { settings: { get: () => false } });
function grab(name) { const i = main.search(new RegExp(`^(async )?function ${name}\\(`, 'm')); let d = 0; for (let k = main.indexOf('{', i); k < main.length; k++) { if (main[k] == '{') d++; else if (main[k] == '}' && --d == 0) return main.slice(i, k + 1); } }
const c = (n) => main.match(new RegExp(`^const ${n} = [^;]*;`, 'm'))[0];
const tt = new TagTranslations();
const setup = new Function('window', 'localStorage', [c('TAG_LANGUAGE_KEY'), c('KANA_RE'), c('HAN_RE'), 'const sessionTagTranslations = new Map();', grab('chineseTagsEnabled'), grab('pickTagTranslation'), grab('setupChineseTags'), 'return setupChineseTags;'].join('\n'))(
  { ppixiv: { tagTranslations: tt } }, { getItem: () => null });
setup(); setup();
// A search page (lang=zh) gives Chinese, then opening the work gives English only.
await tt.addTranslationsDict({ 'ブルーアーカイブ': { zh: '碧蓝档案' } });
await tt.addTranslations([{ tag: 'ブルーアーカイブ', translation: { en: 'Blue Archive' }, romaji: 'buruuaakaibu' }, { tag: '原神', translation: { en: 'Genshin Impact' } }]);
import assert from 'node:assert/strict';
assert.deepEqual(await tt.getTranslations(['ブルーアーカイブ', '原神', 'unknown'], 'en'), { 'ブルーアーカイブ': '碧蓝档案' });
assert.equal(await tt.getTranslation('ブルーアーカイブ'), '碧蓝档案');
assert.equal(await tt.getTranslation('原神'), '原神');
assert.deepEqual(tt._db.m.get('ブルーアーカイブ'), { tag: 'ブルーアーカイブ', translation: { zh: '碧蓝档案', en: 'Blue Archive' }, romaji: 'buruuaakaibu' });
console.log('ok   Chinese translations survive English-only updates and are preferred');
