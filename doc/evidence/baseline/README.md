# Phase 1 基线证据（TASK-QA-01 / Issue #1）

本目录记录 2026-11-24 在 `team/bing-quality` 上生成 Phase 1 逐字节基线的实际过程。golden 与回放入口见 [scripts/baseline/README.md](../../../scripts/baseline/README.md)，会话输入见 [doc/transcript](../../transcript/)。

## 被测输入

| 项目       | 值                                                                                                                                               |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| 标签对象   | `25c263bda5515816d59efb383a3790dd2c77df3a`（附注标签 `final`）                                                                                   |
| 解引用提交 | `e5621a68afd4731626d54566f17ba55885d1bc0f`（`final^{commit}`）                                                                                   |
| 生成方式   | `git archive --format=tar -o artifacts/baseline/final.tar 'final^{commit}'` 后解包到 `artifacts/baseline/final-tree`（不建 worktree，不动 refs） |
| 依赖安装   | `npm ci --cache <repo>/.npm-cache --prefer-offline`，exit 0，8 个包（未使用 junction 备选）                                                      |
| 构建       | `./node_modules/.bin/tsc -p tsconfig.json`，exit 0                                                                                               |
| 运行环境   | Windows `win32 x64`；Node `v26.13.0`；`.nvmrc` 为 `24.22.1`（已知差异，未改工程策略）                                                            |

## 四会话真实结果

| 会话        | transcript                              | 退出码 | stdout 字节 | stderr 字节 | 产物                     |
| ----------- | --------------------------------------- | ------ | ----------- | ----------- | ------------------------ |
| `basic`     | `doc/transcript/baseline-basic.txt`     | 1      | 1177        | 0           | `demo.svg`               |
| `flowchart` | `doc/transcript/baseline-flowchart.txt` | 0      | 824         | 0           | `flowchart.svg`          |
| `io`        | `doc/transcript/baseline-io.txt`        | 1      | 643         | 0           | `other.svg`、`saved.svg` |
| `dir`       | `doc/transcript/baseline-dir.txt`       | 1      | 65          | 0           | 无                       |

`basic` 与 `io` 的退出码 1 是规格会话本身包含的故意错误（`group bad`、save 后 `undo`、读取不存在文件）造成的，不是回放失败。stdout/stderr 分离保存，均无 CRLF、无绝对路径。

## 生成与比较日志

| 文件                                       | 内容                                                      |
| ------------------------------------------ | --------------------------------------------------------- |
| [record.json](record.json)                 | 机器可读：SHA、Node、平台、安装方式、生成命令、各会话摘要 |
| [record.log](record.log)                   | 从 final 树生成 golden 的实际输出                         |
| [compare-final.log](compare-final.log)     | 用 final 树自身回放 golden：4 会话 4 匹配 0 差异          |
| [compare-current.log](compare-current.log) | 用当前工作树构建回放 golden：4 会话 4 匹配 0 差异         |
| [npm-test.log](npm-test.log)               | 根 `npm test`：89 项通过（原 83 项 + 新增 6 项基线测试）  |
| [check.log](check.log)                     | 根 `npm run check` 的完整输出                             |
| [spec-diff.md](spec-diff.md)               | 课程规格示例与 `final` 实际输出的差异及裁决               |

## 复现

```bash
npm run build --silent
node scripts/baseline/compare.mjs --entry dist/src/bootstrap/main.js
```

比较器默认只比较，不改文件；差异会打印字节数、首个不同行号与上下文。golden 只能由 `record.mjs --update` 重写。

## 未完成项

- `dir` 只有 Phase 1 的 `error: unknown command: dir` 基线；带 `dir` 插件输出的会话由 `#18`/`#21` 追加。
- 只在 Windows + Node v26.13.0 上实跑；其他平台需要重跑比较后再声明通过。
- 符号链接与特殊项的目录夹具待 `dir` 的 ADR 确定策略后再补。
