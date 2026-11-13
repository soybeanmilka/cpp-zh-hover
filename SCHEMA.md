# 词条格式（SCHEMA）

这个扩展的工作方式：鼠标悬停到 C++ 代码里的标识符上 → 按 `keys` 匹配 `data/*.json` 里的中文词条 → 显示一张中文卡片。

词条文件 = **一个 JSON 数组**，每个元素是一条词条。UTF-8、无 BOM、2 空格缩进、**不能有注释和尾逗号**。

## 完整示例

```json
[
  {
    "keys": ["push_back"],
    "scope": "vector",
    "kind": "成员函数",
    "brief": "在末尾追加一个元素：值被拷贝或移动进容器。",
    "sig": "void push_back(const T& v);\nvoid push_back(T&& v);",
    "params": [["v", "要追加的元素，拷贝或移动进容器尾部"]],
    "ret": "无返回值。",
    "notes": ["均摊 O(1)", "线程安全：否"],
    "pits": ["扩容会让原有迭代器、指针、引用全部失效。", "先用 reserve 预留空间，能避免反复扩容和搬迁。"],
    "example": "std::vector<int> v;\nv.push_back(1);\nv.push_back(2);",
    "link": "https://zh.cppreference.com/w/cpp/container/vector/push_back",
    "since": "C++98"
  }
]
```

## 字段表

| 字段 | 必填 | 类型 | 约束与说明 |
|---|---|---|---|
| `keys` | 是 | string[] | 1~4 个。查表用的标识符原文（英文，别翻译）。头文件词条写 `"<thread>"`。 |
| `kind` | 是 | string | 必须是这 11 个之一：`头文件` `类` `成员函数` `函数` `关键字` `类型` `对象` `宏` `命名空间` `运算符` `特性` |
| `brief` | 是 | string | 一句话说清"它干什么、什么时候用"，≤ 60 字。 |
| `scope` | 否 | string | 所属类/头文件/分类，用来消歧和当标题，≤ 24 字。例：`vector`、`std::mutex`、`Windows API`。 |
| `sig` | 否 | string | 原型，≤ 400 字；重载用 `\n` 分行；版本差异写行尾注释。 |
| `params` | 否 | [string, string][] | 最多 4 组：`[参数名, 中文解释]`，解释 ≤ 80 字。 |
| `ret` | 否 | string | 返回值说明，≤ 100 字。 |
| `notes` | 否 | string[] | 最多 3 条：复杂度、线程安全、版本要求、易混点，每条 ≤ 80 字。 |
| `pits` | 否 | string[] | 最多 3 条真正会踩的坑，每条 ≤ 90 字。 |
| `example` | 否 | string | 2~8 行能看懂的示例，≤ 400 字，不许有 tab。 |
| `link` | 否 | string | 只填**你确认存在**的页面；拿不准就整个字段省略。允许的域名只有 `zh.cppreference.com`、`en.cppreference.com`、`learn.microsoft.com`，以及 POSIX/Linux 系统调用的 `man7.org`。 |
| `since` | 否 | string | 例：`C++11`、`C++17`、`Win32`。≤ 12 字。 |

## 硬规则

1. **准确性 > 覆盖率。** 签名没把握就写简化版（如 `size_type size() const;`），别编参数。宁可少写一条，不能写错一条。
2. **坑要具体。** 写"扩容后迭代器失效""`unlock` 前抛异常会死锁""`wait` 必须配谓词防虚假唤醒"这种；不写"注意安全""小心使用"。
3. **例子要能看懂、最好能编译。** 不用完整 `main`，但要语法正确、上下文够。
4. **不写套话**：不写"以下""注意""总而言之"，不写 emoji，不写"要点："。
5. **同一个 `keys` 在不同类里含义不同时，拆成多条，用 `scope` 区分。** 例：`wait`（`condition_variable`）、`wait`（`future`）、`lock`（`mutex`）、`lock`（`weak_ptr`）。`scope` 会显示在卡片标题上。
6. **同一个文件内 `keys + scope` 不能重复**；跑校验脚本会查。
7. **只改分配给你的文件**，别动别人的 `data/*.json`，别改扩展代码。

## 写完必须自检

```bash
cd tools/vscode-cpp-zh-hover   # 在仓库根目录执行
node scripts/validate.js data/你的文件.json
```

退出码 0 才算合格。有错就改到 0 再回报。

预览一条词条渲染出来的样子（可选）：

```bash
node scripts/preview.js push_back
```
