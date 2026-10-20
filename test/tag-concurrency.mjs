// Exercise the Chinese wrapper with two independent tabs sharing transactional storage.
// The original upstream-class compatibility tests remain in tag-translations.mjs.
import assert from 'node:assert/strict';
import fs from 'node:fs';

const src = fs.readFileSync(process.argv[2] ?? new URL('../src/main.js', import.meta.url), 'utf8');
const section = src.slice(src.indexOf('const TAG_LANGUAGE_KEY ='), src.indexOf('// Pixiv\'s tag autocomplete'));
const clone = (value) => value == null ? value : structuredClone(value);
const tick = () => new Promise((resolve) => setImmediate(resolve));

class SharedStorage
{
    rows = new Map();
    tail = Promise.resolve();
    reads = 0;
    atomicTransactions = 0;
    failWrites = false;

    // Separate reads snapshot before either tab starts a later write.  This is the race
    // the old wrapper allowed; a serialized write alone doesn't make that snapshot current.
    async multiGet(keys)
    {
        ++this.reads;
        await this.tail;
        return keys.map((key) => clone(this.rows.get(key)));
    }

    async multiSet(data, { overwrite = true } = {})
    {
        const before = this.tail;
        this.tail = before.then(() => {
            if(this.failWrites)
                throw new Error('write failed');
            for(const [key, value] of Object.entries(data))
                if(overwrite || !this.rows.has(key))
                    this.rows.set(key, clone(value));
        });
        const result = this.tail;
        this.tail = result.catch(() => {});
        return result;
    }

    // A minimal IDB transaction model: all requests use one snapshot, readwrite
    // transactions serialize, success callbacks can enqueue requests, and abort rolls back.
    getStore()
    {
        ++this.atomicTransactions;
        const before = this.tail;
        let release;
        this.tail = new Promise((resolve) => release = resolve);
        const transaction = {};
        const requests = [];
        const enqueue = (type, key, value) => {
            const request = {};
            requests.push({ type, key, value, request });
            return request;
        };
        before.then(() => {
            const rows = new Map([...this.rows].map(([key, value]) => [key, clone(value)]));
            const run = () => {
                const op = requests.shift();
                if(op == null)
                {
                    this.rows = rows;
                    transaction.oncomplete?.();
                    release();
                    return;
                }
                if(op.type == 'put' && this.failWrites)
                {
                    transaction.error = new Error('write failed');
                    transaction.onabort?.();
                    release();
                    return;
                }
                if(op.type == 'get')
                    op.request.result = clone(rows.get(op.key));
                else
                    rows.set(op.key, clone(op.value));
                op.request.onsuccess?.();
                queueMicrotask(run);
            };
            queueMicrotask(run);
        });
        return {
            transaction,
            get: (key) => enqueue('get', key),
            put: (value, key) => enqueue('put', key, value),
        };
    }
}

function channels()
{
    const all = [];
    return class {
        constructor() { all.push(this); }
        postMessage(data)
        {
            for(const other of all)
                if(other != this)
                    queueMicrotask(() => other.onmessage?.({ data }));
        }
    };
}

function tab(shared, BroadcastChannel = null, { unavailable = false, now = () => Date.now() } = {})
{
    let language = 'zh';
    const _db = {
        dbOp: async (func) => unavailable ? null : await func({}),
        getStore: () => shared.getStore(),
        multiGet: async (keys) => unavailable ? {} : await shared.multiGet(keys),
        multiSet: async (data, options) => unavailable ? undefined : await shared.multiSet(data, options),
    };
    const tt = {
        _db, _cache: new Map(), enabled: true,
        async addTranslations(tags, options = {}) {
            const data = {};
            for(const tag of tags) {
                data[tag.tag] = tag;
                if(tag.translation?.en && (options.overwrite !== false || !this._cache.has(tag.tag)))
                    this._cache.set(tag.tag, tag.translation.en);
            }
            await this._db.multiSet(data, options);
        },
        async getTagInfo(tags) {
            const records = await this._db.multiGet(tags);
            return Object.fromEntries(tags.map((tag, i) => [tag, records[i]]));
        },
        async getTranslations(tags) {
            const info = await this.getTagInfo(tags);
            return Object.fromEntries(tags.map((tag) => [tag, info[tag]?.translation?.en ?? this._cache.get(tag)]));
        },
        async getTranslation(tag) {
            return this._cache.get(tag) ?? (await this.getTranslations([tag]))[tag] ?? tag;
        },
    };
    new Function('window', 'localStorage', 'Date', section + '\nsetupChineseTags();')(
        { ppixiv: { tagTranslations: tt }, BroadcastChannel },
        { getItem: () => language },
        { now },
    );
    return { tt, setLanguage: (value) => language = value };
}

