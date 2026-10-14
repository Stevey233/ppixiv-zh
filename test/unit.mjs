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
eq(translate('1234 Private Bookmarks / 原神'), '1234 个非公开收藏 / 原神', 'bookmarks heading keeps the tag');
eq(translate('1 Bookmark / untagged'), '1 个收藏 / 未分类', 'bookmarks heading for untagged');
eq(translate('Public Bookmarks'), '公开收藏', 'bookmarks heading before the count loads');
eq(translate('24 frames'), '24 帧', 'ugoira frame count');
eq(translate('2 years'), '2 年前', 'time filter button after picking "2 years ago"');
eq(translate('Suggestions for gen'), '「gen」的建议', 'autocomplete header');
eq(translate('Clear 1 recent search?'), '清除 1 条最近搜索？', 'clear recent searches');
eq(translate('This group contains 3 tags.'), '此分组包含 3 个标签。', 'first line of the delete group prompt');
eq(translate("                        Delete this group and all tags inside it?  This can't be undone."), '删除此分组及其中的所有标签？此操作无法撤销。', 'second line of the delete group prompt');
eq(translate('Artist: Alice'), '作者：Alice', 'mobile artist row');
eq(translate('AI-generated'), 'AI 生成', 'AI tag row');
eq(translate('by the sea'), null, 'a title starting with "by" is left alone');

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

// fetchFilteredDiscovery.  known is what ppixiv's data source already shows.
const messages = [];
let known = [];
const fd = new Function('window', 'later', constLine('DISCOVERY_MAX_REQUESTS') + constLine('DISCOVERY_RETRY_DELAY_MS') +
  src.match(/^const DISCOVERY_TYPES = \[[\s\S]*?\];/m)[0] + grab('fetchFilteredDiscovery') + '; return fetchFilteredDiscovery;')(
  { ppixiv: { message: { show: (m) => messages.push(m) }, app: { currentDataSource: { idList: { getAllMediaIds: () => known } } } } },
  (cb) => setTimeout(cb, 0));
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
calls = 0;
messages.length = 0;
res = await fd(async () => ++calls == 1 ? page([0, 0], { base: 1 }) : new Response('slow down', { status: 429 }), '/ajax/discovery/artworks', {}, 'manga');
eq([calls, res.status, messages.length], [2, 429, 0], 'a failed retry goes to ppixiv without the "no works" message');
calls = 0;
known = ['illust:2-0'];
const repeats = [[1], [1, 1]];
res = await fd(async () => page(repeats[calls], { base: 2 + 7 * calls++ }), '/ajax/discovery/artworks', {}, 'manga');
body = await res.json();
eq([calls, body.body.thumbnails.illust.map(t => t.id)], [2, ['9', '10']], 'works ppixiv already shows do not count as kept');
known = [];

// getMediaInfoForPrefetch: a failed request isn't remembered, but Pixiv's own errors are.
const infoForPrefetch = new Function(grab('getMediaInfoForPrefetch') + '; return getMediaInfoForPrefetch;')();
const cacheFailing = (message) => {
  const cache = { _nonexistantMediaIds: { 'illust:5-0': 'deleted' } };
  cache.getMediaInfo = async (id) => { cache._nonexistantMediaIds[id.replace(/^illust:(\d+).*$/, 'illust:$1-0')] = message; return null; };
  return cache;
};
let mc = cacheFailing('Invalid response');
await infoForPrefetch(mc, 'illust:7-2');
eq(Object.keys(mc._nonexistantMediaIds), ['illust:5-0'], 'a failed request is forgotten, other entries stay');
mc = cacheFailing('429 Too Many Requests');
await infoForPrefetch(mc, 'illust:7');
eq(Object.keys(mc._nonexistantMediaIds), ['illust:5-0'], 'an HTML error page is forgotten');
mc = cacheFailing('Artwork has been deleted');
await infoForPrefetch(mc, 'illust:7-0');
eq(Object.keys(mc._nonexistantMediaIds), ['illust:5-0', 'illust:7-0'], "Pixiv's own error is kept");

// hoverWouldFetch
const prefetchedUrls = new Set(['orig', 'preview']);
const wouldFetch = (info) => new Function('window', 'prefetched', 'prefetching', grab('hoverWouldFetch') + '; return hoverWouldFetch;')(
  { ppixiv: { mediaCache: { getMediaInfoSync: (id, { full = true } = {}) => full ? info : { previewUrls: ['preview'] } } } },
  prefetchedUrls, new Map());
const fullInfo = (url) => ({ getMainImageUrl: (page) => ({ url: page == 0 ? url : undefined }) });
eq(wouldFetch(null)('illust:1-0', 0), true, 'hover fetches info that is not loaded');
eq(wouldFetch(fullInfo('orig'))('illust:1-0', 0), false, 'hover with everything downloaded sends nothing');
eq(wouldFetch(fullInfo('other'))('illust:1-0', 0), true, 'hover downloads a missing original');

// prefetchUpcomingMangaPages follows ppixiv's "Preload manga" setting.
const mangaPages = (mode) => {
  const got = [];
  new Function('window', 'prefetchPages', 'saveData', 'parseMediaId', 'MANGA_PAGES_AHEAD',
    'let lastMangaMediaId = null;' + grab('prefetchUpcomingMangaPages') + '; prefetchUpcomingMangaPages();')(
    { ppixiv: { app: { displayedMediaId: 'illust:1-3' }, settings: { get: () => mode } } },
    async (id, pages) => got.push(...pages), () => false, () => ({ page: 3 }), 2);
  return got;
};
eq([mangaPages('full'), mangaPages('partial'), mangaPages('thumbnails'), mangaPages(undefined)], [[4, 5], [4], [], [4, 5]], 'manga prefetch per preload setting');

// pixivAjaxUrl
const ajax = new Function('location', grab('pixivAjaxUrl') + '; return pixivAjaxUrl;')({ href: 'https://www.pixiv.net/discovery', origin: 'https://www.pixiv.net' });
eq(ajax('/ajax/illust/1?lang=en')?.pathname, '/ajax/illust/1', 'relative ajax GET');
eq(ajax('/ajax/illusts/like', { method: 'POST' }), null, 'POST is left alone');
eq(ajax('https://i.pximg.net/ajax/x'), null, 'other origins are left alone');
eq(ajax('/touch/ajax/user/self/status?lang=en'), null, 'touch API is left alone');

process.exitCode = failures ? 1 : 0;
