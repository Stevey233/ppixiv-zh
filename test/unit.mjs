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
eq([translate('Horizontal'), translate('Vertical')], ['横排', '竖排'], 'image translation text direction');

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

// fetchFilteredFeed.  known is what ppixiv's data source already shows, storage holds the filters,
// and where is the page's location.
const messages = [];
let known = [];
const storage = new Map();
const where = { pathname: '/discovery', search: '', hash: '' };
const seenIds = new Set();
const block = (name) => src.match(new RegExp(`^const ${name} = [\\[{][\\s\\S]*?\\n[\\]}];`, 'm'))[0];
const session = new Map();
// The data source making requests.  A new one is a refresh.
const app = {};
const newSource = (extra = {}) => app.currentDataSource = { idList: { getAllMediaIds: () => known }, ...extra };
newSource();
const feeds = new Function('window', 'later', 'location', 'localStorage', 'sessionStorage', 'seenWorks', [
  block('TYPE_FILTERS'), block('FEEDS'), constLine('DISCOVERY_FILTERS_KEY'), block('DISCOVERY_FILTERS'),
  constLine('FEED_MAX_REQUESTS'), constLine('FEED_RETRY_DELAY_MS'), constLine('feedWorks'), constLine('FEED_PAGES_KEY'), constLine('FEED_PAGES_LIMIT'),
  constLine('feedFilterPins'), constLine('mergedPagesWithoutWorks'),
  ...['feedType', 'discoveryFilters', 'feedFilterSignature', 'feedFilter', 'feedFilterLabel', 'feedForRequest', 'setFeedWorks',
    'readFeedPagesStorage', 'loadFeedPages', 'saveFeedPage', 'feedPaging', 'feedFilterFor', 'fetchFilteredFeed'].map(grab),
  src.match(/^const bookmarksShuffled = .*$/m)[0],
  'return { fetchFilteredFeed, feedFilter, feedFilterFor, feedForRequest, loadFeedPages };'].join('\n'))(
  { ppixiv: { message: { show: (m) => messages.push(m) }, plocation: where, app } },
  (cb) => setTimeout(cb, 0), { ...where, href: 'https://www.pixiv.net/discovery' },
  { getItem: (k) => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, String(v)) },
  { getItem: (k) => session.get(k) ?? null, setItem: (k, v) => session.set(k, String(v)) }, seenIds);
// Each call pins the filters to the current data source, so a call after a filter change needs a
// new data source, as a refresh would make.
const filterFeed = (fetchFunc, url, feed = 'discovery') => feeds.fetchFilteredFeed(fetchFunc, url, {}, feed, feeds.feedFilterFor(feed));
const setType = (feed, type) => { storage.set({ discovery: 'ppx-zh-discovery-type', following: 'ppx-zh-following-type', bookmarks: 'ppx-zh-bookmarks-type' }[feed], type); newSource(); };
const fd = (fetchFunc, url, init, type) => { setType('discovery', type); return filterFeed(fetchFunc, url); };
const work = (id, t, extra) => ({ id: String(id), illustType: t, width: 100, height: 100, pageCount: 1, aiType: 1, bookmarkData: null, ...extra });
const page = (types, extra = {}) => new Response(JSON.stringify({ error: false, body: { thumbnails: { illust: types.map((t, i) => work(extra.base + i, t)) }, tagTranslation: extra.tt ?? {} } }), { status: 200 });
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
calls = 0;
messages.length = 0;
res = await fd(async () => (++calls, newSource(), page([0, 0], { base: 1 })), '/ajax/discovery/artworks', {}, 'manga');
body = await res.json();
eq([calls, body.body.thumbnails.illust.length, messages.length], [1, 2, 0], 'a refresh stops the retries, and ppixiv gets the batch unfiltered');

// Filters are pinned to the data source that started with them.
setType('discovery', 'manga');
const pinned = feeds.feedFilterFor('discovery');
storage.set('ppx-zh-discovery-type', 'illust');
eq([feeds.feedFilterFor('discovery') === pinned, (newSource(), feeds.feedFilterFor('discovery').label)], [true, '插画'],
  'a filter changed elsewhere applies after a refresh');
calls = 0;
setType('discovery', 'manga');
res = await filterFeed(async () => (++calls, where.pathname = '/new_illust.php', page([0, 0], { base: 1 })), '/ajax/discovery/artworks');
where.pathname = '/discovery';
body = await res.json();
eq([calls, body.body.thumbnails.illust.length, messages.length], [1, 2, 0], 'leaving the page stops the retries without ending the feed or the message');

