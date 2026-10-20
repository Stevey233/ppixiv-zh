// Exercise the real prefetch section with deferred metadata/URL requests and image events.
// Clearing an image's src intentionally fires no event: browsers don't guarantee one.
import fs from 'node:fs';
import assert from 'node:assert/strict';

const source = fs.readFileSync(process.argv[2] ?? new URL('../src/main.js', import.meta.url), 'utf8');
// Only an explicitly requested baseline run may omit the new cancellation entry points.
const legacySource = process.argv.includes('--legacy-source');
const start = source.indexOf('// ------------------------------------------------------------------ faster full-size images');
const section = source.slice(start, source.indexOf('\n// ------------------------------------------------------------------ ', start + 1));
assert.ok(start >= 0 && section.length > 0, 'prefetch section found');

function deferred() {
  let resolve;
  const promise = new Promise((r) => resolve = r);
  return { promise, resolve };
}

const flush = async () => {
  for(let i = 0; i < 10; ++i)
    await Promise.resolve();
};
async function settled(promise) {
  let finished = false, value, error;
  Promise.resolve(promise).then(
    (result) => { finished = true; value = result; },
    (reason) => { finished = true; error = reason; });
  await flush();
  assert.equal(finished, true, 'prefetch/wait promise settles without another image event');
  if(error)
    throw error;
  return value;
}
const infoFor = (id) => ({
  illustType: 0,
  mangaPages: Array.from({ length: 8 }),
  getMainImageUrl: (page) => ({ url: `${id.split('-')[0]}/original-${page}` }),
});

function runtime({ mode = 'full', partial = null } = {}) {
  const events = new Map(), connectionEvents = new Map(), timers = new Map();
  const storage = new Map(), images = [], requests = [], infoRequests = [], guesses = [];
  let timerId = 0;
  const document = {
    addEventListener: (name, callback) => events.set(name, callback),
    createElement: () => {
      const image = {
        onload: null,
        onerror: null,
        set src(url) { this.url = url; if(url) requests.push(url); },
        get src() { return this.url; },
        load() { this.onload?.(); },
        fail() { this.onerror?.(); },
      };
      images.push(image);
      return image;
    },
  };
  const navigator = { connection: {
    saveData: false,
    addEventListener: (name, callback) => connectionEvents.set(name, callback),
  } };
  const window = {
    realSetTimeout: (callback) => { timers.set(++timerId, callback); return timerId; },
    realClearTimeout: (id) => timers.delete(id),
    ppixiv: {
      app: { displayedMediaId: null },
      settings: { get: () => mode },
      mediaCache: {
        _nonexistantMediaIds: {},
        getMediaInfo: (id) => {
          const request = { id, ...deferred() };
          infoRequests.push(request);
          return request.promise;
        },
        getMediaInfoSync: (_id, { full = true } = {}) => full ? null : partial,
      },
      guessImageUrl: {
        guessUrl: (id) => {
          const request = { id, ...deferred() };
          guesses.push(request);
          return request.promise;
        },
      },
    },
  };
  const api = new Function('document', 'window', 'navigator', 'performance', 'localStorage',
    `let active = true;\n${section}\nreturn {
      prefetchUpcomingMangaPages, waitForShownPage,
      refreshPrefetchSettings: typeof refreshPrefetchSettings == 'function' ? refreshPrefetchSettings : null,
      cancelShownPageWait: typeof cancelShownPageWait == 'function' ? cancelShownPageWait : null,
      prefetched, getShownPageLoader: () => shownPageLoader,
    };`)(document, window, navigator, { now: () => 0 }, { getItem: (key) => storage.get(key) ?? null });
  for(const name of ['refreshPrefetchSettings', 'cancelShownPageWait']) {
    if(legacySource)
      api[name] ??= () => {};
    else
      assert.equal(typeof api[name], 'function', `${name} is present in the fixed source`);
  }
  const result = {
    api, storage, images, requests, infoRequests, guesses, timers, navigator, window,
    setMode: (next) => mode = next,
    pointer(name, id) {
      const thumb = id == null ? null : {
        dataset: { mediaId: id },
        closest: () => ({ classList: { contains: () => false } }),
      };
      events.get(name)({ pointerType: 'mouse', target: { closest: () => thumb } });
    },
    runTimers() {
      for(const [id, callback] of [...timers]) {
        timers.delete(id);
        callback();
      }
    },
    hover(id = 'illust:1-0') {
      result.pointer('pointermove', id);
      result.runTimers();
    },
    show(id = 'illust:1-0') {
      window.ppixiv.app.displayedMediaId = id;
      return api.prefetchUpcomingMangaPages();
    },
    resolveInfo(index = 0) {
      const request = infoRequests[index];
      assert.ok(request, `metadata request ${index} exists`);
      request.resolve(infoFor(request.id));
    },
    disable(kind, notify = true) {
      if(kind == 'hover')
        storage.set('ppx-zh-hover-prefetch', 'off');
      else if(kind == 'saveData')
        navigator.connection.saveData = true;
      else
        mode = 'thumbnails';
      if(notify) {
        if(kind == 'saveData')
          connectionEvents.get('change')();
        else
          api.refreshPrefetchSettings();
      }
    },
    enable(kind) {
      if(kind == 'hover')
        storage.delete('ppx-zh-hover-prefetch');
      else if(kind == 'saveData')
        navigator.connection.saveData = false;
      else
        mode = 'full';
      api.refreshPrefetchSettings();
    },
  };
  return result;
}

