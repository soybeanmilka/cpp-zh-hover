'use strict';

// 把一条词条渲染成悬停卡片（Markdown）。纯 Node，不依赖 vscode。

function linkLabel(link) {
  try {
    const host = new URL(link).hostname;
    if (host === 'zh.cppreference.com') return '中文文档（cppreference）';
    if (host === 'en.cppreference.com') return '英文文档（cppreference）';
    if (host === 'learn.microsoft.com') return '微软文档';
    if (host === 'man7.org') return 'Linux man 手册（英文）';
    return '文档';
  } catch (_) {
    return '文档';
  }
}

function titleOf(entry) {
  const name = entry.keys[0] || '';
  const head = name.startsWith('<') ? '`' + name + '`' : '**' + name + '**';
  const tail = [];
  if (entry.scope) tail.push(entry.scope);
  if (entry.kind) tail.push(entry.kind);
  if (entry.since) tail.push(entry.since);
  return tail.length ? head + '  ·  ' + tail.join(' · ') : head;
}

/**
 * @param {object} entry 词条
 * @param {{showExample?: boolean, showPits?: boolean, showLink?: boolean}} [opts]
 */
function renderEntry(entry, opts) {
  const o = opts || {};
  const lines = [];
  lines.push(titleOf(entry));
  lines.push('');
  if (entry.brief) {
    lines.push(entry.brief);
    lines.push('');
  }
  if (entry.sig) {
    lines.push('```cpp');
    lines.push(entry.sig);
    lines.push('```');
    lines.push('');
  }
  const meta = [];
  for (const pair of entry.params) {
    if (!Array.isArray(pair) || pair.length < 2) continue;
    meta.push('- `' + pair[0] + '`：' + pair[1]);
  }
  if (entry.ret) meta.push('- 返回：' + entry.ret);
  for (const note of entry.notes) meta.push('- ' + note);
  if (meta.length) {
    lines.push(meta.join('\n'));
    lines.push('');
  }
  if (o.showPits !== false && entry.pits.length) {
    lines.push('**坑**');
    for (const pit of entry.pits) lines.push('- ' + pit);
    lines.push('');
  }
  if (o.showExample !== false && entry.example) {
    lines.push('**例**');
    lines.push('```cpp');
    lines.push(entry.example);
    lines.push('```');
    lines.push('');
  }
  if (o.showLink !== false && entry.link) {
    lines.push('[' + linkLabel(entry.link) + '](' + entry.link + ')');
    lines.push('');
  }
  return lines.join('\n').trim();
}

/**
 * 一张或多张卡。多张时用分割线隔开，并默认省略示例（避免悬停框太长）。
 */
function renderHover(entries, opts) {
  const o = opts || {};
  const compact = entries.length > 1;
  return entries
    .map((entry) =>
      renderEntry(entry, {
        showExample: compact ? false : o.showExample,
        showPits: o.showPits,
        showLink: o.showLink,
      })
    )
    .join('\n\n---\n\n');
}

module.exports = { renderEntry, renderHover, titleOf, linkLabel };
