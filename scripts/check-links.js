#!/usr/bin/env node
'use strict';

// 抽样检查词条里的文档链接是否真的能打开。
// 用法：
//   node scripts/check-links.js            # 抽查前 40 个（去重后）
//   node scripts/check-links.js --all      # 全部
//   node scripts/check-links.js 60         # 抽查前 60 个

const https = require('https');
const path = require('path');
const { loadEntries } = require('../src/data');

const root = path.join(__dirname, '..');
const { entries } = loadEntries(root);
const unique = [...new Set(entries.map((e) => e.link).filter(Boolean))];

const all = process.argv.includes('--all');
const numeric = process.argv.slice(2).find((a) => /^\d+$/.test(a));
const limit = all ? unique.length : numeric ? Number(numeric) : 40;
const sample = unique.slice(0, limit);
const TIMEOUT = 15000;
const CONCURRENCY = 6;

function check(url) {
  return new Promise((resolve) => {
    const req = https.get(
      url,
      {
        timeout: TIMEOUT,
        headers: {
          'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) cpp-zh-hover-linkcheck',
          'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8',
        },
      },
      (res) => {
        const result = { url, status: res.statusCode, location: res.headers.location || '' };
        res.destroy();
        resolve(result);
      }
    );
    req.on('timeout', () => {
      req.destroy();
      resolve({ url, status: 'timeout' });
    });
    req.on('error', (err) => resolve({ url, status: 'error', message: err.message }));
  });
}

async function main() {
  console.log('去重后链接 ' + unique.length + ' 个，本次检查 ' + sample.length + ' 个');
  const results = [];
  let cursor = 0;
  async function worker() {
    while (cursor < sample.length) {
      const index = cursor;
      cursor += 1;
      const result = await check(sample[index]);
      results.push(result);
      const mark =
        result.status === 200 || (typeof result.status === 'number' && result.status >= 200 && result.status < 400)
          ? 'ok  '
          : 'BAD ';
      console.log(mark + String(result.status).padEnd(7) + result.url + (result.message ? '  (' + result.message + ')' : ''));
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, sample.length) }, worker));

  const bad = results.filter(
    (r) => !(r.status === 200 || (typeof r.status === 'number' && r.status >= 200 && r.status < 400))
  );
  console.log('\n通过 ' + (results.length - bad.length) + ' / ' + results.length);
  if (bad.length) {
    console.log('打不开的链接：');
    for (const r of bad) console.log('  ' + r.status + '  ' + r.url);
    process.exitCode = 1;
  }
}

main();