let count = 0;
async function test(name, run) {
  await run();
  ++count;
  console.log(`ok   ${name}`);
}

for(const kind of ['hover', 'saveData']) {
  await test(`${kind}: disabling before the hover delay sends no request`, async () => {
    const r = runtime();
    r.pointer('pointermove', 'illust:1-0');
    r.disable(kind);
    r.runTimers();
    assert.equal(r.infoRequests.length, 0);
    assert.deepEqual(r.requests, []);
  });

  for(const notify of [false, true]) {
    await test(`${kind}: metadata and guessed URLs respect current settings (notification ${notify})`, async () => {
      const r = runtime({ partial: { illustType: 0 } });
      r.hover();
      assert.equal(r.infoRequests.length, 1);
      assert.equal(r.guesses.length, 1);
      r.disable(kind, notify);
      r.resolveInfo();
      r.guesses[0].resolve('guessed-original');
      await flush();
      assert.deepEqual(r.requests, []);
    });
  }

  await test(`${kind}: re-enabling doesn't revive an interrupted hover`, async () => {
    const r = runtime({ partial: { illustType: 0 } });
    r.hover();
    r.disable(kind);
    r.enable(kind);
    r.resolveInfo();
    r.guesses[0].resolve('stale-guess');
    await flush();
    assert.deepEqual(r.requests, []);
    r.hover();
    r.resolveInfo(1);
    r.guesses[1].resolve('illust:1/original-0');
    await flush();
    assert.deepEqual(r.requests, ['illust:1/original-0']);
  });

  await test(`${kind}: moving over a disabled thumbnail doesn't prevent a later enabled hover`, async () => {
    const r = runtime();
    r.disable(kind);
    r.hover();
    assert.equal(r.infoRequests.length, 0);
    r.enable(kind);
    r.hover();
    r.resolveInfo();
    await flush();
    assert.deepEqual(r.requests, ['illust:1/original-0']);
  });
}

await test('the settings-panel/storage refresh invalidates a pending hover', async () => {
  const r = runtime();
  const settingChanged = source.match(/^function settingChanged\(\)\n\{[\s\S]*?^\}/m)?.[0];
  assert.ok(settingChanged);
  const noop = () => {};
  const refresh = new Function('runSetup', 'applyTheme', 'refreshFeedFilterButtons', 'refreshSeenThumbs',
    'refreshSettingsPanel', 'refreshPrefetchSettings', `${settingChanged}; return settingChanged;`)(
    (callback) => callback(), noop, noop, noop, noop, r.api.refreshPrefetchSettings);
  r.hover();
  r.storage.set('ppx-zh-hover-prefetch', 'off');
  refresh();
  r.storage.delete('ppx-zh-hover-prefetch');
  refresh();
  r.resolveInfo();
  await flush();
  assert.deepEqual(r.requests, []);
});

