// Tampermonkey runs this in the page world, alongside ppixiv.  ppixiv replaces setTimeout, fetch
// and createElement there, and createElement("style") throws, so nothing here may use them.

const ON_CLASS = "ppx-zh";
const ATTRS = ["data-popup", "title", "placeholder", "aria-label"];
const DEBUG = typeof PZ_DEBUG != "undefined" && PZ_DEBUG;
const missing = new Map();

const normalize = (s) => s.replace(/\s+/g, " ").trim();

function translateString(raw)
{
    const key = normalize(raw);
    if(!key || !/[A-Za-z]/.test(key))
        return null;
    if(Object.hasOwn(DICT, key))
        return DICT[key];
    for(const [re, replacement] of PATTERNS)
        if(re.test(key))
            return key.replace(re, replacement);
    return null;
}

// ppixiv's elements all carry the "widget" class.  Anything outside one belongs to Pixiv or to
// other extensions sharing the page (Powerful Pixiv Downloader, UTags), so leave it alone.
// text is the normalized text being translated, or null for attributes.
function isSkipped(element, text = null)
{
    if(element == null || element.closest(".widget") == null || element.closest(ICON_SELECTOR) != null)
        return true;
    if(element.closest(TAG_BUTTON_LABEL_SELECTOR) != null)
        return !TAG_BUTTON_LABELS.has(text);
    if(element.closest(ALLOW_SELECTOR) != null)
        return false;
    return element.closest(SKIP_SELECTOR) != null || showsUserContent(element);
}

// User content in elements that also show UI text, depending on state.
function showsUserContent(element)
{
    // The image viewer's error text is the muted tag or user name when "Muted:" is shown next
    // to it, and an error message otherwise.
    const errorText = element.closest(".viewer-error .error-text");
    if(errorText != null)
        return errorText.parentElement.querySelector(".muted-label")?.hidden === false;

    // The mobile info dialog's header is the work's title.  The "More" dialog shares the class.
    const header = element.closest(".mobile-illust-ui-dialog .header-text");
    return header != null && header.closest(".mobile-illust-ui-dialog").querySelector(".mobile-image-info") != null;
}

function translateTextNode(node)
{
    const text = node.nodeValue;
    if(!text || !/[A-Za-z]/.test(text) || isSkipped(node.parentElement, normalize(text)))
        return;

    const translated = translateString(text);
    if(translated == null)
    {
        if(DEBUG && /[A-Za-z]{2}/.test(text))
            noteMissing(normalize(text), node.parentElement);
        return;
    }

    // Keep the surrounding whitespace so inline layout doesn't change.
    const [, lead, , trail] = text.match(/^(\s*)([\s\S]*?)(\s*)$/);
    const result = lead + translated + trail;
    if(result != text)
        node.nodeValue = result;
}

function translateAttributes(element)
{
    if(!ATTRS.some((name) => element.hasAttribute(name)) || isSkipped(element))
        return;
    for(const name of ATTRS)
    {
        const value = element.getAttribute(name);
        if(!value)
            continue;
        const translated = translateString(value);
        if(translated != null && translated != value)
            element.setAttribute(name, translated);
        else if(translated == null && DEBUG && /[A-Za-z]{2}/.test(value))
            noteMissing(`[${name}] ${normalize(value)}`, element);
    }
}

// ppixiv's checkbox is a Material icon whose text is "check_box" or "check_box_outline_blank".
// Mirror that into an attribute so CSS can draw a switch.
function syncCheckbox(element)
{
    const on = element.textContent.trim() == "check_box" ? "1" : "0";
    if(element.dataset.pzOn != on)
        element.dataset.pzOn = on;
}

function processTree(root)
{
    if(root.nodeType == Node.TEXT_NODE)
    {
        translateTextNode(root);
        return;
    }
    if(root.nodeType != Node.ELEMENT_NODE && root.nodeType != Node.DOCUMENT_FRAGMENT_NODE)
        return;

    if(root.nodeType == Node.ELEMENT_NODE)
        processElement(root);

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
            if(node.nodeType == Node.ELEMENT_NODE)
            {
                const tag = node.tagName;
                if(tag == "SCRIPT" || tag == "STYLE" || tag == "svg")
                    return NodeFilter.FILTER_REJECT;
            }
            return NodeFilter.FILTER_ACCEPT;
        },
    });

    for(let node = walker.nextNode(); node; node = walker.nextNode())
    {
        if(node.nodeType == Node.TEXT_NODE)
            translateTextNode(node);
        else
            processElement(node);
    }
}

function processElement(element)
{
    translateAttributes(element);
    if(element.classList.contains("checkbox"))
        syncCheckbox(element);
    else if(element.tagName == "IMG" && thumbStates.has(element))
        watchThumb(element);
    else if(element.classList.contains("thumbnail-box"))
        markSeenThumb(element);
}

function noteMissing(text, element)
{
    // Already-translated strings can still contain Latin text, like "返回 Pixiv".
    if(missing.has(text) || /[\u3040-\u30ff\u4e00-\u9fff]/.test(text))
        return;
    const where = [];
    for(let e = element; e && e != document.body && where.length < 4; e = e.parentElement)
        where.push(e.tagName.toLowerCase() + (e.classList.length ? "." + [...e.classList].join(".") : ""));
    missing.set(text, where.join(" < "));
}

// ------------------------------------------------------------------ activation

let active = false;
let themeSheet = null;

function ppixivIsRunning()
{
    return document.querySelector("head > style#main") != null &&
        document.querySelector(".screen-search-container, .screen-illust-container") != null;
}

// Use a constructed stylesheet.  It doesn't go through createElement, and adopted sheets come
// after all of the document's own stylesheets in the cascade, so equal-specificity rules
// resolve in our favor.  Safari before 16.4 can't construct stylesheets, so it gets a <style>
// element kept after the other stylesheets in <head> instead.  ppixiv's createElement refuses to create one, but
// it keeps the original as realCreateElement.
let themeStyle = null;

function ensureStyle()
{
    if(themeSheet == null && themeStyle == null)
    {
        try {
            const sheet = new CSSStyleSheet();
            sheet.replaceSync(THEME_CSS);
            if(!Array.isArray(document.adoptedStyleSheets))
                throw new Error("no adoptedStyleSheets");
            themeSheet = sheet;
        } catch(e) {
            themeStyle = (document.realCreateElement ?? document.createElement).call(document, "style");
            themeStyle.textContent = THEME_CSS;
        }
    }

    if(themeSheet != null)
    {
        if(!document.adoptedStyleSheets.includes(themeSheet))
            document.adoptedStyleSheets = [...document.adoptedStyleSheets, themeSheet];
        return;
    }

    // Move it only when a stylesheet comes after it.  ppixiv replaces <title> on every work shown,
    // and moving the style each time would re-parse it and restyle the page.
    let next = themeStyle.isConnected ? themeStyle.nextElementSibling : null;
    while(next != null && next.tagName != "STYLE" && !(next.tagName == "LINK" && next.rel == "stylesheet"))
        next = next.nextElementSibling;
    if(!themeStyle.isConnected || next != null)
        document.head.append(themeStyle);
}

// Run each feature on its own, so one that throws, for example after a ppixiv update, can't
// stop the others or the translation.  Each feature's first error is logged.
const failedSetups = new Set();

function runSetup(setup)
{
    try {
        setup();
    } catch(e) {
        if(!failedSetups.has(setup))
        {
            failedSetups.add(setup);
            console.error("ppixiv-zh:", setup.name, e);
        }
    }
}

// ------------------------------------------------------------------ bookmark + download button

// The "bookmark tags" button in the popup menu is replaced with one that bookmarks the image and
// downloads the original.  Both go through ppixiv's own hotkey handler, so bookmark privacy follows
// the "bookmark privately" setting and files are named the same way as ppixiv's own downloads.
const BOOKMARK_DOWNLOAD_ICON = `
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
    <path d="M12 20.5 4.6 13.3a4.6 4.6 0 0 1 6.5-6.5l.9.9.9-.9a4.6 4.6 0 0 1 6.5 6.5" fill="currentColor" fill-opacity=".22"/>
    <path d="M17.5 12.5v8"/>
    <path d="m14.4 17.6 3.1 3.1 3.1-3.1"/>
</svg>`;

function setupBookmarkDownloadButton()
{
    const button = document.querySelector(".popup-context-menu .button-bookmark-tags");
    if(button == null || button.classList.contains("pz-bookmark-download"))
        return;

    button.classList.add("pz-bookmark-download");
    button.dataset.popup = "收藏并下载原图";
    button.innerHTML = BOOKMARK_DOWNLOAD_ICON;
}

function bookmarkAndDownload()
{
    const ppixiv = window.ppixiv;
    const menu = ppixiv?.app?._contextMenu;
    if(typeof menu?._handleKeyEventForImage != "function")
    {
        ppixiv?.message?.show("收藏并下载失败：这个版本的 ppixiv 不支持");
        return;
    }

    // ppixiv checks Ctrl or Cmd depending on the hotkey modifier setting, so set both.
    const fakeKey = (key, altKey) => ({
        key, code: "Key" + key.toUpperCase(),
        ctrlKey: true, metaKey: true, altKey, shiftKey: false, repeat: false,
        preventDefault() {}, stopPropagation() {},
    });

    // Ctrl+B bookmarks with the default privacy, and does nothing if already bookmarked.
    menu._handleKeyEventForImage(fakeKey("b", false));

    // Ctrl+Alt+S downloads a ZIP of every page for multi-page posts, the original image for
    // single images, and an MKV for animations.
    menu._handleKeyEventForImage(fakeKey("s", true));
}

// ppixiv cancels the browser's own clicks inside the popup menu and dispatches its own
// (misc/fix-chrome-clicks.js), so one press reaches us twice.  Act on the first one only.
let lastBookmarkDownload = 0;

document.addEventListener("click", (e) => {
    if(!active || !e.target.closest?.(".popup-context-menu .pz-bookmark-download"))
        return;

    // Keep ppixiv's bookmark tag dropdown from opening.
    e.preventDefault();
    e.stopImmediatePropagation();

    const now = performance.now();
    if(now - lastBookmarkDownload < 500)
        return;
    lastBookmarkDownload = now;
    bookmarkAndDownload();
}, true);

// ------------------------------------------------------------------ similar works button

// The like button in the popup menu is replaced with one that opens the similar works page, the
// same page as "Similar illustrations" in the "more" menu.  ppixiv keeps setting the like
// button's tooltip, so it's set back on every mutation batch.
const SIMILAR_LABEL = "相似作品";
const SIMILAR_ICON = `
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
    <path d="M8 4h9.5A2.5 2.5 0 0 1 20 6.5V16"/>
    <rect x="3.5" y="7.5" width="12.5" height="12.5" rx="2.5" fill="currentColor" fill-opacity=".22"/>
    <circle cx="7.6" cy="11.6" r="1.3"/>
    <path d="m4 18.5 4-4 3 3 1.5-1.5 3 3"/>
</svg>`;

function setupSimilarButton()
{
    const button = document.querySelector(".popup-context-menu .button-like");
    if(button == null)
        return;

    if(!button.classList.contains("pz-similar"))
    {
        button.classList.add("pz-similar");
        button.innerHTML = SIMILAR_ICON;
    }
    if(button.dataset.popup != SIMILAR_LABEL)
        button.dataset.popup = SIMILAR_LABEL;
}

function showSimilarWorks()
{
    const ppixiv = window.ppixiv;
    const menu = ppixiv?.app?._contextMenu;
    const mediaId = menu?._effectiveMediaId ?? ppixiv?.app?.displayedMediaId;

    // Media IDs look like "illust:12345-0".  Users and local files have no similar works page.
    const illustId = /^illust:(\d+)/.exec(mediaId ?? "")?.[1];
    if(illustId == null || ppixiv?.phistory == null)
    {
        ppixiv?.message?.show("这里没有可以查找相似作品的作品");
        return;
    }

    menu?.hide?.();

    // This is what ppixiv's helpers.navigate does, which isn't reachable from outside the bundle.
    // Like navigate, don't add a history entry when we're already there.
    const url = new URL(`/bookmark_detail.php?illust_id=${illustId}#ppixiv?recommendations=1`, location.href);
    if(String(ppixiv.plocation ?? location) == url.toString())
        return;
    ppixiv.phistory.pushState({}, "", url.toString());
    const popstate = new PopStateEvent("pp:popstate");
    popstate.navigationCause = "navigation";
    popstate.scrollToTop = false;
    window.dispatchEvent(popstate);
    window.dispatchEvent(new PopStateEvent("pp:statechange"));
}