// The other recommendation filters, all at once.
setType('discovery', 'all');
storage.set('ppx-zh-discovery-filters', JSON.stringify({ shape: 'portrait', pages: 'single', hideAi: true, hideBookmarked: true, hideSeen: true, bogus: 1 }));
newSource();
seenIds.add('6');
const mixed = [
  work(1, 0, { height: 200 }), work(2, 0, { width: 200 }), work(3, 0, { height: 200, pageCount: 3 }),
  work(4, 0, { height: 200, aiType: 2 }), work(5, 0, { height: 200, bookmarkData: { id: '1' } }), work(6, 0, { height: 200 }),
  work(7, 0, { height: 200, aiType: 0 }),
];
res = await filterFeed(async () => new Response(JSON.stringify({ body: { thumbnails: { illust: mixed } } })), '/ajax/discovery/artworks');
body = await res.json();
eq(body.body.thumbnails.illust.map(t => t.id), ['1', '7'], 'portrait, single page, no AI, not bookmarked, not seen');
storage.set('ppx-zh-discovery-filters', JSON.stringify({ shape: 'square' }));
eq(feeds.feedFilter('discovery'), null, 'unknown filter values are ignored');
newSource();
storage.delete('ppx-zh-discovery-filters');

// Which requests are filtered.
const reqUrl = (u) => new URL(u, 'https://www.pixiv.net/');
eq([feeds.feedForRequest(reqUrl('/ajax/discovery/artworks?mode=all')), feeds.feedForRequest(reqUrl('/ajax/discovery/artworks?sampleIllustId=5')),
  feeds.feedForRequest(reqUrl('/ajax/follow_latest/illust?p=1')), feeds.feedForRequest(reqUrl('/ajax/user/9/illusts/bookmarks?offset=0')),
  feeds.feedForRequest(reqUrl('/ajax/user/9/illusts/bookmark/tags'))], ['discovery', null, 'following', 'bookmarks', null], 'requests that are filtered');
where.hash = '#ppixiv?shuffle=1';
eq(feeds.feedForRequest(reqUrl('/ajax/user/9/illusts/bookmarks?offset=0')), null, 'shuffled bookmarks are not filtered');
where.hash = '';

// Paged feeds continue after the pages that were skipped.  followPages maps the feed's own page
// to its works' types.
const followPages = { 1: [0, 0], 2: [0, 0], 3: [1, 0], 4: [1], 5: [0], 6: [] };
let requested = [];
const follow = async (u) => {
  const p = Number(reqUrl(u).searchParams.get('p'));
  requested.push(p);
  return new Response(JSON.stringify({ body: { thumbnails: { illust: (followPages[p] ?? []).map((t, i) => work(p * 10 + i, t)) }, tagTranslation: {}, page: { tags: [] } } }));
};
setType('following', 'manga');
messages.length = 0;
let followLang = '&lang=zh';
const followIds = async (p) => (await (await filterFeed(follow, `/ajax/follow_latest/illust?p=${p}&mode=all${followLang}`, 'following')).json()).body.thumbnails.illust.map(t => t.id);
const step = async (p) => { requested = []; const ids = await followIds(p); return [ids, requested]; };
eq(await step(1), [['30'], [1, 2, 3]], 'following: page 1 skips pages with no manga');
eq(await step(2), [['40'], [4]], 'following: page 2 continues after the skipped pages');
eq([await step(3), messages], [[[], [5, 6]], []], 'following: the end of the feed stops without a message');
newSource();
eq(await step(1), [['30'], [1, 2, 3]], 'following: a refresh starts page 1 where it was');

// The audit's case: manga on feed page 1, none on 2 and 3, manga from 4.
Object.assign(followPages, { 1: [1, 0], 2: [0], 3: [0], 4: [1], 5: [1], 6: [1], 7: [1] });
session.clear();
newSource();
eq([await step(1), await step(2), await step(3)], [[['10'], [1]], [['40'], [2, 3, 4]], [['50'], [5]]], 'following: first visit');
// Reloading at ?p=3, then loading upward, puts every page back where it was.
newSource();
eq([await step(3), await step(2), await step(1)], [[['50'], [5]], [['40'], [2, 3, 4]], [['10'], [1]]], 'following: reload at page 3 and load upward');
// A refresh then continues page 2 from the new page 1, not from the old page 2.
followPages[2] = [1];
newSource();
eq([await step(1), await step(2)], [[['10'], [1]], [['20'], [2]]], 'following: after a refresh, page 2 follows the new page 1');

