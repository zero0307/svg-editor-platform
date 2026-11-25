# 发布前检查证据（TASK-QA-03 / Issue #22）

本目录记录 Phase 2 候选 `fb0427a` 在**干净安装**后的真实检查结果。所有命令都在 2026-11-25、Windows `win32 x64`、Node `v26.13.0`、npm `12.2.1`、TypeScript `7.0.2` 下执行；`.nvmrc` 固定 `24.22.1`，与本机运行版本不同，跨平台未验证。

| 文件                    | 命令                                                                                                      | 真实结果                                                                                                                                                                                                               |
| ----------------------- | --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm-ci.log`            | `npm ci --prefer-offline`                                                                                 | exit 0；`@vscode/vsce-sign@2.1.1` 与 `esbuild@0.28.2` 的 postinstall 被 `allowScripts` 策略阻止（日志保留原样）；本节点检查不依赖二者，VSCode 打包由 V 板块单独记录                                                    |
| `check.log`             | `npm run check`                                                                                           | exit 0：格式检查通过；文档 93 个 Markdown、387 条本地链接；根测试 128 项；`build:packages` 成功；`test:packages` 102/39/36/2/19/25/17/14/30/26 = 310 项全过；架构检查 11 个 workspace 包、257 个源文件、119 条跨包导入 |
| `verify-visual.log`     | `npm run verify:visual`                                                                                   | exit 0；`differingChannels: 0`、`meanAbsoluteChannelDifference: 0`，原图与归一化 SVG 渲染一致（`sourceSha256 = 69fbd19f…`）                                                                                            |
| `cli-smoke.log`         | `npm run cli -- --help` 与插件会话                                                                        | help exit 0；含 `box`/`stats`/`dir`/`tree-modified` 的会话 exit 0，输出了 `(box)` 与 `*` 后缀、`stats` 统计、`(empty directory)` 与 `save` 成功                                                                        |
| `environment.json`      | —                                                                                                         | Node/npm/TypeScript/OS、`.nvmrc` 差异、`final` 标签对象与解引用 SHA、候选 SHA、实测命令                                                                                                                                |
| `metrics-candidate.log` | `node scripts/metrics/metrics.mjs --from 'final^{commit}' --to fb0427a --out artifacts/metrics-candidate` | exit 0；候选指标先进临时目录核对                                                                                                                                                                                       |
| `metrics-final.log`     | 同一命令改为 `--out docs/metrics`                                                                         | exit 0；写入 `docs/metrics/e5621a6-to-fb0427a.json` 与 `summary.md`                                                                                                                                                    |
| `metrics-recheck.log`   | 在报告提交 `412727f` 上重跑并 `verify-report.mjs` 对比                                                    | **PASS**：`measured.to.files`、基线文件、汇总、规则版本、分类哈希全部一致，说明报告提交只改了 `docs/metrics` 与 `scripts/metrics`，被测 CLI 源码未变                                                                   |

## 候选指标（rules v1，`final` = `e5621a6` → `fb0427a`）

| 分类             | 文件 |          行数 |       复杂度 | 函数数 | 最大单元 |
| ---------------- | ---: | ------------: | -----------: | -----: | -------: |
| kernel           |   61 | 2197（+1276） |  354（+108） |    200 |       16 |
| assembly         |   28 | 1910（+1224） |  482（+270） |    144 |       21 |
| plugin           |   67 | 1924（+1924） |  272（+272） |    182 |       13 |
| CLI 合计（三类） |  156 | 6031（+4424） | 1108（+650） |    526 |       21 |
| vscode（单列）   |   14 |           402 |           46 |     27 |        4 |
| dsh（单列）      |   11 |           724 |          100 |     51 |       10 |

数字来自脚本，未手填；`plugin` 67 个文件包含 `packages/builtins`（默认能力）与四类可选插件。基线为 38 文件/1607 行/复杂度 458。

## 指标脚本的一处修正（本轮发现并修复）

汇总表的“CLI 合计”此前误用全部类别之和（含单列的 VSCode/DSH）。本轮在 `scripts/metrics/metrics.mjs` 中新增显式 `cli` 桶（只含内核/装配/插件三类），`summary.md` 行改为“CLI 合计（内核+装配+插件）”，JSON 增加 `measured.*.summary.cli` 与 `delta.cli`；`totals` 保留为全部测得类别之和并在文档中说明。修正后重新生成候选与最终指标，二者除 `command` 字段外逐字节相同。

## 复现

```bash
npm ci --prefer-offline
npm run check
npm run verify:visual
node scripts/metrics/metrics.mjs --from 'final^{commit}' --to fb0427a --out artifacts/metrics-recheck
node scripts/metrics/verify-report.mjs \
  --report docs/metrics/e5621a6-to-fb0427a.json \
  --candidate artifacts/metrics-recheck/e5621a6-to-fb0427a.json
```

`p2` 创建后需在 `p2` 上重跑同一命令并按发布清单核对。
