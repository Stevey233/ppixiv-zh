// Exercise the installed fetch hook, including asynchronous seen-history loading and retries.
// Pass another main.js as the first argument to check the same regressions against an old build.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';

const src = fs.readFileSync(process.argv[2] ?? new URL('../src/main.js', import.meta.url), 'utf8');
function grab(name) {
  const start = src.search(new RegExp(`^(async )?function ${name}\\(`, 'm'));
  if (start < 0) throw new Error('no ' + name);
  let depth = 0;
  for (let i = src.indexOf('{', start); i < src.length; ++i) {
    if (src[i] === '{') ++depth;
    else if (src[i] === '}' && --depth === 0) return src.slice(start, i + 1);
  }
  throw new Error('unterminated ' + name);
}
const feedCode = src.slice(src.indexOf('const TYPE_FILTERS ='), src.indexOf('function setupFeedFilterButtons()'));
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
};
const work = (id, type = 1) => ({ id: String(id), illustType: type, isBookmarkable: true });
const reply = (works, bookmarks = false) => new Response(JSON.stringify({
  body: { ...(bookmarks ? { works } : { thumbnails: { illust: works } }), tagTranslation: {} },
}));
const ids = async (response, bookmarks = false) => {
  const { body } = await response.json();
  return (bookmarks ? body.works : body.thumbnails.illust).map((item) => item.id);
};
const pageNumber = (url) => Number(new URL(url, 'https://www.pixiv.net').searchParams.get('p'));
const followingUrl = (page) => `/ajax/follow_latest/illust?p=${page}&mode=all`;
const bookmarksUrl = (offset, rest = 'show') => `/ajax/user/9/illusts/bookmarks?offset=${offset}&limit=48&rest=${rest}`;
const dataSource = (name = 'discovery', known = [], extra = {}) => ({
  name, idList: { getAllMediaIds: () => known }, ...extra,
});

function environment({ feed = 'discovery', hideSeen = false, manualRetries = false, source = dataSource() } = {}) {
  const memory = new Map([
    [`ppx-zh-${feed}-type`, 'manga'],
    ['ppx-zh-discovery-filters', JSON.stringify(hideSeen ? { hideSeen: true } : {})],
  ]);
  const session = new Map();
  const storage = (map) => ({ getItem: (key) => map.get(key) ?? null, setItem: (key, value) => map.set(key, String(value)) });
  const location = { href: 'https://www.pixiv.net/discovery', origin: 'https://www.pixiv.net',
    pathname: '/discovery', search: '', hash: '' };
  const messages = [];
  const seenWorks = new Set();
  const window = { ppixiv: { plocation: location, app: { currentDataSource: source },
    message: { show: (message) => messages.push(message) } } };
  let fetch = () => { throw new Error('unexpected request'); };
  let seenLoader = () => Promise.resolve();
  let seenLoads = 0;
  const retries = [], retryWaiters = [];
  const later = (callback) => {
    if (!manualRetries) return queueMicrotask(callback);
    if (retryWaiters.length) retryWaiters.shift()(callback);
    else retries.push(callback);
  };
  window.realFetch = (...args) => fetch(...args);
  new Function('window', 'location', 'localStorage', 'sessionStorage', 'seenWorks', 'later',
    'chineseTagsEnabled', 'loadSeenWorks', [
      feedCode,
      'const AUTOCOMPLETE_PATH = "/rpc/cps.php"; let fetchHookInstalled = false;',
      grab('pixivAjaxUrl'), grab('installFetchHook'), 'installFetchHook();',
    ].join('\n'))(window, location, storage(memory), storage(session), seenWorks, later, () => false,
    () => { ++seenLoads; return seenLoader(); });
  return {
    window, location, memory, session, messages, seenWorks,
    setFetch: (next) => { fetch = next; },
    setSeenLoader: (next) => { seenLoader = next; },
    get seenLoads() { return seenLoads; },
    fetch: (...args) => window.realFetch(...args),
    use: (next) => { window.ppixiv.app.currentDataSource = next; },
    nextRetry: () => retries.length ? Promise.resolve(retries.shift()) :
      new Promise((resolve) => retryWaiters.push(resolve)),
  };
}

