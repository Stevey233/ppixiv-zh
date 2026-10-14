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
// element kept at the end of <head> instead.  ppixiv's createElement refuses to create one, but
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
    }
    else if(document.head.lastElementChild != themeStyle)
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

// ------------------------------------------------------------------ discovery type filter

// Pixiv's recommendation API only filters by age rating.  This filters its results by work type
// before ppixiv sees them, so ppixiv lays out only the works that are kept.  ppixiv makes every
// request through window.realFetch, which is looked up on each call.
const DISCOVERY_TYPE_KEY = "ppx-zh-discovery-type";
const DISCOVERY_TYPES = [
    ["all", "全部类型", "显示所有类型的作品"],
    ["illust", "插画", "只显示插画和动图"],
    ["manga", "漫画", "只显示漫画"],
];

// ppixiv treats an empty page as the end of the results and stops loading.  If a page has nothing
// of the selected type, ask for more recommendations, up to this many requests in total.
const DISCOVERY_MAX_REQUESTS = 4;
const DISCOVERY_RETRY_DELAY_MS = 500;

function discoveryType()
{
    const type = localStorage.getItem(DISCOVERY_TYPE_KEY);
    return DISCOVERY_TYPES.some(([key]) => key == type) ? type : "all";
}

// Return the request URL as a URL if it's a GET to Pixiv's own ajax API, otherwise null.
function pixivAjaxUrl(url, init)
{
    if(typeof url != "string" && !(url instanceof URL))
        return null;
    if((init?.method ?? "GET").toUpperCase() != "GET")
        return null;
    try {
        const parsed = new URL(url, location.href);
        return parsed.origin == location.origin && parsed.pathname.startsWith("/ajax/") ? parsed : null;
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

        if(chineseTagsEnabled())
        {
            ajaxUrl.searchParams.set("lang", "zh");
            url = ajaxUrl.toString();
        }

        // The similar works page uses the same API with sampleIllustId.  The filter is only shown
        // on the recommended works page, so only filter there.
        const type = discoveryType();
        if(type == "all" || ajaxUrl.pathname != "/ajax/discovery/artworks" || ajaxUrl.searchParams.has("sampleIllustId"))
            return await realFetch.call(this, url, init);

        return await fetchFilteredDiscovery((u, i) => realFetch.call(this, u, i), url, init, type);
    };
    hookedFetch.pzHooked = true;
    window.realFetch = hookedFetch;
}

async function fetchFilteredDiscovery(fetchFunc, url, init, type)
{
    // illustType: 0 is an illustration, 1 is manga, 2 is an animation.
    const keep = (thumb) => type == "manga"? thumb.illustType == 1:thumb.illustType != 1;

    // Batches can repeat works from earlier pages.  ppixiv drops works it already has, and a
    // page left empty ends the feed, so only new works count.  Discovery media IDs are always
    // "illust:<id>-0" (ppixiv's util/media-id.js).
    const seen = new Set(window.ppixiv?.app?.currentDataSource?.idList?.getAllMediaIds?.() ?? []);

    let last = null;
    const kept = [];
    const tagTranslation = {};
    for(let request = 0; request < DISCOVERY_MAX_REQUESTS; ++request)
    {
        if(request > 0)
        {
            await new Promise((resolve) => later(resolve, DISCOVERY_RETRY_DELAY_MS));
            init?.signal?.throwIfAborted?.();
        }

        const response = await fetchFunc(url, init);
        let json = null;
        try {
            json = response?.ok ? await response.clone().json() : null;
        } catch(e) {
        }

        // Give ppixiv the error, as it would get without the filter.  Earlier requests kept
        // nothing, or the loop would have stopped.
        const thumbs = json?.body?.thumbnails?.illust;
        if(!Array.isArray(thumbs))
            return response;

        last = { response, json };
        Object.assign(tagTranslation, json.body.tagTranslation);
        for(const thumb of thumbs)
        {
            const mediaId = `illust:${thumb.id}-0`;
            if(keep(thumb) && !seen.has(mediaId))
            {
                seen.add(mediaId);
                kept.push(thumb);
            }
        }
        if(kept.length > 0)
            break;
    }

    if(kept.length == 0)
    {
        const label = DISCOVERY_TYPES.find(([key]) => key == type)[1];
        window.ppixiv?.message?.show(`连续 ${DISCOVERY_MAX_REQUESTS} 次推荐里都没有新的${label}，已停止加载。点刷新按钮可以重新获取。`);
    }

    const { response, json } = last;
    json.body.thumbnails.illust = kept;
    json.body.tagTranslation = tagTranslation;
    return new Response(JSON.stringify(json), {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
    });
}

