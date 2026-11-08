#!/usr/bin/env node
'use strict';

// 在终端里预览一条词条渲染成悬停卡片后的样子。
// 用法：
//   node scripts/preview.js push_back
//   node scripts/preview.js "<thread>"
//   node scripts/preview.js mutex --all

const path = require('path');
const { loadEntries, buildIndex, lookup } = require('../src/data');
const { renderHover } = require('../src/render');

const root = path.join(__dirname, '..');
const { entries } = loadEntries(root);
const index = buildIndex(entries);

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const key = args[0];
if (!key) {
  console.error('用法: node scripts/preview.js <标识符>');
  process.exit(1);
}

const max = process.argv.includes('--all') ? 10 : 3;
const hits = lookup(index, [key], '', max);
if (hits.length === 0) {
  console.log('没有找到词条：' + key + '（共 ' + entries.length + ' 条）');
  process.exit(2);
}
console.log(renderHover(hits, {}));
console.log('\n（命中 ' + hits.length + ' 条 / 词库共 ' + entries.length + ' 条）');
