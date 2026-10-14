# ppixiv 中文与现代界面

[ppixiv](https://github.com/ppixiv/ppixiv) 的配套油猴脚本，提供简体中文界面、中文标签译名和深浅色主题，也支持推荐类型筛选、高清缩略图和原图预加载。ppixiv 仍从 Greasy Fork 单独更新。

## 安装

1. 安装 Tampermonkey 和 [ppixiv](https://github.com/ppixiv/ppixiv)。
2. 打开 [脚本安装链接](https://raw.githubusercontent.com/Stevey233/ppixiv-zh/main/dist/ppixiv-zh.user.js)，在 Tampermonkey 页面确认安装。
3. 打开 Pixiv，进入 ppixiv 界面。

Tampermonkey 会通过 `dist/ppixiv-zh.meta.js` 检查版本，有新版本时自动更新。

如果装过 0.8.0 或更早的版本，安装后请在 Tampermonkey 中删除旧脚本。新版本更换了 namespace，脚本管理器会把它当作另一个脚本，两份同时启用会重复运行。

## 界面和标签

菜单、按钮、提示、设置和消息显示为简体中文，相对时间显示为 "3 小时前"。作品信息面板里的作品标题、用户名和说明保留原文，ppixiv 的更新日志也保留原文。

工具栏、信息面板、菜单和对话框使用半透明背景，按钮和缩略图使用圆角，设置中的复选框显示为开关。中文字体优先使用系统已安装的 MiSans、HarmonyOS Sans、苹方和 Noto Sans CJK SC。

顶部工具栏齿轮左侧的按钮按深色、浅色、跟随系统的顺序切换，默认深色，选择会保存在浏览器中。

标签优先显示 Pixiv 返回的中文译名。日文标签没有中文译名时使用英文；中文或纯汉字标签没有含汉字的译名时保留原标签，例如 "原神" 不会显示成 Genshin Impact。中文译名需要先在搜索、推荐等页面收到，同一标签的英文数据不会覆盖已保存的中文译名。

## 推荐作品筛选

推荐作品页提供全部类型、插画、漫画三个选项，插画包含动图，选择会保存在浏览器中。筛选在本地进行，所以每批结果可能少于未筛选时。

如果一批结果中没有所选类型，脚本会继续请求，最多共 4 次。仍没有结果时停止加载并提示，可以点刷新重新获取。相似作品页不使用这个筛选。

## 看图和右键菜单

桌面端双击图片不会进入浏览器全屏。需要全屏时按 F11，或点右键菜单的全屏按钮。移动端和 iPad 的双击缩放照常使用。

按住右键打开菜单，再用左键点对应按钮：

- 收藏并下载原图，替换原来的收藏标签按钮。收藏的公开范围跟随 ppixiv 的默认设置，已收藏的作品不会重复收藏。单张作品下载原图，多页作品下载全部页的 ZIP，动图下载 MKV。收藏标签仍可在作品信息面板里编辑。
- 相似作品，替换原来的点赞按钮，打开与 "更多 > 相似插画" 相同的页面。点赞仍可在作品信息面板中操作，也可按 Ctrl+V。

## 缩略图和预加载

缩略图按屏幕上的实际像素大小选择 WebP 尺寸，包含系统缩放和浏览器缩放。三档分别为 `600x1200_90_webp`、`1200x1200_80_webp`、`1200x1200_90_webp`，每张通常约 40 到 180 KB。调大缩略图后，脚本在后台下载更大的版本，加载完再替换。

脚本根据最近 40 张缩略图的下载时间估算网速，并折算同时下载的数量。单张估计耗时超过 0.4 秒时不用最高画质，超过 1 秒时只用最小尺寸；网速恢复后重新检查可见缩略图。浏览器开启节省流量时只用最小尺寸。

某张图加载较大尺寸失败后，本次浏览不再重试该 URL。首次加载失败时回到 ppixiv 原来的缩略图，后台升级失败时保留当前图片。重建缩略图不会重复计数，累计 5 个不同 URL 失败后停止新的高清请求和升级。断网期间的失败不计入这个阈值。

鼠标在缩略图上停留 0.3 秒后，脚本请求作品信息并预加载原图，也会下载看图时先显示的 540 预览图。看多页作品时预加载后面 2 页。图片预加载最多同时进行 3 个，新请求会取消最旧的未完成请求；悬停触发的预加载每分钟最多 30 次。

被屏蔽的作品不预加载，浏览器开启节省流量时关闭预加载。悬停过但没有点开的作品也可能下载原图，因此这个功能会增加流量。

## 可选设置

在 Pixiv 页面的控制台执行命令后刷新：

```js
// 恢复英文标签译名。
localStorage.setItem("ppx-zh-tag-language", "en");

// 关闭高清缩略图。
localStorage.setItem("ppx-zh-thumb-quality", "off");
```

删除对应设置即可恢复默认行为：

```js
localStorage.removeItem("ppx-zh-tag-language");
localStorage.removeItem("ppx-zh-thumb-quality");
```

## 修改和构建

源文件在 `src/`：

- `dict.js` 保存翻译词典、带变量的句式和不翻译的区域。
- `theme.css` 保存主题样式，规则限定在 `html.ppx-zh` 下。
- `main.js` 处理翻译、主题和功能扩展。
- `header.js` 保存油猴脚本信息和版本号。

脚本在页面环境中运行。ppixiv 会替换 `setTimeout`、`fetch` 和 `createElement`，因此定时器和请求使用它保留的接口，主题通过 `document.adoptedStyleSheets` 注入。检测到 ppixiv 界面后才启用主题，界面翻译限定在带 `widget` 类的元素内。

构建不需要安装依赖：

```sh
node build.mjs
```

构建会生成 `dist/ppixiv-zh.user.js` 和只含脚本头的 `dist/ppixiv-zh.meta.js`。发布时提高 `src/header.js` 中的 `@version`，重新构建，并把两个生成文件一同提交。

## 测试

测试在 Node.js 中运行：

```sh
node test/unit.mjs
node test/thumbnails.mjs
node test/tag-translations.mjs /path/to/ppixiv/web/vview/misc/tag-translations.js
```

`unit.mjs` 检查界面文字和句式的翻译、推荐筛选、请求 URL、网速估算和标签译名选择。`thumbnails.mjs` 检查失败去重、重建元素后的降级，以及停用后是否仍发起升级或替换图片。

`tag-translations.mjs` 使用 ppixiv 的实际 `TagTranslations` 类，检查并发更新是否保留中文、写入失败后能否继续保存，以及 IndexedDB 不可用时的会话缓存。省略源码路径时，默认读取 `~/scratch/ppixiv-src/repo/web/vview/misc/tag-translations.js`。

排查漏翻译的文字时，可在脚本开头加入 `var PZ_DEBUG = true;`，然后在页面控制台执行 `document.dispatchEvent(new Event("pz-dump"))`。结果保存在 `document.documentElement.dataset.pzMissing`。

## 许可证

本项目采用 [MIT 许可证](LICENSE)。
