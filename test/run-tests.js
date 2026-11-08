#!/usr/bin/env node
'use strict';

// 纯 Node 单测：验证词条能加载、查找逻辑、#include 识别、渲染不出 undefined。
// 跑法：node test/run-tests.js

const path = require('path');
const assert = require('assert');
const { loadEntries, buildIndex, lookup, buildCandidates } = require('../src/data');
const { renderHover, renderEntry } = require('../src/render');

const root = path.join(__dirname, '..');
const { entries, files } = loadEntries(root);
const index = buildIndex(entries);

let passed = 0;
let failed = 0;

function check(name, fn) {
  try {
    fn();
    passed += 1;
    console.log('ok   ' + name);
  } catch (e) {
    failed += 1;
    console.log('FAIL ' + name + '\n     ' + e.message);
  }
}

check('词条能加载', () => {
  assert.ok(entries.length >= 200, '词条只有 ' + entries.length + ' 条');
  assert.ok(files.length >= 5, '词条文件只有 ' + files.length + ' 个');
});

check('每条词条都有 keys / kind / brief', () => {
  for (const entry of entries) {
    assert.ok(entry.keys.length > 0, entry.id + ' 没有 keys');
    assert.ok(entry.kind, entry.id + ' 没有 kind');
    assert.ok(entry.brief && entry.brief.length > 1, entry.id + ' 没有 brief');
  }
});

check('普通标识符识别', () => {
  const target = buildCandidates('    v.push_back(1);', 8);
  assert.ok(target, '没识别到');
  assert.deepStrictEqual(target.names, ['push_back']);
  assert.strictEqual(target.start, 6);
  assert.strictEqual(target.end, 15);
});

check('光标停在词尾也能识别', () => {
  const target = buildCandidates('    v.push_back(1);', 15);
  assert.ok(target);
  assert.deepStrictEqual(target.names, ['push_back']);
});

check('#include <thread> 识别成头文件', () => {
  const target = buildCandidates('#include <thread>', 12);
  assert.ok(target);
  assert.deepStrictEqual(target.names, ['<thread>']);
});

check('#include "xxx.h" 识别成头文件', () => {
  const target = buildCandidates('#  include "thread_pool.hpp"', 16);
  assert.ok(target);
  assert.deepStrictEqual(target.names, ['<thread_pool.hpp>']);
});

check('operator<< 归到 operator 词条', () => {
  const target = buildCandidates('std::ostream& operator<<(std::ostream& os, int v);', 24);
  assert.ok(target);
  assert.deepStrictEqual(target.names, ['operator']);
});

check('词库覆盖核心符号', () => {
  for (const key of ['push_back', 'mutex', 'thread', 'sort', 'const', 'printf', 'size']) {
    const hits = lookup(index, [key], '', 3);
    assert.ok(hits.length > 0, '查不到 ' + key);
  }
});

check('头文件词条能查到', () => {
  const hits = lookup(index, ['<thread>'], '', 3);
  assert.ok(hits.length > 0, '查不到 <thread>');
  assert.ok(hits.some((h) => h.kind === '头文件'), '<thread> 不是头文件词条');
});

check('上下文能消歧（mutex 附近优先 mutex 相关卡）', () => {
  const hits = lookup(index, ['lock'], 'std::mutex m;\nstd::lock_guard<std::mutex> lk(m);', 3);
  assert.ok(hits.length > 0, '查不到 lock');
  const first = hits[0];
  const firstText = JSON.stringify(first);
  assert.ok(/mutex/i.test(firstText), '第一张卡和 mutex 无关：' + first.scope);
});

check('多张卡渲染不带 undefined', () => {
  const md = renderHover(lookup(index, ['wait'], '', 3), {});
  assert.ok(md.includes('**wait**'), '标题没渲染出来');
  assert.ok(!md.includes('undefined'), '渲染里出现 undefined');
});

check('每条词条都能渲染', () => {
  for (const entry of entries) {
    const md = renderEntry(entry, {});
    assert.ok(md && md.length > 0, entry.id + ' 渲染为空');
    assert.ok(!md.includes('undefined'), entry.id + ' 渲染出 undefined');
  }
});

console.log('\n' + passed + ' 项通过，' + failed + ' 项失败，词库共 ' + entries.length + ' 条（' + files.length + ' 个文件）');
if (failed > 0) process.exit(1);
