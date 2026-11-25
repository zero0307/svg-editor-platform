# 指标产物（docs/metrics）

本目录是课程要求的指标位置，内容全部由 [scripts/metrics](../../scripts/metrics/README.md) 从 Git 历史生成，不接受手改。

| 文件                    | 说明                                                                      |
| ----------------------- | ------------------------------------------------------------------------- |
| `summary.md`            | 最近一次运行的可读摘要：输入 SHA、三类 CLI 指标、Top 文件、迁移表、排除项 |
| `<from7>-to-<to7>.json` | 同一运行的机器可读产物：逐文件指标、按分类汇总、输入与工具版本、生成命令  |

## 已生成

| 产物                      | 基线                         | 目标                                               | 阶段         |
| ------------------------- | ---------------------------- | -------------------------------------------------- | ------------ |
| `e5621a6-to-17f9a78.json` | `final^{commit}` = `e5621a6` | `17f9a78`（含 `#7`/`#8`/`#10` 的集成分支）         | 框架候选首版 |
| `e5621a6-to-a21f758.json` | `final^{commit}` = `e5621a6` | `a21f758`（F：框架完整、业务插件未接入，#15 冻结） | F 的首版指标 |
| `e5621a6-to-fb0427a.json` | `final^{commit}` = `e5621a6` | `fb0427a`（21 个节点后的 Phase 2 最终候选，#22）   | 最终候选指标 |

`e5621a6-to-17f9a78` 是早期候选（`plugin` 类为 0，旧 `src/` 与新包同时在测）；`e5621a6-to-a21f758` 是框架冻结快照；`e5621a6-to-fb0427a` 是 Phase 2 最终候选的完整指标，**在创建 `p2` 之前测量**。`p2` 只能由用户在确认后于主线创建；创建后必须用同一脚本在 `p2` 上重跑并核对 CLI 源码文件集合与指标不变（复核命令见 `doc/evidence/release/README.md`）。

表中“CLI 合计（内核+装配+插件）”只汇总三类；JSON 里的 `totals` 是全部测得类别（含单列的 VSCode 与 DSH），两者不要混用。

## 重算

```bash
node scripts/metrics/metrics.mjs --from 'final^{commit}' --to fb0427a
```

换目标提交（例如 p2 候选）时使用 `--to <sha>`；希望不影响已提交产物时用 `--out artifacts/metrics-candidate`。同一输入与同一 `--out` 必须得到逐字节相同的文件，比较方式见 `doc/evidence/acceptance/012-met-01.md`。

## 注意

- `summary.md` 与 `*.json` 由脚本确定性生成，已加入 `.prettierignore`；手改会被下一次重跑覆盖，也与“同 SHA 两次运行字节一致”的验收冲突。
- VSCode（`apps/vscode-svg`）与 DSH（`apps/dsh-plugin`）在 JSON 中单列，不计入 CLI 三类合计。
- 迁移表的 `pending` 表示旧路径仍在、新路径尚未落地，不代表复杂度已消除。
