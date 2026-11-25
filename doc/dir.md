# dir 命令与目录访问适配器

本文说明 `dir` 命令插件（`plugins/command-dir`，`@svgframe/command-dir`）、目录访问端口与适配器模式的分工，以及排序、标记与特殊项策略。实现与逐条验收见 [018-cmd-02](evidence/acceptance/018-cmd-02.md)；组合会话输入见 [transcript/stats-dir.txt](transcript/stats-dir.txt)。

## 1. 角色与职责

| 适配器模式角色      | 本项目对应物                                                  | 职责                                                                      |
| ------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Target（目标）      | `DirectoryReader`（`@svgframe/core` 公开端口）                | `cwd()` 返回进程工作目录，`list(path)` 返回**直接子项**及类型             |
| Adaptee（被适配者） | Node `process.cwd()` 与 `fs.readdir({ withFileTypes: true })` | 真实的文件系统调用，只在 host 内出现                                      |
| Adapter（适配器）   | `LocalDirectoryReader`（`@svgframe/host`）                    | 把 Node API 适配为端口；按 dirent 分类、过滤 `.`/`..`、不递归、不跟随链接 |
| Client（客户）      | `DirCommand` / `DirListing`（插件）                           | 只调用端口，负责分组、排序、标记与空目录文案；不 import Node fs 或 host   |

`DirCommand` 只通过 `QueryContext.directories()` 取得端口。查询上下文不提供 session、编辑或历史能力，所以 `dir` 既不依赖已初始化文档，也不可能改动文档状态。更换端口实现（例如编辑器工作区目录）不需要改插件。

端口契约（`packages/core/ports/DirectoryReader.ts`）：

```ts
export type DirectoryEntryKind = 'directory' | 'file' | 'link' | 'other';
export interface DirectoryEntry {
  readonly name: string;
  readonly kind: DirectoryEntryKind;
}
export interface DirectoryReader {
  cwd(): string;
  list(path: string): Promise<readonly DirectoryEntry[]>;
}
```

适配器读取失败统一抛出 `cannot read directory: <path>`；插件不捕获该错误，CLI 分发器统一加 `error: ` 前缀并继续执行后续命令。

## 2. 输出与排序策略

- 每个直接子项一行：`[DIR]`、`[FILE]`、`[LINK]`、`[OTHER]` 之一，标记后**两个空格**再接名称。
- 组顺序固定：目录 → 普通文件 → 符号链接 → 其他特殊项；组内按**大小写敏感的 JavaScript 字符串序**（`left.name < right.name`）升序，不使用 `localeCompare`，因此不随机器 locale 变化。
- 包含以 `.` 开头的隐藏项；不递归、不跟随符号链接（链接只显示为 `[LINK]`，其目标不在本次输出中）。
- 空目录输出 `(empty directory)`。
- 命令不接受参数；多余参数输出 `error: usage: dir`（规格未规定文案，沿用 Phase 1 的 `usage:` 约定）。

示例（`test/fixtures/dir/tree`，冻结夹具）：

```text
[DIR]  sub-one
[DIR]  sub-two
[FILE]  .hidden
[FILE]  Zeta.md
[FILE]  alpha.txt
[FILE]  with space.txt
[FILE]  中文名.txt
```

## 3. 状态不变与装配

- `dir` 的 `prepare` 返回 `requiresDocument:false`、`effect:'query'`，分发器因此只构造只读 `QueryContext`；成功或失败都不改变文档内容、dirty（`#20` 引入后由组合级测试复核）、cwd、undo/redo 与 I/O 屏障，也不清空已有 redo 分支。
- A（代码装配）在 `apps/cli/src/main.ts` 显式 import 并注册，B（配置装配）在根 `plugins.config.json` 声明；两者经同一 `PluginInstaller`，注册顺序与配置顺序一致，`help` 紧接内置命令后依次列出 `stats`、`dir`。
- `enabled:false` 时插件不被解析或激活，`help` 无该命令，执行输出 `error: unknown command: dir`。

## 4. 测试

| 层次     | 位置                                                          | 覆盖                                                                                                                |
| -------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| 插件单测 | `plugins/command-dir/test/`                                   | 混合分组、大小写敏感排序、隐藏项、乱序稳定性、空目录、链接/其他标记、失败文案、多余参数、无文档、状态不变           |
| 真实组合 | `test/plugin-dir-integration.test.ts`                         | `LocalDirectoryReader` + 临时目录（中文/空格/隐藏/子目录/符号链接）、空目录、失败后继续、无文档、A/B 字节一致、禁用 |
| 固定夹具 | `test/fixtures/dir/tree` + `test/fixtures/dir/inventory.json` | A/B 同一目录逐字节比较；日志与被列目录分离，不使用 `process.chdir`                                                  |

## 5. 边界

- 插件源码不 import Node `fs`/`process`、host 或其他插件；`packages/host` 不实现排序或标记，只提供端口适配。
- 不在 `dir` 接入提交里修改 core/host/builtins/svg-xml/既有插件；本期唯一的框架前置补丁是 [查询命令目录端口](architecture.md#10-目录适配器与-dsh-边界)（`QueryContext.directories()`），已在 #18 开始前合入。
