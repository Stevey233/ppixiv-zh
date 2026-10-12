// Bundles src/ into dist/ppixiv-zh.user.js.
import fs from 'node:fs';
const read = (f) => fs.readFileSync(new URL(f, import.meta.url), 'utf8');
const css = read('./src/theme.css');
const out = [
    read('./src/header.js'),
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
console.log('wrote dist/ppixiv-zh.user.js', out.length, 'bytes');
