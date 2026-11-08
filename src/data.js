'use strict';

// 词条加载 / 索引 / 查找。纯 Node，不依赖 vscode，
// 这样 scripts/ 和 test/ 都能直接 require，方便离线验证。

const fs = require('fs');
const path = require('path');

function normalize(entry, file, index) {
  const keys = Array.isArray(entry.keys) ? entry.keys : entry.key ? [entry.key] : [];
  return {
    id: file + '#' + index,
    file,
    index,
    keys: keys.map(String),
    scope: entry.scope || '',
    kind: entry.kind || '',
    brief: entry.brief || '',
    sig: entry.sig || '',
    params: Array.isArray(entry.params) ? entry.params : [],
    ret: entry.ret || '',
    notes: Array.isArray(entry.notes) ? entry.notes : [],
    pits: Array.isArray(entry.pits) ? entry.pits : [],
    example: entry.example || '',
    link: entry.link || '',
    since: entry.since || '',
  };
}

/**
 * 读 data/*.json，返回 { entries, files }。
 * @param {string} extensionRoot 扩展根目录（有 data/ 的目录）
 */
function loadEntries(extensionRoot) {
  const dataDir = path.join(extensionRoot, 'data');
  if (!fs.existsSync(dataDir)) throw new Error('找不到 data 目录：' + dataDir);
  const files = fs
    .readdirSync(dataDir)
    .filter((f) => f.toLowerCase().endsWith('.json'))
    .sort();
  if (files.length === 0) throw new Error('data 目录里没有 .json 词条文件');
  const entries = [];
  for (const file of files) {
    const raw = fs.readFileSync(path.join(dataDir, file), 'utf8').replace(/^\uFEFF/, '');
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      throw new Error(file + ' JSON 解析失败：' + e.message);
    }
    if (!Array.isArray(parsed)) throw new Error(file + ' 顶层必须是数组');
    parsed.forEach((entry, i) => entries.push(normalize(entry, file, i)));
  }
  return { entries, files };
}

function buildIndex(entries) {
  const index = new Map();
  for (const entry of entries) {
    for (const key of entry.keys) {
      if (!index.has(key)) index.set(key, []);
      index.get(key).push(entry);
    }
  }
  return index;
}

/**
 * 用上下文给同名词条打分：scope 里的英文关键词出现在附近几行就加分。
 * 例：附近有 mutex 时，lock 优先给 mutex::lock 而不是 weak_ptr::lock。
 */
function scopeScore(entry, contextText) {
  if (!entry.scope || !contextText) return 0;
  let score = 0;
  for (const word of entry.scope.split(/[\/、,，\s]+/)) {
    if (!word || !/^[A-Za-z_][A-Za-z0-9_:<>-]*$/.test(word)) continue;
    if (contextText.includes(word)) score += 20;
  }
  return score;
}

/**
 * @param {Map<string, object[]>} index
 * @param {string[]} names 候选标识符，越靠前越具体
 * @param {string} contextText 光标附近几行源码
 * @param {number} maxCards 最多返回几张卡
 */
function lookup(index, names, contextText, maxCards) {
  const max = Math.max(1, maxCards || 3);
  const seen = new Set();
  const hits = [];
  names.forEach((name, order) => {
    const list = index.get(name);
    if (!list) return;
    for (const entry of list) {
      if (seen.has(entry.id)) continue;
      seen.add(entry.id);
      hits.push({ entry, score: scopeScore(entry, contextText) + (order === 0 ? 5 : 0) });
    }
  });
  hits.sort(
    (a, b) =>
      b.score - a.score ||
      a.entry.file.localeCompare(b.entry.file) ||
      a.entry.index - b.entry.index
  );
  return hits.slice(0, max).map((h) => h.entry);
}

const IDENT_CHAR = /[A-Za-z0-9_]/;

/**
 * 从一行源码 + 光标列号，算出要查的标识符和悬停下划线范围。
 * 纯函数，不依赖 vscode，方便单测。
 * @returns {{names: string[], start: number, end: number} | null}
 */
function buildCandidates(lineText, character) {
  // 1) #include <thread> / #include "xxx.h"
  const inc = /^\s*#\s*include\s*[<"]([^>"]+)[>"]/.exec(lineText);
  if (inc) {
    const header = inc[1];
    const start = lineText.indexOf(header, inc.index);
    const end = start + header.length;
    if (start >= 0 && character >= start - 1 && character <= end + 1) {
      return { names: ['<' + header + '>'], start, end };
    }
  }

  // 2) operator<< / operator[] 这类符号：整段归到 operator 词条
  const opRe = /\boperator\s*([^\s(]+)/g;
  let m;
  while ((m = opRe.exec(lineText))) {
    const opStart = m.index + m[0].indexOf(m[1]);
    const opEnd = opStart + m[1].length;
    if (character >= m.index && character <= opEnd) {
      return { names: ['operator'], start: m.index, end: opEnd };
    }
  }

  // 3) 普通标识符
  let start = Math.max(0, Math.min(character, lineText.length));
  let end = start;
  if (start > 0 && !IDENT_CHAR.test(lineText[start] || '') && IDENT_CHAR.test(lineText[start - 1])) {
    start -= 1;
  }
  while (start > 0 && IDENT_CHAR.test(lineText[start - 1])) start -= 1;
  while (end < lineText.length && IDENT_CHAR.test(lineText[end])) end += 1;
  if (start >= end) return null;
  const word = lineText.slice(start, end);
  if (!word) return null;
  return { names: [word], start, end };
}

module.exports = { loadEntries, buildIndex, lookup, buildCandidates, scopeScore };
