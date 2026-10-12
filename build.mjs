// Bundles src/ into dist/ppixiv-zh.user.js, and writes the header alone to dist/ppixiv-zh.meta.js.
// Tampermonkey downloads the .meta.js file to check for updates.
import fs from 'node:fs';
const read = (f) => fs.readFileSync(new URL(f, import.meta.url), 'utf8');
const header = read('./src/header.js');
const css = read('./src/theme.css');
const out = [
    header,
    '(function() {',
    '"use strict";',
    read('./src/dict.js'),
    `const THEME_CSS = ${JSON.stringify(css)};`,
    read('./src/main.js'),
    '})();',
    '',
].join('\n');
fs.mkdirSync(new URL('./dist/', import.meta.url), { recursive: true });
fs.writeFileSync(new URL('./dist/ppixiv-zh.user.js', import.meta.url), out);
fs.writeFileSync(new URL('./dist/ppixiv-zh.meta.js', import.meta.url), header);
console.log('wrote dist/ppixiv-zh.user.js', out.length, 'bytes');