// Opened at a page that was never loaded: pages above it take one request each and come back
// unfiltered when nothing passes, and the page below continues after the start page.
session.clear();
newSource();
Object.assign(followPages, { 6: [0], 7: [0], 8: [0], 9: [0], 10: [0], 11: [1], 12: [0], 13: [0], 14: [0], 15: [] });
messages.length = 0;
eq([await step(9), messages.length], [[['110'], [9, 10, 11]], 0], 'following: start at page 9 of the URL');
eq((await step(8)), [['80'], [8]], 'following: page 8 above it is one request, unfiltered');
eq(await step(10), [[], [12, 13, 14, 15]], 'following: page 10 continues after page 9');

// The language isn't part of the feed: switching it doesn't start over.
session.clear();
newSource();
Object.assign(followPages, { 1: [1], 2: [0], 3: [0], 4: [1], 5: [1] });
await step(1); await step(2);
followLang = '';
eq(await step(3), [['50'], [5]], 'following: page 3 continues after page 2 without lang');
followLang = '&lang=zh';
eq(JSON.parse(session.get('ppx-zh-feed-pages'))['https://www.pixiv.net/ajax/follow_latest/illust?mode=all ["manga",null]'].map(([p]) => p), [1, 2, 3],
  'pages are saved per feed without the page or language');

// Malformed saved pages are ignored rather than breaking requests.
session.set('ppx-zh-feed-pages', JSON.stringify({ 'https://www.pixiv.net/ajax/follow_latest/illust?mode=all ["manga",null]': [[2, null], [3, { low: 'x', high: 1, seq: 1 }], 'junk'] }));
newSource();
eq(await step(2), [['40'], [2, 3, 4]], 'following: malformed saved pages are skipped, and page 2 starts fresh');
session.set('ppx-zh-feed-pages', '[1,2]');
eq((await step(1))[1], [1], 'following: a saved value of the wrong type is ignored');
setType('following', 'all');

// Bookmarks page by offset, and deleted works don't count.
const bookmarkPages = { show: { 0: [work(1, 0), { id: 2, isBookmarkable: false }], 48: [work(3, 1)], 96: [work(4, 1)] }, hide: {} };
requested = [];
const bookmarks = async (u) => {
  const q = reqUrl(u).searchParams;
  requested.push(q.get('rest') + q.get('offset'));
  return new Response(JSON.stringify({ body: { works: bookmarkPages[q.get('rest')][q.get('offset')] ?? [], total: 3, bookmarkTags: {} } }));
};
setType('bookmarks', 'manga');
const bookmarkBody = async (offset, rest = 'show') => (await (await filterFeed(bookmarks, `/ajax/user/9/illusts/bookmarks?tag=&offset=${offset}&limit=48&rest=${rest}`, 'bookmarks')).json()).body;
let bm = await bookmarkBody(0);
eq([bm.works.map(w => w.id), bm.total, requested], [['3'], 3, ['show0', 'show48']], 'bookmarks: offset 0 skips to the next 48');
requested = [];
bm = await bookmarkBody(48);
eq([bm.works.map(w => w.id), requested], [['4'], ['show96']], 'bookmarks: the next page continues after it');

// Public and private shown together: a side that runs out of manga is kept going with its works
// marked deleted, and the message shows only when both sides have nothing.
session.clear();
newSource({ requestBookmarkType() {} });
messages.length = 0;
bookmarkPages.show = { 0: [work(10, 0)], 48: [work(11, 0)], 96: [work(12, 0)], 144: [work(13, 0)], 192: [work(14, 1)] };
bookmarkPages.hide = { 0: [work(20, 1)], 48: [work(21, 0)], 96: [work(22, 0)], 144: [work(23, 0)], 192: [work(24, 0)] };
requested = [];
const [pub, priv] = await Promise.all([bookmarkBody(0, 'show'), bookmarkBody(0, 'hide')]);
eq([pub.works.map((w) => [w.id, w.isBookmarkable]), priv.works.map((w) => w.id), messages.length],
  [[['13', false]], ['20'], 0], 'merged bookmarks: an empty side is kept going, no message');
requested = [];
const [pub2, priv2] = await Promise.all([bookmarkBody(48, 'show'), bookmarkBody(48, 'hide')]);
eq([pub2.works.map((w) => w.id), priv2.works.map((w) => w.isBookmarkable), messages.length],
  [['14'], [false, ], 0], 'merged bookmarks: page 2 continues each side, private runs out');