test('late responses cannot overwrite refreshed pages; cached sources retain their own ranges', { timeout: 5000 }, async () => {
  const oldSource = dataSource('new_works_by_following');
  const env = environment({ feed: 'following', source: oldSource });
  const secondStarted = deferred(), secondResponse = deferred();
  env.setFetch(async (url) => {
    if (pageNumber(url) === 1) return reply([work(10, 0)]);
    secondStarted.resolve();
    return secondResponse.promise;
  });
  const old = env.fetch(followingUrl(1));
  await secondStarted.promise;
  const freshSource = dataSource('new_works_by_following');
  env.use(freshSource);
  env.setFetch(async () => reply([work(11)]));
  assert.deepEqual(await ids(await env.fetch(followingUrl(1))), ['11']);
  const freshPages = env.session.get('ppx-zh-feed-pages');

  secondResponse.resolve(reply([work(20)]));
  assert.deepEqual(await ids(await old), ['20']);
  assert.equal(env.session.get('ppx-zh-feed-pages'), freshPages, 'late response does not write shared pagination');

  const requested = [];
  env.setFetch(async (url) => { requested.push(pageNumber(url)); return reply([work(pageNumber(url) * 10)]); });
  await env.fetch(followingUrl(2));
  assert.deepEqual(requested.splice(0), [2], 'fresh page 2 is not silently skipped');
  env.use(oldSource);
  await env.fetch(followingUrl(2));
  assert.deepEqual(requested.splice(0), [3], 'the cached old source continues after its own skipped pages');
  env.use(freshSource);
  await env.fetch(followingUrl(3));
  assert.deepEqual(requested, [3], 'returning to the fresh source does not adopt the cached source mapping');
});

test('a late failed retry does not overwrite the refreshed pagination sequence', { timeout: 5000 }, async () => {
  const env = environment({ feed: 'following', source: dataSource('new_works_by_following') });
  const secondStarted = deferred(), secondResponse = deferred();
  env.setFetch(async (url) => {
    if (pageNumber(url) === 1) return reply([work(10, 0)]);
    secondStarted.resolve();
    return secondResponse.promise;
  });
  const old = env.fetch(followingUrl(1));
  await secondStarted.promise;
  env.use(dataSource('new_works_by_following'));
  env.setFetch(async () => reply([work(11)]));
  await env.fetch(followingUrl(1));
  const freshPages = env.session.get('ppx-zh-feed-pages');
  secondResponse.resolve(new Response('slow down', { status: 429 }));
  assert.equal((await old).status, 429);
  assert.equal(env.session.get('ppx-zh-feed-pages'), freshPages);
  assert.deepEqual(env.messages, []);
});

test('refresh during the retry delay stops old retries without ending the cached source', { timeout: 5000 }, async () => {
  const env = environment({ feed: 'following', manualRetries: true, source: dataSource('new_works_by_following') });
  let calls = 0;
  env.setFetch(async () => { ++calls; return reply([work(10, 0)]); });
  const old = env.fetch(followingUrl(1));
  const resumeRetry = await env.nextRetry();
  env.use(dataSource('new_works_by_following'));
  env.setFetch(async () => { ++calls; return reply([work(11)]); });
  await env.fetch(followingUrl(1));
  const freshPages = env.session.get('ppx-zh-feed-pages');
  resumeRetry();
  assert.deepEqual(await ids(await old), ['10'], 'stale empty filtered page is returned unfiltered');
  assert.equal(calls, 2, 'no old retry is sent after the refresh');
  assert.equal(env.session.get('ppx-zh-feed-pages'), freshPages);
  assert.deepEqual(env.messages, []);
});

test('merged bookmarks keep per-source and per-side page ranges after a refresh', { timeout: 5000 }, async () => {
  const mergedSource = () => dataSource('bookmarks', [], { requestBookmarkType() {} });
  const oldSource = mergedSource();
  const env = environment({ feed: 'bookmarks', source: oldSource });
  const secondStarted = deferred(), secondResponse = deferred();
  env.setFetch(async (url) => {
    if (new URL(url).searchParams.get('offset') === '0') return reply([work(10, 0)], true);
    secondStarted.resolve();
    return secondResponse.promise;
  });
  const old = env.fetch(bookmarksUrl(0));
  await secondStarted.promise;
  const freshSource = mergedSource();
  env.use(freshSource);
  env.setFetch(async () => reply([work(11)], true));
  await Promise.all([env.fetch(bookmarksUrl(0)), env.fetch(bookmarksUrl(0, 'hide'))]);
  const freshPages = env.session.get('ppx-zh-feed-pages');
  secondResponse.resolve(reply([work(20)], true));
  assert.deepEqual(await ids(await old, true), ['20']);
  assert.equal(env.session.get('ppx-zh-feed-pages'), freshPages);

  const requested = [];
  env.setFetch(async (url) => {
    const params = new URL(url).searchParams;
    requested.push([params.get('rest'), params.get('offset')]);
    return reply([work(30)], true);
  });
  await Promise.all([env.fetch(bookmarksUrl(48)), env.fetch(bookmarksUrl(48, 'hide'))]);
  assert.deepEqual(requested.splice(0).sort(), [['hide', '48'], ['show', '48']]);
  env.use(oldSource);
  await env.fetch(bookmarksUrl(48));
  assert.deepEqual(requested.splice(0), [['show', '96']]);
  env.use(freshSource);
  await env.fetch(bookmarksUrl(96));
  assert.deepEqual(requested, [['show', '96']]);
  assert.deepEqual(env.messages, []);
});

