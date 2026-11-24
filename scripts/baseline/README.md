# Phase 1 逐字节基线回放

本目录是 TASK-QA-01（Issue #1）建立的基线与回归入口：把 Phase 1 `final` 的 CLI 输出冻结成 golden，并在任意构建上逐字节回放。后续 `#15`、`#21` 的 A/B 回放复用同一套会话夹具。

## 组成

| 文件             | 作用                                                                  |
| ---------------- | --------------------------------------------------------------------- |
| `sessions.mjs`   | 四个冻结会话：`basic`、`flowchart`、`io`、`dir` 及其种子夹具          |
| `lib/runner.mjs` | 在 `artifacts/` 下的隔离目录重放会话，采集 stdout/stderr/退出码与产物 |
| `lib/golden.mjs` | golden 读写、sha256 清单、带上下文的字节差异输出                      |
| `record.mjs`     | 从指定构建生成 golden，只允许 `--update` 覆盖                         |
| `compare.mjs`    | 默认只比较；另支持 `--pair` 比较两个会话目录                          |

会话输入只存命令与注释，位于 [doc/transcript](../../doc/transcript/)；SVG 与目录夹具位于 `test/fixtures/`；golden 位于 [test/fixtures/expected/baseline-final](../../test/fixtures/expected/baseline-final/)。

## 记录（只允许在 final 或明确标注的构建上执行）

```bash
# 1. 从 final 导出只读工作树（不建 worktree、不动 refs）
git archive --format=tar -o artifacts/baseline/final.tar 'final^{commit}'
mkdir -p artifacts/baseline/final-tree && tar -xf artifacts/baseline/final.tar -C artifacts/baseline/final-tree

# 2. 安装锁文件依赖（.npmrc 的 cache 是仓库内相对路径，独立目录必须显式指定）
cd artifacts/baseline/final-tree
npm ci --cache ../../../.npm-cache --prefer-offline
./node_modules/.bin/tsc -p tsconfig.json
cd ../../..

# 3. 生成 golden 与证据（provenance 记录标签对象与解引用 SHA）
node scripts/baseline/record.mjs \
  --entry artifacts/baseline/final-tree/dist/src/bootstrap/main.js \
  --tag final --update --evidence doc/evidence/baseline \
  --install-method "npm ci --cache .npm-cache --prefer-offline"
```

golden 只在 `--update` 时重写，并且必须同时更新 `doc/evidence/baseline/spec-diff.md` 说明变更依据；任何用新实现输出静默覆盖旧值的做法都违反 Issue #1。

## 回放（默认行为，不改文件）

```bash
npm run build --silent
node scripts/baseline/compare.mjs --entry dist/src/bootstrap/main.js
node scripts/baseline/compare.mjs --entry dist/src/bootstrap/main.js --session basic   # 单会话
node scripts/baseline/compare.mjs --pair <expected-session-dir> <actual-session-dir>  # 两个目录
```

比较范围：`stdout.txt`、`stderr.txt`、`exit-code.txt`、`files/**` 与 `files.sha256`，全部按原始字节；不 trim、不排序、不删除 warning/error。差异输出包含字节数、首个不同行号与前后三行上下文。`npm test` 中的 `test/baseline.test.ts` 会在当前构建上执行一次四会话回放。

## 固定条件与确定性

1. 每个会话在 `artifacts/baseline/<session>/run` 重建：先删除、再复制种子夹具，因此上一轮 `save` 产物不会污染下一轮。
2. 运行目录与日志分离：日志与记录在 `artifacts/baseline/` 与 `doc/evidence/`，不进入被回放目录（`dir` 会话的工作目录是 [test/fixtures/dir/tree](../../test/fixtures/dir/tree) 的副本）。
3. CLI 以编译产物直接启动（`node dist/.../main.js --script <transcript>`），不混入构建日志；非交互模式没有 banner 与 `svg>` 提示符。
4. 会话内只使用相对路径，因此捕获字节不含机器相关路径；golden 以 UTF-8/LF 提交，`.gitattributes` 强制 `eol=lf`。
5. 退出码逐会话断言：`basic=1`（会话内包含规格要求的两处错误）、`flowchart=0`、`io=1`、`dir=1`。脚本模式任一 `error:` 行都会令退出码为 1，`compare` 因此同时比较退出码。

## 目录夹具重建协议

[test/fixtures/dir/tree](../../test/fixtures/dir/tree) 是 `dir` 命令的固定目录输入，配套 [inventory.json](../../test/fixtures/dir/inventory.json) 记录每个条目的类型与内容 sha256。新增、删除或修改条目必须同时更新清单，`test/baseline.test.ts` 会校验两者一致。当前夹具覆盖：小写/大写/中文/含空格文件名、隐藏文件、两个子目录；符号链接与特殊项待 `dir` 的 ADR 决定后再补。

## 已知限制

- golden 由 Windows + Node v26.13.0 生成并记录；`.nvmrc` 固定 24.22.1，团队主环境与之存在差异。当前比较对平台无硬依赖（无绝对路径、无时间戳），换平台仍需重跑 `compare.mjs` 后再声明通过。
- `dir` 在 Phase 1 不存在，golden 只冻结 `error: unknown command: dir` 的缺省行为；带插件输出的 golden 由 `#18`/`#21` 追加，不改写本文件。
- A/B 双装配回放、`box`/`stats` 会话属于 `#15`、`#21`，本目录只提供可复用的执行器。
