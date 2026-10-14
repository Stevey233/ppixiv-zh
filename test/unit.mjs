// Tests functions from src/main.js in Node.  They're pulled out of the source by name, since
// the script itself only runs in the browser.
import fs from 'node:fs';
const src = fs.readFileSync(process.argv[2] ?? new URL('../src/main.js', import.meta.url), 'utf8');
function grab(name) {
  const i = src.search(new RegExp(`^(async )?function ${name}\\(`, 'm'));
  if (i < 0) throw new Error('no ' + name);
  let depth = 0, j = src.indexOf('{', i);
  for (let k = j; k < src.length; k++) { if (src[k] == '{') depth++; else if (src[k] == '}' && --depth == 0) return src.slice(i, k + 1); }
}
const constLine = (name) => src.match(new RegExp(`^const ${name} = [^;]*;`, 'm'))[0];
let failures = 0;
const eq = (a, b, msg) => { const ok = JSON.stringify(a) === JSON.stringify(b); if (!ok) failures++; console.log(ok ? 'ok  ' : 'FAIL', msg, ok ? '' : `got ${JSON.stringify(a)} want ${JSON.stringify(b)}`); };

// translateString, with the dictionary from src/dict.js
const dictSrc = fs.readFileSync(new URL('../src/dict.js', import.meta.url), 'utf8');
const translate = new Function(dictSrc + constLine('normalize') + grab('translateString') + '; return translateString;')();
eq(translate('  Bookmarked\n privately '), '已非公开收藏', 'whitespace is collapsed before lookup');
eq(translate('Followed Alice'), '已关注 Alice', 'public follow');
eq(translate('Followed Alice privately'), '已非公开关注 Alice', 'private follow keeps "privately" out of the name');
eq(translate('Now following Bob publically'), '已改为公开关注 Bob', 'follow privacy change');
eq(translate('Added the tag "原神" to Alice'), '已给 Alice 添加关注标签「原神」', 'follow tag added');
eq(translate('Removed the tag "原神" from Alice'), '已从 Alice 移除关注标签「原神」', 'follow tag removed');
eq(translate('Change bookmark to private'), '改为非公开收藏', 'bookmark privacy change has no English left');
eq(translate('Downloading 12 pages...'), '正在下载 12 页…', 'multi-page download');
eq(translate('3 hours ago'), '3 小时前', 'relative time');
eq(translate('Followed users'), '已关注用户', 'dictionary entries win over patterns');
eq(translate('原神'), null, 'text without Latin letters is left alone');

// pickTagTranslation
const pick = new Function(constLine('KANA_RE') + constLine('HAN_RE') + grab('pickTagTranslation') + '; return pickTagTranslation;')();
eq(pick('原神', { en: 'Genshin Impact' }), null, 'Han-only tag with English translation keeps the tag');
eq(pick('ブルーアーカイブ', { zh: '碧蓝档案', en: 'Blue Archive' }), '碧蓝档案', 'kana tag prefers zh');
eq(pick('ブルーアーカイブ', { en: 'Blue Archive' }), 'Blue Archive', 'kana tag falls back to en');
eq(pick('崩坏星穹铁道', { zh: 'Honkai: Star Rail' }), null, 'Chinese tag with English "zh" keeps the tag');
eq(pick('東方', { zh: '东方' }), '东方', 'kanji tag with Chinese zh uses it');
eq(pick('girl', { zh: '女孩' }), '女孩', 'latin tag uses zh');
eq(pick('abc', {}), null, 'no translation');

// updateThumbLoadMs
const thumb = new Function('let thumbLoadMs = null; const thumbTimings = [];' + grab('updateThumbLoadMs') +
  '; return { run(t) { thumbTimings.length = 0; thumbTimings.push(...t); updateThumbLoadMs(); return thumbLoadMs; } };')();
const parallel = Array.from({ length: 40 }, (_, i) => ({ start: 0, end: 1600 }));
eq(Math.round(thumb.run(parallel)), 40, '40 parallel 1.6 s downloads count as 40 ms each');
const serial = Array.from({ length: 10 }, (_, i) => ({ start: i * 1000, end: i * 1000 + 800 }));
eq(Math.round(thumb.run(serial)), 800, 'serial 800 ms downloads stay 800 ms');

// fetchFilteredDiscovery
const messages = [];
const fd = new Function('window', 'later', constLine('DISCOVERY_MAX_REQUESTS') + constLine('DISCOVERY_RETRY_DELAY_MS') +
  src.match(/^const DISCOVERY_TYPES = \[[\s\S]*?\];/m)[0] + grab('fetchFilteredDiscovery') + '; return fetchFilteredDiscovery;')(
  { ppixiv: { message: { show: (m) => messages.push(m) } } }, (cb) => setTimeout(cb, 0));
const page = (types, extra = {}) => new Response(JSON.stringify({ error: false, body: { thumbnails: { illust: types.map((t, i) => ({ id: String(extra.base + i), illustType: t })) }, tagTranslation: extra.tt ?? {} } }), { status: 200 });
let calls = 0;
let res = await fd(async () => (++calls, page([0, 1, 2, 0], { base: 100 })), '/ajax/discovery/artworks', {}, 'illust');
let body = await res.json();
eq([calls, body.body.thumbnails.illust.map(t => t.id)], [1, ['100', '102', '103']], 'illust filter keeps illustrations and animations in one request');
calls = 0;
const pages = [[0, 0], [0, 2], [1, 0]];
res = await fd(async () => page(pages[calls++], { base: calls * 10, tt: { ['t' + calls]: { zh: 'x' } } }), '/ajax/discovery/artworks', {}, 'manga');
body = await res.json();
eq([calls, body.body.thumbnails.illust.map(t => t.illustType), Object.keys(body.body.tagTranslation)], [3, [1], ['t1', 't2', 't3']], 'manga filter retries empty pages and merges translations');
calls = 0;
res = await fd(async () => (++calls, page([0, 0], { base: 1 })), '/ajax/discovery/artworks', {}, 'manga');
body = await res.json();
eq([calls, body.body.thumbnails.illust.length, messages.length], [4, 0, 1], 'gives up after 4 requests and tells the user');
console.log(messages[0]);
calls = 0;
res = await fd(async () => (++calls, new Response('oops', { status: 500 })), '/ajax/discovery/artworks', {}, 'manga');
eq([calls, res.status], [1, 500], 'first-request errors go to ppixiv unchanged');

// pixivAjaxUrl
const ajax = new Function('location', grab('pixivAjaxUrl') + '; return pixivAjaxUrl;')({ href: 'https://www.pixiv.net/discovery', origin: 'https://www.pixiv.net' });
eq(ajax('/ajax/illust/1?lang=en')?.pathname, '/ajax/illust/1', 'relative ajax GET');
eq(ajax('/ajax/illusts/like', { method: 'POST' }), null, 'POST is left alone');
eq(ajax('https://i.pximg.net/ajax/x'), null, 'other origins are left alone');
eq(ajax('/touch/ajax/user/self/status?lang=en'), null, 'touch API is left alone');

process.exitCode = failures ? 1 : 0;