test('discovery filters without hide-seen do not wait for IndexedDB', { timeout: 5000 }, async () => {
  const env = environment();
  const database = deferred();
  env.setSeenLoader(() => database.promise);
  let calls = 0;
  env.setFetch(async () => { ++calls; return reply([work(1)]); });
  const pending = env.fetch('/ajax/discovery/artworks');
  const callsBeforeDatabase = calls, loads = env.seenLoads;
  database.resolve();
  await pending;
  assert.equal(loads, 0, 'type-only filters do not load seen history');
  assert.equal(callsBeforeDatabase, 1, 'the request starts while seen history is unavailable');
});

test('a refresh while seen history loads cannot borrow the new source or show a false stop message', { timeout: 5000 }, async () => {
  let oldReads = 0, freshReads = 0;
  const env = environment({ hideSeen: true, source: dataSource('discovery', [], {
    idList: { getAllMediaIds: () => { ++oldReads; return []; } },
  }) });
  const database = deferred();
  env.setSeenLoader(() => database.promise);
  let calls = 0;
  env.setFetch(async () => { ++calls; return reply([work(1)]); });
  const pending = env.fetch('/ajax/discovery/artworks');
  assert.equal(calls, 0, 'hide-seen waits for its history');
  env.use(dataSource('discovery', [], {
    idList: { getAllMediaIds: () => { ++freshReads; return ['illust:1-0']; } },
  }));
  database.resolve();
  assert.deepEqual(await ids(await pending), ['1']);
  assert.equal(calls, 1, 'stale request is delivered without retrying against fresh source IDs');
  assert.deepEqual([oldReads, freshReads], [0, 0], 'stale request does not consult either source for deduplication');
  assert.deepEqual(env.messages, []);
});

test('navigation during the seen-history wait invalidates the original request context', { timeout: 5000 }, async () => {
  const env = environment({ hideSeen: true });
  const database = deferred();
  env.setSeenLoader(() => database.promise);
  let calls = 0;
  env.setFetch(async () => { ++calls; return reply([work(1, 0)]); });
  const pending = env.fetch('/ajax/discovery/artworks');
  env.location.search = '?mode=r18';
  database.resolve();
  assert.deepEqual(await ids(await pending), ['1'], 'stale request returns its raw batch, not a terminal empty page');
  assert.equal(calls, 1);
  assert.deepEqual(env.messages, []);
});

test('hide-seen waits when needed, but changing only the page/hash does not stale the request', { timeout: 5000 }, async () => {
  const env = environment({ hideSeen: true });
  const database = deferred();
  env.setSeenLoader(() => database.promise);
  let calls = 0;
  env.setFetch(async () => { ++calls; return reply([work(1), work(2), work(3, 0)]); });
  const pending = env.fetch('/ajax/discovery/artworks');
  assert.equal(calls, 0);
  env.location.search = '?p=2';
  env.location.hash = '#ppixiv?illust_id=1';
  env.seenWorks.add('1');
  database.resolve();
  assert.deepEqual(await ids(await pending), ['2']);
  assert.equal(calls, 1);
  assert.equal(env.seenLoads, 1);
  assert.deepEqual(env.messages, []);
});

test('deduplication still includes works added to the same source during the seen-history wait', { timeout: 5000 }, async () => {
  const known = [];
  const env = environment({ hideSeen: true, source: dataSource('discovery', known) });
  const database = deferred();
  env.setSeenLoader(() => database.promise);
  env.setFetch(async () => reply([work(1), work(2)]));
  const pending = env.fetch('/ajax/discovery/artworks');
  known.push('illust:1-0');
  database.resolve();
  assert.deepEqual(await ids(await pending), ['2']);
  assert.deepEqual(env.messages, []);
});