// Clicks arrive twice here too, see lastBookmarkDownload.
let lastSimilar = 0;

document.addEventListener("click", (e) => {
    if(!active || !e.target.closest?.(".popup-context-menu .pz-similar"))
        return;

    // Keep ppixiv's like handler from liking the image.
    e.preventDefault();
    e.stopImmediatePropagation();

    const now = performance.now();
    if(now - lastSimilar < 500)
        return;
    lastSimilar = now;
    showSimilarWorks();
}, true);

// ------------------------------------------------------------------ no fullscreen on double-click

// ppixiv toggles browser fullscreen when an image is double-clicked, with no setting to turn it
// off.  Stop the event before it reaches the image view (.view-container, where ppixiv listens).
// The info box beside it has its own double-click actions, like the avatar opening the user's
// works.  The image editors use double-clicks themselves, so leave those alone.  On mobile
// (including iPads) ppixiv uses double-tap to zoom instead of fullscreen, so leave that alone too.
document.addEventListener("dblclick", (e) => {
    if(!active || document.documentElement.classList.contains("mobile"))
        return;
    if(!e.target.closest?.(".screen-illust-container .view-container"))
        return;
    if(e.target.closest(".crop-editor-overlay, .inpaint-editor-overlay, .pan-editor-overlay, .video-ui"))
        return;
    e.stopPropagation();
}, true);

// ------------------------------------------------------------------ feed filters

// Pixiv's recommendation, following and bookmark APIs can't filter by work type.  The results are
// filtered here before ppixiv sees them, so ppixiv lays out only the works that are kept.  ppixiv
// makes every request through window.realFetch, which is looked up on each call.
const TYPE_FILTERS = [
    ["all", "全部类型", "显示所有类型的作品"],
    ["illust", "插画", "只显示插画和动图"],
    ["manga", "漫画", "只显示漫画"],
];

// typeKey is where the feed's type is saved, and dataSource is ppixiv's name for the page its
// buttons go on.  pageParam is the query parameter that pages through the feed.  The
// recommendations have none, since every request returns different works.
const FEEDS = {
    discovery: { typeKey: "ppx-zh-discovery-type", dataSource: "discovery", pageParam: null },
    following: { typeKey: "ppx-zh-following-type", dataSource: "new_works_by_following", pageParam: "p" },
    bookmarks: { typeKey: "ppx-zh-bookmarks-type", dataSource: "bookmarks", pageParam: "offset" },
};

// The other filters on the recommended works page, saved as JSON.  A filter is off when missing.
const DISCOVERY_FILTERS_KEY = "ppx-zh-discovery-filters";
const DISCOVERY_FILTERS = [
    ["shape", "portrait", "竖图", "只显示高大于宽的作品"],
    ["shape", "landscape", "横图", "只显示宽大于高的作品"],
    ["pages", "single", "单页", "只显示单页作品"],
    ["pages", "multi", "多页", "只显示多页作品"],
    ["hideAi", true, "隐藏 AI", "隐藏 AI 生成的作品"],
    ["hideBookmarked", true, "隐藏已收藏", "隐藏已经收藏的作品"],
    ["hideSeen", true, "隐藏看过的", "隐藏在看图界面打开过的作品"],
];

// ppixiv treats an empty page as the end of the results and stops loading.  If a page has nothing
// that passes the filters, ask for more, up to this many requests in total.
const FEED_MAX_REQUESTS = 4;
const FEED_RETRY_DELAY_MS = 500;

function feedType(feed)
{
    const type = localStorage.getItem(FEEDS[feed].typeKey);
    return TYPE_FILTERS.some(([key]) => key == type) ? type : "all";
}

function discoveryFilters()
{
    let saved = null;
    try {
        saved = JSON.parse(localStorage.getItem(DISCOVERY_FILTERS_KEY));
    } catch(e) {
    }
    const filters = {};
    for(const [name, value] of DISCOVERY_FILTERS)
        if(saved?.[name] === value)
            filters[name] = value;
    return filters;
}

// A string that changes whenever the feed's filters change.
function feedFilterSignature(feed)
{
    return JSON.stringify([feedType(feed), feed == "discovery" ? discoveryFilters() : null]);
}

// Return a function that says whether to keep a work from the feed, or null if nothing is
// filtered.  Works are thumbnail data as Pixiv returns it.
function feedFilter(feed)
{
    const checks = [];
    const type = feedType(feed);
    // illustType: 0 is an illustration, 1 is manga, 2 is an animation.
    if(type == "manga")
        checks.push((work) => work.illustType == 1);
    else if(type == "illust")
        checks.push((work) => work.illustType != 1);

    const filters = feed == "discovery" ? discoveryFilters() : {};
    if(filters.shape == "portrait")
        checks.push((work) => work.height > work.width);
    else if(filters.shape == "landscape")
        checks.push((work) => work.width > work.height);
    if(filters.pages == "single")
        checks.push((work) => work.pageCount == 1);
    else if(filters.pages == "multi")
        checks.push((work) => work.pageCount > 1);
    // aiType is 2 for AI-generated works, 1 for other works and 0 for works older than the field.
    if(filters.hideAi)
        checks.push((work) => work.aiType != 2);
    if(filters.hideBookmarked)
        checks.push((work) => work.bookmarkData == null);
    if(filters.hideSeen)
        checks.push((work) => !seenWorks.has(String(work.id)));
    return checks.length == 0 ? null : (work) => checks.every((check) => check(work));
}

// What the "nothing found" message calls the works it looked for.
function feedFilterLabel(feed)
{
    if(feed == "discovery" && Object.keys(discoveryFilters()).length > 0)
        return "符合筛选条件的作品";
    return TYPE_FILTERS.find(([key]) => key == feedType(feed))[1];
}

