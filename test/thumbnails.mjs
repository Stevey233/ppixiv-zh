// Run the thumbnail hooks against image and observer stubs, without a browser.
import assert from 'node:assert/strict';
import fs from 'node:fs';

const src = fs.readFileSync(process.argv[2] ?? new URL('../src/main.js', import.meta.url), 'utf8');
const section = src.slice(
  src.indexOf('// ------------------------------------------------------------------ sharper thumbnails'),
  src.indexOf('// ------------------------------------------------------------------ activation (continued)'),
);

function runtime()
{
  const requests = [], loaders = [], microtasks = [], events = new Map();
  const storage = new Map();
  const navigator = { onLine: true };
  class Image
  {
    constructor(box = null)
    {
      this.box = box;
      this.isConnected = true;
      this.classList = { contains: (name) => box != null && name == 'thumb' };
    }
    closest() { return this.box; }
    get src() { return this.url; }
    set src(url) { this.url = url; requests.push({ image: this, url }); }
    get currentSrc() { return this.url; }
    async decode() {}
  }
  class Observer
  {
    constructor(callback) { this.callback = callback; }
    observe() {}
  }
  const document = {
    createElement() { const img = new Image(); loaders.push(img); return img; },
    addEventListener(name, callback) { events.set(name, callback); },
    querySelectorAll() { return []; },
  };
  const hooks = new Function('window', 'document', 'localStorage', 'navigator', 'HTMLImageElement',
    'ResizeObserver', 'IntersectionObserver', 'PerformanceObserver', 'queueMicrotask',
    `let active = true; const saveData = () => false;
    ${section}
    return { resize: thumbResizeObserver.callback, visibility: thumbVisibilityObserver.callback,
      enabled: thumbsEnabled, get failures() { return thumbFailures; } };`)(
      { devicePixelRatio: 1, ppixiv: { mediaCache: {
        getMediaInfoSync: () => ({ width: 2000, height: 1000 }), getImageDimensions: (info) => info,
      } } }, document, { getItem: (key) => storage.get(key) ?? null }, navigator,
      Image, Observer, Observer, Observer, (callback) => microtasks.push(callback));

  return {
    ...hooks, get failures() { return hooks.failures; }, requests, loaders, storage, navigator,
    create(id, currentWidth)
    {
      const box = { dataset: { id: `illust:${id}-0` }, origWidth: 100, origHeight: 50,
        currentWidth, currentHeight: currentWidth == null ? undefined : currentWidth / 2 };
      const img = new Image(box);
      img.src = `https://i.pximg.net/c/540x540_70/img-master/${id}_master1200.jpg`;
      return img;
    },
    fail(img) { events.get('error')({ target: img }); },
    resize(img) { hooks.resize([{ target: img, contentRect: { width: 900, height: 450 } }]); },
    enter(img) { hooks.visibility([{ target: img, isIntersecting: true,
      boundingClientRect: { width: 900, height: 450 } }]); },
    flush() { while(microtasks.length) microtasks.shift()(); },
  };
}

// ppixiv rebuilds thumbnails when the size slider or manga expansion changes.
const repeated = runtime();
const first = repeated.create(123);
assert.match(first.src, /600x1200_90_webp/);
repeated.fail(first);
assert.match(first.src, /540x540_70/);
for(let i = 0; i < 5; ++i)
{
  const rebuilt = repeated.create(123);
  assert.match(rebuilt.src, /540x540_70/, 'a failed URL stays on the original thumbnail');
  repeated.resize(rebuilt);
  repeated.enter(rebuilt);
}
assert.equal(repeated.failures, 1);
assert.equal(repeated.loaders.length, 0);
assert.equal(repeated.enabled(), true);
console.log('ok   Rebuilt thumbnails retain failures without increasing the failure count');

// Online failures count once for each URL.  Offline failures still use the fallback.
const distinct = runtime();
const existing = distinct.create(999);
for(let id = 0; id < 5; ++id)
  distinct.fail(distinct.create(id));
assert.equal(distinct.failures, 5);
assert.equal(distinct.enabled(), false);
const requestsBefore = distinct.requests.length;
distinct.resize(existing);
distinct.enter(existing);
distinct.flush();
assert.equal(distinct.requests.length, requestsBefore, 'disabled hooks must not start upgrades');
assert.match(distinct.create(1000).src, /540x540_70/);
console.log('ok   Five distinct failures stop upgrades for existing and new thumbnails');

const offline = runtime();
offline.navigator.onLine = false;
offline.fail(offline.create(1));
assert.equal(offline.failures, 0);
assert.match(offline.create(1).src, /540x540_70/);
assert.equal(offline.enabled(), true);
console.log('ok   Offline failures fall back without counting towards global disablement');

// An upgrade that finishes after disablement must not replace the displayed image.
const pending = runtime();
const target = pending.create(999);
pending.resize(target);
assert.equal(pending.loaders.length, 1);
const original = target.src;
for(let id = 0; id < 5; ++id)
  pending.fail(pending.create(id));
await pending.loaders[0].onload();
assert.equal(target.src, original);
console.log('ok   An in-flight upgrade cannot replace an image after disablement');

const deferred = runtime();
const queued = deferred.create(1, 900);
const initial = queued.src;
deferred.storage.set('ppx-zh-thumb-quality', 'off');
deferred.flush();
deferred.resize(queued);
assert.equal(queued.src, initial);
assert.equal(deferred.loaders.length, 0);
console.log('ok   Turning quality off also stops deferred layout and observer upgrades');
