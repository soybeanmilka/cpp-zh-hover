'use strict';

const fs = require('fs');
const vscode = require('vscode');
const { loadEntries, buildIndex, lookup, buildCandidates } = require('./src/data');
const { renderHover } = require('./src/render');

const DEFAULT_LANGUAGES = ['cpp', 'c', 'objective-cpp'];
const SELFTEST_ENV = 'CPP_ZH_HOVER_SELFTEST';

let output = null;
let provider = null;
let state = { entries: [], files: 0, index: new Map(), loadedAt: null, error: null };

function log(message) {
  if (output) output.appendLine('[cpp-zh-hover] ' + message);
}

function config() {
  return vscode.workspace.getConfiguration('cppZhHover');
}

function reload() {
  try {
    const { entries, files } = loadEntries(__dirname);
    state = { entries, files: files.length, index: buildIndex(entries), loadedAt: new Date(), error: null };
    log('已加载 ' + state.entries.length + ' 条词条 / ' + state.files + ' 个文件');
  } catch (e) {
    state = { entries: [], files: 0, index: new Map(), loadedAt: null, error: String((e && e.message) || e) };
    log('词条加载失败：' + state.error);
    vscode.window.showErrorMessage('C++ 中文接口提示：词条加载失败，详见输出面板「C++ 中文接口提示」。');
  }
}

function activeLanguages() {
  const list = config().get('languages');
  return Array.isArray(list) && list.length > 0 ? list : DEFAULT_LANGUAGES;
}

function registerProvider() {
  if (provider) {
    provider.dispose();
    provider = null;
  }
  if (!config().get('enabled', true)) {
    log('已关闭（cppZhHover.enabled = false），不注册悬停');
    return;
  }
  const selector = activeLanguages().map((language) => ({ language, scheme: '*' }));
  provider = vscode.languages.registerHoverProvider(selector, { provideHover });
  log('已注册悬停：' + activeLanguages().join(' / '));
}

function nearbyText(document, line) {
  const lines = [];
  for (let i = Math.max(0, line - 2); i <= line; i += 1) lines.push(document.lineAt(i).text);
  return lines.join('\n');
}

function provideHover(document, position) {
  const cfg = config();
  if (!cfg.get('enabled', true)) return undefined;
  if (state.index.size === 0) return undefined;

  const lineText = document.lineAt(position.line).text;
  const target = buildCandidates(lineText, position.character);
  if (!target) return undefined;

  const maxCards = Math.max(1, Math.min(5, Number(cfg.get('maxCards', 3)) || 3));
  const hits = lookup(state.index, target.names, nearbyText(document, position.line), maxCards);
  if (hits.length === 0) return undefined;

  const markdown = renderHover(hits, {
    showExample: cfg.get('showExample', true),
    showPits: cfg.get('showPits', true),
    showLink: cfg.get('showLink', true),
  });
  if (!markdown) return undefined;

  const start = Math.min(target.start, lineText.length);
  const end = Math.min(Math.max(target.end, start + 1), lineText.length);
  return new vscode.Hover(markdown, new vscode.Range(position.line, start, position.line, end));
}

async function runSelfTest(reportPath) {
  const report = { ok: false, checks: [], errors: [], count: state.entries.length };
  try {
    const content = [
      '#include <vector>',
      '#include <thread>',
      'int main() {',
      '    std::vector<int> v;',
      '    v.push_back(1);',
      '    std::mutex m;',
      '    m.lock();',
      '    m.unlock();',
      '    return static_cast<int>(v.size());',
      '}',
    ].join('\n');
    const doc = await vscode.workspace.openTextDocument({ language: 'cpp', content });
    const cases = [
      { label: '方法 push_back', line: 4, ch: 8, expect: 'push_back' },
      { label: '#include <thread>', line: 1, ch: 12, expect: 'thread' },
      { label: '互斥量 lock', line: 6, ch: 8, expect: 'lock' },
      { label: '容器 size', line: 8, ch: 31, expect: 'size' },
    ];
    for (const item of cases) {
      const hovers = await vscode.commands.executeCommand(
        'vscode.executeHoverProvider',
        doc.uri,
        new vscode.Position(item.line, item.ch)
      );
      const text = (hovers || [])
        .map((h) =>
          (h.contents || [])
            .map((part) => (typeof part === 'string' ? part : part && part.value ? part.value : ''))
            .join('\n')
        )
        .join('\n');
      const ok = text.includes(item.expect);
      report.checks.push({ label: item.label, ok, preview: text.slice(0, 160) });
      if (!ok) report.errors.push(item.label + '：悬停结果里没有 ' + item.expect);
    }
    report.ok = report.errors.length === 0;
  } catch (e) {
    report.errors.push(String((e && e.stack) || e));
  }
  try {
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
  } catch (e) {
    // 写不出报告就只能在退出码上体现，不阻塞
  }
  try {
    await vscode.commands.executeCommand('workbench.action.quit');
  } catch (e) {
    // 自检环境里没有窗口命令也没关系
  }
}

function activate(context) {
  output = vscode.window.createOutputChannel('C++ 中文接口提示');
  context.subscriptions.push(output);

  reload();
  registerProvider();

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration('cppZhHover')) {
        registerProvider();
        if (event.affectsConfiguration('cppZhHover.enabled')) {
          vscode.window.showInformationMessage(
            config().get('enabled', true) ? 'C++ 中文接口提示：已开启' : 'C++ 中文接口提示：已关闭'
          );
        }
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('cppZhHover.stats', () => {
      reload();
      const summary = state.error
        ? '词条加载失败：' + state.error
        : '已加载 ' + state.entries.length + ' 条词条（' + state.files + ' 个文件），悬停即用。';
      output.show(true);
      vscode.window.showInformationMessage(summary);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('cppZhHover.reload', () => {
      reload();
      vscode.window.showInformationMessage(
        state.error ? '重新加载失败：' + state.error : '已重新加载 ' + state.entries.length + ' 条词条'
      );
    })
  );

  log('激活完成');

  const selftestPath = process.env[SELFTEST_ENV];
  if (selftestPath) {
    setTimeout(() => {
      runSelfTest(selftestPath).catch(() => {});
    }, 1200);
  }
}

function deactivate() {
  if (provider) {
    provider.dispose();
    provider = null;
  }
}

module.exports = { activate, deactivate, provideHover };