// Page 3: both sides reach Pixiv's end.  ppixiv stops, and nothing was filtered away.
const ended = await Promise.all([bookmarkBody(96, 'show'), bookmarkBody(96, 'hide')]);
eq([ended.map((b) => b.works.length), messages.length], [[0, 0], 0], 'merged bookmarks: both sides at the end, no message');
// Page 4: public runs out of manga while private is at its end, so ppixiv stops: message.
for(const offset of [240, 288, 336, 384, 432, 480, 528, 576]) bookmarkPages.show[offset] = [work(offset, 0)];
const both = await Promise.all([bookmarkBody(144, 'show'), bookmarkBody(144, 'hide')]);
eq([both.map((b) => b.works.length), messages.length], [[1, 0], 1], 'merged bookmarks: one side ran out and the other ended, message');
eq(JSON.parse(session.get('ppx-zh-feed-pages')) && Object.keys(JSON.parse(session.get('ppx-zh-feed-pages'))).every((k) => k.endsWith(' merged')), true,
  'merged bookmarks keep their own pages');
newSource();
setType('bookmarks', 'all');

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
// The pages ahead wait for the page on screen, which is passed as shownPage.
const mangaPages = (mode) => {
  const got = [];
  new Function('window', 'prefetchPages', 'saveData', 'parseMediaId', 'MANGA_PAGES_AHEAD',
    'let lastMangaMediaId = null, shownPageLoader = null;' + grab('prefetchUpcomingMangaPages') + '; prefetchUpcomingMangaPages();')(
    { ppixiv: { app: { displayedMediaId: 'illust:1-3' }, settings: { get: () => mode } } },
    async (id, pages, shownPage) => got.push(...pages, `after ${shownPage}`), () => false, () => ({ page: 3 }), 2);
  return got;
};
eq([mangaPages('full'), mangaPages('partial'), mangaPages('thumbnails'), mangaPages(undefined)],
  [[4, 5, 'after 3'], [4, 'after 3'], [], [4, 5, 'after 3']], 'manga prefetch per preload setting, after the page on screen');

// prefetchPages with shownPage waits until the page on screen has loaded, and gives up when
// another page is shown first.
for(const shownAgain of [false, true])
{
  const fetched = [], loaders = [];
  const env = new Function('window', 'document', 'prefetchUrl', 'prefetched', 'parseMediaId',
    'let shownPageLoader = null, lastMangaMediaId = "illust:1-0";' + grab('getMediaInfoForPrefetch') + grab('prefetchPages') + grab('waitForShownPage') +
    '; return { prefetchPages, showAnother() { shownPageLoader = null; } };')(
    { ppixiv: { mediaCache: { _nonexistantMediaIds: {}, getMediaInfo: async () => ({ illustType: 0, mangaPages: [0, 1, 2, 3], getMainImageUrl: (p) => ({ url: `p${p}` }) }) } } },
    { createElement: () => { const loader = {}; loaders.push(loader); return loader; } },
    (url) => fetched.push(url), new Set(), () => ({ page: 0 }));
  const done = env.prefetchPages('illust:1-0', [1, 2], 0);
  await new Promise((resolve) => setTimeout(resolve, 0));
  const waiting = [fetched.length, loaders.map((l) => l.src)];
  if(shownAgain)
    env.showAnother();
  loaders[0].onload();
  await done;
  eq([waiting, fetched], [[0, ['p0']], shownAgain ? [] : ['p1', 'p2']],
    shownAgain ? 'read-ahead is dropped when another page is shown first' : 'read-ahead starts after the page on screen loads');
}

// A read-ahead whose info arrives after another work is shown does nothing.
{
  const fetched = [], loaders = [];
  let resolveInfo;
  const env = new Function('window', 'document', 'prefetchUrl', 'prefetched', 'parseMediaId',
    'let shownPageLoader = null, lastMangaMediaId = "illust:1-0";' + grab('getMediaInfoForPrefetch') + grab('prefetchPages') + grab('waitForShownPage') +
    '; return { prefetchPages, show(id) { lastMangaMediaId = id; } };')(
    { ppixiv: { mediaCache: { _nonexistantMediaIds: {}, getMediaInfo: () => new Promise((resolve) => resolveInfo = resolve) } } },
    { createElement: () => { const loader = {}; loaders.push(loader); return loader; } },
    (url) => fetched.push(url), new Set(), () => ({ page: 0 }));
  const done = env.prefetchPages('illust:1-0', [1, 2], 0);
  env.show('illust:2-0');
  resolveInfo({ illustType: 0, mangaPages: [0, 1, 2], getMainImageUrl: (p) => ({ url: `p${p}` }) });
  await done;
  eq([loaders.length, fetched], [0, []], 'a read-ahead for a work no longer shown does nothing');
}

