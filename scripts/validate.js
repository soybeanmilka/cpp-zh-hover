#!/usr/bin/env node
'use strict';

// 词条校验：字段类型 / 长度 / 枚举 / 链接域名 / 重复 key
// 用法：
//   node scripts/validate.js data/10-containers-strings.json
//   node scripts/validate.js --all

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const KINDS = new Set([
  '头文件', '类', '成员函数', '函数', '关键字', '类型', '对象', '宏', '命名空间', '运算符', '特性',
]);
const LINK_HOSTS = new Set(['zh.cppreference.com', 'en.cppreference.com', 'learn.microsoft.com', 'man7.org']);
const FIELDS = new Set([
  'keys', 'scope', 'kind', 'brief', 'sig', 'params', 'ret', 'notes', 'pits', 'example', 'link', 'since',
]);

const errors = [];
const warnings = [];

function err(file, idx, key, msg) {
  errors.push(`${file} [#${idx}${key ? ' ' + key : ''}] ${msg}`);
}
function warn(file, idx, key, msg) {
  warnings.push(`${file} [#${idx}${key ? ' ' + key : ''}] ${msg}`);
}

function strField(file, idx, key, field, value, maxLen, required) {
  if (value === undefined) {
    if (required) err(file, idx, key, `缺少必填字段 ${field}`);
    return;
  }
  if (typeof value !== 'string') {
    err(file, idx, key, `${field} 必须是字符串`);
    return;
  }
  if (!value.trim()) {
    err(file, idx, key, `${field} 不能是空字符串`);
    return;
  }
  if (maxLen && value.length > maxLen) {
    err(file, idx, key, `${field} 超过 ${maxLen} 字（现在 ${value.length} 字）`);
  }
}

function strArray(file, idx, key, field, value, maxCount, maxLen) {
  if (value === undefined) return;
  if (!Array.isArray(value)) {
    err(file, idx, key, `${field} 必须是字符串数组`);
    return;
  }
  if (value.length > maxCount) err(file, idx, key, `${field} 最多 ${maxCount} 条，现在 ${value.length} 条`);
  value.forEach((item, i) => {
    if (typeof item !== 'string' || !item.trim()) {
      err(file, idx, key, `${field}[${i}] 必须是非空字符串`);
    } else if (item.length > maxLen) {
      err(file, idx, key, `${field}[${i}] 超过 ${maxLen} 字（现在 ${item.length} 字）`);
    }
  });
}

