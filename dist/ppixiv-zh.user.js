// ==UserScript==
// @name         ppixiv 中文与现代界面
// @namespace    https://github.com/Stevey233/ppixiv-zh
// @version      0.8.4
// @description  给 ppixiv 汉化界面和标签译名，换成现代化的深色或浅色主题。需要同时安装 ppixiv。
// @author       Stevey233
// @license      MIT
// @homepageURL  https://github.com/Stevey233/ppixiv-zh
// @supportURL   https://github.com/Stevey233/ppixiv-zh/issues
// @updateURL    https://raw.githubusercontent.com/Stevey233/ppixiv-zh/main/dist/ppixiv-zh.meta.js
// @downloadURL  https://raw.githubusercontent.com/Stevey233/ppixiv-zh/main/dist/ppixiv-zh.user.js
// @match        https://www.pixiv.net/*
// @run-at       document-start
// @grant        none
// @noframes
// ==/UserScript==

/*
MIT License

Copyright (c) 2026 Stevey233

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/
(function() {
"use strict";
// English UI string -> Simplified Chinese.  Keys are matched against the trimmed text of a
// text node or attribute, with runs of whitespace collapsed to one space.
const DICT = {
    // Search menu and page titles
    "Search works": "搜索作品",
    "New works by following": "关注用户的新作",
    "New works by everyone": "所有人的新作",
    "Bookmarks": "收藏",
    "all": "全部",
    "All": "全部",
    "Public": "公开",
    "Private": "非公开",
    "Followed users": "已关注用户",
    "Rankings": "排行榜",
    "Recommended works": "推荐作品",
    "Recommended Works": "推荐作品",
    "Recommended users": "推荐用户",
    "Recommended Users": "推荐用户",
    "Completed requests": "已完成的约稿",
    "Users": "用户",
    "Search users": "搜索用户",
    "Search users:": "搜索用户：",
    "Search": "搜索",
    "Search:": "搜索：",
    "Discovery": "发现",
    "New Works": "新作",
    "Artist": "作者",
    "Similar Illustrations": "相似插画",
    "Similar Illusts": "相似插画",
    "Similar Bookmarks": "相似收藏",
    "Similar Images": "相似图片",
    "Similar images": "相似图片",
    "User's Bookmarks": "用户的收藏",
    "User's followed users": "用户关注的人",
    "User's follows": "用户的关注",
    "Users who bookmarked image": "收藏了此作品的用户",
    "Edited Images": "已编辑的图片",
    "Edited": "已编辑",
    "Untagged bookmarks": "未分类的收藏",
    "Untagged": "未分类",
    "Muted Tags": "屏蔽的标签",
    "Muted Users": "屏蔽的用户",
    "Saved Tags": "已保存的标签",
    "Recent tags": "最近的标签",
    "Saved tags": "已保存的标签",
    "Following": "关注中",
    "Private follows": "非公开关注",
    "No search tags": "没有搜索标签",
    "Load Previous Results": "加载之前的结果",
    "No results": "没有结果",
    "No Results": "没有结果",
    "See all": "查看全部",

    // Search UI buttons (tooltips)
    "Show navigation": "显示导航",
    "Return to Pixiv": "返回 Pixiv",
    "Refresh": "刷新",
    "Refresh from page": "从当前页刷新",
    "Refresh search from page": "从当前页刷新搜索",
    "Slideshow": "幻灯片",
    "Preferences": "设置",
    "Expand manga posts": "展开漫画作品",
    "Collapse manga posts": "收起漫画作品",

    // Rankings
    "Previous day": "前一天",
    "Show the previous day": "查看前一天",
    "Next day": "后一天",
    "Show the next day": "查看后一天",
    "Ranking type": "排行类型",
    "Rankings to display": "要显示的排行",
    "Contents": "内容",
    "Content type to display": "要显示的内容类型",
    "Daily": "今日",
    "Daily rankings": "今日排行",
    "Weekly": "本周",
    "Weekly rankings": "本周排行",
    "Monthly": "本月",
    "Monthly rankings": "本月排行",
    "Rookie": "新人",
    "Rookie rankings": "新人排行",
    "Original": "原创",
    "Original rankings": "原创排行",
    "AI": "AI",
    "AI-generated": "AI 生成",
    "Show AI works": "显示 AI 作品",
    "Male": "男性",
    "Popular with men": "受男性欢迎",
    "Female": "女性",
    "Popular with women": "受女性欢迎",
    "Show R18 works": "显示 R18 作品",
    "Show R18G works": "显示 R18G 作品",
    "Show ALL works": "显示全部作品",
    "Show illustrations only": "只显示插画",
    "Overall": "综合",

    // Search filters
    "Ages": "年龄分级",
    "All ages": "全年龄",
    "Aspect": "比例",
    "Aspect ratio": "宽高比",
    "Bookmarked": "已收藏",
    "# Bookmarks": "收藏数",
    "Time": "时间",
    "Hide AI": "隐藏 AI",
    "Show or hide AI works": "显示或隐藏 AI 作品",
    "Popularity": "热门度",
    "Tag": "标签",
    "Tags": "标签",
    "Exact tag match": "标签完全一致",
    "Title, Caption": "标题、说明",
    "Tags, Title, Caption": "标签、标题、说明",
    "Square": "正方形",
    "Landscape": "横图",
    "Portrait": "竖图",
    "Horizontal": "横图",
    "Vertical": "竖图",
    "Public bookmarks": "公开收藏",
    "Private bookmarks": "非公开收藏",
    "This week": "本周",
    "This Week": "本周",
    "This month": "本月",
    "This year": "今年",
    "years ago": "年前",
    "Sort": "排序",
    "Type": "类型",
    "Order": "顺序",
    "Reset": "重置",
    "Clear all search options": "清除所有搜索条件",
    "Newest": "最新",
    "Oldest": "最早",
    "New bookmarks": "新收藏在前",
    "Old bookmarks": "旧收藏在前",
    "Shuffle": "随机",
    "Search mode": "搜索方式",
    "Works": "作品",
    "Illusts": "插画",
    "Illustrations": "插画",
    "Illustrations, Ugoira": "插画、动图",
    "Manga": "漫画",
    "Animations": "动图",
    "Show bookmarks": "显示收藏",
    "Show all bookmarks": "显示全部收藏",
    "Show public bookmarks": "显示公开收藏",
    "Show private bookmarks": "显示非公开收藏",
    "All bookmarks": "全部收藏",
    "Latest": "最新",
    "Show latest completed requests": "显示最新完成的约稿",
    "Recommended": "推荐",
    "Show recommmended completed requests": "显示推荐的已完成约稿",
    "Show animations only": "只显示动图",
    "Show manga only": "只显示漫画",
    "Show all works": "显示全部作品",
    "Show all-ages works": "显示全年龄作品",
    "Show publically followed users": "显示公开关注的用户",
    "Show privately followed users": "显示非公开关注的用户",
    "Accepting requests": "接受约稿",
    "All tags": "全部标签",
    "All tags:": "全部标签：",
    "Follow tags": "关注标签",
    "Show illustrations": "显示插画",
    "Show only R18 works": "只显示 R18 作品",
    "Containing tags:": "包含标签：",
    "Images": "图片",
    "Videos": "视频",
    "Image size": "图片尺寸",
    "High-res": "高分辨率",
    "Medium-res": "中分辨率",
    "Low-res": "低分辨率",
    "Name": "名称",
    "Name (inverse)": "名称（倒序）",
    "Files": "文件",

    // Image view
    "Download image": "下载图片",
    "Download ZIP of all images": "下载全部图片（ZIP）",
    "Download MKV": "下载 MKV",
    "Similar illustrations": "相似插画",
    "Similar artists": "相似作者",
    "Similar bookmarks": "相似收藏",
    "Edit post": "编辑作品",
    "View manga pages": "查看漫画分页",
    "Bookmark tags": "收藏标签",
    "Bookmark illustration": "收藏插画",
    "Bookmark": "收藏",
    "Bookmark image": "收藏作品",
    "Bookmark privately": "非公开收藏",
    "Bookmark folder": "收藏文件夹",
    "Remove bookmark": "取消收藏",
    "Remove bookmark?": "取消收藏？",
    "Public Bookmark": "公开收藏",
    "Private Bookmark": "非公开收藏",
    "Like image": "点赞",
    "Already liked image": "已点赞",
    "More": "更多",
    "More...": "更多…",
    "Info": "信息",
    "Pages": "分页",
    "Series": "系列",
    "View series": "查看系列",
    "Muted:": "已屏蔽：",
    "View image": "查看图片",
    "Fullscreen": "全屏",
    "Back": "返回",
    "Mousewheel to zoom": "滚轮缩放",
    "Zoom to cover": "缩放至铺满",
    "Zoom to actual size": "缩放至原始尺寸",
    "Zoom lock": "锁定缩放",
    "Zoom": "缩放",
    "Parent folder": "上级文件夹",
    "Illustration doesn't exist": "作品不存在",
    "Not bookmarked": "未收藏",
    "Already bookmarked": "已收藏",

    // More options dropdown
    "Index similarity": "建立相似度索引",
    "GPU upscaling": "GPU 放大",
    "Edit mutes": "编辑屏蔽",
    "Refresh image": "刷新图片",
    "Share image": "分享图片",
    "Download manga ZIP": "下载漫画 ZIP",
    "Download video MKV": "下载视频 MKV",
    "Send to tab": "发送到标签页",
    "Loop": "循环播放",
    "Linked tabs": "联动标签页",
    "Image editing": "图片编辑",
    "Settings": "设置",
    "Translate": "翻译",
    "Show tag prompt": "显示标签输入框",

    // User widgets
    "Follow": "关注",
    "Follow privately": "非公开关注",
    "Unfollow": "取消关注",
    "Unfollow?": "取消关注？",
    "Change follow to private": "改为非公开关注",
    "Change follow to public": "改为公开关注",
    "View followed users": "查看关注的用户",
    "View bookmarks": "查看收藏",
    "Send a message": "发送私信",
    "Mute this user": "屏蔽此用户",
    "Unmute this user": "取消屏蔽此用户",
    "Webpage": "个人网站",
    "Add new tag": "添加新标签",
    "New folder:": "新文件夹：",
    "New tag:": "新标签：",
    "Fetch user": "获取用户",

    // Mutes
    "Note": "提示",
    "Add": "添加",
    "Tag to mute:": "要屏蔽的标签：",
    "Mute": "屏蔽",
    "Unmute": "取消屏蔽",
    "Muted": "已屏蔽",
    "Muted tags": "屏蔽的标签",
    "Muted users": "屏蔽的用户",
    "You can mute any number of tags and users.": "标签和用户的屏蔽数量没有上限。",
    "However, since you don't have Premium, mutes will only be saved in your browser and can't be saved to your Pixiv account. They will be lost if you change browsers or clear site data.":
        "不过你没有 Premium 会员，屏蔽只会保存在当前浏览器，无法同步到 Pixiv 账号。换浏览器或清除网站数据后会丢失。",
    "Users can be muted from their user page, or by right-clicking an image and clicking": "要屏蔽用户，可以在用户主页操作，也可以在图片上右键，然后点击",
    "The Pixiv mute list is full.": "Pixiv 屏蔽列表已满。",
    "Item is already muted": "已经屏蔽过了",

    // Prompts
    "Yes": "是",
    "No": "否",
    "Accept": "确定",
    "Log out?": "退出登录？",
    "Log out": "退出登录",
    "Login": "登录",

    // Settings dialog
    "Thumbnail options": "缩略图",
    "Image viewing": "看图",
    "Translation": "翻译",
    "Other": "其他",
    "What's New": "更新日志",
    "Updates": "更新日志",
    "Thumbnail size": "缩略图大小",
    "Thumbnail style": "缩略图样式",
    "Disabled by default": "默认关闭",
    "Go to Pixiv by default.": "默认打开 Pixiv 原版页面。",
    "Go here by default.": "默认打开 ppixiv。",
    "Hide cursor": "隐藏光标",
    // ppixiv stores this toggle inverted ("no-hide-cursor") and picks the explanation from the
    // stored value, so it shows the wrong sentence.  Swapping the translations corrects it.
    "Hide the cursor while the mouse isn't moving.": "鼠标静止时不隐藏光标。",
    "Don't hide the cursor while the mouse isn't moving.": "鼠标静止时隐藏光标。",
    "Show manga progress": "显示漫画阅读进度",
    "Show icon on AI-generated images": "在 AI 生成的作品上显示图标",
    "Ignore rapid mousewheel inputs": "忽略过快的滚轮输入",
    "Enable if wheel scrolls by multiple images": "如果滚一下就跳过好几张图，请打开此项",
    "Hotkey modifier": "快捷键修饰键",
    "Automatic": "自动",
    "Command": "Command",
    "Shift-right-click to show the popup menu": "Shift + 右键打开弹出菜单",
    "Shift-right-click to open the popup menu": "按住 Shift 再右键打开弹出菜单",
    "Right click opens the popup menu": "右键直接打开弹出菜单",
    "Hold ctrl to show the popup menu": "按住 Ctrl 显示弹出菜单",
    "Pressing Ctrl shows the popup menu (for laptops)": "按 Ctrl 显示弹出菜单（适合笔记本触控板）",
    "Hover to show search box": "悬停时才显示搜索栏",
    "Only show the search box when hovering over it": "鼠标移到顶部时才显示搜索栏",
    "Always show the search box": "始终显示搜索栏",
    "Invert image panning": "反转图片拖动方向",
    "Dragging down moves the image down": "向下拖动时图片向下移动",
    "Dragging down moves the image up": "向下拖动时图片向上移动",
    "Show tag translations": "显示标签翻译",
    "Pan thumbnails while hovering over them": "悬停时平移缩略图",
    "Zoom out thumbnails while hovering over them": "悬停时缩小缩略图",
    "Use transitions": "使用过渡动画",
    "Bookmark and follow privately": "默认非公开收藏和关注",
    "Pressing Ctrl-B will bookmark publically": "按 Ctrl+B 公开收藏",
    "Pressing Ctrl-B will bookmark privately": "按 Ctrl+B 非公开收藏",
    "Limit slideshows to 60 FPS": "幻灯片限制为 60 FPS",
    "Settings and data": "设置和数据",
    "Import": "导入",
    "Export": "导出",
    "Bookmark slideshow": "收藏幻灯片",
    "Go": "开始",
    "Quick view": "快速查看",
    "Navigate to images immediately when the mouse button is pressed": "按下鼠标键时立即打开图片",
    "Quick View is only supported when using a mouse.": "快速查看只支持鼠标操作。",
    "Pan images": "平移图片",
    "Pan images while viewing them (drag the image to stop)": "看图时自动平移（拖动图片即可停止）",
    "Time per image": "每张图片的时长",
    "Slideshow mode": "幻灯片模式",
    "Pan": "平移",
    "Fade": "淡入淡出",
    "Pan the image left-to-right or top-to-bottom": "从左到右或从上到下平移图片",
    "Fade in and out without panning": "淡入淡出，不平移",
    "Slideshow skips manga pages": "幻灯片跳过漫画分页",
    "Slideshow mode will only show the first page.": "幻灯片只显示第一页。",
    "Slideshow mode will show all pages.": "幻灯片显示所有分页。",
    "Slideshow duration": "幻灯片时长",
    "Pan duration": "平移时长",
    "Display mode": "显示模式",
    "Fill the screen": "铺满屏幕",
    "Rounded display": "圆角屏幕",
    "Avoid the status bar": "避开状态栏",
    "Return to the top when changing images": "切换图片时回到顶部",
    "Preload manga": "预加载漫画",
    "All pages": "所有分页",
    "Nearby pages": "附近的分页",
    "Thumbnails only": "只预加载缩略图",
    "Open Pixiv": "打开 Pixiv",
    "Enabled": "启用",
    "Unlink all tabs": "解除所有标签页的联动",
    "Link this tab": "联动此标签页",
    "Unlink this tab": "解除此标签页的联动",
    "Click to send image here": "点击把图片发送到这里",
    // "Open a [ppixiv icon] tab on another monitor..." is split around an inline icon.
    "Open a": "在另一台显示器上打开一个",
    "tab on another monitor and click \"Link this tab\" to send images to it": "标签页，点击「联动此标签页」后就能把图片发送过去",
    "Click a": "点击一个",
    "tab to send the image there": "标签页，把图片发送到那里",
    "Allow Website Tinting": "允许网站着色",
    "Exported ppixiv data": "已导出 ppixiv 数据",
    "Imported data.": "数据已导入。",

    // Translation settings
    "Translate this image": "翻译这张图片",
    "There was an error translating this image": "翻译这张图片时出错",
    "Retry": "重试",
    "Language": "语言",
    "Translation engine": "翻译引擎",
    "Use low res image for translations (faster)": "用低分辨率图片翻译（更快）",
    "Translation resolution": "翻译分辨率",
    "Text direction": "文字方向",
    "None (remove text)": "无（移除文字）",
    "English": "英语",
    "Japanese": "日语",
    "Korean": "韩语",
    "Chinese (Simplified)": "简体中文",
    "Chinese (Traditional)": "繁体中文",
    "French": "法语",
    "German": "德语",
    "Spanish": "西班牙语",
    "Italian": "意大利语",
    "Russian": "俄语",
    "Portuguese (Brazil)": "葡萄牙语（巴西）",
    "Polish": "波兰语",
    "Dutch": "荷兰语",
    "Czech": "捷克语",
    "Hungarian": "匈牙利语",
    "Romanian": "罗马尼亚语",
    "Turkish": "土耳其语",
    "Ukrainian": "乌克兰语",
    "Vietnames": "越南语",
    "Arabic": "阿拉伯语",
    "Serbian": "塞尔维亚语",
    "Croatian": "克罗地亚语",
    "Google": "Google",
    "Baidu": "百度",
    "Youdao": "有道",
    "Papago": "Papago",
    "Offline": "离线",

    // Tag search dropdown
    "Group name:": "分组名称：",
    "Edit search:": "编辑搜索：",
    "Rename group:": "重命名分组：",
    "Add section": "添加分组",
    "Delete tag group": "删除标签分组",
    // ppixiv sets this with innerText, which splits the message into a text node per line.
    "Delete this group and all tags inside it? This can't be undone.": "删除此分组及其中的所有标签？此操作无法撤销。",
    "Edit": "编辑",
    "Saved tag already exists": "这个标签已经保存过了",
    "Saved tag updated": "已更新保存的标签",

    // Messages
    "Please log in to use ppixiv.": "请先登录 Pixiv 再使用 ppixiv。",
    "Couldn't find a slideshow image to view": "找不到可用于幻灯片的图片",
    "Couldn't find an image to view": "找不到可查看的图片",
    "Image isn't bookmarked": "这张图片还没有收藏",
    // ppixiv's message says ^B, but Ctrl+B only bookmarks.  Ctrl+Shift+B removes the bookmark.
    "Already bookmarked (^B to remove bookmark)": "已经收藏过了（按 Ctrl+Shift+B 取消收藏）",
    "Couldn't get Recaptcha token for following a user": "无法获取 reCAPTCHA 验证，关注失败",
    "Error retrieving follow info to update tags": "获取关注信息失败，无法更新关注标签",
    "Image panning enabled": "已开启图片平移",
    "Image panning disabled": "已关闭图片平移",
    "Not following this user": "还没有关注此用户",
    "Already following this user": "已经关注了此用户",
    "Bookmark removed": "已取消收藏",
    "Bookmark edited": "已修改收藏",
    "Bookmarked privately": "已非公开收藏",
    "Bookmarked folder": "已收藏文件夹",
    "Already liked this image": "已经赞过了",
    "Illustration liked": "已点赞",
    "Unfollowed": "已取消关注",
    "Downloading video...": "正在下载视频…",
    "Downloading image...": "正在下载图片…",
    "These settings will only affect this image, and aren't saved. Settings for all images can be changed from settings.": "这些设置只对这张图片生效，不会保存。所有图片的设置可以在设置里修改。",
    "Previewing portrait": "正在预览竖版",
    "Previewing landscape": "正在预览横版",
    "Loading...": "加载中…",
    "Saving...": "保存中…",
    "Path copied to clipboard": "路径已复制到剪贴板",
    "Downloading not available": "无法下载",
    "Error downloading file": "下载文件出错",
    "Unknown error": "未知错误",
    "Request error": "请求出错",
    "Invalid response": "无效的响应",
    "Error loading illustration": "加载作品出错",
    "Error loading user": "加载用户出错",

    // Editing (mostly for vview, but harmless)
    "Undo": "撤销",
    "Redo": "重做",
    "Save": "保存",
    "Crop": "裁剪",
    "Edit panning": "编辑平移",
    "Inpainting": "修复",
    "Stop editing": "停止编辑",
    "Edit start": "编辑起点",
    "Swap start and end": "交换起点和终点",
    "Edit end": "编辑终点",
    "Edit anchor": "编辑锚点",
    "Portrait/landscape": "竖图/横图",
    "Clear animation": "清除动画",
    "View": "查看",
    "Create lines": "绘制线条",
    "Set as default": "设为默认",
    "Save default": "保存为默认",
    "Thickness": "粗细",
    "Downscale": "缩小",
    "Soften edges": "柔化边缘",
    "No edits to copy": "没有可复制的编辑",
    "Edits copied": "已复制编辑",
    "Clipboard doesn't contain edits": "剪贴板里没有编辑数据",
    "Edits pasted": "已粘贴编辑",
};

// Strings with variable parts.  Each entry is [regex, replacement].
const PATTERNS = [
    [/^(\d+(?:\.\d+)?) (sec|min|hour|day|month|year)s? (ago|from now)$/, (m, n, unit, dir) => {
        const units = { sec: "秒", min: "分钟", hour: "小时", day: "天", month: "个月", year: "年" };
        return `${n} ${units[unit]}${dir == "ago" ? "前" : "后"}`;
    }],
    [/^Page (\d+)\/(\d+)$/, "第 $1/$2 页"],
    [/^Page (\d+)$/, "第 $1 页"],
    [/^(\d+) pages?$/, "共 $1 页"],
    [/^Refresh search from page (\d+)$/, "从第 $1 页刷新搜索"],
    [/^Show (R18G?|ALL) works$/i, (m, a) => a.toUpperCase() == "ALL" ? "显示全部作品" : `显示 ${a.toUpperCase()} 作品`],
    [/^(Mute|Unmute) this user$/, (m, a) => a == "Mute" ? "屏蔽此用户" : "取消屏蔽此用户"],
    [/^Muted the (tag|user) (.+)$/, (m, t, l) => `已屏蔽${t == "tag" ? "标签" : "用户"} ${l}`],
    [/^Unmuted the (tag|user) (.+)$/, (m, t, l) => `已取消屏蔽${t == "tag" ? "标签" : "用户"} ${l}`],
    [/^Search: (.+)$/, "搜索：$1"],
    [/^Search users: (.+)$/, "搜索用户：$1"],
    [/^(.+)'s Illustrations$/, "$1 的作品"],
    [/^(.+)'s Bookmarks$/, "$1 的收藏"],
    [/^(.+)'s Follows$/, "$1 的关注"],
    [/^(.+)'s followed users$/, "$1 关注的用户"],
    [/^Similar artists to (.+)$/, "与 $1 相似的作者"],
    [/^Users who bookmarked (.+)$/, "收藏了 $1 的用户"],
    // ppixiv appends " privately" to the name: "Followed " + name + " privately".
    [/^Followed (.+?)( privately)?$/, (m, name, priv) => `已${priv ? "非公开" : ""}关注 ${name}`],
    [/^Now following (.+) (privately|publically)$/, (m, name, priv) => `已改为${priv == "privately" ? "非公开" : "公开"}关注 ${name}`],
    [/^Unfollow (.+)\?$/, "取消关注 $1？"],
    [/^Unfollowed (.+)$/, "已取消关注 $1"],
    [/^Added the tag "(.+)" to (.+)$/, "已给 $2 添加关注标签「$1」"],
    [/^Removed the tag "(.+)" from (.+)$/, "已从 $2 移除关注标签「$1」"],
    [/^Change bookmark to (public|private)$/, (m, type) => type == "public" ? "改为公开收藏" : "改为非公开收藏"],
    [/^Downloading (\d+) pages\.\.\.$/, "正在下载 $1 页…"],
    [/^Previewing (\d+):(\d+)$/, "预览比例 $1:$2"],
    [/^Error reading series: (.*)$/, "读取系列时出错：$1"],
    [/^Group "(.+)" deleted$/, "已删除分组「$1」"],
    [/^Group "(.+)" already exists$/, "分组「$1」已存在"],
    [/^Couldn't edit bookmark: (.+)$/, "无法修改收藏：$1"],
    [/^Error changing follow privacy: (.*)$/, "更改关注的公开范围时出错：$1"],
    [/^Error editing follow tags: (.*)$/, "编辑关注标签时出错：$1"],
    [/^Error saving image edits: (.*)$/, "保存图片编辑时出错：$1"],
    [/^Error reading search: (.*)$/, "读取搜索结果时出错：$1"],
    [/^Error reading directory: (.*)$/, "读取文件夹时出错：$1"],
    [/^Couldn't remove bookmark: (.+)$/, "无法取消收藏：$1"],
    [/^Error following user (\d+): (.+)$/, "关注用户 $1 时出错：$2"],
    [/^The file "(.+)" doesn't contain exported ppixiv data\.$/, "文件「$1」不包含 ppixiv 导出的数据。"],
    [/^Saved Tags (\d+)$/, "已保存的标签 $1"],
    // The heading of your own bookmarks: "1234 Private Bookmarks / tag".  The count is missing
    // until it loads.
    [/^(?:(\d+) )?(Public |Private )?Bookmarks?(?: \/ (.+))?$/, (m, n, kind, tag) =>
        (n ? `${n} 个` : "") + (kind == "Public " ? "公开" : kind == "Private " ? "非公开" : "") + "收藏" +
        (tag == null ? "" : tag == "untagged" ? " / 未分类" : ` / ${tag}`)],
    [/^(\d+) frames$/, "$1 帧"],
    [/^Suggestions for (.+)$/, "「$1」的建议"],
    // The time filter button shows "2 years" after "2 years ago" is picked.
    [/^([1-7]) years?$/, "$1 年前"],
    [/^Clear (\d+) recent search(?:es)?\?$/, "清除 $1 条最近搜索？"],
    [/^This group contains (\d+) tags?\.$/, "此分组包含 $1 个标签。"],
    [/^Artist: (.+)$/, "作者：$1"],
    [/^(\d+(?:\.\d+)?) seconds?$/, "$1 秒"],
];

// Icon ligatures are never text, even inside the rows ALLOW_SELECTOR lets through.
const ICON_SELECTOR = ".font-icon, .material-icons, .ppixiv-icon";

// Text that should never be translated because it's user content or the ppixiv changelog.
const SKIP_SELECTOR = [
    "textarea", "[contenteditable]", "script", "style",
    ".description", ".title", ".author", ".folder-text", ".tag", ".tag-entry", ".tag-name",
    ".tag-list", ".search-tags", ".word", ".user-name", ".username",
    ".thumbnail-label", ".whats-new-dialog", ".follow-tag", ".utags_ul", ".avatar-widget",
    // User names and tags that ppixiv shows outside the containers above.
    ".thumbnail-box .muted-label", ".follow-widget .view-posts .label",
    // ppixiv copies the hovered element's data-popup here, and that is already translated
    // unless it came from user content, like an avatar's user name.
    ".tooltip-display-text",
    // Saved search groups are named by the user.  "Saved tags" is ppixiv's default name.
    ".tag-section[data-group]:not([data-group='Saved tags']) > .label",
].join(",");

// Exceptions inside skipped containers: fixed UI rows that sit among user tags.
// - the bookmark tag dropdown's "Add" and "Refresh" rows, and its "Loading..." row
// - the "All", "All bookmarks" and "All tags" default rows of tag filter dropdowns, and the
//   "Untagged" row that always follows "All bookmarks"
// - "Add new tag", always the first row of the follow tag list
// - the "AI-generated" row of the info panel's tag list, the only row without a link
const ALLOW_SELECTOR = [
    ".popup-bookmark-tag-entry:not(.tag-toggle)", ".tag-list > .loading",
    ".tag-entry[data-default]", ".tag-entry[data-default] + .tag-entry[data-type=bookmark-tag]",
    ".vertical-list > .follow-tag:first-child", ".tag-list > .tag-entry:not([href])",
].join(",");

// Tag filter buttons show the selected entry's label, which is the user's tag once one is
// picked.  Only ppixiv's own labels are translated there.
const TAG_BUTTON_LABEL_SELECTOR = [
    ".bookmark-tag-button .label", ".follow-tag-button .label", ".follow-tags-button .label",
    ".member-tags-button .label",
].join(",");
const TAG_BUTTON_LABELS = new Set(["All bookmarks", "Untagged", "All tags", "Tags", "All", "Other"]);

const THEME_CSS = "/* Modern theme for ppixiv.  Every rule is scoped to html.ppx-zh, which the script only sets\n * while ppixiv is running, so Pixiv's own pages are never restyled. */\n\nhtml.ppx-zh {\n    --pz-bg: #0c0d10;\n    --pz-surface: rgba(22, 23, 28, 0.78);\n    --pz-surface-strong: rgba(20, 21, 26, 0.92);\n    --pz-surface-solid: #16171c;\n    --pz-raise: rgba(255, 255, 255, 0.055);\n    --pz-raise-hover: rgba(255, 255, 255, 0.1);\n    --pz-raise-active: rgba(255, 255, 255, 0.14);\n    --pz-border: rgba(255, 255, 255, 0.08);\n    --pz-border-strong: rgba(255, 255, 255, 0.14);\n    --pz-text: #eceef2;\n    --pz-text-2: #a6aab4;\n    --pz-text-3: #6d717c;\n    --pz-accent: #3a9dff;\n    --pz-accent-hover: #5cb0ff;\n    --pz-accent-soft: rgba(58, 157, 255, 0.18);\n    --pz-accent-ring: rgba(58, 157, 255, 0.45);\n    --pz-heart: #ff4060;\n    --pz-radius: 16px;\n    --pz-radius-md: 12px;\n    --pz-radius-sm: 9px;\n    --pz-shadow: 0 18px 48px -12px rgba(0, 0, 0, 0.7), 0 4px 14px rgba(0, 0, 0, 0.35);\n    --pz-shadow-sm: 0 6px 18px -6px rgba(0, 0, 0, 0.6);\n    --pz-blur: blur(22px) saturate(150%);\n    --pz-text-strong: #fff;\n    --pz-selected-text: #d8ebff;\n    --pz-tag-text: #cfe3ff;\n    --pz-scroll-thumb: rgba(255, 255, 255, 0.14);\n    --pz-scroll-thumb-hover: rgba(255, 255, 255, 0.3);\n    --pz-tip-bg: rgba(14, 15, 19, 0.94);\n    --pz-toast-bg: rgba(18, 19, 24, 0.9);\n    --pz-input-bg: rgba(255, 255, 255, 0.04);\n    --pz-input-bg-focus: rgba(255, 255, 255, 0.06);\n    --pz-thumb-placeholder: #15161a;\n    --pz-desc-bg: rgba(255, 255, 255, 0.04);\n    --pz-desc-text: #c9ccd3;\n    --pz-dialog-bg: rgba(18, 19, 24, 0.96);\n    --pz-switch-off: rgba(255, 255, 255, 0.16);\n    --pz-menu-bg: #17181d;\n    --pz-menu-shadow: rgba(0, 0, 0, 0.55);\n    --pz-menu-button: rgba(255, 255, 255, 0.06);\n    --pz-menu-button-text: #a9adb6;\n    --pz-menu-button-disabled: rgba(255, 255, 255, 0.03);\n    --pz-menu-button-disabled-text: #4f525a;\n    --pz-menu-button-hover: rgba(255, 255, 255, 0.16);\n    --pz-warning-bg: rgba(255, 196, 0, 0.08);\n    --pz-warning-border: rgba(255, 196, 0, 0.25);\n    --pz-warning-text: #f3dc9a;\n    --pz-icon: #9a9ea8;\n    --pz-icon-disabled: #4a4d55;\n    --pz-ease: cubic-bezier(0.2, 0.7, 0.2, 1);\n    --pz-font: \"Inter\", \"MiSans\", \"HarmonyOS Sans SC\", \"PingFang SC\", \"Noto Sans CJK SC\",\n        \"Source Han Sans SC\", \"Microsoft YaHei UI\", \"Microsoft YaHei\", system-ui, sans-serif;\n\n    /* ppixiv's own variables */\n    --main-background-color: var(--pz-bg);\n    --background-noise: none;\n    --button-color: var(--pz-icon);\n    --button-highlight-color: var(--pz-text-strong);\n    --button-disabled-color: var(--pz-icon-disabled);\n    --input-outline: var(--pz-border-strong);\n    --input-outline-focused: var(--pz-accent);\n    --ui-bg-color: var(--pz-surface);\n    --ui-fg-color: var(--pz-text);\n    --ui-border-color: var(--pz-border);\n    --ui-bg-section-color: var(--pz-desc-bg);\n    --frame-bg-color: var(--pz-surface-strong);\n    --frame-fg-color: var(--pz-text);\n    --frame-border-color: var(--pz-border);\n    --dropdown-menu-hover-color: var(--pz-raise-hover);\n    --box-link-fg-color: var(--pz-text);\n    --box-link-bg-color: var(--pz-raise);\n    --box-link-disabled-color: var(--pz-text-3);\n    --box-link-hover-color: var(--pz-raise-hover);\n    --box-link-selected-color: var(--pz-accent-soft);\n    --box-link-selected-hover-color: var(--pz-accent-soft);\n    --minor-text-fg-color: var(--pz-text-2);\n    --title-fg-color: var(--pz-text);\n    --title-bg-color: transparent;\n    --like-button-color: var(--pz-icon);\n    --like-button-liked-color: #f5b700;\n    --like-button-hover-color: var(--pz-text-strong);\n}\n\nhtml.ppx-zh body,\nhtml.ppx-zh .title-font,\nhtml.ppx-zh .widget input,\nhtml.ppx-zh .widget textarea,\nhtml.ppx-zh .widget button {\n    font-family: var(--pz-font);\n}\n\nhtml.ppx-zh body {\n    color: var(--pz-text);\n    -webkit-font-smoothing: antialiased;\n    letter-spacing: 0.01em;\n}\n\nhtml.ppx-zh ::selection {\n    background: var(--pz-accent-soft);\n}\n\n/* ------------------------------------------------------------------ scrollbars */\n\nhtml.ppx-zh:not(.macos) ::-webkit-scrollbar,\nhtml.ppx-zh:not(.macos) .search-results::-webkit-scrollbar {\n    width: 10px;\n    height: 10px;\n    background-color: transparent;\n}\n\nhtml.ppx-zh:not(.macos) ::-webkit-scrollbar-thumb {\n    background-color: var(--pz-scroll-thumb);\n    border: 3px solid transparent;\n    border-radius: 999px;\n    background-clip: padding-box;\n}\n\nhtml.ppx-zh:not(.macos) ::-webkit-scrollbar-thumb:hover {\n    background-color: var(--pz-scroll-thumb-hover);\n}\n\nhtml.ppx-zh:not(.macos) ::-webkit-scrollbar-corner,\nhtml.ppx-zh:not(.macos) ::-webkit-resizer {\n    background: transparent;\n}\n\n/* ------------------------------------------------------------------ tooltips */\n\n@keyframes pz-tip-in {\n    from { opacity: 0; translate: 0 3px; }\n    to { opacity: 1; translate: 0 0; }\n}\n\n@media (hover: hover) {\n    html.ppx-zh .popup:hover::after {\n        background: var(--pz-tip-bg);\n        color: var(--pz-text);\n        border: 1px solid var(--pz-border-strong);\n        border-radius: 8px;\n        padding: 5px 10px;\n        font-size: 12.5px;\n        font-weight: 500;\n        line-height: 1.4;\n        letter-spacing: 0.02em;\n        text-shadow: none;\n        box-shadow: var(--pz-shadow-sm);\n        top: -2.4em;\n        animation: pz-tip-in 0.14s var(--pz-ease) both;\n    }\n\n    html.ppx-zh .popup.popup-bottom:hover::after {\n        top: auto;\n        bottom: -2.5em;\n    }\n}\n\n/* ------------------------------------------------------------------ icon buttons */\n\nhtml.ppx-zh .icon-button {\n    position: relative;\n    isolation: isolate;\n    transition: color 0.15s var(--pz-ease);\n}\n\nhtml.ppx-zh .icon-button::before {\n    content: \"\";\n    position: absolute;\n    inset: -4px;\n    z-index: -1;\n    border-radius: 10px;\n    background: transparent;\n    transition: background-color 0.15s var(--pz-ease), transform 0.15s var(--pz-ease);\n    transform: scale(0.85);\n}\n\n@media (hover: hover) {\n    html.ppx-zh .icon-button:hover::before {\n        background: var(--pz-raise-hover);\n        transform: scale(1);\n    }\n}\n\nhtml.ppx-zh .icon-button.highlighted::before {\n    background: var(--pz-accent-soft);\n    transform: scale(1);\n}\n\nhtml.ppx-zh .button-row {\n    gap: calc(var(--icon-row-gap) + 6px);\n}\n\n/* The settings button turns yellow when ppixiv has a changelog entry.  Use a dot instead. */\nhtml.ppx-zh[data-whats-new-updated] .screen-search-container .thumbnail-ui-box .settings-menu-box {\n    --button-color: var(--pz-icon);\n}\n\nhtml.ppx-zh[data-whats-new-updated] .settings-menu-box .icon-button::after {\n    content: \"\";\n    position: absolute;\n    top: -2px;\n    right: -2px;\n    width: 7px;\n    height: 7px;\n    border-radius: 50%;\n    background: var(--pz-accent);\n    box-shadow: 0 0 0 2px var(--pz-bg);\n}\n\n/* ------------------------------------------------------------------ box links (pills) */\n\nhtml.ppx-zh .box-link {\n    border-radius: var(--pz-radius-sm);\n    transition: background-color 0.15s var(--pz-ease), color 0.15s var(--pz-ease), box-shadow 0.15s var(--pz-ease);\n    font-weight: 500;\n}\n\nhtml.ppx-zh .box-link.selected {\n    color: var(--pz-selected-text);\n    box-shadow: inset 0 0 0 1px var(--pz-accent-ring);\n}\n\nhtml.ppx-zh .menu-dropdown-button.selected,\nhtml.ppx-zh .menu-dropdown-button {\n    box-shadow: none;\n}\n\nhtml.ppx-zh .box-link.disabled {\n    opacity: 0.55;\n}\n\nhtml.ppx-zh .box-button-row > .box-link {\n    margin: 0 0.18em;\n}\n\nhtml.ppx-zh .box-link .icon.with-text {\n    opacity: 0.8;\n}\n\n/* ------------------------------------------------------------------ inputs */\n\nhtml.ppx-zh .input-field-container {\n    outline: none;\n    border: 1px solid var(--pz-border-strong);\n    background: var(--pz-input-bg);\n    border-radius: var(--pz-radius-sm);\n    transition: border-color 0.15s, box-shadow 0.15s, background-color 0.15s;\n}\n\nhtml.ppx-zh .input-field-container:focus-within {\n    outline: none;\n    border-color: var(--pz-accent);\n    background: var(--pz-input-bg-focus);\n    box-shadow: 0 0 0 3px var(--pz-accent-soft);\n}\n\nhtml.ppx-zh .input-field-container > input {\n    background: transparent;\n    color: var(--pz-text);\n    border: none;\n}\n\nhtml.ppx-zh .input-field-container > input::placeholder {\n    color: var(--pz-text-3);\n}\n\n/* ------------------------------------------------------------------ dropdowns and menus */\n\nhtml.ppx-zh .dropdown-box {\n    background: var(--pz-surface-strong);\n    -webkit-backdrop-filter: var(--pz-blur);\n    backdrop-filter: var(--pz-blur);\n    border: 1px solid var(--pz-border-strong);\n    border-radius: var(--pz-radius-md);\n    box-shadow: var(--pz-shadow);\n}\n\nhtml.ppx-zh .popup-menu-box {\n    padding: 6px;\n}\n\nhtml.ppx-zh .vertical-list > .box-link {\n    height: 2.15em;\n    border-radius: 8px;\n}\n\nhtml.ppx-zh .vertical-list .box-link-row {\n    gap: 0.25em;\n}\n\nhtml.ppx-zh .vertical-list .box-link-row > .box-link {\n    border-radius: 8px;\n}\n\nhtml.ppx-zh .follow-widget .separator {\n    height: 1px;\n    margin: 4px 6px;\n    background-color: var(--pz-border-strong);\n}\n\n/* ------------------------------------------------------------------ search page header */\n\nhtml.ppx-zh .screen-search-container .thumbnail-ui-box {\n    background: var(--pz-surface);\n    -webkit-backdrop-filter: var(--pz-blur);\n    backdrop-filter: var(--pz-blur);\n    border: 1px solid var(--pz-border);\n    border-radius: 20px;\n    box-shadow: var(--pz-shadow);\n    padding: 14px 20px 14px;\n}\n\nhtml.ppx-zh .screen-search-container .search-desktop-ui {\n    padding-top: calc(max(14px, env(safe-area-inset-top)));\n    padding-bottom: 14px;\n}\n\nhtml.ppx-zh .screen-search-container .search-title {\n    font-size: 22px;\n    font-weight: 700;\n    letter-spacing: 0.02em;\n}\n\nhtml.ppx-zh .screen-search-container .thumbnail-ui-box .button-row {\n    margin-top: 4px;\n}\n\nhtml.ppx-zh .screen-search-container .thumbnail-ui-box .data-source-ui {\n    padding-top: 2px;\n}\n\n/* The discovery type filter sits on the same line as the age buttons. */\nhtml.ppx-zh .screen-search-container .data-source-ui > div:has(> .pz-discovery-type) {\n    display: flex;\n    flex-wrap: wrap;\n    align-items: center;\n    gap: 0.5em 1.2em;\n}\n\nhtml.ppx-zh .title-with-button-row-container:hover .title-with-button-row {\n    background: transparent;\n}\n\nhtml.ppx-zh .avatar-widget .avatar,\nhtml.ppx-zh .screen-search-container .image-for-suggestions > img {\n    border-radius: 14px;\n}\n\n/* ------------------------------------------------------------------ thumbnails */\n\nhtml.ppx-zh .search-view .thumbnail-box a.thumbnail-link {\n    border-radius: 12px;\n    background: var(--pz-thumb-placeholder);\n    transition: box-shadow 0.2s var(--pz-ease), transform 0.2s var(--pz-ease);\n}\n\nhtml.ppx-zh:not(.mobile) .search-view .thumbnail-box a.thumbnail-link {\n    border-radius: 12px;\n}\n\n/* Hover ring.  Drawn inside the thumbnail, since rows use contain: strict and clip anything\n * outside them. */\nhtml.ppx-zh .search-view .thumbnail-box a.thumbnail-link {\n    position: relative;\n}\n\nhtml.ppx-zh .search-view .thumbnail-box a.thumbnail-link::after {\n    content: \"\";\n    position: absolute;\n    inset: 0;\n    border-radius: inherit;\n    pointer-events: none;\n    box-shadow: inset 0 0 0 2px rgba(255, 255, 255, 0.9), inset 0 0 0 3px rgba(0, 0, 0, 0.35);\n    opacity: 0;\n    transition: opacity 0.15s var(--pz-ease);\n}\n\n@media (hover: hover) {\n    html.ppx-zh .search-view .thumbnail-box:hover a.thumbnail-link::after {\n        opacity: 1;\n    }\n}\n\nhtml.ppx-zh .search-view .thumbnail-box .bottom-row {\n    bottom: 6px;\n    padding: 0 6px;\n}\n\n/* These sit on the image in both themes, so their text stays light. */\nhtml.ppx-zh .search-view .thumbnail-box .bottom-row .thumbnail-label,\nhtml.ppx-zh .search-view .thumbnail-box .bottom-row .manga-info-box {\n    color: #fff;\n    background: rgba(12, 13, 16, 0.62);\n    -webkit-backdrop-filter: blur(10px);\n    backdrop-filter: blur(10px);\n    border: 1px solid rgba(255, 255, 255, 0.1);\n    border-radius: 999px;\n    font-size: 13px;\n    font-weight: 600;\n    font-variant-numeric: tabular-nums;\n}\n\nhtml.ppx-zh .search-view .thumbnail-box .bottom-row .manga-info-box {\n    padding: 0.2em 0.6em;\n}\n\nhtml.ppx-zh .search-view .thumbnail-box .bottom-row .manga-info-box:hover {\n    background: var(--pz-accent);\n    border-color: transparent;\n}\n\n/* ppixiv gives each expanded post its own underline color inline, to tell neighboring posts\n * apart. */\nhtml.ppx-zh .search-view .thumbnail-box.expanded-thumb a.thumbnail-link {\n    border-bottom-width: 4px;\n}\n\n/* On the darkened image in both themes. */\nhtml.ppx-zh .search-view .thumbnail-box.muted .muted-text .muted-label {\n    font-size: 13px;\n    font-weight: 600;\n    color: rgba(255, 255, 255, 0.75);\n}\n\nhtml.ppx-zh .search-view > .no-results > .message {\n    background: var(--pz-surface);\n    border: 1px solid var(--pz-border);\n    border-radius: var(--pz-radius-md);\n    padding: 0.6em 1.2em;\n    color: var(--pz-text-2);\n}\n\n/* ------------------------------------------------------------------ toast messages */\n\nhtml.ppx-zh .hover-message > .message {\n    background: var(--pz-toast-bg);\n    -webkit-backdrop-filter: var(--pz-blur);\n    backdrop-filter: var(--pz-blur);\n    border: 1px solid var(--pz-border-strong);\n    border-radius: 14px;\n    box-shadow: var(--pz-shadow);\n    padding: 0.55em 1.1em;\n    font-size: 15px;\n    font-weight: 500;\n}\n\n/* ------------------------------------------------------------------ image info panel */\n\nhtml.ppx-zh .image-ui .ui-box {\n    background: var(--pz-surface);\n    -webkit-backdrop-filter: var(--pz-blur);\n    backdrop-filter: var(--pz-blur);\n    border: 1px solid var(--pz-border);\n    border-radius: 18px;\n    box-shadow: var(--pz-shadow);\n    padding: 14px 16px 16px;\n    top: 14px;\n    left: 14px;\n    min-width: min(500px, 90vw);\n    max-height: min(560px, 100vh - 28px);\n}\n\nhtml.ppx-zh .image-ui .ui-box .avatar-popup {\n    top: 14px;\n    right: 14px;\n    width: 3.6em;\n}\n\nhtml.ppx-zh .image-ui .ui-box .title-block {\n    display: flex;\n    flex-direction: column;\n    gap: 2px;\n    padding: 0;\n    margin: 0 0 8px;\n    border-radius: 0;\n    line-height: 1.35;\n}\n\n/* Put the author on its own muted line instead of \"title by author\". */\nhtml.ppx-zh .image-ui .ui-box .title-block .author-block > span:first-child {\n    display: none;\n}\n\nhtml.ppx-zh .image-ui .ui-box .title-block .author {\n    vertical-align: baseline;\n}\n\n/* Keep the icon row clear of the avatar in the top right. */\nhtml.ppx-zh .image-ui .ui-box > .button-row {\n    padding-right: 4.2em;\n    gap: calc(var(--icon-row-gap) + 2px);\n}\n\nhtml.ppx-zh .image-ui .ui-box .title-block .title {\n    font-size: 19px;\n    font-weight: 700;\n}\n\nhtml.ppx-zh .image-ui .ui-box .title-block .author {\n    color: var(--pz-text-2);\n    font-size: 15px;\n    font-weight: 600;\n}\n\nhtml.ppx-zh .image-ui .ui-box .post-info {\n    display: flex;\n    flex-wrap: wrap;\n    gap: 6px;\n    margin: 2px 0 8px;\n}\n\nhtml.ppx-zh .image-ui .ui-box .post-info > * {\n    background: var(--pz-raise);\n    color: var(--pz-text-2);\n    border-radius: 999px;\n    padding: 3px 10px;\n    font-size: 12px;\n    font-weight: 600;\n    font-variant-numeric: tabular-nums;\n}\n\nhtml.ppx-zh .image-ui .ui-box .post-info > [hidden] {\n    display: none !important;\n}\n\nhtml.ppx-zh .image-ui .ui-box .box-link.tag {\n    height: 1.9em;\n    font-size: 14px;\n    border-radius: 999px;\n    padding: 0 0.8em;\n    margin: 0 4px 6px 0;\n    background: var(--pz-raise);\n    color: var(--pz-tag-text);\n}\n\nhtml.ppx-zh .image-ui .ui-box .box-link.tag:hover {\n    background: var(--pz-accent-soft);\n}\n\nhtml.ppx-zh .image-ui .ui-box .description {\n    margin-top: 6px;\n    padding: 10px 12px;\n    border-radius: var(--pz-radius-md);\n    background: var(--pz-desc-bg);\n    color: var(--pz-desc-text);\n    line-height: 1.65;\n    font-size: 14px;\n}\n\nhtml.ppx-zh .image-ui .ui-box .description * {\n    color: inherit;\n}\n\nhtml.ppx-zh .image-ui .ui-box .description a {\n    color: var(--pz-accent-hover);\n}\n\n/* ------------------------------------------------------------------ context menu (hold right click) */\n\nhtml.ppx-zh .popup-context-menu {\n    --context-menu-bg-color: var(--pz-menu-bg);\n    color: var(--pz-text);\n    filter: drop-shadow(0 16px 32px var(--pz-menu-shadow));\n}\n\nhtml.ppx-zh .popup-context-menu .button-strip > .button-block:first-child {\n    border-radius: 16px 0 0 16px;\n}\n\nhtml.ppx-zh .popup-context-menu .button-strip > .button-block:last-child {\n    border-radius: 0 16px 16px 0;\n}\n\nhtml.ppx-zh .popup-context-menu .button-strip > .button-block:only-child {\n    border-radius: 16px;\n}\n\nhtml.ppx-zh .popup-context-menu .button-strip .button {\n    background-color: var(--pz-menu-button);\n    color: var(--pz-menu-button-text);\n    border-radius: 11px;\n    transition: background-color 0.12s var(--pz-ease), color 0.12s var(--pz-ease);\n}\n\nhtml.ppx-zh .popup-context-menu .button-strip .button:not(.enabled) {\n    color: var(--pz-menu-button-disabled-text);\n    background-color: var(--pz-menu-button-disabled);\n}\n\n@media (hover: hover) {\n    html.ppx-zh .popup-context-menu .button-strip .button.enabled:hover {\n        background-color: var(--pz-menu-button-hover);\n        color: var(--pz-text-strong);\n    }\n}\n\n/* The like button is replaced with \"similar works\", which works whether or not the image was\n * liked.  ppixiv drops .enabled and adds .liked after a like, so style it the same either way. */\nhtml.ppx-zh .popup-context-menu .button-strip .button.pz-similar {\n    color: var(--pz-menu-button-text);\n    background-color: var(--pz-menu-button);\n}\n\nhtml.ppx-zh .popup-context-menu .button.button-like.pz-similar > svg {\n    color: inherit;\n    margin-top: 0;\n}\n\n@media (hover: hover) {\n    html.ppx-zh .popup-context-menu .button-strip .button.pz-similar:hover {\n        background-color: var(--pz-menu-button-hover);\n        color: var(--pz-text-strong);\n    }\n}\n\nhtml.ppx-zh .popup-context-menu .button-strip .button.enabled.selected {\n    background-color: var(--pz-accent-soft);\n    color: var(--pz-selected-text);\n    box-shadow: inset 0 0 0 1px var(--pz-accent-ring);\n}\n\nhtml.ppx-zh .popup-context-menu .avatar-widget .avatar {\n    border-radius: 11px;\n}\n\nhtml.ppx-zh .popup-context-menu .context-menu-image-info {\n    color: var(--pz-text-2);\n    font-weight: 600;\n    font-variant-numeric: tabular-nums;\n}\n\nhtml.ppx-zh .popup-context-menu .tooltip-display .tooltip-display-text {\n    background: var(--pz-tip-bg);\n    border: 1px solid var(--pz-border-strong);\n    border-radius: 9px;\n    padding: 4px 10px;\n    font-size: 13.5px;\n    font-weight: 500;\n}\n\n/* ------------------------------------------------------------------ dialogs */\n\nhtml.ppx-zh .dialog {\n    border: 1px solid var(--pz-border);\n    box-shadow: var(--pz-shadow);\n}\n\n/* ppixiv shows dialogs as full-width sheets, without .floating, when the window is under 500px\n * in either direction, as on phones.  Those keep ppixiv's own top-only rounding. */\nhtml.ppx-zh :has(> .dialog) > .dialog {\n    background: var(--pz-dialog-bg);\n}\n\nhtml.ppx-zh :has(> .dialog).floating > .dialog {\n    border-radius: 20px;\n}\n\nhtml.ppx-zh :has(> .dialog).floating {\n    -webkit-backdrop-filter: blur(6px);\n    backdrop-filter: blur(6px);\n}\n\nhtml.ppx-zh .dialog .header {\n    padding-bottom: 6px;\n}\n\nhtml.ppx-zh .dialog .header .header-text {\n    font-weight: 700;\n    letter-spacing: 0.03em;\n}\n\nhtml.ppx-zh .dialog .header .close-button-container .close-button {\n    border-radius: 10px;\n    transition: background-color 0.15s;\n}\n\nhtml.ppx-zh .dialog .header .close-button-container .close-button:hover {\n    background: var(--pz-raise-hover);\n}\n\n/* Settings: sidebar */\nhtml.ppx-zh .settings-dialog > .dialog > .scroll {\n    gap: 1.5em;\n}\n\nhtml.ppx-zh .settings-dialog .sections {\n    gap: 2px;\n    padding-right: 1.2em;\n    border-right: 1px solid var(--pz-border);\n}\n\nhtml.ppx-zh .settings-dialog .sections > .box-link {\n    padding: 0.45em 0.8em;\n    height: auto;\n    border-radius: 10px;\n    font-size: 0.95em;\n    box-shadow: none;\n}\n\nhtml.ppx-zh .settings-dialog .sections > .box-link:not(.selected) {\n    opacity: 1;\n    color: var(--pz-text-2);\n}\n\nhtml.ppx-zh .settings-dialog .sections > .box-link.selected {\n    background: var(--pz-raise-active);\n    color: var(--pz-text-strong);\n    box-shadow: none;\n}\n\nhtml.ppx-zh[data-whats-new-updated] .settings-dialog .sections .settings-page-button[data-page='whatsNew'] {\n    color: var(--pz-accent-hover);\n}\n\n/* Settings: rows */\nhtml.ppx-zh .settings-list {\n    gap: 2px;\n}\n\nhtml.ppx-zh .settings-list > .box-link {\n    padding: 0.6em 0.8em;\n    border-radius: 12px;\n    box-shadow: none;\n}\n\nhtml.ppx-zh .settings-list > .box-link.clickable:hover,\nhtml.ppx-zh .settings-list > .box-link:has(.checkbox):hover {\n    background: var(--pz-raise);\n}\n\nhtml.ppx-zh .settings-list > .box-link > .explanation {\n    color: var(--pz-text-3);\n    font-size: 78%;\n    margin-top: 2px;\n    font-weight: 400;\n}\n\n/* Checkboxes become switches.  The script mirrors the icon state into data-pz-on. */\nhtml.ppx-zh .font-icon.checkbox {\n    font-size: 0 !important;\n    color: transparent !important;\n    flex: none;\n    position: relative;\n    width: 38px;\n    height: 22px;\n    border-radius: 999px;\n    background: var(--pz-switch-off);\n    transition: background-color 0.18s var(--pz-ease);\n    align-self: center;\n}\n\nhtml.ppx-zh .font-icon.checkbox::after {\n    content: \"\";\n    position: absolute;\n    top: 3px;\n    left: 3px;\n    width: 16px;\n    height: 16px;\n    border-radius: 50%;\n    background: #fff;\n    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);\n    transition: transform 0.18s var(--pz-ease);\n}\n\nhtml.ppx-zh .font-icon.checkbox[data-pz-on=\"1\"] {\n    background: var(--pz-accent);\n}\n\nhtml.ppx-zh .font-icon.checkbox[data-pz-on=\"1\"]::after {\n    transform: translateX(16px);\n}\n\n/* Sliders */\nhtml.ppx-zh .slider {\n    --track-height: 6px;\n    --thumb-height: 18px;\n    --on-color: var(--pz-accent);\n    --off-color: var(--pz-switch-off);\n}\n\nhtml.ppx-zh .slider:hover {\n    --on-color: var(--pz-accent-hover);\n}\n\nhtml.ppx-zh .slider .track-left {\n    border-radius: 999px 0 0 999px;\n}\n\nhtml.ppx-zh .slider .track-right {\n    border-radius: 0 999px 999px 0;\n}\n\nhtml.ppx-zh .slider .thumb {\n    background: #fff;\n    box-shadow: 0 0 0 4px var(--pz-accent-soft), 0 2px 6px rgba(0, 0, 0, 0.45);\n}\n\n/* Mutes */\nhtml.ppx-zh .muted-tags-popup .mute-warning {\n    background: var(--pz-warning-bg);\n    border: 1px solid var(--pz-warning-border);\n    color: var(--pz-warning-text);\n    border-radius: 12px;\n    padding: 10px 12px;\n    font-size: 0.85em;\n    line-height: 1.6;\n}\n\n/* ------------------------------------------------------------------ image editor */\n\n/* The editor's buttons sit straight on the image.  ppixiv gives them a black background, and\n * the theme's translucent button colors would leave them unreadable over a bright or dark image,\n * so every state gets an opaque color here. */\nhtml.ppx-zh .image-editor {\n    --box-link-bg-color: var(--pz-surface-solid);\n    --box-link-hover-color: color-mix(in srgb, var(--pz-text) 12%, var(--pz-surface-solid));\n    --box-link-selected-color: color-mix(in srgb, var(--pz-accent) 22%, var(--pz-surface-solid));\n    --box-link-selected-hover-color: color-mix(in srgb, var(--pz-accent) 30%, var(--pz-surface-solid));\n}\n\n/* ------------------------------------------------------------------ video controls */\n\n/* The controls fill the strip, so it can't fade out completely without losing contrast at the\n * top.  ppixiv's own strip is rgba(0, 0, 0, 0.5). */\nhtml.ppx-zh .video-ui > .video-ui-strip {\n    background: linear-gradient(to top, rgba(0, 0, 0, 0.7), rgba(0, 0, 0, 0.5));\n}\n\nhtml.ppx-zh .seek-bar > .seek-parts > [data-seek-part=\"fill\"] {\n    background-color: var(--pz-accent);\n}\n\nhtml.ppx-zh .seek-bar > .seek-parts > [data-seek-part=\"loaded\"] {\n    background-color: rgba(255, 255, 255, 0.35);\n}\n\n/* ------------------------------------------------------------------ light mode */\n\n/* The script adds pz-light to <html> when light mode is chosen, or when \"follow system\" is\n * chosen and the system is light. */\nhtml.ppx-zh.pz-light {\n    color-scheme: light;\n\n    --pz-bg: #f3f4f7;\n    --pz-bg-rgb: 243 244 247;\n    --pz-surface: rgba(255, 255, 255, 0.8);\n    --pz-surface-strong: rgba(255, 255, 255, 0.95);\n    --pz-surface-solid: #fff;\n    --pz-raise: rgba(20, 24, 34, 0.05);\n    --pz-raise-hover: rgba(20, 24, 34, 0.085);\n    --pz-raise-active: rgba(20, 24, 34, 0.11);\n    --pz-border: rgba(20, 24, 34, 0.09);\n    --pz-border-strong: rgba(20, 24, 34, 0.14);\n    --pz-text: #1c1e24;\n    --pz-text-2: #5c616c;\n    --pz-text-3: #8e939e;\n    --pz-text-strong: #0b0c0f;\n    --pz-accent: #0a84f0;\n    --pz-accent-hover: #0070d6;\n    --pz-accent-soft: rgba(10, 132, 240, 0.12);\n    --pz-accent-ring: rgba(10, 132, 240, 0.45);\n    --pz-selected-text: #005bb5;\n    --pz-tag-text: #0b62c4;\n    --pz-shadow: 0 18px 44px -14px rgba(20, 28, 45, 0.25), 0 3px 10px rgba(20, 28, 45, 0.08);\n    --pz-shadow-sm: 0 6px 16px -6px rgba(20, 28, 45, 0.22);\n    --pz-scroll-thumb: rgba(20, 24, 34, 0.18);\n    --pz-scroll-thumb-hover: rgba(20, 24, 34, 0.35);\n    --pz-tip-bg: rgba(255, 255, 255, 0.97);\n    --pz-toast-bg: rgba(255, 255, 255, 0.95);\n    --pz-input-bg: rgba(255, 255, 255, 0.75);\n    --pz-input-bg-focus: #fff;\n    --pz-thumb-placeholder: #e4e6ea;\n    --pz-desc-bg: rgba(20, 24, 34, 0.04);\n    --pz-desc-text: #3b3f48;\n    --pz-dialog-bg: rgba(255, 255, 255, 0.97);\n    --pz-switch-off: rgba(20, 24, 34, 0.18);\n    --pz-menu-bg: #fff;\n    --pz-menu-shadow: rgba(20, 28, 45, 0.24);\n    --pz-menu-button: rgba(20, 24, 34, 0.05);\n    --pz-menu-button-text: #4d525c;\n    --pz-menu-button-disabled: rgba(20, 24, 34, 0.025);\n    --pz-menu-button-disabled-text: #b9bdc5;\n    --pz-menu-button-hover: rgba(20, 24, 34, 0.1);\n    --pz-warning-bg: rgba(240, 170, 0, 0.1);\n    --pz-warning-border: rgba(200, 140, 0, 0.3);\n    --pz-warning-text: #7a5600;\n    --pz-icon: #6a6f7a;\n    --pz-icon-disabled: #c4c7cd;\n    --like-button-liked-color: #e0a100;\n\n    /* ppixiv sets an inline black background on <html> while it starts up. */\n    background-color: var(--pz-bg) !important;\n}\n\n/* Dim the page behind dialogs less. */\nhtml.ppx-zh.pz-light :has(> .dialog) {\n    background-color: rgba(20, 24, 34, calc(var(--dialog-visible, 1) * 0.28));\n}\n\nhtml.ppx-zh.pz-light .search-title .word.or,\nhtml.ppx-zh.pz-light .input-dropdown .search .word.or {\n    color: var(--pz-text-3);\n}\n\nhtml.ppx-zh.pz-light .years-ago > a {\n    background-color: var(--pz-raise);\n}\n\n/* Section headers in the tag search dropdown (\"Recent tags\", saved groups).  ppixiv draws them\n * navy with inherited text color.  They're sticky, so the background has to stay opaque. */\nhtml.ppx-zh.pz-light .input-dropdown .tag-section {\n    background-color: #e9edf4;\n    color: var(--pz-text-2);\n}\n\nhtml.ppx-zh.pz-light .input-dropdown :is(.edit-button, .group-suggestions-button) {\n    border-color: var(--pz-border-strong);\n}\n\n@media (hover: hover) {\n    html.ppx-zh.pz-light .input-dropdown :is(.edit-button, .group-suggestions-button):hover {\n        border-color: var(--pz-text-3);\n    }\n}\n\n/* Other colors ppixiv hard-codes for its dark background: the non-premium warning icon in the\n * mute settings, already-muted tags in the \"Edit mutes\" dialog, and the text prompt's submit\n * button. */\nhtml.ppx-zh.pz-light .non-premium-mute-warning .icon {\n    color: var(--pz-warning-text);\n}\n\nhtml.ppx-zh.pz-light .post-mute-list .entry.muted .tag-name {\n    color: #c0392b;\n}\n\nhtml.ppx-zh.pz-light .text-entry-popup .input-box > .submit-button {\n    border-color: var(--pz-border-strong);\n}\n\n@media (hover: hover) {\n    html.ppx-zh.pz-light .text-entry-popup .input-box > .submit-button:hover {\n        background-color: var(--pz-raise-hover);\n    }\n}\n\n/* ppixiv fades the search results behind the image view to black.  Keep its opacity formula,\n * which makes the layer fully transparent while the image view is hidden, and only change the\n * color. */\nhtml.ppx-zh.pz-light .screen-illust-container .fade-search {\n    background-color: rgb(var(--pz-bg-rgb) / calc(1 - (var(--illust-hidden) - 0.1) / 0.9));\n}\n\n/* Bookmark and like counts are outlined so they read over icons.  Use a light outline. */\nhtml.ppx-zh.pz-light {\n    --minor-text-shadow-color: rgba(255, 255, 255, 0.95);\n}\n\n/* ------------------------------------------------------------------ appearance button */\n\nhtml.ppx-zh .pz-theme-button svg {\n    display: block;\n    width: 100%;\n    height: 100%;\n}\n";
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

})();