// Shuffled bookmarks load their pages in random order, so the pages skipped for one can't be
// continued from in the next.  They aren't filtered.
const bookmarksShuffled = () => /[#?&]shuffle(?:[=&]|$)/.test((window.ppixiv?.plocation ?? location).hash ?? "");

// Return the feed a request belongs to, or null if it isn't filtered.
function feedForRequest(url)
{
    // The similar works page uses the recommendations API with sampleIllustId.  The filters are
    // only shown on the recommended works page.
    if(url.pathname == "/ajax/discovery/artworks")
        return url.searchParams.has("sampleIllustId") ? null : "discovery";
    if(url.pathname == "/ajax/follow_latest/illust")
        return "following";
    if(/^\/ajax\/user\/\d+\/illusts\/bookmarks$/.test(url.pathname))
        return bookmarksShuffled() ? null : "bookmarks";
    return null;
}

const feedWorks = (feed, json) => feed == "bookmarks" ? json?.body?.works : json?.body?.thumbnails?.illust;

function setFeedWorks(feed, json, works)
{
    if(feed == "bookmarks")
        json.body.works = works;
    else
        json.body.thumbnails.illust = works;
}

// For paged feeds, the pages of the feed that were requested for each of ppixiv's pages, as
// { low, high, seq, end }.  When pages with nothing to keep are skipped, ppixiv's next page
// continues after them.  seq says which page was loaded most recently, and end is true when the
// last page requested was empty, the end of the feed.  Keyed by the request without its
// page and language, the filters, and for bookmarks whether public and private are shown
// together.  They're kept in sessionStorage, so reloading a page that starts from the page in
// the URL starts where that page was.
const FEED_PAGES_KEY = "ppx-zh-feed-pages";
const FEED_PAGES_LIMIT = 20; // feeds remembered per tab

function readFeedPagesStorage()
{
    try {
        const saved = JSON.parse(sessionStorage.getItem(FEED_PAGES_KEY));
        return saved != null && typeof saved == "object" && !Array.isArray(saved) ? saved : {};
    } catch(e) {
        return {};
    }
}

// Entries that aren't in the expected form, which other code could have written, are skipped.
function loadFeedPages(key)
{
    const entries = readFeedPagesStorage()[key];
    const valid = ([page, range]) => Number.isInteger(page) && page >= 1 &&
        Number.isInteger(range?.low) && Number.isInteger(range?.high) && Number.isInteger(range?.seq) &&
        range.low >= 1 && range.low <= range.high && (range.end === undefined || range.end === true);
    return new Map(Array.isArray(entries) ? entries.filter((entry) => Array.isArray(entry) && valid(entry)) : []);
}

// Add one page to the saved pages.  This reads them again rather than writing back a copy from
// when the request started, since another data source may have saved pages in the meantime.
function saveFeedPage(key, page, low, high, end)
{
    const pages = loadFeedPages(key);
    const seq = Math.max(0, ...[...pages.values()].map((range) => range.seq)) + 1;
    pages.set(page, end ? { low, high, seq, end } : { low, high, seq });

    // Move the feed to the end, and drop the ones used longest ago.
    const saved = readFeedPagesStorage();
    delete saved[key];
    saved[key] = [...pages];
    const keys = Object.keys(saved);
    for(const old of keys.slice(0, Math.max(0, keys.length - FEED_PAGES_LIMIT)))
        delete saved[old];
    try {
        sessionStorage.setItem(FEED_PAGES_KEY, JSON.stringify(saved));
    } catch(e) {
    }
}

// Return how to page through a paged feed: the feed's page to start from, a step of -1 if it's
// above the pages ppixiv has, the page ppixiv asked for, urlFor(page) to request one of the
// feed's pages, and done(page, end) to call with the last page requested and whether it was
// empty.  Returns null for feeds that aren't paged.  source is ppixiv's data source that made the
// request.
function feedPaging(feed, url, signature, source)
{
    const param = FEEDS[feed].pageParam;
    if(param == null)
        return null;

    // "p" counts pages from 1, and "offset" counts works.
    const parsed = new URL(url, location.href);
    const limit = Math.max(1, Math.floor(Number(parsed.searchParams.get("limit"))) || 1);
    const page = param == "offset" ?
        Math.floor(Math.max(0, Number(parsed.searchParams.get("offset")) || 0) / limit) + 1 :
        Math.max(1, Math.floor(Number(parsed.searchParams.get("p"))) || 1);
    const key = new URL(parsed);
    key.searchParams.delete(param);
    key.searchParams.delete("lang");
    key.searchParams.sort();

    // Showing public and private bookmarks together sends the same requests as showing public
    // ones alone, but pages through them differently.
    const merged = typeof source?.requestBookmarkType == "function";
    const feedKey = key.toString() + " " + signature + (merged ? " merged" : "");

    // ppixiv makes a new data source when the feed is refreshed or the page is reloaded, and it
    // loads each page once per data source.  A page continues after the page before it when that
    // one was loaded more recently, as when scrolling down.  Otherwise a page that was loaded
    // before starts where it was, as after a refresh or a reload, and when loading upward through
    // pages that were seen before.  A page past the one where the feed ended starts from that
    // empty page again.  That happens with merged bookmarks, where the other side kept going and
    // the page was reloaded further down.  A page above the ones ppixiv has, when it started from
    // the page in the URL, gets the page just before.  Anything else starts from the same page of
    // the feed.
    const pages = loadFeedPages(feedKey);
    const before = pages.get(page - 1), known = pages.get(page), after = pages.get(page + 1);
    const ended = [...pages].filter(([endPage, range]) => range.end && endPage < page)
        .sort(([, a], [, b]) => b.seq - a.seq)[0]?.[1];
    let start = page, step = 1;
    if(before != null && (known == null || before.seq > known.seq))
        start = before.high + 1;
    else if(known != null)
        start = known.low;
    else if(ended != null)
        start = ended.high;
    else if(after != null)
    {
        start = Math.max(1, after.low - 1);
        step = -1;
    }

    return {
        start, step, page, merged,
        urlFor(feedPage) {
            const result = new URL(parsed);
            result.searchParams.set(param, param == "offset" ? (feedPage - 1) * limit : feedPage);
            return result.toString();
        },
        done(last, end = false) {
            saveFeedPage(feedKey, page, Math.min(start, last), Math.max(start, last), end);
        },
    };
}

// The filters a data source started with, so a change made elsewhere doesn't mix two sets of
// filters in one feed.  ppixiv keeps a data source for each view of a feed, such as R18 or
// private bookmarks, and reuses it when going back to that view, so a change made in another view
// or another tab only applies to the views loaded after it.  The buttons show the filters of the
// view on screen, and clicking one reloads it.  ppixiv makes a data source current before it
// loads anything, so the current one is the one making the request.
const feedFilterPins = new WeakMap(); // ppixiv data source -> { keep, signature, label, shown }

function feedFilterFor(feed)
{
    const source = window.ppixiv?.app?.currentDataSource;
    let filter = source != null ? feedFilterPins.get(source) : null;
    if(filter == null)
    {
        filter = {
            keep: feedFilter(feed), signature: feedFilterSignature(feed), label: feedFilterLabel(feed),
            shown: savedFeedFilters(feed),
        };
        if(source != null)
            feedFilterPins.set(source, filter);
    }
    return filter;
}

// The saved filters, as { type, filters }.  filters is empty except on the recommendations.
function savedFeedFilters(feed)
{
    return { type: feedType(feed), filters: feed == "discovery" ? discoveryFilters() : {} };
}

// The filters the view on screen was loaded with, or the saved ones if it hasn't loaded anything.
function shownFeedFilters(feed)
{
    const source = window.ppixiv?.app?.currentDataSource;
    const pin = source != null && source.name == FEEDS[feed].dataSource ? feedFilterPins.get(source) : null;
    return pin?.shown ?? savedFeedFilters(feed);
}

// For merged bookmarks, the pages where public or private bookmarks gave nothing: "end" when
// Pixiv had no more, "skipped" when nothing in FEED_MAX_REQUESTS pages passed the filters.  ended
// has the page where each side, "show" or "hide", ended.  ppixiv doesn't ask for that side again
// on later pages.
const mergedPagesWithoutWorks = new WeakMap(); // ppixiv data source -> { pages: Map of page -> "end" or "skipped", ended: Map of side -> page }

// filter is from feedFilterFor.
async function fetchFilteredFeed(fetchFunc, url, init, feed, filter)
{
    const source = window.ppixiv?.app?.currentDataSource;
    const paging = feedPaging(feed, url, filter.signature, source);

    // Batches can repeat works from earlier pages.  ppixiv drops works it already has, and a
    // page left empty ends the feed, so only new works count.  These feeds' media IDs are always
    // "illust:<id>-0" (ppixiv's util/media-id.js).
    const seen = new Set(source?.idList?.getAllMediaIds?.() ?? []);

    // ppixiv passes no abort signal, so notice when retrying stops helping: the user left the
    // page, or the feed was refreshed, which also happens when the filters change.  Opening a work
    // only changes the hash, and the page ppixiv keeps in "p".  Then stop retrying, so ppixiv's
    // next page doesn't wait for the retries.
    const where = () => {
        const url = window.ppixiv?.plocation ?? location;
        const search = new URLSearchParams(url.search);
        search.delete("p");
        return url.pathname + "?" + search;
    };
    const startedAt = where();
    const stale = () => where() != startedAt || window.ppixiv?.app?.currentDataSource !== source;

    // A page loaded above the ones ppixiv has, when it started from a page in the URL, isn't
    // retried.  If it has nothing to keep, it's given to ppixiv unfiltered, since an empty page
    // would stop ppixiv from loading the pages below it too.
    const maxRequests = paging?.step == -1 ? 1 : FEED_MAX_REQUESTS;
    let last = null, requests = 0;
    let feedPage = paging?.start;
    const kept = [];
    const tagTranslation = {};
    while(requests < maxRequests)
    {
        if(requests > 0)
        {
            if(stale())
                break;
            await new Promise((resolve) => later(resolve, FEED_RETRY_DELAY_MS));
            init?.signal?.throwIfAborted?.();
            if(stale())
                break;
            if(paging != null)
                ++feedPage;
        }

        ++requests;
        const response = await fetchFunc(paging?.urlFor(feedPage) ?? url, init);
        let json = null;
        try {
            json = response?.ok ? await response.clone().json() : null;
        } catch(e) {
        }

        // Give ppixiv the error, as it would get without the filter.  Earlier requests kept
        // nothing, or the loop would have stopped.
        const works = feedWorks(feed, json);
        if(!Array.isArray(works))
        {
            if(last != null)
                paging?.done(last.feedPage);
            return response;
        }

        last = { response, json, works, feedPage };
        Object.assign(tagTranslation, json.body.tagTranslation);
        for(const work of works)
        {
            // ppixiv drops deleted works from bookmarks.
            const mediaId = `illust:${work.id}-0`;
            if(work.isBookmarkable !== false && filter.keep(work) && !seen.has(mediaId))
            {
                seen.add(mediaId);
                kept.push(work);
            }
        }

        // An empty page of a paged feed is its end.
        if(kept.length > 0 || (paging != null && works.length == 0))
            break;
    }
    paging?.done(last.feedPage, paging != null && last.works.length == 0);

    // When retrying stopped early, give ppixiv the last batch unfiltered.  ppixiv keeps this data
    // source for when the user comes back, and an empty page would end its feed for good.  The
    // "no works" message would also show over the next page.
    if(kept.length == 0 && (stale() || maxRequests == 1))
        return last.response;

    const { response, json } = last;
    let works = kept;
    const skipped = kept.length == 0 && requests == FEED_MAX_REQUESTS && last.works.length > 0;
    let stopped = skipped;
    if(paging?.merged && kept.length == 0)
    {
        // ppixiv shows public and private bookmarks together by asking for a page of each.  An
        // empty page from one ends that one for good, and ppixiv stops loading when both pages
        // are empty.  When this one only ran out of works to keep, give ppixiv the last batch
        // marked as deleted instead.  ppixiv drops deleted bookmarks after noting that the page
        // wasn't empty, so this one keeps going.  The message is for when ppixiv stops.  The
        // other side gives nothing either when it ended on an earlier page.
        let merged = mergedPagesWithoutWorks.get(source);
        if(merged == null)
            mergedPagesWithoutWorks.set(source, merged = { pages: new Map(), ended: new Map() });
        const side = new URL(url, location.href).searchParams.get("rest");
        const otherEnded = merged.ended.get(side == "hide" ? "show" : "hide");
        const other = otherEnded < paging.page ? "end" : merged.pages.get(paging.page);
        merged.pages.set(paging.page, skipped ? "skipped" : "end");
        if(!skipped)
            merged.ended.set(side, Math.min(paging.page, merged.ended.get(side) ?? Infinity));
        stopped = other != null && (skipped || other == "skipped");
        if(skipped)
            works = last.works.map((work) => ({ ...work, isBookmarkable: false }));
    }

    if(stopped)
        window.ppixiv?.message?.show(paging == null ?
            `连续 ${FEED_MAX_REQUESTS} 次推荐里都没有新的${filter.label}，已停止加载。点刷新按钮可以重新获取。` :
            `接下来 ${FEED_MAX_REQUESTS} 页里都没有${filter.label}，已停止加载。`);

    setFeedWorks(feed, json, works);
    if(json.body.tagTranslation != null)
        json.body.tagTranslation = tagTranslation;
    return new Response(JSON.stringify(json), {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
    });
}

function setupFeedFilterButtons()
{
    const name = window.ppixiv?.app?.currentDataSource?.name;
    const feed = Object.keys(FEEDS).find((key) => FEEDS[key].dataSource == name);

    // The rows go inside the root of ppixiv's widget for the page, so they're removed with it.
    // Shuffled bookmarks aren't filtered, and ppixiv keeps its buttons when shuffling is turned
    // on, so remove ours then.
    const ui = document.querySelector(".screen-search-container .data-source-ui");
    const root = ui?.firstElementChild;
    const wanted = feed != null && !(feed == "bookmarks" && bookmarksShuffled());
    for(const row of ui?.querySelectorAll(".pz-type-filter, .pz-feed-filters") ?? [])
        if(!wanted || row.dataset.feed != feed || row.parentElement != root)
            row.remove();
    if(!wanted || root == null)
        return;
    if(root.querySelector(":scope > .pz-type-filter"))
    {
        // ppixiv keeps the widget of a view it goes back to, with the buttons as they were.
        if(window.ppixiv?.app?.currentDataSource !== feedFilterButtonsSource)
            refreshFeedFilterButtons();
        return;
    }

    const button = (filter, value, label, popup) =>
        `<a href="#" class="box-link popup" data-filter="${filter}" data-value="${value}" data-popup="${popup}"><span class="label">${label}</span></a>`;
    const buttonRows = [TYPE_FILTERS.map(([key, label, popup]) => button("type", key, label, popup))];
    if(feed == "discovery")
        buttonRows.push(DISCOVERY_FILTERS.map(([filter, value, label, popup]) => button(filter, value, label, popup)));

    buttonRows.forEach((buttons, i) => {
        const row = document.createElement("div");
        row.className = "box-button-row " + (i == 0 ? "pz-type-filter" : "pz-feed-filters");
        if(feed == "discovery" && i == 0)
            row.classList.add("pz-discovery-type");
        row.dataset.feed = feed;
        row.innerHTML = buttons.join("");
        root.append(row);

        row.addEventListener("click", (e) => {
            const button = e.target.closest(".box-link[data-filter]");
            if(button == null)
                return;
            e.preventDefault();
            e.stopPropagation();
            if(!changeFeedFilter(feed, button.dataset.filter, button.dataset.value))
                return;
            refreshFeedFilterButtons();

            // Reload the feed with the new filters.
            document.querySelector(".screen-search-container .refresh-search-button")?.click();
        });
    });
    refreshFeedFilterButtons();
}

// Change a filter of the view on screen, starting from the filters its buttons show, and save the
// result.  Return true if the filter changed.  The type always has one value selected.  The other
// filters turn off when clicked again.
function changeFeedFilter(feed, filter, value)
{
    const { type, filters } = shownFeedFilters(feed);
    let newType = type;
    const newFilters = { ...filters };
    if(filter == "type")
    {
        if(value == type)
            return false;
        newType = value;
    }
    else
    {
        const parsed = value == "true" ? true : value;
        if(newFilters[filter] === parsed)
            delete newFilters[filter];
        else
            newFilters[filter] = parsed;
    }

    localStorage.setItem(FEEDS[feed].typeKey, newType);
    if(feed == "discovery")
        localStorage.setItem(DISCOVERY_FILTERS_KEY, JSON.stringify(newFilters));

    // The view is reloaded with the new filters.  Drop its pin now, so the buttons show them before
    // the reload finishes.
    const source = window.ppixiv?.app?.currentDataSource;
    if(source != null)
        feedFilterPins.delete(source);
    return true;
}

let feedFilterButtonsSource = null; // the data source the buttons were last updated for

function refreshFeedFilterButtons()
{
    feedFilterButtonsSource = window.ppixiv?.app?.currentDataSource ?? null;
    const shown = {};
    for(const button of document.querySelectorAll(".pz-type-filter .box-link[data-filter], .pz-feed-filters .box-link[data-filter]"))
    {
        const feed = button.parentElement.dataset.feed;
        const { type, filters } = shown[feed] ??= shownFeedFilters(feed);
        const { filter, value } = button.dataset;
        const selected = filter == "type" ? value == type : String(filters[filter]) == value;
        button.classList.toggle("selected", selected);
    }
}

// The tag autocomplete, which isn't under /ajax/.
const AUTOCOMPLETE_PATH = "/rpc/cps.php";

// Return the request URL as a URL if it's a GET to Pixiv's own ajax API or the tag autocomplete,
// otherwise null.
function pixivAjaxUrl(url, init)
{
    if(typeof url != "string" && !(url instanceof URL))
        return null;
    if((init?.method ?? "GET").toUpperCase() != "GET")
        return null;
    try {
        const parsed = new URL(url, location.href);
        if(parsed.origin != location.origin)
            return null;
        return parsed.pathname.startsWith("/ajax/") || parsed.pathname == AUTOCOMPLETE_PATH ? parsed : null;
    } catch(e) {
        return null;
    }
}

// ppixiv sets realFetch once at startup, so the hook only needs installing once.  Checking
// pzHooked alone isn't enough: if another script wraps our hook, realFetch is its wrapper,
// and hooking that would run the filter twice, one inside the other.  pzHooked still stops a
// second installed copy of this script.
let fetchHookInstalled = false;

function installFetchHook()
{
    const realFetch = window.realFetch;
    if(fetchHookInstalled || typeof realFetch != "function" || realFetch.pzHooked)
        return;
    fetchHookInstalled = true;

    const hookedFetch = async function(url, init)
    {
        const ajaxUrl = pixivAjaxUrl(url, init);
        if(ajaxUrl == null)
            return await realFetch.call(this, url, init);

        const chinese = chineseTagsEnabled();
        if(chinese)
        {
            ajaxUrl.searchParams.set("lang", "zh");
            url = ajaxUrl.toString();
        }

        if(ajaxUrl.pathname == AUTOCOMPLETE_PATH)
        {
            const response = await realFetch.call(this, url, init);
            if(chinese)
                await rememberAutocompleteTranslations(response, ajaxUrl.searchParams.get("keyword"));
            return response;
        }

        const feed = feedForRequest(ajaxUrl);
        const filter = feed == null ? null : feedFilterFor(feed);
        if(filter?.keep == null)
            return await realFetch.call(this, url, init);

        // Hiding seen works needs the list of them.
        if(feed == "discovery")
            await loadSeenWorks();
        return await fetchFilteredFeed((u, i) => realFetch.call(this, u, i), url, init, feed, filter);
    };
    hookedFetch.pzHooked = true;
    window.realFetch = hookedFetch;
}

// ------------------------------------------------------------------ Chinese tag translations

// ppixiv only shows English tag translations: its requests ask for lang=en and it reads
// translation.en.  The fetch hook above asks Pixiv for lang=zh instead, and the wrappers below
// make ppixiv's TagTranslations prefer Chinese.
//
// ppixiv replaces a tag's stored translations each time it sees the tag, and the illust API only
// returns English, so a Chinese translation would be lost as soon as the work is opened.  The
// wrapper merges new translations into the stored ones instead.
const TAG_LANGUAGE_KEY = "ppx-zh-tag-language"; // "zh" (default) or "en" (ppixiv's own behavior)
const KANA_RE = /[぀-ヿ]/;
const HAN_RE = /[㐀-鿿]/;

// tag -> merged translations, for when IndexedDB is unavailable (Firefox private windows).
const sessionTagTranslations = new Map();

function chineseTagsEnabled()
{
    return localStorage.getItem(TAG_LANGUAGE_KEY) != "en";
}

function pickTagTranslation(tag, translation)
{
    const value = translation?.zh || translation?.zh_tw || translation?.en;
    if(!value || value == tag)
        return null;

    // Pixiv also "translates" tags that are already Chinese, or kanji-only Japanese, into
    // English, like 原神 to "Genshin Impact".  A Chinese reader is better off with the tag itself.
    if(HAN_RE.test(tag) && !KANA_RE.test(tag) && !HAN_RE.test(value))
        return null;
    return value;
}

// The wrappers stay installed when English is chosen, and pass lookups to ppixiv's own methods,
// so the choice takes effect without a reload.  Translations are still merged, so the Chinese ones
// are there when Chinese is chosen again.
function setupChineseTags()
{
    const tagTranslations = window.ppixiv?.tagTranslations;
    if(tagTranslations == null || tagTranslations.pzChinese)
        return;
    if(typeof tagTranslations.addTranslations != "function" || typeof tagTranslations.getTagInfo != "function" ||
        typeof tagTranslations._db?.multiGet != "function")
        return;
    tagTranslations.pzChinese = true;

    const { addTranslations, getTranslations, getTranslation } = tagTranslations;
    // Keep each read, merge and write together.  Search results and full work info can
    // arrive at once, so the next batch must wait for the previous write to finish.  With
    // pzOnlyMissingZh, which isn't passed on to ppixiv, tags that already have a Chinese
    // translation are left out, checked with the same read as the write.
    let pendingTranslations = Promise.resolve();
    tagTranslations.addTranslations = function(tagList, { pzOnlyMissingZh = false, ...options } = {})
    {
        const result = pendingTranslations.then(async () => {
            let stored = null;
            try {
                stored = await this._db.multiGet(tagList.map((tag) => tag.tag));
            } catch(e) {
            }

            if(pzOnlyMissingZh)
            {
                const missing = tagList.map((tag, i) => [tag, stored?.[i]]).filter(([tag, info]) =>
                    !info?.translation?.zh && !sessionTagTranslations.get(tag.tag)?.zh);
                if(missing.length == 0)
                    return;
                tagList = missing.map(([tag]) => tag);
                stored = missing.map(([, info]) => info);
            }

            const merged = tagList.map((tag, i) => {
                const translation = { ...(stored?.[i]?.translation ?? sessionTagTranslations.get(tag.tag)) };
                for(const [lang, value] of Object.entries(tag.translation ?? {}))
                    if(value)
                        translation[lang] = value;
                sessionTagTranslations.set(tag.tag, translation);
                return { ...tag, translation, romaji: tag.romaji ?? stored?.[i]?.romaji };
            });
            return await addTranslations.call(this, merged, options);
        });
        // Return the error to this caller without blocking later batches.
        pendingTranslations = result.catch(() => {});
        return result;
    };

    // ppixiv always asks for "en".  Answer with Chinese when there is one.
    tagTranslations.getTranslations = async function(tags, ...args)
    {
        if(!chineseTagsEnabled())
            return await getTranslations.call(this, tags, ...args);
        if(!this.enabled)
            return {};

        await pendingTranslations;
        const info = await this.getTagInfo(tags);
        const result = {};
        for(const tag of tags)
        {
            const value = pickTagTranslation(tag, info[tag]?.translation ?? sessionTagTranslations.get(tag));
            if(value != null)
                result[tag] = value;
        }
        return result;
    };

    tagTranslations.getTranslation = async function(tag, ...args)
    {
        if(!chineseTagsEnabled())
            return await getTranslation.call(this, tag, ...args);
        const result = await this.getTranslations([tag]);
        return result[tag] ?? tag;
    };
}

// Pixiv's tag autocomplete only matches translations when the request names a language, and
// ppixiv sends none.  With lang=zh, typing 碧蓝 also suggests アズールレーン, whose translation is
// 碧蓝航线.  ppixiv only records English translations from autocomplete, so the dropdown would
// show the Japanese tag alone.  Record the Chinese ones for tags with no Chinese translation yet.
// tag_translation is the text the suggestion matched, in any language, so only Chinese typed by
// the user that the translation contains counts.  This finishes before ppixiv reads the response,
// so its lookups for the dropdown find them.
async function rememberAutocompleteTranslations(response, keyword)
{
    const tagTranslations = window.ppixiv?.tagTranslations;
    keyword = keyword?.trim();
    if(!tagTranslations?.pzChinese || !response?.ok || !keyword || !HAN_RE.test(keyword) || KANA_RE.test(keyword))
        return;

    try {
        const json = await response.clone().json();
        const found = new Map();
        for(const candidate of json?.candidates ?? [])
        {
            const { type, tag_name: tag, tag_translation: translation } = candidate;
            if(type == "tag_translation" && tag && translation && tag != translation &&
                translation.includes(keyword) && !KANA_RE.test(translation))
                found.set(tag, translation);
        }
        if(found.size > 0)
            await tagTranslations.addTranslations([...found].map(([tag, zh]) => ({ tag, translation: { zh } })), { pzOnlyMissingZh: true });
    } catch(e) {
    }
}

// ppixiv translates the text in manga pages to English by default.  Use Simplified Chinese
// instead, unless a language was already picked in ppixiv's settings.
let imageTranslationChecked = false;

function setupImageTranslationLanguage()
{
    const settings = window.ppixiv?.settings;
    if(imageTranslationChecked || typeof settings?.set != "function")
        return;
    imageTranslationChecked = true;
    if(!("_ppixiv_translation_language" in localStorage))
        settings.set("translation_language", "CHS");
}

// ------------------------------------------------------------------ light and dark mode

// "dark", "light" or "auto" (follow the system).  Dark is the default.
const THEME_KEY = "ppx-zh-theme";
const THEME_MODES = {
    dark: { next: "light", label: "外观：深色（点击切换为浅色）",
        icon: `<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z"/>` },
    light: { next: "auto", label: "外观：浅色（点击切换为跟随系统）",
        icon: `<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4"/>` },
    auto: { next: "dark", label: "外观：跟随系统（点击切换为深色）",
        icon: `<rect x="3" y="4.5" width="18" height="12.5" rx="2"/><path d="M8.5 21h7M12 17v4"/><path d="M12 7.5a3.25 3.25 0 0 0 0 6.5Z" fill="currentColor"/>` },
};
const systemDark = window.matchMedia("(prefers-color-scheme: dark)");

function themeMode()
{
    const mode = localStorage.getItem(THEME_KEY);
    return Object.hasOwn(THEME_MODES, mode) ? mode : "dark";
}

function applyTheme()
{
    const mode = themeMode();
    const light = mode == "light" || (mode == "auto" && !systemDark.matches);
    document.documentElement.classList.toggle("pz-light", light);

    // Styles that only apply with Chinese tag translations.
    document.documentElement.classList.toggle("pz-zh-tags", chineseTagsEnabled());

    // ppixiv sets the browser's toolbar color to black.  #f3f4f7 is --pz-bg in light mode.
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", light ? "#f3f4f7" : "#000");

    const button = document.querySelector(".pz-theme-button");
    if(button)
    {
        button.dataset.popup = THEME_MODES[mode].label;
        button.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${THEME_MODES[mode].icon}</svg>`;
    }
}

systemDark.addEventListener("change", () => {
    if(active)
        applyTheme();
});

// Follow settings changed in other tabs.  Otherwise the buttons here show the old choice, and
// the next click acts on the other tab's value.  A null key means storage was cleared.  Results
// already loaded keep their filters until the next refresh.
window.addEventListener("storage", (e) => {
    if(!active || (e.storageArea != null && e.storageArea != localStorage))
        return;
    if(e.key == null || e.key.startsWith("ppx-zh-"))
        settingChanged();
});

// Bring what's on screen up to date with the settings.
function settingChanged()
{
    runSetup(applyTheme);
    runSetup(refreshFeedFilterButtons);
    runSetup(refreshSeenThumbs);
    runSetup(refreshSettingsPanel);
}

// The button goes left of the gear: in the toolbar above the results on desktop, and in the
// navigation bar at the bottom on phones and iPads.
function setupThemeButton()
{
    const row = document.querySelector(".screen-search-container .thumbnail-ui-box .button-row") ??
        document.querySelector(".screen-search-container .mobile-navigation-bar .button-row");
    if(row == null || row.querySelector(".pz-theme-button"))
        return;

    const button = document.createElement("div");
    button.className = "icon-button popup pz-theme-button";
    const settings = row.querySelector(".settings-menu-box, .preferences-button");
    if(settings)
        settings.before(button);
    else
        row.append(button);
    applyTheme();

    button.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        localStorage.setItem(THEME_KEY, THEME_MODES[themeMode()].next);
        settingChanged();
    });
}

// ------------------------------------------------------------------ faster full-size images

// Two kinds of prefetching, both through the browser's HTTP cache.  ppixiv's viewer loads the
// same URLs with <img>, so it finds them already downloaded.
//
// - Moving the mouse onto a thumbnail and resting there for a moment fetches the work's info and
//   starts downloading the original.  Without this, opening a work waits for the info request
//   before the original even starts.
// - While reading a multi-page work, the next pages are downloaded in parallel once the page on
//   screen has loaded.  ppixiv's own preloader fetches one page at a time and delays pages that
//   aren't adjacent.  This follows ppixiv's "Preload manga" setting.
//
// Each hover prefetch costs an API request and a full-size download, so hovers are limited to
// HOVER_PREFETCH_LIMIT a minute, leaving Pixiv's rate limits to ppixiv.  Nothing is prefetched
// when the browser's "save data" mode is on.  Hover prefetching can also be turned off in the
// settings panel.
const HOVER_PREFETCH_KEY = "ppx-zh-hover-prefetch"; // "on" (default) or "off"
const HOVER_DELAY_MS = 300;
const HOVER_PREFETCH_LIMIT = 30;
const MAX_PREFETCHES = 3;
const MANGA_PAGES_AHEAD = 2;

const prefetched = new Set();
const prefetching = new Map(); // url -> img
const hoverPrefetchTimes = [];
let hoverTimer = null;
let hoveredMediaId = null;
let lastMangaMediaId = null;

const saveData = () => navigator.connection?.saveData == true;
const hoverPrefetchEnabled = () => localStorage.getItem(HOVER_PREFETCH_KEY) != "off";

// Return true and record the hover if another hover prefetch fits in the last minute.
function takeHoverPrefetch()
{
    const now = performance.now();
    while(hoverPrefetchTimes.length > 0 && now - hoverPrefetchTimes[0] > 60000)
        hoverPrefetchTimes.shift();
    if(hoverPrefetchTimes.length >= HOVER_PREFETCH_LIMIT)
        return false;
    hoverPrefetchTimes.push(now);
    return true;
}

// ppixiv disables setTimeout in the page and keeps the real one as realSetTimeout.
const later = (callback, ms) => (window.realSetTimeout ?? window.setTimeout)(callback, ms);
const cancelLater = (id) => (window.realClearTimeout ?? window.clearTimeout)(id);

function prefetchUrl(url)
{
    if(!url || prefetched.has(url) || prefetching.has(url))
        return;

    // Drop the oldest unfinished prefetch to keep bandwidth for the newest.
    if(prefetching.size >= MAX_PREFETCHES)
    {
        const [oldUrl, oldImg] = prefetching.entries().next().value;
        oldImg.src = "";
        prefetching.delete(oldUrl);
    }

    const img = document.createElement("img");
    const done = (ok) => {
        if(prefetching.get(url) != img)
            return;
        prefetching.delete(url);
        if(ok)
            prefetched.add(url);
    };
    img.onload = () => done(true);
    img.onerror = () => done(false);
    img.decoding = "async";
    prefetching.set(url, img);
    img.src = url;
}

function parseMediaId(mediaId)
{
    const match = /^illust:(\d+)(?:-(\d+))?$/.exec(mediaId ?? "");
    return match ? { page: Number(match[2] ?? 0) } : null;
}

// mediaCache.getMediaInfo, except that a failed request isn't remembered.  ppixiv records
// failures in _nonexistantMediaIds and never retries them, not even when the work is opened,
// so a dropped connection during a prefetch would make the work unopenable until a reload.
// Errors Pixiv itself returns, like a deleted work, are kept as ppixiv keeps them.
async function getMediaInfoForPrefetch(mediaCache, mediaId)
{
    const failures = mediaCache._nonexistantMediaIds;
    const key = mediaId.replace(/^illust:(\d+).*$/, "illust:$1-0"); // ppixiv's getMediaIdFirstPage
    const failedBefore = failures != null && key in failures;
    const info = await mediaCache.getMediaInfo(mediaId);
    if(info == null && failures != null && !failedBefore)
    {
        // "Invalid response" means the request failed.  A message like "429 Too Many Requests"
        // means Pixiv answered with an error page instead of JSON.
        const message = String(failures[key] ?? "");
        if(message == "Invalid response" || /^\d{3}\b/.test(message))
            delete failures[key];
    }
    return info;
}

// If shownPage is given, it's the page on screen, and the other pages wait until it has
// loaded so they don't share the connection with it.
async function prefetchPages(mediaId, pages, shownPage = null)
{
    const ppixiv = window.ppixiv;
    if(parseMediaId(mediaId) == null || ppixiv?.mediaCache == null)
        return;

    // Loading full info here also means the viewer won't wait for it when the work is opened.
    const info = await getMediaInfoForPrefetch(ppixiv.mediaCache, mediaId);
    if(info == null || info.illustType == 2)
        return;

    // Another work or page may have been shown while the info loaded.
    if(shownPage != null && mediaId != lastMangaMediaId)
        return;
    if(ppixiv.muting?.anyTagMuted?.(info.tagList) || ppixiv.muting?.isUserIdMuted?.(info.userId))
        return;
    if(shownPage != null && !await waitForShownPage(info.getMainImageUrl(shownPage).url))
        return;

    for(const page of pages)
        if(page < info.mangaPages.length)
            prefetchUrl(info.getMainImageUrl(page).url);
}

// An image outside the page that loads the page on screen.  It shares the viewer's request for
// the same URL, so it costs nothing.  It's dropped when another page is shown, which ends the
// wait.
let shownPageLoader = null;

// Resolve to true once url has loaded, or false if it failed or another page was shown first.
function waitForShownPage(url)
{
    if(!url || prefetched.has(url))
        return Promise.resolve(true);
    const loader = document.createElement("img");
    shownPageLoader = loader;
    return new Promise((resolve) => {
        loader.onload = () => resolve(shownPageLoader == loader);
        loader.onerror = () => resolve(false);
        loader.src = url;
    });
}

// Return true if hovering a work would request anything: its full info isn't loaded yet, or
// its original or 540 preview isn't downloaded or downloading.
function hoverWouldFetch(mediaId, page)
{
    const mediaCache = window.ppixiv?.mediaCache;
    try {
        const info = mediaCache?.getMediaInfoSync(mediaId);
        if(info == null)
            return true;
        // Animations' originals aren't prefetched, see below.
        const have = (url) => url == null || prefetched.has(url) || prefetching.has(url);
        return (info.illustType != 2 && !have(info.getMainImageUrl(page).url)) ||
            !have(mediaCache.getMediaInfoSync(mediaId, { full: false })?.previewUrls?.[page]);
    } catch(e) {
        return true;
    }
}

// ppixiv's viewer loads the same originals and 540 previews.  Count those as downloaded too, so
// hovering a work that was already viewed doesn't use up the limit.
document.addEventListener("load", (e) => {
    const url = e.target.currentSrc;
    if(e.target.tagName == "IMG" && url?.startsWith("https://i.pximg.net/") && !url.includes("_webp/"))
        prefetched.add(url);
}, true);

const HOVER_THUMB_SELECTOR = ".screen-search-container .thumbnail-box [data-media-id], .screen-search-container .thumbnail-box[data-media-id]";

// Scrolling under a still mouse fires pointerover for whatever ends up under it, but not
// pointermove.  So pointerover only cancels a pending hover, and the hover starts when the mouse
// moves onto a thumbnail.
document.addEventListener("pointerover", (e) => {
    if(!active || e.pointerType != "mouse")
        return;
    const mediaId = e.target.closest?.(HOVER_THUMB_SELECTOR)?.dataset.mediaId ?? null;
    if(mediaId == hoveredMediaId)
        return;

    hoveredMediaId = null;
    if(hoverTimer != null)
        cancelLater(hoverTimer);
    hoverTimer = null;
}, true);

document.addEventListener("pointermove", (e) => {
    if(!active || e.pointerType != "mouse")
        return;
    const thumb = e.target.closest?.(HOVER_THUMB_SELECTOR);
    const mediaId = thumb?.dataset.mediaId ?? null;
    if(mediaId == hoveredMediaId)
        return;

    hoveredMediaId = mediaId;
    if(hoverTimer != null)
        cancelLater(hoverTimer);
    hoverTimer = null;

    const parsed = parseMediaId(mediaId);
    if(parsed == null || !hoverPrefetchEnabled())
        return;
    hoverTimer = later(() => {
        hoverTimer = null;
        if(hoveredMediaId != mediaId || saveData() || !hoverPrefetchEnabled())
            return;

        // Muted works show a placeholder.  Don't download what the user chose not to see.
        // Hovers that would request nothing don't count towards the limit.
        if(thumb.closest(".thumbnail-box")?.classList.contains("muted") || !hoverWouldFetch(mediaId, parsed.page) ||
            !takeHoverPrefetch())
            return;

        let partialInfo = null;
        try {
            partialInfo = window.ppixiv?.mediaCache?.getMediaInfoSync(mediaId, { full: false });
        } catch(e) {
        }

        // ppixiv can often guess the original's URL from the thumbnail without waiting for
        // the info request (it needs a few earlier works by the same artist to know the file
        // type).  Start that right away, and fetch the info in parallel.  Animations play from
        // a ZIP, and the "original" guessUrl returns for one is its first frame, which the
        // viewer doesn't use.
        if(partialInfo != null && partialInfo.illustType != 2)
        {
            window.ppixiv?.guessImageUrl?.guessUrl(mediaId).then((url) => {
                if(url && hoveredMediaId == mediaId)
                    prefetchUrl(url);
            }).catch(() => {});
        }
        prefetchPages(mediaId, [parsed.page]).catch(() => {});

        // The viewer shows ppixiv's 540 thumbnail while the original loads.  Search results
        // now load larger thumbnails instead (see "sharper thumbnails"), so fetch it too.
        prefetchUrl(partialInfo?.previewUrls?.[parsed.page]);
    }, HOVER_DELAY_MS);
}, true);

function prefetchUpcomingMangaPages()
{
    const mediaId = window.ppixiv?.app?.displayedMediaId;
    if(mediaId == lastMangaMediaId || saveData())
        return;
    lastMangaMediaId = mediaId;

    // Stop waiting for the page that was shown before.
    if(shownPageLoader != null)
    {
        shownPageLoader.src = "";
        shownPageLoader = null;
    }

    const parsed = parseMediaId(mediaId);
    if(parsed == null)
        return;

    // Follow ppixiv's "Preload manga" setting.  "Thumbnails only" preloads no other pages, and
    // "Nearby pages" only preloads the next one.  ppixiv defaults to thumbnails only on mobile.
    const mode = window.ppixiv?.settings?.get?.("preload_manga");
    if(mode == "thumbnails")
        return;
    const pages = [];
    for(let i = 1; i <= (mode == "partial" ? 1 : MANGA_PAGES_AHEAD); ++i)
        pages.push(parsed.page + i);
    prefetchPages(mediaId, pages, parsed.page).catch(() => {});
}

// ------------------------------------------------------------------ sharper thumbnails

// ppixiv's thumbnails use Pixiv's 540x540 JPEGs at quality 70.  On a high-DPI screen they're
// upscaled, portrait works the most, since 540 limits their height and the layout sizes them by
// width.  i.pximg.net only serves a fixed set of sizes; these WebP ones are larger and sharper,
// and still small:
//
//                       box         typical size
//   600x1200_90_webp    600x1200    40-80 KB     (540x540_70 is 35-50 KB)
//   1200x1200_80_webp   1200x1200   70-110 KB
//   1200x1200_90_webp   1200x1200   100-180 KB
//
// Each thumbnail gets the cheapest one that covers its size on screen in device pixels.  The
// first choice is made when ppixiv sets the URL, from the size ppixiv plans for the thumbnail,
// so the 540 image is never downloaded, except in the manga view (see inMangaView).  A
// ResizeObserver then upgrades thumbnails that end up larger when the layout stretches short
// rows.  Upgrades load in the background and replace the image once decoded.  The size slider,
// Ctrl+wheel, the window size and browser zoom make ppixiv rebuild the thumbnails instead, and
// the new ones start from a size that already loaded (see shownThumbTier).
//
// The tiers allowed depend on how long recent thumbnails took to download, so a slow connection
// falls back to smaller files.  With "save data" on in the browser, ppixiv's own 540 is kept.
const THUMB_QUALITY_KEY = "ppx-zh-thumb-quality"; // "auto" (default) or "off"
const THUMB_TIERS = [
    { spec: "600x1200_90_webp", box: [600, 1200] },
    { spec: "1200x1200_80_webp", box: [1200, 1200] },
    { spec: "1200x1200_90_webp", box: [1200, 1200] },
];
const THUMB_BASE = -1; // ppixiv's own 540x540_70 URL
const THUMB_URL_RE = /^(.*\/c\/)540x540_70(\/img-master\/.*_master1200\.jpg)$/;

// Download time per thumbnail, as if it had the connection to itself (see thumbLoadMs).  For a
// 100-140 KB thumbnail, 400 ms is about 2 Mbps and 1000 ms about 1 Mbps.
const THUMB_SLOW_MS = 400;
const THUMB_VERY_SLOW_MS = 1000;
const THUMB_TIMING_SAMPLES = 40;

// Stop changing thumbnails after this many different images fail, in case Pixiv stopped serving
// these sizes.
const THUMB_MAX_FAILURES = 5;

const thumbStates = new WeakMap(); // img -> { base, prefix, path, mediaId, tier, upgrading, failed }
const thumbTimings = []; // { start, end } of recent thumbnail downloads
const failedThumbUrls = new Set(); // Keep failures when ppixiv rebuilds thumbnail elements.
const loadedThumbTiers = new Map(); // base URL -> Set of tiers that finished loading
let thumbLoadMs = null;
let thumbFailures = 0;

function thumbsEnabled()
{
    return localStorage.getItem(THUMB_QUALITY_KEY) != "off" && thumbFailures < THUMB_MAX_FAILURES;
}

// Tiers that may be used now, from smallest to largest.  Empty means keep ppixiv's 540.
function allowedThumbTiers()
{
    if(saveData())
        return [];
    if(thumbLoadMs == null || thumbLoadMs < THUMB_SLOW_MS)
        return [0, 2];
    if(thumbLoadMs < THUMB_VERY_SLOW_MS)
        return [0, 1];
    return [0];
}

function thumbUrl(state, tier)
{
    return tier == THUMB_BASE ? state.base : state.prefix + THUMB_TIERS[tier].spec + state.path;
}

// Return the best tier for showing mediaId in a cssWidth x cssHeight box.
function pickThumbTier(mediaId, cssWidth, cssHeight)
{
    const allowed = allowedThumbTiers();
    if(allowed.length == 0)
        return THUMB_BASE;
    if(!(cssWidth > 0 && cssHeight > 0))
        return allowed[0];

    const mediaCache = window.ppixiv?.mediaCache;
    let width = 1, height = 1;
    try {
        const info = mediaCache?.getMediaInfoSync(mediaId, { full: false });
        if(info != null)
            ({ width, height } = mediaCache.getImageDimensions(info, mediaId));
    } catch(e) {
        // Unknown dimensions are treated as square.
    }
    if(!(width > 0 && height > 0))
        width = height = 1;

    // Thumbnails are object-fit: cover, so the image is scaled to fill the box and cropped.
    const dpr = window.devicePixelRatio || 1;
    const scale = Math.max(cssWidth * dpr / width, cssHeight * dpr / height);
    const neededWidth = width * scale;

    // Pixiv scales the image down to fit the box, and the source is at most 1200 on its long
    // side.  Allow 10% upscaling before reaching for a bigger file.
    let best = allowed[0], bestWidth = 0;
    for(const tier of allowed)
    {
        const [boxWidth, boxHeight] = THUMB_TIERS[tier].box;
        const fit = Math.min(1, boxWidth / width, boxHeight / height, 1200 / Math.max(width, height));
        const delivered = width * fit;
        if(delivered >= neededWidth * 0.9)
            return tier;
        if(delivered > bestWidth + 1)
        {
            best = tier;
            bestWidth = delivered;
        }
    }
    return best;
}

const imgSrc = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, "src");
const setImgSrc = (img, url) => imgSrc.set.call(img, url);

// ppixiv zooms square thumbnails to 125% while the mouse isn't over them (--zoom-thumb in its
// main.scss).  Layout sizes leave the zoom out and getBoundingClientRect includes it, so layout
// sizes are scaled by this.  Otherwise the IntersectionObserver would pick a larger size than
// the one already loading, and every thumbnail would download twice.  This follows ppixiv's
// updateFromSettings.  Its settings are read rather than the body class it sets, because
// changing the thumbnail style rebuilds the thumbnails before the class changes.
const canHover = window.matchMedia("(hover: hover)");
function thumbZoom()
{
    const ppixiv = window.ppixiv;
    if(!canHover.matches || ppixiv?.mobile)
        return 1;
    if(typeof ppixiv?.settings?.get == "function")
        return ppixiv.settings.get("thumbnail_style") == "aspect" || ppixiv.settings.get("disable_thumbnail_zooming") ? 1 : 1.25;
    return document.body?.classList.contains("disable-thumbnail-zooming") === false ? 1.25 : 1;
}

function thumbTierLoaded(state, tier)
{
    return loadedThumbTiers.get(state.base)?.has(tier) == true;
}

function markThumbTierLoaded(state, tier)
{
    let tiers = loadedThumbTiers.get(state.base);
    if(tiers == null)
        loadedThumbTiers.set(state.base, tiers = new Set());
    tiers.add(tier);
}

// The tier to show at once for a thumbnail that wants `wanted`.  ppixiv rebuilds thumbnails
// when their size changes, and the new elements would stay blank while a new size downloads.
// If another tier of the work has already loaded, show that instead: a larger one as it is, or a
// smaller one until the wanted tier has loaded in the background.
function shownThumbTier(state, wanted)
{
    const tiers = loadedThumbTiers.get(state.base);
    if(tiers == null || tiers.has(wanted))
        return wanted;
    return Math.max(...tiers);
}

// In the manga view, ppixiv loads each page's 540 thumbnail to learn its aspect ratio before it
// creates the thumbnails, so those URLs are already downloaded.  Swapping them would leave the
// thumbnails blank until a different file downloads, so keep them and upgrade in the background.
const inMangaView = () => window.ppixiv?.app?.currentDataSource?.name == "manga";

const thumbResizeObserver = new ResizeObserver((entries) => {
    const zoom = thumbZoom();
    for(const entry of entries)
        maybeUpgradeThumb(entry.target, entry.contentRect.width * zoom, entry.contentRect.height * zoom);
});

function trackThumb(img, url)
{
    const match = THUMB_URL_RE.exec(url);
    const mediaId = img.closest(".thumbnail-box")?.dataset.id;
    if(match == null || mediaId == null)
    {
        thumbStates.delete(img);
        return null;
    }

    const state = { base: url, prefix: match[1], path: match[2], mediaId, tier: THUMB_BASE, upgrading: null, failed: failedThumbUrls.has(url) };
    thumbStates.set(img, state);
    watchThumb(img);
    return state;
}

function watchThumb(img)
{
    thumbResizeObserver.observe(img);
    thumbVisibilityObserver.observe(img);
}

// The observers keep what they watch alive, so stop watching thumbnails ppixiv has thrown away.
// ppixiv sometimes removes a thumbnail and puts it back in the same task while laying out rows,
// so this is only called for thumbnails that are still detached when the mutation is delivered.
function forgetThumb(img)
{
    thumbResizeObserver.unobserve(img);
    thumbVisibilityObserver.unobserve(img);
    visibleThumbs.delete(img);
}

function forgetRemovedThumbs(node)
{
    if(node.nodeType != Node.ELEMENT_NODE || node.isConnected)
        return;
    const imgs = node.tagName == "IMG" ? [node] : node.querySelectorAll("img.thumb");
    for(const img of imgs)
        if(thumbStates.has(img))
            forgetThumb(img);
}

// ppixiv sets thumbnails with "thumb.src = url".  Swap the URL before the browser starts loading it.
Object.defineProperty(HTMLImageElement.prototype, "src", {
    configurable: true,
    enumerable: imgSrc.enumerable,
    get: imgSrc.get,
    set(value) {
        if(active && this.classList.contains("thumb") && thumbsEnabled())
        {
            const state = trackThumb(this, String(value));
            if(state != null && !state.failed && !inMangaView())
            {
                // At this point ppixiv has only decided the size it wants for the thumbnail.
                // It adds the thumbnail to a row right after, in the same task, and stretches
                // the row to fill the width.  Check again with that size before the browser
                // sends the request.  ppixiv waits for the image to load right after setting
                // it, so the src can't be left empty until then.
                const box = this.closest(".thumbnail-box");
                const zoom = thumbZoom();
                state.tier = shownThumbTier(state, pickThumbTier(state.mediaId, box.origWidth * zoom, box.origHeight * zoom));
                value = thumbUrl(state, state.tier);
                queueMicrotask(() => {
                    if(thumbStates.get(this) != state || state.failed || !thumbsEnabled() || box.currentWidth == null)
                        return;
                    const width = box.currentWidth * zoom, height = box.currentHeight * zoom;

                    // A file that loaded before stays on screen, and a larger one loads in the
                    // background.
                    if(thumbTierLoaded(state, state.tier))
                    {
                        maybeUpgradeThumb(this, width, height);
                        return;
                    }

                    const tier = pickThumbTier(state.mediaId, width, height);
                    if(tier > state.tier)
                    {
                        state.tier = tier;
                        setImgSrc(this, thumbUrl(state, tier));
                    }
                });
            }
        }
        else if(thumbStates.has(this))
            thumbStates.delete(this);
        setImgSrc(this, value);
    },
});

function upgradeThumb(img, state, tier)
{
    state.upgrading = tier;
    const url = thumbUrl(state, tier);
    const loader = document.createElement("img");
    loader.decoding = "async";
    loader.onload = async () => {
        markThumbTierLoaded(state, tier);
        await loader.decode().catch(() => {});
        if(thumbStates.get(img) != state || state.upgrading != tier)
            return;
        state.upgrading = null;
        if(state.failed || !thumbsEnabled())
            return;
        state.tier = tier;
        setImgSrc(img, url);
    };
    loader.onerror = () => {
        if(state.upgrading == tier)
            state.upgrading = null;
        thumbFailed(state, url);
    };
    setImgSrc(loader, url);
}

// Load url in an image outside the page, and call done(true) if it loads or done(false).
function loadDetached(url, done)
{
    const loader = document.createElement("img");
    loader.onload = () => done(true);
    loader.onerror = () => done(false);
    setImgSrc(loader, url);
}

// Stop trying larger sizes for an image once one fails, so scrolling it back into view doesn't
// try again.  The failure only counts towards turning the feature off if the connection isn't
// to blame: a request for ppixiv's 540 has to get through, and then url has to fail a second
// time.  An error event
// can't tell a refused size from a dropped connection, and one connection reset can fail a
// whole page of thumbnails at once.  When the connection was to blame, the image is forgotten,
// and gets larger sizes again once the observers see it or ppixiv rebuilds it.
function thumbFailed(state, url)
{
    if(state.failed)
        return;
    state.failed = true;
    if(failedThumbUrls.has(state.base))
        return;
    failedThumbUrls.add(state.base);

    const forget = () => {
        failedThumbUrls.delete(state.base);
        state.failed = false;
    };

    // Ask the network whether it's up.  Loading the 540 in an image isn't enough, since it can
    // come from the cache while offline.  A no-cors fetch resolves for any HTTP response and
    // rejects only when the request didn't get through.  ppixiv replaces fetch and keeps the
    // original as realFetch.
    Promise.resolve()
        .then(() => (window.realFetch ?? window.fetch)(state.base, { mode: "no-cors", cache: "no-store", credentials: "omit" }))
        .then(() => loadDetached(url, (ok) => ok || navigator.onLine === false ? forget() : thumbFailures++), forget);
}

// Remember which tiers have loaded, for shownThumbTier.
document.addEventListener("load", (e) => {
    const state = thumbStates.get(e.target);
    if(state != null && e.target.currentSrc == thumbUrl(state, state.tier))
        markThumbTierLoaded(state, state.tier);
}, true);

// If Pixiv refuses one of these sizes for some image, go back to ppixiv's URL.
document.addEventListener("error", (e) => {
    const img = e.target;
    const state = thumbStates.get(img);
    if(state == null || state.tier == THUMB_BASE || img.currentSrc != thumbUrl(state, state.tier))
        return;
    thumbFailed(state, img.currentSrc);
    state.tier = THUMB_BASE;
    state.upgrading = null;
    setImgSrc(img, state.base);

    // ppixiv learns aspect ratios from thumbnails as they load, and recorded 0 for the failed
    // one.  The manga view and the image viewer lay pages out with it, so measure again once
    // ppixiv's own thumbnail has loaded.  Measuring now doesn't work: ppixiv's listeners would
    // see the error that is still being dispatched and record 0 again.
    img.addEventListener("load", () => {
        if(thumbStates.get(img) == state && img.currentSrc == state.base)
            window.ppixiv?.extraCache?.registerLoadingThumbnail?.(state.mediaId, img)?.catch?.(() => {});
    }, { once: true });
}, true);

// Estimate how long one thumbnail takes to download with the connection to itself.  A
// request's duration alone isn't enough: a page of results loads dozens of thumbnails at once,
// and they share the connection, so each one takes much longer than it would alone.  Divide
// each duration by the average number of thumbnail downloads running during it, and use the
// median of recent downloads.  Cross-origin timing hides sizes, but times are available.
function updateThumbLoadMs()
{
    const adjusted = [];
    for(const a of thumbTimings)
    {
        const duration = a.end - a.start;
        if(duration <= 0)
            continue;
        let overlap = 0;
        for(const b of thumbTimings)
            overlap += Math.max(0, Math.min(a.end, b.end) - Math.max(a.start, b.start));
        adjusted.push(duration * duration / overlap);
    }
    if(adjusted.length == 0)
        return;
    adjusted.sort((a, b) => a - b);
    thumbLoadMs = adjusted[Math.floor(adjusted.length / 2)];
}

new PerformanceObserver((list) => {
    const maxBefore = Math.max(THUMB_BASE, ...allowedThumbTiers());
    let changed = false;
    for(const entry of list.getEntries())
    {
        if(!entry.name.includes("i.pximg.net/c/") || !entry.name.includes("_webp/"))
            continue;

        // Disk cache hits take a few milliseconds and say nothing about the connection.
        if(entry.duration < 10)
            continue;
        thumbTimings.push({ start: entry.startTime, end: entry.responseEnd || entry.startTime + entry.duration });
        if(thumbTimings.length > THUMB_TIMING_SAMPLES)
            thumbTimings.shift();
        changed = true;
    }
    if(changed)
        updateThumbLoadMs();

    // When the connection gets faster, thumbnails loaded while it was slow are still smaller or
    // lower quality.
    if(Math.max(THUMB_BASE, ...allowedThumbTiers()) > maxBefore)
        upgradeVisibleThumbs();
}).observe({ type: "resource" });

function maybeUpgradeThumb(img, width, height)
{
    const state = thumbStates.get(img);

    // A thumbnail ppixiv rebuilt while a failure was being confirmed copied the failure, and the
    // confirmation may have cleared it since.
    if(state?.failed && !failedThumbUrls.has(state.base))
        state.failed = false;
    if(state == null || state.failed || !active || !img.isConnected || !thumbsEnabled())
        return;
    const tier = pickThumbTier(state.mediaId, width, height);
    if(tier > state.tier && tier != state.upgrading)
        upgradeThumb(img, state, tier);
}

// Thumbnails that were off screen when the connection got faster are checked when they scroll
// into view.
const visibleThumbs = new Set();
const thumbVisibilityObserver = new IntersectionObserver((entries) => {
    for(const entry of entries)
    {
        if(!entry.isIntersecting)
        {
            visibleThumbs.delete(entry.target);
            continue;
        }
        visibleThumbs.add(entry.target);
        maybeUpgradeThumb(entry.target, entry.boundingClientRect.width, entry.boundingClientRect.height);
    }
});

function upgradeVisibleThumbs()
{
    for(const img of visibleThumbs)
    {
        if(!img.isConnected)
        {
            visibleThumbs.delete(img);
            continue;
        }
        const rect = img.getBoundingClientRect();
        maybeUpgradeThumb(img, rect.width, rect.height);
    }
}

// Moving the window to a screen with a different scale changes devicePixelRatio without
// changing any CSS size, so neither observer notices.
function watchPixelRatio()
{
    window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`).addEventListener("change", () => {
        watchPixelRatio();
        upgradeVisibleThumbs();
    }, { once: true });
}
watchPixelRatio();

// Thumbnails created before the script activated still have ppixiv's URLs.  Hand them to the
// ResizeObserver, which upgrades them.
function trackExistingThumbs()
{
    if(!thumbsEnabled())
        return;
    for(const img of document.querySelectorAll(".thumbnail-box img.thumb"))
        if(!thumbStates.has(img))
            trackThumb(img, img.src);
}

// ------------------------------------------------------------------ seen works

// Works opened in the image view are remembered in IndexedDB, and their thumbnails are dimmed.
// The recommended works page can also leave them out (see feed filters).  Other tabs are told
// about each work through a BroadcastChannel.
const SEEN_KEY = "ppx-zh-seen"; // "dim" (default), "keep" (remember without dimming) or "off"
const SEEN_DB = "ppx-zh-seen";
const SEEN_LIMIT = 50000; // the oldest are forgotten beyond this

const seenWorks = new Set(); // illust IDs
const seenChannel = typeof BroadcastChannel == "function" ? new BroadcastChannel("ppx-zh-seen") : null;
let seenLoading = null;
let seenClears = 0; // how many times the seen works were cleared, here or in another tab
let lastSeenId = null;

function seenMode()
{
    const mode = localStorage.getItem(SEEN_KEY);
    return mode == "keep" || mode == "off" ? mode : "dim";
}

// Run func(store) in a transaction, and resolve to what it returned once the transaction
// completes, or to null if IndexedDB is unavailable, as in Firefox private windows.  Like
// ppixiv's KeyStorage, the database is closed again after each operation.
async function seenDbOp(mode, func)
{
    let db;
    try {
        db = await new Promise((resolve, reject) => {
            const request = indexedDB.open(SEEN_DB, 1);
            request.onupgradeneeded = () => request.result.createObjectStore("seen");
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    } catch(e) {
        return null;
    }

    try {
        return await new Promise((resolve, reject) => {
            const transaction = db.transaction("seen", mode);
            const result = func(transaction.objectStore("seen"));
            transaction.oncomplete = () => resolve(result);
            transaction.onerror = transaction.onabort = () => reject(transaction.error);
        });
    } catch(e) {
        return null;
    } finally {
        db.close();
    }
}

// Load the IDs of seen works once.  The store maps each ID to when it was last opened.
function loadSeenWorks()
{
    seenLoading ??= (async () => {
        // If they're cleared while this reads them, what it read may be from before.  Works
        // opened after the clear are already in seenWorks.
        const clears = seenClears;
        const requests = await seenDbOp("readonly", (store) => [store.getAllKeys(), store.getAll()]);
        if(requests == null || seenClears != clears)
            return;
        const [ids, times] = requests.map((request) => request.result);
        for(const id of ids)
            seenWorks.add(id);

        if(ids.length > SEEN_LIMIT)
        {
            const oldest = ids.map((id, i) => [times[i], id]).sort((a, b) => a[0] - b[0]).slice(0, ids.length - SEEN_LIMIT);
            for(const [, id] of oldest)
                seenWorks.delete(id);
            seenDbOp("readwrite", (store) => oldest.forEach(([, id]) => store.delete(id)));
        }
        refreshSeenThumbs();
        refreshSettingsPanel();
    })();
    return seenLoading;
}

// Remember the work shown in the image view.  Runs after every DOM change.  Turning the pages of
// a work doesn't count again.
function recordSeenWork()
{
    const id = /^illust:(\d+)/.exec(window.ppixiv?.app?.displayedMediaId ?? "")?.[1] ?? null;
    if(id == lastSeenId)
        return;
    lastSeenId = id;
    if(id == null || seenMode() == "off")
        return;
    const isNew = !seenWorks.has(id);
    seenWorks.add(id);
    seenDbOp("readwrite", (store) => store.put(Date.now(), id));
    if(isNew)
    {
        seenChannel?.postMessage({ id });
        refreshSeenThumbs(id);
    }
}

function clearSeenWorks()
{
    ++seenClears;
    seenWorks.clear();
    seenDbOp("readwrite", (store) => store.clear());
    seenChannel?.postMessage({ clear: true });
    refreshSeenThumbs();
}

if(seenChannel != null)
{
    seenChannel.onmessage = (e) => {
        // Other code on the page can post to the channel too.  Only illust IDs go into the set,
        // since refreshSeenThumbs puts them in a selector.
        const id = e.data?.id;
        if(e.data?.clear)
        {
            ++seenClears;
            seenWorks.clear();
        }
        else if(typeof id == "string" && /^\d+$/.test(id))
            seenWorks.add(id);
        else
            return;
        if(active)
        {
            refreshSeenThumbs(e.data.clear ? null : id);
            refreshSettingsPanel();
        }
    };
}

// Thumbnails in the manga view are pages of the work being viewed, so they're never dimmed.
function markSeenThumb(box)
{
    const id = /^illust:(\d+)/.exec(box.dataset.id ?? "")?.[1];
    const seen = id != null && seenMode() == "dim" && seenWorks.has(id) && !inMangaView();
    if(box.classList.contains("pz-seen") != seen)
        box.classList.toggle("pz-seen", seen);
}

// Update the thumbnails of one work, or of every work.
function refreshSeenThumbs(id = null)
{
    const selector = id == null ? ".thumbnail-box[data-id]" : `.thumbnail-box[data-id^="illust:${id}-"]`;
    for(const box of document.querySelectorAll(selector))
        markSeenThumb(box);
}

// ------------------------------------------------------------------ download file names

// ppixiv names downloads "<user> - <id> - <title>.<ext>", with " #<page>" after the ID when
// downloading one page of a multi-page work.  It saves them by clicking a hidden <a download>
// link to a blob: URL.  The browser reads the link's file name after the click event has been
// dispatched, so the name can be changed here.  ZIP and MKV files keep ppixiv's names inside them.
const FILENAME_KEY = "ppx-zh-filename"; // a template, or empty for ppixiv's names
const FILENAME_FIELDS = [
    ["author", "作者名"],
    ["author_id", "作者 ID"],
    ["id", "作品 ID"],
    ["title", "标题"],
    ["page", "页码，从 1 开始，ZIP 和动图为空"],
    ["pages", "总页数"],
    ["date", "投稿日期"],
];
const FILENAME_MAX_LENGTH = 180;

// Return the fields for a file name ppixiv chose, or null if it isn't one.  getInfo(id) returns
// ppixiv's media info for an illust ID.
function downloadFields(name, getInfo)
{
    const ext = /\.([^.]+)$/.exec(name)?.[1];
    if(ext == null)
        return null;

    // User names and titles can contain " - " and numbers too.  The ID is where the rest of the
    // name is the work's title.  If more than one place fits, prefer the one where the name starts
    // with the work's user name.  The lookahead lets a match start in the " - " the one before
    // ended with, as in "Studio - 2024 - 123 - Title.png".
    let found = null;
    for(const match of name.matchAll(/ - (\d+)(?: #(\d+))?(?= - )/g))
    {
        const info = getInfo(match[1]);
        if(info == null || name.slice(match.index + match[0].length + 3) != `${info.illustTitle}.${ext}`)
            continue;
        const author = name.slice(0, match.index);
        if(found == null || author == info.userName)
            found = { match, info, author };
        if(author == info.userName)
            break;
    }
    if(found == null)
        return null;

    const { match, info, author } = found;
    const single = ext != "zip" && ext != "mkv";
    const date = new Date(info.createDate);
    const pad = (n) => String(n).padStart(2, "0");
    return {
        author,
        author_id: String(info.userId ?? ""),
        id: match[1],
        title: info.illustTitle,
        page: match[2] ?? (single ? "1" : ""),
        pages: String(info.pageCount ?? ""),
        date: isNaN(date) ? "" : `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
        ext,
    };
}

// Fill in a template like "{author} - {id}<_p{page}>".  Text in <> is left out when a field in it
// is empty.  < and > can't be in Windows file names, so they're free for this.  Returns null when
// nothing is left.
function renderFilename(template, fields)
{
    // Fields are filled in one pass over the template, so a title containing "{id}" stays as it is.
    const value = (key) => Object.hasOwn(fields, key) ? fields[key] : null;
    const expand = (text) => text.replace(/\{(\w+)\}/g, (m, key) => value(key) ?? m);
    let name = template.replace(/<([^<>]*)>|\{(\w+)\}/g, (m, inner, key) => {
        if(inner == null)
            return value(key) ?? m;
        return [...inner.matchAll(/\{(\w+)\}/g)].some(([, key]) => value(key) === "") ? "" : expand(inner);
    });

    // Leading and trailing dots and spaces are dropped: Windows doesn't allow them at the end, and
    // a leading dot hides the file elsewhere.  The end is trimmed with a loop, since a regex
    // anchored to the end is slow on long runs of dots.
    name = name.replace(/[\\/:*?"<>|\u0000-\u001f\u007f]/g, "_").replace(/\s+/g, " ");
    name = Array.from(name).slice(0, FILENAME_MAX_LENGTH).join("").replace(/^[\s.]+/, "");
    let end = name.length;
    while(end > 0 && (name[end - 1] == "." || name[end - 1] == " "))
        --end;
    name = name.slice(0, end);
    return name ? `${name}.${fields.ext}` : null;
}

document.addEventListener("click", (e) => {
    const link = e.target;
    if(!active || link?.tagName != "A" || !link.hasAttribute("download") || !link.href.startsWith("blob:"))
        return;
    const template = localStorage.getItem(FILENAME_KEY)?.trim();
    const mediaCache = window.ppixiv?.mediaCache;
    if(!template || mediaCache == null)
        return;

    const getInfo = (id) => {
        try {
            return mediaCache.getMediaInfoSync(`illust:${id}`);
        } catch(e) {
            return null;
        }
    };
    const fields = downloadFields(link.download, getInfo);
    const name = fields && renderFilename(template, fields);
    if(name)
        link.download = name;
}, true);

// ------------------------------------------------------------------ settings panel

// The script's settings, in a panel opened from the button right of the appearance button.  It
// isn't a ppixiv dialog, so it lives outside .widget and isn't translated.
const SETTINGS_ICON = `
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">
    <path d="M4 7h8.5M17.5 7H20M4 17h2.5M11.5 17H20"/>
    <circle cx="15" cy="7" r="2.5"/>
    <circle cx="9" cy="17" r="2.5"/>
</svg>`;

// Each setting with buttons: the values to show, and how to read the current one.
const SETTINGS_CHOICES = {
    [THEME_KEY]: { current: themeMode, options: [["dark", "深色"], ["light", "浅色"], ["auto", "跟随系统"]] },
    [TAG_LANGUAGE_KEY]: { current: () => chineseTagsEnabled() ? "zh" : "en", options: [["zh", "中文"], ["en", "英文"]] },
    [THUMB_QUALITY_KEY]: { current: () => localStorage.getItem(THUMB_QUALITY_KEY) == "off" ? "off" : "auto", options: [["auto", "自动"], ["off", "关闭"]] },
    [HOVER_PREFETCH_KEY]: { current: () => hoverPrefetchEnabled() ? "on" : "off", options: [["on", "开启"], ["off", "关闭"]] },
    [SEEN_KEY]: { current: seenMode, options: [["dim", "调暗"], ["keep", "只记录"], ["off", "不记录"]] },
};

const FILENAME_SAMPLE = {
    author: "作者", author_id: "1234", id: "123456789", title: "作品标题", page: "2", pages: "3", date: "2026-01-02", ext: "png",
};

let settingsPanel = null;
let settingsReturnFocus = null;

// While the panel is open, focus that moves to the page behind it is brought back, so Tab and
// Enter can't reach ppixiv's links and buttons.  Clicks are stopped by the backdrop.  ppixiv sets
// inert on its own screens, so the panel leaves inert alone.
document.addEventListener("focusin", (e) => {
    if(settingsPanel?.isConnected && !settingsPanel.contains(e.target))
        settingsPanel.querySelector(".pz-settings-box").focus();
}, true);

function setupSettingsButton()
{
    const themeButton = document.querySelector(".pz-theme-button");
    if(themeButton == null || themeButton.parentElement.querySelector(".pz-settings-button"))
        return;

    const button = document.createElement("div");
    button.className = "icon-button popup pz-settings-button";
    button.dataset.popup = "中文脚本设置";
    button.innerHTML = SETTINGS_ICON;
    themeButton.after(button);
    button.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        openSettingsPanel();
    });
}

function settingsPanelHtml()
{
    const choice = (key) => `<div class="pz-choice" data-key="${key}">` +
        SETTINGS_CHOICES[key].options.map(([value, label]) => `<button type="button" data-value="${value}">${label}</button>`).join("") +
        "</div>";
    const row = (label, explanation, control) => `
        <div class="pz-settings-row">
            <div class="pz-settings-text">
                <div class="pz-settings-label">${label}</div>
                ${explanation ? `<div class="pz-settings-explanation">${explanation}</div>` : ""}
            </div>
            ${control}
        </div>`;
    const fields = FILENAME_FIELDS.map(([key, label]) => `<code>{${key}}</code> ${label}`).join("，");

    return `
        <div class="pz-settings-box" tabindex="-1">
            <div class="pz-settings-header">
                <span>中文脚本设置</span>
                <button type="button" class="pz-settings-close" aria-label="关闭">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>
                </button>
            </div>
            <div class="pz-settings-body">
                <div class="pz-settings-section">外观和标签</div>
                ${row("外观", "", choice(THEME_KEY))}
                ${row("标签译名", "没有中文译名时显示英文。搜索框的补全会用中文译名找到日文标签。", choice(TAG_LANGUAGE_KEY))}

                <div class="pz-settings-section">缩略图和预加载</div>
                ${row("高清缩略图", "按屏幕上的实际像素和网速选择 WebP 尺寸。关闭后新加载的缩略图生效。", choice(THUMB_QUALITY_KEY))}
                ${row("悬停预加载原图", "鼠标在缩略图上停留 0.3 秒后下载原图，会增加流量。多页作品的预加载跟随 ppixiv 的「预加载漫画」设置。", choice(HOVER_PREFETCH_KEY))}

                <div class="pz-settings-section">看过的作品</div>
                ${row("在看图界面打开过的作品", "推荐作品页可以用「隐藏看过的」去掉它们。「不记录」既不调暗，也不记下新打开的作品，已有的记录保留。", choice(SEEN_KEY))}
                <div class="pz-settings-row pz-settings-actions">
                    <span class="pz-seen-count"></span>
                    <button type="button" class="pz-seen-clear">清除记录</button>
                </div>

                <div class="pz-settings-section">下载</div>
                <div class="pz-settings-row pz-settings-wide">
                    <div class="pz-settings-label">文件名</div>
                    <input type="text" class="pz-filename-input" spellcheck="false" placeholder="留空使用 ppixiv 的文件名：作者名 - 作品 ID - 标题">
                    <div class="pz-settings-explanation">可用 ${fields}。<code>&lt; &gt;</code> 里有空的变量时，整段省略。例如 <code>{id}&lt;_p{page}&gt; {title}</code></div>
                    <div class="pz-filename-preview"></div>
                </div>
            </div>
        </div>`;
}

function openSettingsPanel()
{
    if(settingsPanel?.isConnected)
        return;

    settingsReturnFocus = document.activeElement;
    settingsPanel = document.createElement("div");
    settingsPanel.className = "pz-settings";
    settingsPanel.setAttribute("role", "dialog");
    settingsPanel.setAttribute("aria-modal", "true");
    settingsPanel.setAttribute("aria-label", "中文脚本设置");
    settingsPanel.innerHTML = settingsPanelHtml();
    document.body.append(settingsPanel);

    const input = settingsPanel.querySelector(".pz-filename-input");
    input.value = localStorage.getItem(FILENAME_KEY) ?? "";
    input.addEventListener("input", () => {
        if(input.value.trim())
            localStorage.setItem(FILENAME_KEY, input.value);
        else
            localStorage.removeItem(FILENAME_KEY);
        refreshSettingsPanel();
    });

    // Clicking outside the box closes the panel.  A drag that starts in the box, like selecting
    // text in the template, and ends outside it also sends a click to the backdrop, so the press
    // has to start there too.
    let pressedBackdrop = false;
    settingsPanel.addEventListener("pointerdown", (e) => pressedBackdrop = e.target == settingsPanel);
    settingsPanel.addEventListener("click", (e) => {
        if((e.target == settingsPanel && pressedBackdrop) || e.target.closest(".pz-settings-close"))
        {
            closeSettingsPanel();
            return;
        }
        if(e.target.closest(".pz-seen-clear"))
        {
            clearSeenWorks();
            refreshSettingsPanel();
            return;
        }

        const button = e.target.closest(".pz-choice button[data-value]");
        if(button == null)
            return;
        const key = button.parentElement.dataset.key;
        if(button.dataset.value == SETTINGS_CHOICES[key].current())
            return;
        localStorage.setItem(key, button.dataset.value);
        settingChanged();
    });

    refreshSettingsPanel();
    settingsPanel.querySelector(".pz-settings-box").focus();
}

function closeSettingsPanel()
{
    if(settingsPanel == null)
        return;
    settingsPanel.remove();
    settingsPanel = null;
    settingsReturnFocus?.focus?.();
    settingsReturnFocus = null;
}

function refreshSettingsPanel()
{
    if(!settingsPanel?.isConnected)
        return;

    for(const group of settingsPanel.querySelectorAll(".pz-choice[data-key]"))
    {
        const current = SETTINGS_CHOICES[group.dataset.key].current();
        for(const button of group.querySelectorAll("button[data-value]"))
        {
            const selected = button.dataset.value == current;
            button.classList.toggle("selected", selected);
            button.setAttribute("aria-pressed", String(selected));
        }
    }

    settingsPanel.querySelector(".pz-seen-count").textContent = `已记录 ${seenWorks.size} 个作品`;

    // Another tab may have changed the template.  Leave the box alone while it's being typed in.
    const input = settingsPanel.querySelector(".pz-filename-input");
    const template = localStorage.getItem(FILENAME_KEY) ?? "";
    if(document.activeElement != input && input.value != template)
        input.value = template;

    const preview = settingsPanel.querySelector(".pz-filename-preview");
    if(!template.trim())
    {
        preview.textContent = `示例：${FILENAME_SAMPLE.author} - ${FILENAME_SAMPLE.id} #${FILENAME_SAMPLE.page} - ${FILENAME_SAMPLE.title}.${FILENAME_SAMPLE.ext}`;
        return;
    }
    const page = renderFilename(template, FILENAME_SAMPLE) ?? "（ppixiv 的文件名）";
    const zip = renderFilename(template, { ...FILENAME_SAMPLE, page: "", ext: "zip" }) ?? "（ppixiv 的文件名）";
    preview.textContent = `示例：${page}，ZIP：${zip}`;
}

// ppixiv sends keys typed outside its screen to the screen, so its hotkeys would act on keys
// typed into the panel.  This listener is added before ppixiv's own, so it runs first.  Keys
// still do their usual job, like typing or moving the focus.  keyup goes through, so ppixiv sees
// a key held when the panel opened being released.  Escape while an input method is composing
// text belongs to the input method.
for(const type of ["keydown", "keypress"])
{
    window.addEventListener(type, (e) => {
        if(!settingsPanel?.isConnected)
            return;
        if(type == "keydown" && e.key == "Escape" && !e.isComposing && e.keyCode != 229)
        {
            e.preventDefault();
            closeSettingsPanel();
        }
        else if(type == "keydown" && e.key == "Tab" && !e.altKey && !e.ctrlKey && !e.metaKey)
            wrapSettingsFocus(e);
        e.stopImmediatePropagation();
    }, true);
}

// Tab on the last control goes to the first, and Shift+Tab on the first control or on the box goes
// to the last.  The browser would move the focus out of the panel, and the focusin listener would
// put it on the box, so Shift+Tab could never get past it.
function wrapSettingsFocus(e)
{
    const controls = [...settingsPanel.querySelectorAll("button, input")]
        .filter((control) => !control.disabled && control.getClientRects().length > 0);
    if(controls.length == 0)
        return;
    const focused = document.activeElement;
    let target = null;
    if(e.shiftKey && (focused == controls[0] || !controls.includes(focused)))
        target = controls.at(-1);
    else if(!e.shiftKey && focused == controls.at(-1))
        target = controls[0];
    if(target != null)
    {
        e.preventDefault();
        target.focus();
    }
}

// Like ppixiv's dialogs, the panel closes when ppixiv navigates, as with the back button.
window.addEventListener("pp:popstate", () => closeSettingsPanel());
window.addEventListener("popstate", () => closeSettingsPanel());

// ------------------------------------------------------------------ activation (continued)

// Features that look for their part of ppixiv's UI on activation and after every DOM change.
const SETUPS = [ensureStyle, installFetchHook, setupChineseTags, setupImageTranslationLanguage, setupThemeButton,
    setupSettingsButton, setupBookmarkDownloadButton, setupSimilarButton, setupFeedFilterButtons];

function activate()
{
    active = true;
    runSetup(applyTheme);
    document.documentElement.classList.add(ON_CLASS);
    processTree(document.body);
    SETUPS.forEach(runSetup);
    runSetup(trackExistingThumbs);
    loadSeenWorks();
    new MutationObserver(translateTitle).observe(document.head, { subtree: true, childList: true, characterData: true });
    translateTitle();
}

const observer = new MutationObserver((mutations) => {
    // ppixiv sets up realFetch before it builds its UI, so hook it as early as possible.  The
    // first requests then ask for Chinese tag translations too.
    runSetup(installFetchHook);

    // ppixiv also translates the first search's title before its UI exists, so wrap the tag
    // lookups as soon as ppixiv creates them.
    runSetup(setupChineseTags);

    if(!active)
    {
        if(document.body && ppixivIsRunning())
            activate();
        return;
    }

    SETUPS.forEach(runSetup);
    runSetup(prefetchUpcomingMangaPages);
    runSetup(recordSeenWork);
    for(const mutation of mutations)
    {
        if(mutation.type == "childList")
        {
            for(const node of mutation.addedNodes)
                processTree(node);
            for(const node of mutation.removedNodes)
                forgetRemovedThumbs(node);
            const target = mutation.target;
            if(target.nodeType == Node.ELEMENT_NODE && target.classList.contains("checkbox"))
                syncCheckbox(target);
        }
        else if(mutation.type == "characterData")
        {
            translateTextNode(mutation.target);
            const parent = mutation.target.parentElement;
            if(parent && parent.classList.contains("checkbox"))
                syncCheckbox(parent);
        }
        else if(mutation.type == "attributes")
            translateAttributes(mutation.target);
    }
});

// documentElement can still be null at document-start, so watch the document itself.
observer.observe(document, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ATTRS,
});

// Translate the browser tab title too ("Rankings - ppixiv" and similar).  On a user's page the
// title is the user's name, which is left alone.
function translateTitle()
{
    if(!active)
        return;
    const title = document.title;
    const match = title.match(/^(.*?)( - ppixiv)?$/);
    if(match == null || match[1] == window.ppixiv?.app?.currentDataSource?.userInfo?.name)
        return;
    const translated = translateString(match[1]);
    if(translated != null)
        document.title = translated + (match[2] ?? "");
}

if(DEBUG)
{
    document.addEventListener("pz-dump", () => {
        document.documentElement.dataset.pzMissing = JSON.stringify([...missing]);
    });
}
