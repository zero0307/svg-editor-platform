# 发布清单（Phase 2 候选，待用户确认）

本文件记录 Phase 2 收口时的候选提交、复跑命令、证据引用与 **未完成的发布步骤**。`p2` 标签与 `main` 合并按用户要求**尚未执行**，由主线在用户确认后完成；本节点不得 push、不得建标签。

## 1. 候选提交

| 角色         | 引用 / 提交                                                                                                         | 说明                                                                                                       |
| ------------ | ------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| 被测候选     | `fb0427ad5895eaaebb13a5c18be8cb19ffa30183`（`fb0427a`）                                                             | 全部 21 个节点的集成提交；最终指标测量的是该提交的 Git 树                                                  |
| 指标提交     | `412727fdab1a11d1d6951f22a256387415bc3725`（`412727f`）                                                             | 只新增 `docs/metrics/` 与 `doc/evidence/release/`；源码复核见 `doc/evidence/release/metrics-recheck.log`   |
| 收口报告提交 | 本文件随其提交                                                                                                      | `docs(release): close phase 2 report and release checklist (#22)`；SHA 见 `git log -1`，不写死以避免自引用 |
| 框架基线 F   | `a21f758bf072a7d8c0ff683bc579db124c6d209d`                                                                          | 受保护分支 `evidence/p2-framework-base`                                                                    |
| 原 C_A / C_B    | `d3465f73…` / `043a2f76…`                                                                                           | `evidence/box-code` / `evidence/box-config`，仅 diff 证据（F 上不可构建，见 #21 记录）                     |
| box 复核基线 | `9cf8447` | `codex/box-feedback-base`，包含通用回显修复 |
| box 独立接入 A / B | `bcdb30f` / `30f02c7` | `codex/box-code-verified` / `codex/box-config-verified`，见[box 双装配复核报告](evidence/assembly/verified-box/README.md) |
| Phase 1 基线 | `final` = `25c263bda5515816d59efb383a3790dd2c77df3a`（标签对象），解引用 `e5621a68afd4731626d54566f17ba55885d1bc0f` | 不移动、不复用                                                                                             |

## 2. 复跑命令（真实执行过）

```bash
npm ci --prefer-offline
npm run check
npm run verify:visual
npm run cli -- --help
node apps/cli/dist/main.js --script <smoke transcript>

node scripts/metrics/metrics.mjs --from 'final^{commit}' --to fb0427a --out docs/metrics
node scripts/metrics/metrics.mjs --from 'final^{commit}' --to 412727f --out artifacts/metrics-recheck
node scripts/metrics/verify-report.mjs \
  --report docs/metrics/e5621a6-to-fb0427a.json \
  --candidate artifacts/metrics-recheck/e5621a6-to-412727f.json

node scripts/baseline/compare.mjs --entry apps/cli/dist/main.js     # 空配置对照 final golden
node scripts/assembly/replay.mjs --entry apps/cli/dist/main.js --config plugins.config.json \
  --integration fb0427a --out doc/evidence/assembly
node scripts/assembly/diff-evidence.mjs --framework a21f758 --code evidence/box-code \
  --config evidence/box-config --integration d2b5e23
```

## 3. 证据引用

- 环境、`npm ci`、检查、视觉、CLI 冒烟：`doc/evidence/release/`（`README.md` 列出每个日志的结论）。
- 指标：`docs/metrics/e5621a6-to-fb0427a.json` 与 `summary.md`；“报告提交 vs 被测候选”的源码一致性：`doc/evidence/release/metrics-recheck.log`（PASS）。
- Phase 1 基线：`doc/evidence/baseline/`；框架冻结：`doc/evidence/framework/`；接入差异与 A/B：`doc/evidence/assembly/`；VSCode：`doc/evidence/vscode/`；DSH：`doc/evidence/dsh/`。
- 逐节点验收：`doc/evidence/acceptance/`；汇总状态：`doc/acceptance.md` §8；证据导航：`doc/evidence-index.md`。

## 4. 各板块结论摘要

| 板块                                | 结论                                                   | 未完成                                                  |
| ----------------------------------- | ------------------------------------------------------ | ------------------------------------------------------- |
| Phase 1 兼容（BASE-01）             | 空配置下四个 golden 会话 4/4 逐字节一致                | 只在 Windows/Node 26 实跑                               |
| 四扩展点与事务（EXT/ATTR/BOX/TREE） | 契约、实现、缺省与错误测试齐备；插件独立测试全绿       | —                                                       |
| 加载与装配（LOAD/ASM） | 加载器 39 项故障测试；集成回放三组一致，空配置 4/4。独立 box A/B 均构建通过，各通过 30 项插件测试；标准输出均匹配预期 806 字节，SVG 均匹配既有 601 字节产物摘要。见[box 双装配复核报告](evidence/assembly/verified-box/README.md) | — |
| 指标（MET）                         | `final → fb0427a` 由脚本生成，报告提交源码复核不变     | `p2` 创建后需重跑并核对                                 |
| VSCode（VS/PKG-01）                 | 标记/Outline 截图真实；VSIX 干净安装                   | 跨平台未验                                              |
| DSH（DSH-01/PKG-02）                | 插件产物在干净目录安装、加载、注册、卸载               | 模型侧真实工具调用未执行（无 `DEEPSEEK_API_KEY`）       |
| 交付（REL-01）                      | 候选 SHA、证据、复跑命令齐全                           | `p2` 未创建；评阅访问未重新验证                         |

## 5. `p2` 发布步骤（待用户确认后由主线执行，本节点未执行）

1. 用户确认候选；主线把本分支合并到 `main`（保留 merge commit，不 squash）。
2. 在验收提交上重跑 `npm ci --prefer-offline && npm run check`，并重跑指标到临时目录，与 `docs/metrics/e5621a6-to-fb0427a.json` 比较 `measured.to.files`（见 `scripts/metrics/verify-report.mjs`）。
3. 更新 `doc/release-checklist.md` 的“p2 提交”行与 `doc/records/`，提交报告收尾。
4. 在收尾提交上创建**附注标签** `p2`：`git tag -a p2 -m "Phase 2 acceptance"`，推送 `main` 与 `p2` 到交付仓库（同一远程要求见 `CONTRIBUTING.md`）。
5. 推送后重新跑一次指标，绑定 `p2` 标签对象与解引用 SHA，再核对评阅访问与最终证据索引。

## 6. 未完成与风险

- `p2`、`main` 合并、远程推送均未执行（用户要求）。
- 跨平台（Linux/macOS）与 Node 22/24 的全套发布检查未验证；`.nvmrc` 为 24.22.1，全套发布检查实跑在 Node 26.13.0。
- DSH 模型侧调用未执行；VSCode 真实宿主验证仅在 Windows/本机 VSCode 版本完成。
- `npm ci` 时 `@vscode/vsce-sign` 与 `esbuild` 的 postinstall 被 `allowScripts` 策略阻止；本节点检查不依赖二者，VSCode 打包由 V 板块单独记录。