await test('returning to the same hover does not revive earlier metadata or URL guesses', async () => {
  const r = runtime({ partial: { illustType: 0 } });
  r.hover('illust:1-0');
  r.pointer('pointerover', 'illust:2-0');
  r.hover('illust:2-0');
  r.pointer('pointerover', 'illust:1-0');
  r.hover('illust:1-0');
  for(let i = 0; i < 2; ++i) {
    r.resolveInfo(i);
    r.guesses[i].resolve(`stale-${i}`);
  }
  await flush();
  assert.deepEqual(r.requests, []);
  r.resolveInfo(2);
  r.guesses[2].resolve('illust:1/original-0');
  await flush();
  assert.deepEqual(r.requests, ['illust:1/original-0']);
});

await test('unchanged hover keeps its timer and prefetches the preview and original once', async () => {
  const r = runtime({ partial: { illustType: 0, previewUrls: ['preview-0'] } });
  r.pointer('pointermove', 'illust:1-0');
  r.pointer('pointermove', 'illust:1-0');
  assert.equal(r.timers.size, 1);
  r.runTimers();
  r.resolveInfo();
  r.guesses[0].resolve('illust:1/original-0');
  await flush();
  assert.deepEqual(r.requests, ['preview-0', 'illust:1/original-0']);
});

for(const kind of ['manga', 'saveData']) {
  for(const notify of [false, true]) {
    await test(`${kind}: metadata cannot start a disabled manga wait (notification ${notify})`, async () => {
      const r = runtime();
      const done = r.show();
      r.disable(kind, notify);
      r.resolveInfo();
      await settled(done);
      assert.deepEqual(r.requests, []);
      assert.equal(r.api.getShownPageLoader(), null);
    });

    await test(`${kind}: a disabled manga wait cannot start more originals (notification ${notify})`, async () => {
      const r = runtime();
      const done = r.show();
      r.resolveInfo();
      await flush();
      assert.deepEqual(r.requests, ['illust:1/original-0']);
      const loader = r.images[0], lateLoad = loader.onload;
      r.disable(kind, notify);
      if(notify) {
        assert.equal(loader.src, '');
        assert.equal(loader.onload, null);
        assert.equal(loader.onerror, null);
        let settled = false;
        done.then(() => settled = true);
        await flush();
        assert.equal(settled, true, 'cancelled wait settles without load/error');
      }
      lateLoad();
      await settled(done);
      assert.deepEqual(r.requests, ['illust:1/original-0']);
      assert.equal(r.api.getShownPageLoader(), null);
    });
  }

  await test(`${kind}: same-page disable/re-enable replaces the old waiter safely`, async () => {
    const r = runtime();
    const oldDone = r.show();
    r.resolveInfo();
    await flush();
    const oldLoader = r.images[0], lateLoad = oldLoader.onload;
    r.disable(kind);
    await settled(oldDone);
    r.enable(kind);
    assert.equal(r.infoRequests.length, 2);
    r.resolveInfo(1);
    await flush();
    const currentLoader = r.images[1];
    lateLoad();
    await flush();
    assert.equal(r.api.getShownPageLoader(), currentLoader);
    assert.equal(r.requests.length, 2);
    currentLoader.load();
    await flush();
    assert.deepEqual(r.requests, [
      'illust:1/original-0', 'illust:1/original-0',
      'illust:1/original-1', 'illust:1/original-2',
    ]);
  });

  await test(`${kind}: same-page disable/re-enable doesn't revive stale metadata`, async () => {
    const r = runtime();
    const oldDone = r.show();
    r.disable(kind);
    r.enable(kind);
    assert.equal(r.infoRequests.length, 2);
    r.resolveInfo();
    await settled(oldDone);
    assert.deepEqual(r.requests, []);
    r.resolveInfo(1);
    await flush();
    assert.deepEqual(r.requests, ['illust:1/original-0']);
    r.images[0].load();
    await flush();
    assert.equal(r.requests.length, 3);
  });
}