function setupDiscoveryTypeButtons()
{
    if(window.ppixiv?.app?.currentDataSource?.name != "discovery")
        return;

    const ui = document.querySelector(".screen-search-container .data-source-ui");
    const ageRow = ui?.querySelector(".box-button-row");
    if(ageRow == null || ui.querySelector(".pz-discovery-type"))
        return;

    const row = document.createElement("div");
    row.className = "box-button-row pz-discovery-type";
    row.innerHTML = DISCOVERY_TYPES.map(([key, label, popup]) =>
        `<a href="#" class="box-link popup" data-type="${key}" data-popup="${popup}"><span class="label">${label}</span></a>`).join("");
    ageRow.after(row);
    refreshDiscoveryTypeButtons(row);

    row.addEventListener("click", (e) => {
        const button = e.target.closest(".box-link[data-type]");
        if(button == null)
            return;
        e.preventDefault();
        e.stopPropagation();
        if(button.dataset.type == discoveryType())
            return;

        localStorage.setItem(DISCOVERY_TYPE_KEY, button.dataset.type);
        refreshDiscoveryTypeButtons(row);

        // Reload the recommendations with the new filter.
        document.querySelector(".screen-search-container .refresh-search-button")?.click();
    });
}

function refreshDiscoveryTypeButtons(row)
{
    const type = discoveryType();
    for(const button of row.querySelectorAll(".box-link[data-type]"))
        button.classList.toggle("selected", button.dataset.type == type);
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

function setupChineseTags()
{
    const tagTranslations = window.ppixiv?.tagTranslations;
    if(tagTranslations == null || tagTranslations.pzChinese || !chineseTagsEnabled())
        return;
    if(typeof tagTranslations.addTranslations != "function" || typeof tagTranslations.getTagInfo != "function" ||
        typeof tagTranslations._db?.multiGet != "function")
        return;
    tagTranslations.pzChinese = true;

    const addTranslations = tagTranslations.addTranslations;
    // Keep each read, merge and write together.  Search results and full work info can
    // arrive at once, so the next batch must wait for the previous write to finish.
    let pendingTranslations = Promise.resolve();
    tagTranslations.addTranslations = function(tagList, options)
    {
        const result = pendingTranslations.then(async () => {
            let stored = null;
            try {
                stored = await this._db.multiGet(tagList.map((tag) => tag.tag));
            } catch(e) {
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
    tagTranslations.getTranslations = async function(tags)
    {
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

    tagTranslations.getTranslation = async function(tag)
    {
        const result = await this.getTranslations([tag]);
        return result[tag] ?? tag;
    };
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
        applyTheme();
    });
}

// ------------------------------------------------------------------ faster full-size images

// Two kinds of prefetching, both through the browser's HTTP cache.  ppixiv's viewer loads the
// same URLs with <img>, so it finds them already downloaded.
//
// - Moving the mouse onto a thumbnail and resting there for a moment fetches the work's info and
//   starts downloading the original.  Without this, opening a work waits for the info request
//   before the original even starts.
// - While reading a multi-page work, the next pages are downloaded in parallel.  ppixiv's own
//   preloader fetches one page at a time and delays pages that aren't adjacent.  This follows
//   ppixiv's "Preload manga" setting.
//
// Each hover prefetch costs an API request and a full-size download, so hovers are limited to
// HOVER_PREFETCH_LIMIT a minute, leaving Pixiv's rate limits to ppixiv.  Nothing is prefetched
// when the browser's "save data" mode is on.
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

async function prefetchPages(mediaId, pages)
{
    const ppixiv = window.ppixiv;
    if(parseMediaId(mediaId) == null || ppixiv?.mediaCache == null)
        return;

    // Loading full info here also means the viewer won't wait for it when the work is opened.
    const info = await getMediaInfoForPrefetch(ppixiv.mediaCache, mediaId);
    if(info == null || info.illustType == 2)
        return;
    if(ppixiv.muting?.anyTagMuted?.(info.tagList) || ppixiv.muting?.isUserIdMuted?.(info.userId))
        return;

    for(const page of pages)
        if(page < info.mangaPages.length)
            prefetchUrl(info.getMainImageUrl(page).url);
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
        const have = (url) => url == null || prefetched.has(url) || prefetching.has(url);
        return !have(info.getMainImageUrl(page).url) ||
            !have(mediaCache.getMediaInfoSync(mediaId, { full: false })?.previewUrls?.[page]);
    } catch(e) {
        return true;
    }
}

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
    if(parsed == null)
        return;
    hoverTimer = later(() => {
        hoverTimer = null;
        if(hoveredMediaId != mediaId || saveData())
            return;

        // Muted works show a placeholder.  Don't download what the user chose not to see.
        // Hovers that would request nothing don't count towards the limit.
        if(thumb.closest(".thumbnail-box")?.classList.contains("muted") || !hoverWouldFetch(mediaId, parsed.page) ||
            !takeHoverPrefetch())
            return;

        // ppixiv can often guess the original's URL from the thumbnail without waiting for
        // the info request (it needs a few earlier works by the same artist to know the file
        // type).  Start that right away, and fetch the info in parallel.
        window.ppixiv?.guessImageUrl?.guessUrl(mediaId).then((url) => {
            if(url && hoveredMediaId == mediaId)
                prefetchUrl(url);
        }).catch(() => {});
        prefetchPages(mediaId, [parsed.page]).catch(() => {});

        // The viewer shows ppixiv's 540 thumbnail while the original loads.  Search results
        // now load larger thumbnails instead (see "sharper thumbnails"), so fetch it too.
        try {
            const info = window.ppixiv?.mediaCache?.getMediaInfoSync(mediaId, { full: false });
            prefetchUrl(info?.previewUrls?.[parsed.page]);
        } catch(e) {
        }
    }, HOVER_DELAY_MS);
}, true);

function prefetchUpcomingMangaPages()
{
    const mediaId = window.ppixiv?.app?.displayedMediaId;
    if(mediaId == lastMangaMediaId || saveData())
        return;
    lastMangaMediaId = mediaId;

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
    prefetchPages(mediaId, pages).catch(() => {});
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
// ResizeObserver then upgrades thumbnails that end up larger: the layout stretches short rows,
// and the thumbnail size slider and browser zoom change sizes later.  Upgrades load in the
// background and replace the image once decoded.
//
// The tiers allowed depend on how long recent thumbnails took to download, so a slow connection
// falls back to smaller files.  "Save data" in the browser always uses the smallest tier.
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
let thumbLoadMs = null;
let thumbFailures = 0;

function thumbsEnabled()
{
    return localStorage.getItem(THUMB_QUALITY_KEY) != "off" && thumbFailures < THUMB_MAX_FAILURES;
}

function allowedThumbTiers()
{
    if(saveData())
        return [0];
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
// the one already loading, and every thumbnail would download twice.
const canHover = window.matchMedia("(hover: hover)");
function thumbZoom()
{
    const body = document.body;
    return body != null && canHover.matches && !body.classList.contains("disable-thumbnail-zooming") ? 1.25 : 1;
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
                state.tier = pickThumbTier(state.mediaId, box.origWidth * zoom, box.origHeight * zoom);
                value = thumbUrl(state, state.tier);
                queueMicrotask(() => {
                    if(thumbStates.get(this) != state || state.failed || !thumbsEnabled() || box.currentWidth == null)
                        return;
                    const tier = pickThumbTier(state.mediaId, box.currentWidth * zoom, box.currentHeight * zoom);
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
// to blame: ppixiv's 540 has to load, and then url has to fail a second time.  An error event
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
    loadDetached(state.base, (connected) => {
        if(!connected)
            forget();
        else
            loadDetached(url, (ok) => ok? forget():thumbFailures++);
    });
}

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
    const maxBefore = Math.max(...allowedThumbTiers());
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
    if(Math.max(...allowedThumbTiers()) > maxBefore)
        upgradeVisibleThumbs();
}).observe({ type: "resource" });

function maybeUpgradeThumb(img, width, height)
{
    const state = thumbStates.get(img);
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

// ------------------------------------------------------------------ activation (continued)

// Features that look for their part of ppixiv's UI on activation and after every DOM change.
const SETUPS = [ensureStyle, installFetchHook, setupChineseTags, setupThemeButton, setupBookmarkDownloadButton,
    setupSimilarButton, setupDiscoveryTypeButtons];

function activate()
{
    active = true;
    runSetup(applyTheme);
    document.documentElement.classList.add(ON_CLASS);
    processTree(document.body);
    SETUPS.forEach(runSetup);
    runSetup(trackExistingThumbs);
    new MutationObserver(translateTitle).observe(document.head, { subtree: true, childList: true, characterData: true });
    translateTitle();
}

const observer = new MutationObserver((mutations) => {
    // ppixiv sets up realFetch before it builds its UI, so hook it as early as possible.  The
    // first requests then ask for Chinese tag translations too.
    runSetup(installFetchHook);

    if(!active)
    {
        if(document.body && ppixivIsRunning())
            activate();
        return;
    }

    SETUPS.forEach(runSetup);
    runSetup(prefetchUpcomingMangaPages);
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