// pixivAjaxUrl
const ajax = new Function('location', constLine('AUTOCOMPLETE_PATH') + grab('pixivAjaxUrl') + '; return pixivAjaxUrl;')({ href: 'https://www.pixiv.net/discovery', origin: 'https://www.pixiv.net' });
eq(ajax('/ajax/illust/1?lang=en')?.pathname, '/ajax/illust/1', 'relative ajax GET');
eq(ajax('/ajax/illusts/like', { method: 'POST' }), null, 'POST is left alone');
eq(ajax('https://i.pximg.net/ajax/x'), null, 'other origins are left alone');
eq(ajax('/touch/ajax/user/self/status?lang=en'), null, 'touch API is left alone');
eq(ajax('/rpc/cps.php?keyword=a')?.pathname, '/rpc/cps.php', 'tag autocomplete');
eq(ajax('/rpc/index.php?mode=x'), null, 'other rpc calls are left alone');

// Download file names
const names = new Function(constLine('FILENAME_MAX_LENGTH') + grab('downloadFields') + grab('renderFilename') + '; return { downloadFields, renderFilename };')();
const infos = { 123: { illustTitle: 'Title', userId: 7, pageCount: 3, createDate: '2024-03-05T12:00:00+09:00' }, 456: { illustTitle: 'X - 9 - Y', userId: 8, pageCount: 1, createDate: 'bad' } };
const getInfo = (id) => infos[id] ?? null;
eq(names.downloadFields('Alice - 123 #2 - Title.jpg', getInfo), { author: 'Alice', author_id: '7', id: '123', title: 'Title', page: '2', pages: '3', date: '2024-03-05', ext: 'jpg' }, 'one page of a manga');
eq(names.downloadFields('Alice - 123 - Title.zip', getInfo)?.page, '', 'a ZIP has no page');
eq(names.downloadFields('A - 5 - B - 123 - Title.png', getInfo)?.author, 'A - 5 - B', 'user names with " - " and digits');
eq(names.downloadFields('Bob - 456 - X - 9 - Y.png', getInfo)?.[`page`], '1', 'titles with " - " and digits, single page');
eq(names.downloadFields('Bob - 456 - X - 9 - Y.png', getInfo)?.date, '', 'an unreadable date is empty');
eq(names.downloadFields('something.png', getInfo), null, 'other downloads are left alone');
eq(names.downloadFields('Alice - 123 - Other title.jpg', getInfo), null, 'a title that does not match is left alone');
const f = { author: 'A/B', author_id: '7', id: '123', title: 'T:1', page: '', pages: '3', date: '2024-03-05', ext: 'zip' };
eq(names.renderFilename('{author} - {id}<_p{page}> {title}', f), 'A_B - 123 T_1.zip', 'optional part left out, unsafe characters replaced');
eq(names.renderFilename('{id}<_p{page}>', { ...f, page: '2', ext: 'jpg' }), '123_p2.jpg', 'optional part kept');
eq(names.renderFilename('{id} {foo} <{bar}>', f), '123 {foo} {bar}.zip', 'unknown fields stay as written');
eq(names.renderFilename('  <{page}> ', f), null, 'nothing left means ppixiv\'s name');
eq(Array.from(names.renderFilename('x'.repeat(300), f)).length, 184, 'long names are cut');
eq(names.downloadFields('Studio - 2024 - 123 - Title.png', getInfo)?.author, 'Studio - 2024', 'a user name ending in " - <digits>"');
eq(names.downloadFields('Studio - 2024 #2 - 123 #3 - Title.png', getInfo)?.page, '3', 'a user name ending in " - <digits> #<digits>"');
infos[77] = { illustTitle: '123 - Title', userId: 1, userName: 'Someone', pageCount: 1, createDate: '' };
infos[123].userName = 'Bob - 77';
eq(names.downloadFields('Bob - 77 - 123 - Title.png', getInfo)?.id, '123', 'the ID whose work has the user name in front wins');
eq(names.renderFilename('<{title}> {id}', { ...f, title: 'my {id} {page} piece', page: '1' }), 'my {id} {page} piece 123.zip', 'braces in a title stay as they are');
const started = performance.now();
names.renderFilename('.'.repeat(200000) + 'x' + '.'.repeat(200000), f);
eq(performance.now() - started < 500, true, 'long runs of dots are trimmed quickly');

process.exitCode = failures ? 1 : 0;