{
    const shared = new SharedStorage();
    shared.rows.set('ブルーアーカイブ', { tag: 'ブルーアーカイブ', translation: { en: 'Blue Archive' } });
    const Channel = channels();
    const a = tab(shared, Channel), b = tab(shared, Channel);
    await Promise.all([
        a.tt.addTranslations([{ tag: 'ブルーアーカイブ', translation: { zh: '碧蓝档案' } }]),
        b.tt.addTranslations([{ tag: 'ブルーアーカイブ', translation: { en: 'Blue Archive' } }]),
    ]);
    await tick();
    assert.equal(shared.rows.get('ブルーアーカイブ').translation.zh, '碧蓝档案');
    assert.equal(await a.tt.getTranslation('ブルーアーカイブ'), '碧蓝档案');
    assert.equal(await b.tt.getTranslation('ブルーアーカイブ'), '碧蓝档案');
    assert.equal(shared.atomicTransactions, 2);
    console.log('ok   Independent tabs atomically merge Chinese and English updates');
}

{
    const shared = new SharedStorage(), Channel = channels();
    const a = tab(shared, Channel), b = tab(shared, Channel);
    await a.tt.addTranslations([{ tag: 'girl', translation: { en: 'girl', zh: '女孩' } }]);
    await tick();
    shared.reads = 0;
    for(let i = 0; i < 100; ++i)
        assert.equal(await a.tt.getTranslation('girl'), '女孩');
    assert.equal(shared.reads, 0);
    assert.equal(await b.tt.getTranslation('girl'), '女孩');
    await a.tt.addTranslations([{ tag: 'girl', translation: { zh: '少女' } }]);
    await tick();
    assert.equal(await b.tt.getTranslation('girl'), '少女');
    a.setLanguage('en');
    assert.equal(await a.tt.getTranslation('girl'), 'girl');
    a.setLanguage('zh');
    assert.equal(await a.tt.getTranslation('girl'), '少女');
    console.log('ok   Hot Chinese lookups avoid DB reads and other tabs invalidate cached translations');
}

{
    const shared = new SharedStorage();
    let time = 0;
    const a = tab(shared, null, { now: () => time });
    await a.tt.addTranslations([{ tag: 'girl', translation: { zh: '女孩' } }]);
    shared.rows.set('girl', { tag: 'girl', translation: { zh: '少女' } });
    time = 30001;
    assert.equal(await a.tt.getTranslation('girl'), '少女');
    console.log('ok   Cached translations expire without BroadcastChannel');
}

{
    const shared = new SharedStorage();
    const a = tab(shared);
    await a.tt.addTranslations([
        { tag: 'girl', translation: { zh: '女孩' } },
        { tag: 'girl', translation: { en: 'girl' }, romaji: 'girl' },
    ]);
    assert.deepEqual(shared.rows.get('girl'), { tag: 'girl', translation: { zh: '女孩', en: 'girl' }, romaji: 'girl' });
    await a.tt.addTranslations([{ tag: 'girl', translation: { zh: '不应替换' } }], { pzOnlyMissingZh: true });
    assert.equal(await a.tt.getTranslation('girl'), '女孩');
    shared.failWrites = true;
    await assert.rejects(a.tt.addTranslations([{ tag: 'girl', translation: { zh: '失败' } }]), /write failed/);
    assert.equal(shared.rows.get('girl').translation.zh, '女孩');
    shared.failWrites = false;
    await a.tt.addTranslations([{ tag: 'girl', translation: { zh: '少女' } }]);
    assert.equal(await a.tt.getTranslation('girl'), '少女');
    console.log('ok   Duplicate tags merge within a transaction; aborted writes roll back and later writes recover');
}

{
    const shared = new SharedStorage();
    const a = tab(shared, null, { unavailable: true });
    await a.tt.addTranslations([{ tag: 'girl', translation: { zh: '女孩' } }]);
    await a.tt.addTranslations([{ tag: 'girl', translation: { en: 'girl' } }]);
    assert.equal(await a.tt.getTranslation('girl'), '女孩');
    a.setLanguage('en');
    assert.equal(await a.tt.getTranslation('girl'), 'girl');
    console.log('ok   Unavailable IndexedDB preserves session translations and upstream English fallback');
}
