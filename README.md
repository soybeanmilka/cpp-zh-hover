# C++ 中文接口提示（cpp-zh-hover）

给 VS Code 的 C++ 悬停加中文解释：鼠标停在 `push_back`、`<thread>`、`mutex`、`const`、`printf` 这类标识符上，弹出中文卡片，写清作用、签名、参数、返回、常见坑、最小示例和文档链接。

- 完全离线：不联网、不要 API key、不依赖翻译服务
- 词条面向学习者：讲人话、标坑、带可编译示例
- 未收录的符号：照旧显示 clangd 原来的英文提示，两者并存不冲突
- 词库规模：393 条 / 5 个领域文件（容器 100、算法 65、并发与内存 85、关键字与头文件 93、C 库与 Win32 50）

## 目录

```
vscode-cpp-zh-hover/
├─ extension.js        扩展入口（悬停提供者 / 命令 / 自检）
├─ src/data.js         词条加载、索引、查找、光标处标识符识别
├─ src/render.js       词条 → Markdown 悬停卡片
├─ data/*.json         中文词条库（一个领域一个文件）
├─ scripts/validate.js 词条格式校验
├─ scripts/preview.js  终端预览悬停卡片
├─ test/run-tests.js   纯 Node 单测
├─ SCHEMA.md           词条字段规范
└─ dist/               打包产物（.vsix）
```

## 安装

仓库地址：<https://github.com/soybeanmilka/cpp-zh-hover>

克隆后装打包好的 vsix（或在本仓库根目录直接执行第二条）：

```bash
git clone https://github.com/soybeanmilka/cpp-zh-hover.git
code --install-extension cpp-zh-hover/dist/cpp-zh-hover-0.1.0.vsix --force
```

```bash
code --install-extension dist/cpp-zh-hover-0.1.0.vsix --force
```

装完按 `Ctrl+Shift+P` → `Developer: Reload Window`（或直接重启 VS Code）。

## 用法

打开任意 `.cpp` / `.h`，鼠标停在标识符上即可。

支持范围：

| 领域 | 例子 |
| --- | --- |
| 头文件 | `#include <thread>` 里的 `<thread>` |
| 容器与字符串 | `vector` `push_back` `substr` `unordered_map` `operator[]` |
| 算法与迭代器 | `sort` `lower_bound` `accumulate` `back_inserter` |
| 并发与内存 | `thread` `mutex` `lock_guard` `condition_variable` `atomic` `async` |
| 关键字与类型 | `const` `constexpr` `static_cast` `override` `size_t` `HANDLE` |
| C 库与 Win32 | `printf` `malloc` `CreateFileMappingA` `WaitForSingleObject` `GetLastError` |

悬停卡片最底下可以点文档链接。链接指向 cppreference 英文站（中文站 zh.cppreference.com 在国内不可达，故统一用英文站），网站访问慢或打不开是网络问题，不影响离线卡片内容。

## 看不到中文？

按顺序排查：

1. `Ctrl+Shift+U` 打开输出面板，选「C++ 中文接口提示」，看是否显示「已加载 N 条词条」；
2. 该符号没被收录 → 显示的是 clangd 原英文提示，这是正常回落；
3. 命令面板运行 `C++ 中文接口提示：查看词条统计`（`cppZhHover.stats`）；
4. 检查设置 `cppZhHover.enabled` 是否为 `true`（默认开启）；
5. 改过词条文件后，运行 `C++ 中文接口提示：重新加载词条`（`cppZhHover.reload`），不用重启。

## 配置项

| 配置 | 默认 | 说明 |
| --- | --- | --- |
| `cppZhHover.enabled` | `true` | 总开关 |
| `cppZhHover.languages` | `["cpp","c","objective-cpp"]` | 生效的 VS Code 语言 ID |
| `cppZhHover.showExample` | `true` | 单卡时显示示例代码 |
| `cppZhHover.showPits` | `true` | 显示「坑」列表 |
| `cppZhHover.showLink` | `true` | 显示文档链接 |
| `cppZhHover.maxCards` | `3` | 同名符号最多显示几张卡（1–5） |

## 加词条

1. 按 `SCHEMA.md` 在 `data/*.json` 里加一条（同一个符号不同语义用 `scope` 区分）；
2. 校验：

```bash
node scripts/validate.js --all
```

3. 终端预览效果：

```bash
node scripts/preview.js push_back
node scripts/preview.js "<thread>"
```

4. VS Code 里跑命令 `cppZhHover.reload` 立刻生效。

## 开发与打包

```bash
node test/run-tests.js                                    # 单测
npx --yes @vscode/vsce package --no-dependencies \
  --out dist/cpp-zh-hover-0.1.0.vsix                      # 打包
code --install-extension dist/cpp-zh-hover-0.1.0.vsix --force
```

自检（隔离实例，不开你的日常配置）：

```bash
CPP_ZH_HOVER_SELFTEST=/tmp/hover-report.json \
  Code.exe --user-data-dir /tmp/vs-test/user --extensions-dir /tmp/vs-test/ext --new-window
```

扩展会在 1.2 秒后对样例文件发起 4 次真实悬停，把结果写进报告文件并退出。

## 相关文档

- [`SCHEMA.md`](SCHEMA.md)：词条格式与硬规则，加词条前先看。
- [`发布文案.md`](发布文案.md)：各平台发布文案（B 站 / 知乎 / 小红书 / V2EX / 公众号 / 掘金 / 即刻），发帖时直接复制。