function checkEntry(file, idx, entry, seen) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
    err(file, idx, '', '词条必须是对象');
    return;
  }
  for (const field of Object.keys(entry)) {
    if (!FIELDS.has(field)) err(file, idx, entry.keys && entry.keys[0], `未知字段 ${field}`);
  }

  // keys
  if (!Array.isArray(entry.keys) || entry.keys.length === 0) {
    err(file, idx, '', 'keys 必须是非空数组');
    return;
  }
  if (entry.keys.length > 4) err(file, idx, entry.keys[0], 'keys 最多 4 个');
  for (const k of entry.keys) {
    if (typeof k !== 'string' || !k.trim()) {
      err(file, idx, '', 'keys 里每项都必须是非空字符串');
      return;
    }
    if (!/^[A-Za-z_<][-A-Za-z0-9_:<>./+]*$/.test(k)) {
      err(file, idx, k, `key 格式可疑（只允许英文标识符 / <头文件>）`);
    }
  }
  const keyLabel = entry.keys[0];

  strField(file, idx, keyLabel, 'kind', entry.kind, undefined, true);
  if (entry.kind !== undefined && typeof entry.kind === 'string' && !KINDS.has(entry.kind)) {
    err(file, idx, keyLabel, `kind 只能是：${[...KINDS].join(' / ')}（现在是 ${entry.kind}）`);
  }
  strField(file, idx, keyLabel, 'scope', entry.scope, 24);
  strField(file, idx, keyLabel, 'brief', entry.brief, 60, true);
  strField(file, idx, keyLabel, 'sig', entry.sig, 400);
  strField(file, idx, keyLabel, 'ret', entry.ret, 100);
  strField(file, idx, keyLabel, 'since', entry.since, 12);
  strField(file, idx, keyLabel, 'example', entry.example, 400);

  if (entry.params !== undefined) {
    if (!Array.isArray(entry.params)) {
      err(file, idx, keyLabel, 'params 必须是 [[参数名, 解释], ...]');
    } else {
      if (entry.params.length > 4) err(file, idx, keyLabel, `params 最多 4 组，现在 ${entry.params.length} 组`);
      entry.params.forEach((pair, i) => {
        if (!Array.isArray(pair) || pair.length !== 2 ||
            typeof pair[0] !== 'string' || typeof pair[1] !== 'string') {
          err(file, idx, keyLabel, `params[${i}] 必须是 [参数名, 中文解释]`);
          return;
        }
        if (pair[0].length > 24) err(file, idx, keyLabel, `params[${i}] 参数名太长`);
        if (pair[1].length > 80) err(file, idx, keyLabel, `params[${i}] 解释超过 80 字`);
        if (!pair[0].trim() || !pair[1].trim()) err(file, idx, keyLabel, `params[${i}] 不能为空`);
      });
    }
  }

  strArray(file, idx, keyLabel, 'notes', entry.notes, 3, 80);
  strArray(file, idx, keyLabel, 'pits', entry.pits, 3, 90);

  if (entry.example !== undefined && typeof entry.example === 'string') {
    if (entry.example.includes('\t')) err(file, idx, keyLabel, 'example 里不许用 tab，用空格');
    if (entry.example.split('\n').length > 8) err(file, idx, keyLabel, 'example 超过 8 行');
  }

  if (entry.link !== undefined) {
    if (typeof entry.link !== 'string') {
      err(file, idx, keyLabel, 'link 必须是字符串');
    } else {
      try {
        const u = new URL(entry.link);
        if (u.protocol !== 'https:') err(file, idx, keyLabel, 'link 必须是 https');
        if (!LINK_HOSTS.has(u.hostname)) {
          err(file, idx, keyLabel, `link 域名只能是 ${[...LINK_HOSTS].join(' / ')}（现在 ${u.hostname}）`);
        }
      } catch {
        err(file, idx, keyLabel, 'link 不是合法 URL');
      }
    }
  }

  // 同文件内 keys + scope 去重
  for (const k of entry.keys) {
    const sig = k + '\u0000' + (entry.scope || '');
    if (seen.has(sig)) {
      err(file, idx, keyLabel, `重复词条：key=${k} scope=${entry.scope || '(空)'} 已在本文件出现过`);
    }
    seen.set(sig, idx);
  }

  if (!entry.scope) warn(file, idx, keyLabel, '没有 scope，卡片标题会只有名字');
}

function loadFile(file) {
  const raw = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    errors.push(`${file} JSON 解析失败：${e.message}`);
    return null;
  }
  if (!Array.isArray(data)) {
    errors.push(`${file} 顶层必须是数组`);
    return null;
  }
  return data;
}

function main() {
  const args = process.argv.slice(2);
  let files;
  if (args.includes('--all') || args.length === 0) {
    if (!fs.existsSync(DATA_DIR)) {
      console.error('没有 data 目录：' + DATA_DIR);
      process.exit(1);
    }
    files = fs.readdirSync(DATA_DIR).filter((f) => f.endsWith('.json')).map((f) => path.join(DATA_DIR, f));
    if (files.length === 0) {
      console.error('data 目录里没有 .json');
      process.exit(1);
    }
  } else {
    files = args.filter((a) => !a.startsWith('--')).map((a) => path.resolve(a));
  }

  const globalSeen = new Map();
  let totalEntries = 0;
  const perFile = [];

  for (const file of files) {
    const label = path.relative(process.cwd(), file) || path.basename(file);
    if (!fs.existsSync(file)) {
      errors.push(`${label} 文件不存在`);
      continue;
    }
    const data = loadFile(file);
    if (!data) continue;

    const seen = new Map();
    data.forEach((entry, idx) => checkEntry(label, idx, entry, seen));
    // 跨文件重复 key+scope（只有 --all 时才有意义，但单文件跑也无害）
    for (const [sig, idx] of seen) {
      if (globalSeen.has(sig)) {
        const [k, scope] = sig.split('\u0000');
        errors.push(`${label} [#${idx} ${k}] 与其他文件重复：key=${k} scope=${scope || '(空)'}（另一处 ${globalSeen.get(sig)}）`);
      } else {
        globalSeen.set(sig, `${label}#${idx}`);
      }
    }
    totalEntries += data.length;
    perFile.push(`${label}: ${data.length} 条`);
  }

  for (const line of perFile) console.log('  ' + line);
  for (const w of warnings) console.log('WARN ' + w);
  for (const e of errors) console.log('ERROR ' + e);
  console.log(`\n合计 ${totalEntries} 条词条，${errors.length} 个错误，${warnings.length} 个警告`);

  if (errors.length > 0) process.exit(1);
}

main();
