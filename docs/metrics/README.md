# 指标产物（docs/metrics）

本目录是课程要求的指标位置，内容全部由 [scripts/metrics](../../scripts/metrics/README.md) 从 Git 历史生成，不接受手改。

| 文件                    | 说明                                                                      |
| ----------------------- | ------------------------------------------------------------------------- |
| `summary.md`            | 最近一次运行的可读摘要：输入 SHA、三类 CLI 指标、Top 文件、迁移表、排除项 |
| `<from7>-to-<to7>.json` | 同一运行的机器可读产物：逐文件指标、按分类汇总、输入与工具版本、生成命令  |

## 已生成

| 产物                      | 基线                         | 目标                                       | 阶段         |
| ------------------------- | ---------------------------- | ------------------------------------------ | ------------ |
| `e5621a6-to-17f9a78.json` | `final^{commit}` = `e5621a6` | `17f9a78`（含 `#7`/`#8`/`#10` 的集成分支） | 框架候选首版 |

这是 **框架候选** 指标：`packages/builtins`、`apps/cli`、`plugins/*` 尚未落地，`plugin` 类为 0，旧 `src/` 与新 `packages/`、`apps/` 同时在测。`#15` 冻结框架、`#22` 打 `p2` 前必须重跑，并在报告中写明被测提交；终版指标不能用本文件冒充。

## 重算

```bash
node scripts/metrics/metrics.mjs --from 'final^{commit}' --to 17f9a78
```

换目标提交（例如 p2 候选）时使用 `--to <sha>`；希望不影响已提交产物时用 `--out artifacts/metrics-candidate`。同一输入与同一 `--out` 必须得到逐字节相同的文件，比较方式见 `doc/evidence/acceptance/012-met-01.md`。

## 注意

- `summary.md` 与 `*.json` 由脚本确定性生成，已加入 `.prettierignore`；手改会被下一次重跑覆盖，也与“同 SHA 两次运行字节一致”的验收冲突。
- VSCode（`apps/vscode-svg`）与 DSH（`apps/dsh-plugin`）在 JSON 中单列，不计入 CLI 三类合计。
- 迁移表的 `pending` 表示旧路径仍在、新路径尚未落地，不代表复杂度已消除。
