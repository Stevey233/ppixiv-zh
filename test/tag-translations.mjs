// Runs ppixiv's real TagTranslations class with the script's wrappers.  Pass the path to
// ppixiv's web/vview/misc/tag-translations.js if it isn't in ~/scratch/ppixiv-src.
import fs from 'node:fs';
const main = fs.readFileSync(process.argv[3] ?? new URL('../src/main.js', import.meta.url), 'utf8');
const ttSrc = fs.readFileSync(process.argv[2] ?? process.env.HOME + '/scratch/ppixiv-src/repo/web/vview/misc/tag-translations.js', 'utf8').replace(/^import .*$/mg, '').replace('export default class', 'class');
class KeyStorage { constructor() { this.m = new Map(); }
  async multiGet(keys) { return keys.map(k => structuredClone(this.m.get(k))); }
  async multiSet(data, { overwrite = true } = {}) { for (const [k, v] of Object.entries(data)) if (overwrite || !this.m.has(k)) this.m.set(k, structuredClone(v)); } }
const TagTranslations = new Function('KeyStorage', 'helpers', 'ppixiv', ttSrc + '; return TagTranslations;')(KeyStorage, {}, { settings: { get: () => false } });
function grab(name) { const i = main.search(new RegExp(`^(async )?function ${name}\\(`, 'm')); let d = 0; for (let k = main.indexOf('{', i); k < main.length; k++) { if (main[k] == '{') d++; else if (main[k] == '}' && --d == 0) return main.slice(i, k + 1); } }
const c = (n) => main.match(new RegExp(`^const ${n} = [^;]*;`, 'm'))[0];
const tt = new TagTranslations();
let tagLanguage = null;
const { setupChineseTags: setup, rememberAutocompleteTranslations } = new Function('window', 'localStorage', [c('TAG_LANGUAGE_KEY'), c('KANA_RE'), c('HAN_RE'), 'const sessionTagTranslations = new Map();',
  grab('chineseTagsEnabled'), grab('pickTagTranslation'), grab('setupChineseTags'), grab('rememberAutocompleteTranslations'),
  'return { setupChineseTags, rememberAutocompleteTranslations };'].join('\n'))(
  { ppixiv: { tagTranslations: tt } }, { getItem: () => tagLanguage });
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

// A cached English tag is updated by search results and work info at the same time.
// Snapshot reads match IndexedDB: later writes don't change an earlier read's result.
await tt.addTranslations([{ tag: 'アークナイツ', translation: { en: 'Arknights' } }]);
const concurrent = await Promise.all([
  tt.addTranslations([{ tag: 'アークナイツ', translation: { zh: '明日方舟' } }]),
  tt.addTranslations([{ tag: 'アークナイツ', translation: { en: 'Arknights' }, romaji: 'aakunaitsu' }]),
  tt.getTranslation('アークナイツ'),
]);
assert.deepEqual(tt._db.m.get('アークナイツ'), {
  tag: 'アークナイツ', translation: { en: 'Arknights', zh: '明日方舟' }, romaji: 'aakunaitsu',
});
assert.equal(await tt.getTranslation('アークナイツ'), '明日方舟');
assert.equal(concurrent[2], '明日方舟', 'reads wait for the already queued translation updates');
console.log('ok   Concurrent search and work updates preserve Chinese translations');

// Autocomplete suggestions with Chinese translations fill in tags that have none.
await tt.addTranslations([{ tag: 'アズールレーン', translation: { en: 'Azur Lane' } }]);
const candidates = [
  { tag_name: 'アズールレーン', tag_translation: '碧蓝航线', type: 'tag_translation' },
  { tag_name: 'ブルーアーカイブ', tag_translation: '蔚蓝档案', type: 'tag_translation' },
  { tag_name: '碧蓝航线', tag_translation: 'Azur Lane', type: 'tag_translation' },
  { tag_name: 'アズレン', tag_translation: 'アズールレーン', type: 'tag_translation' },
  { tag_name: 'グラブル', tag_translation: '碧蓝幻想', type: 'tag_translation' },
  { tag_name: '東方Project', tag_translation: '东方', type: 'tag_translation' },
  { tag_name: '碧蓝', type: 'prefix' },
];
// Japanese typed into the search box: nothing is recorded.
await rememberAutocompleteTranslations(new Response(JSON.stringify({ candidates })), 'アズ');
assert.equal(tt._db.m.get('グラブル'), undefined);
await rememberAutocompleteTranslations(new Response(JSON.stringify({ candidates })), '碧蓝');
assert.equal(tt._db.m.get('東方Project'), undefined, 'a translation without the typed text is not recorded');
assert.deepEqual(await tt.getTranslations(['アズールレーン', 'ブルーアーカイブ', '碧蓝航线', 'アズレン', 'グラブル']),
  { 'アズールレーン': '碧蓝航线', 'ブルーアーカイブ': '碧蓝档案', 'グラブル': '碧蓝幻想' });
assert.deepEqual(tt._db.m.get('アズールレーン').translation, { en: 'Azur Lane', zh: '碧蓝航线' });
await rememberAutocompleteTranslations(new Response('not json'), '碧蓝');
await rememberAutocompleteTranslations(new Response('{}', { status: 500 }), '碧蓝');
console.log('ok   Autocomplete adds Chinese translations that matched the typed Chinese, without replacing existing ones');

// With English chosen, lookups are ppixiv's own, and switching back needs no reload.
tagLanguage = 'en';
assert.deepEqual(await tt.getTranslations(['アズールレーン', 'グラブル'], 'en'), { 'アズールレーン': 'Azur Lane', 'グラブル': undefined });
assert.equal(await tt.getTranslation('アズールレーン'), 'Azur Lane');
tagLanguage = null;
assert.equal(await tt.getTranslation('アズールレーン'), '碧蓝航线');
console.log('ok   English lookups use ppixiv\'s methods until Chinese is chosen again');

// A failed write rejects its caller, but the next batch can still be saved.
const multiSet = tt._db.multiSet;
tt._db.multiSet = async () => { throw new Error('write failed'); };
await assert.rejects(tt.addTranslations([{ tag: 'failed', translation: { zh: '失败' } }]), /write failed/);
tt._db.multiSet = multiSet;
await tt.addTranslations([{ tag: 'girl', translation: { zh: '女孩' } }]);
assert.equal(await tt.getTranslation('girl'), '女孩');
console.log('ok   A failed write does not block later translation batches');

// Keep the session fallback when IndexedDB is unavailable.
tt._db.multiGet = async () => ({});
tt._db.multiSet = async () => {};
await Promise.all([
  tt.addTranslations([{ tag: 'ぼっち・ざ・ろっく!', translation: { zh: '孤独摇滚!' } }]),
  tt.addTranslations([{ tag: 'ぼっち・ざ・ろっく!', translation: { en: 'Bocchi the Rock!' } }]),
]);
assert.equal(await tt.getTranslation('ぼっち・ざ・ろっく!'), '孤独摇滚!');
console.log('ok   Concurrent updates preserve translations without IndexedDB');