await test('turning hover off does not interrupt pending manga read-ahead', async () => {
  const r = runtime();
  const done = r.show();
  r.resolveInfo();
  await flush();
  r.disable('hover');
  assert.equal(r.images[0].src, 'illust:1/original-0');
  r.images[0].load();
  await settled(done);
  assert.deepEqual(r.requests, ['illust:1/original-0', 'illust:1/original-1', 'illust:1/original-2']);
});

await test('turning manga read-ahead off does not interrupt pending hover prefetch', async () => {
  const r = runtime();
  r.hover();
  r.disable('manga');
  r.resolveInfo();
  await flush();
  assert.deepEqual(r.requests, ['illust:1/original-0']);
});

await test('manga mode changes on the same page restart with the new page limit', async () => {
  const r = runtime();
  const oldDone = r.show();
  r.resolveInfo();
  await flush();
  const oldLoader = r.images[0], lateLoad = oldLoader.onload;
  r.setMode('partial');
  const done = r.show();
  await settled(oldDone);
  assert.equal(oldLoader.src, '');
  r.resolveInfo(1);
  await flush();
  lateLoad();
  r.images[1].load();
  await settled(done);
  assert.deepEqual(r.requests, [
    'illust:1/original-0', 'illust:1/original-0', 'illust:1/original-1',
  ]);
});

await test('unchanged manga setup does not duplicate requests; returning to the same page invalidates old work', async () => {
  const r = runtime();
  const oldDone = r.show('illust:1-0');
  r.show('illust:1-0');
  assert.equal(r.infoRequests.length, 1);
  const middleDone = r.show('illust:1-1');
  const done = r.show('illust:1-0');
  r.resolveInfo();
  r.resolveInfo(1);
  await settled(Promise.all([oldDone, middleDone]));
  assert.deepEqual(r.requests, []);
  r.resolveInfo(2);
  await flush();
  r.images[0].load();
  await settled(done);
  assert.deepEqual(r.requests, ['illust:1/original-0', 'illust:1/original-1', 'illust:1/original-2']);
});

await test('navigating away cancels the current-page wait even with Save-Data enabled', async () => {
  const r = runtime();
  const done = r.show();
  r.resolveInfo();
  await flush();
  r.navigator.connection.saveData = true;
  r.show(null);
  await settled(done);
  assert.equal(r.images[0].src, '');
  assert.equal(r.api.getShownPageLoader(), null);
  assert.deepEqual(r.requests, ['illust:1/original-0']);
});

await test('replacing, failing, and cancelling current-page waits always settles and cleans up', async () => {
  const r = runtime();
  const first = r.api.waitForShownPage('first');
  const staleLoad = r.images[0].onload;
  const second = r.api.waitForShownPage('second');
  assert.equal(await settled(first), false);
  assert.equal(r.images[0].src, '');
  staleLoad();
  assert.equal(r.api.getShownPageLoader(), r.images[1]);
  r.images[1].fail();
  assert.equal(await settled(second), false);
  assert.equal(r.api.getShownPageLoader(), null);
  assert.equal(r.images[1].onload, null);
  const third = r.api.waitForShownPage('third');
  r.api.prefetched.add('cached');
  assert.equal(await r.api.waitForShownPage('cached'), true);
  assert.equal(await settled(third), false);
  assert.equal(r.images[2].src, '');
  assert.equal(r.images.length, 3);
  r.api.cancelShownPageWait();
  r.api.cancelShownPageWait();
  assert.equal(r.api.getShownPageLoader(), null);
});

console.log(`\n${count} prefetch cancellation regression tests passed.`);
