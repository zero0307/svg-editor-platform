# 2026-11-25 Phase 2 开发日志（阶段快照）

> 用途：记录本次自动化开发到此为止的真实进度、分支/提交、接口约定与遗留问题，供下次继续。**完成状态以本文件和实际提交为准**，未执行的检查不得当作通过。
> 编排规则见 [六人模拟开发编排记录](2026-11-24-agent-team-orchestration.md)；上一轮快照见 [前一日日志](2026-11-24-development-log.md)；任务定义见 [definitions.json](../tasks/definitions.json)。

## 1. 进度总览

- 已完成并合并到集成分支：**22 / 22** 个节点（全部完成）。
- 已完成节点：`#2`、`#1`、`#3`、`#4`、`#5`、`#6`、`#9`、`#7`、`#10`、`#8`、`#12`、`#13`、`#11`、`#14`、`#15`、`#17`、`#18`、`#19`、`#20`、`#16`、`#21`、`#22`。
- `p2` 标签**未创建**（用户约束：不合并 `main`）；发布清单与候选 SHA 已就绪，等待确认。
- 集成分支 `integration/phase2` 当前 HEAD：`97803e6`（`merge #22 TASK-QA-03`），已推送，本地与 `origin` 一致。
- `main` 未合并、未推送新内容；`final` 未移动；未创建 `p2` 标签（发布需经用户确认与主线合并）。

## 2. 分支与提交

| 成员 | 分支                | 分支最新提交 | 状态                                       |
| ---- | ------------------- | ------------ | ------------------------------------------ |
| 甲   | `team/jia-core`     | `df4fd1d`    | 已推送；#2/#7/#10/#14 与两处框架补丁已合并 |
| 乙   | `team/yi-eng`       | `b8a463b`    | 已推送；#5/#6/#9/#8/#13 已合并；无待做     |
| 丙   | `team/bing-quality` | `f07993a`    | 已推送；#1/#12/#15/#21 已合并；下一步 #22  |
| 丁   | `team/ding-vscode`  | `872185d`    | 已推送；#3/#11 已合并；VSCode 完成         |
| 戊   | `team/wu-dsh`       | `8c7ea05`    | 已推送；#4/#16 已合并；DSH 完成            |
| 己   | `team/ji-plugins`   | `1334319`    | 已推送；#17/#18/#19/#20 已合并；插件完成   |

节点提交 → 合并提交（#15 起为本轮新增）：

| 节点 | 节点提交  | 合并提交  |
| ---- | --------- | --------- |
| #14  | `2d16341` | `a21f758` |
| #15  | `29f51c4` | `b7cd7ee` |
| #17  | `39d503f` | `915d398` |
| #18  | `4073ab7` | `af1e057` |
| #19  | `0df080b` | `d68e42f` |
| #20  | `1334319` | `6318f34` |
| #16  | `8c7ea05` | `d2b5e23` |
| #21  | `f07993a` | `308bb47` |

框架补丁（独立于节点）：

| 补丁     | 提交      | 合并提交  | 内容                                               |
| -------- | --------- | --------- | -------------------------------------------------- |
| #18 前置 | `4f41183` | `7e0fa01` | `QueryContext.directories()` 目录端口 + 组合根注入 |
| #19 后续 | `df4fd1d` | `99b6a9a` | `Shape.creationParts()` 多态反馈 + ungroup 文案    |

证据分支（已推送）：

| 分支                         | 指向      | 说明                   |
| ---------------------------- | --------- | ---------------------- |
| `evidence/p2-framework-base` | `a21f758` | 框架冻结基线 F         |
| `evidence/box-code`          | `d3465f7` | A 接入提交 C_A（父 F） |
| `evidence/box-config`        | `043a2f7` | B 接入提交 C_B（父 F） |

## 3. 测试与检查（最后一次真实执行）

- `npm test`（根）：**128 / 128 通过**（Phase 1 回归 89 + 基线 6 + 组合根/插件集成等）。
- `npm run test:packages`：**310 项通过** = core 102 + host 39 + svg-xml 36 + cli 2 + dsh 19 + vscode 25 + command-stats 14 + command-dir 17 + shape-box 30 + tree-modified 26。
- `npm run check`：通过（Prettier、`check:docs`（93 MD/387 链接）、根测试、`build:packages`、`test:packages`、架构检查）。
- 架构检查：0 legacy files、11 workspace 包、257 workspace 源文件、119 条跨包 import。
- 指标脚本：`node scripts/metrics/metrics.mjs --from 'final^{commit}' --to <rev> --out docs/metrics`；已有 `e5621a6-to-17f9a78.json` 与 `e5621a6-to-a21f758.json`，**最终 p2 指标由 #22 重跑**。
- 环境：Windows 10 x64、Node `v26.13.0`、npm `12.2.1`、VS Code `1.143.1`、DSH `0.2.2-rc.5`。

## 4. 节点验收文档

均位于 `doc/evidence/acceptance/`：
`001`、`002`、`003`、`004`、`005`、`006`、`007`、`008`、`009`、`010`、`011`、`012`、`013`、`014`、`015`、`016`、`017`、`018`、`019`、`020`、`021`。

部分通过的条目（已写入对应文档）：

- #2：运行期只读保护、消费方评审记录（2 条部分通过）。
- #12：p2 终版指标未生成（第 4 条部分通过，留给 #22）。
- #16：真实会话中执行两个工具未验证（无 API key；第 3/4 条部分满足）。
- #21：C_A/C_B 在 F 上无法构建（`creationParts()` 是 F 之后的补丁），仅作 diff 证据（第 1 条部分通过）；A/B 运行回放与零改动检查通过。

## 5. 包与关键接口（下次开发前必读）

| 目录                    | 包名                      | 已实现                                                                                                                         |
| ----------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `packages/core`         | `@svgframe/core`          | 领域、四扩展点、注册表、事件、`EditorSession`、结构/属性事务、`TreePresenter`、`creationParts()`、`QueryContext.directories()` |
| `packages/svg-xml`      | `@svgframe/svg-xml`       | 中立语法 `parseSvgSyntax`；严格 `XmlSvgCodec`（变换规范化、provider 恢复、P1 格式 encode）                                     |
| `packages/host`         | `@svgframe/host`          | 文件/目录适配器、`PluginInstaller`/`PluginLoader`/`StagedPluginContext`                                                        |
| `packages/builtins`     | `@svgframe/builtins`      | 六种图形 provider + 19 个 P1 命令 + `BuiltinsPlugin`                                                                           |
| `apps/cli`              | `@svgframe/cli`           | `main`/`Application`/`CommandDispatcher`/`Repl`/`Tokenizer`，A/B 组合根                                                        |
| `plugins/command-stats` | `@svgframe/command-stats` | stats（query，只读）                                                                                                           |
| `plugins/command-dir`   | `@svgframe/command-dir`   | dir（query，`QueryContext.directories()`）                                                                                     |
| `plugins/shape-box`     | `@svgframe/shape-box`     | box provider + `box-attributes` + `box-type-label`                                                                             |
| `plugins/tree-modified` | `@svgframe/tree-modified` | `modified-star` 内容脏状态                                                                                                     |
| `apps/vscode-svg`       | `vscode-svg`              | 文件标记 + Outline + esbuild/VSIX                                                                                              |
| `apps/dsh-plugin`       | `@svgframe/dsh-plugin`    | `svg_inspect` + `svg_create_flowchart`，`ctx.fs` 网关，单文件打包                                                              |

接口/行为约定：

- 命令反馈：`<kind>#<id>` + 复合图形 `creationParts()` 摘要；ungroup 复合图形文案 `cannot ungroup composite shape: <id>`；undo 统一 `undone: <消息>`（§6.1B 的 `moved back by` 未实现，ADR-0017 记录）。
- 插件 manifest：包 `package.json` 顶层 `svgframe.contributes`；`PluginContext.subscribe` 只收已提交事件；加载失败整插件回滚。
- 默认插件顺序：`command-stats → command-dir → shape-box → tree-modified`（`plugins.config.json`）。
- 关闭全部可选插件：`test/fixtures/plugins/no-optional-plugins.json` 下 4/4 baseline golden 匹配。
- 指标分类：`scripts/metrics/classification.json`；`plugin` 类已包含 builtins 与四个插件。

## 6. ADR 编号

已用：`0003`–`0017`（其中 `0006` CLI 组合根、`0014` box、`0015` dirty、`0016` metrics、`0017` 多态反馈）、`0009`（Accepted）。新建前先查 `doc/adr/README.md`。

## 7. 下一步（#22）与依赖

```text
#22 丙  QA-03 收口（需 #21 ✓、#11 ✓、#16 ✓、#12 ✓）
```

#22 要做的：

1. 最终全量检查（`npm ci` + `npm run check`）并记录真实输出；
2. `doc/README.md` 汇总扩展点清单、前后 PlantUML（实际渲染）、ADR、会话、证据、指标、交付步骤；
3. 在最终候选提交上重跑 metrics（`final^{commit}` → 候选），把 p2 指标写入 `docs/metrics/`，写清输入 SHA/规则/排除项；报告与指标分离提交避免 SHA 循环；
4. `doc/release-checklist.md`：最终 SHA、命令、未完成项、访问验证；
5. **p2 不创建**（用户约束：不合并 `main`、不打 tag），REL-01 记为“待用户确认后发布”，并给出候选 SHA 与发布步骤；
6. 复核 VSCode/DSH 真实证据、loader 故障矩阵、A/B 证据索引与所有验收文档，写 `doc/records/2026-11-25-quality-closeout.md`。

建议 #22 的提交拆成两个（指标/报告各一），仍是同一节点；若必须单提交，则把指标生成与报告一起提交并在证据里说明。

## 8. 恢复操作手册

1. 结束状态：工作树在 `integration/phase2`、干净；`node_modules` 已安装。
2. 继续成员节点：`git switch team/<成员>`，再 `git merge --no-edit integration/phase2` 同步。
3. 子智能体纪律：只在自己的 `team/*` 分支提交；不 checkout/merge/rebase/push/tag/reset；只 `git add` 本节点文件；每节点一个提交 + 一份 `doc/evidence/acceptance/NNN-<key>.md`。
4. 负责人：`git switch integration/phase2 && git merge --no-ff <节点提交>`，跑 `npm run check`，再 `git push origin team/<成员> integration/phase2`；证据分支单独推送。
5. 复跑命令：
   ```text
   npm ci --prefer-offline
   npm test                    # 128 项根测试
   npm run build:packages
   npm run test:packages       # 310 项工作区测试
   npm run check
   npm run cli
   node scripts/metrics/metrics.mjs --from 'final^{commit}' --to integration/phase2 --out docs/metrics
   node scripts/assembly/replay.mjs
   npm run verify:visual
   ```
6. 单包测试：`npm test -w @svgframe/core`（同理 svg-xml、host、builtins、vscode-svg、dsh-plugin、四个插件）。

## 9. 已知差距与风险（#22 需处理/记录）

- **p2 未创建**：用户要求不合并 `main`，因此 `p2` 标签与“同一仓库发布”留待用户确认；#22 只能准备发布清单与候选 SHA。
- **#21 C_A/C_B 不可构建**：F 缺少 `creationParts()` 钩子；若需要“可构建的证据分支”，可从 `0df080b`（#19 接入时的插件实现）重做 C_A/C_B，或把框架补丁纳入新 F' 后重建。当前仅 diff 证据。
- **#16 模型侧工具调用未执行**：无 `DEEPSEEK_API_KEY`；真实宿主只验证装载/注册/卸载。
- **#12 指标**：需要 #22 在最终候选上重跑，避免报告 SHA 循环。
- **跨平台/Node 版本**：仅 Windows + Node 26 实测；`.nvmrc` 24.22.1、CI 22/24 未本机复跑。
- **VSCode**：编辑后 `Ctrl+Z` 撤销刷新未判定通过；其余截图/VSIX 已验。
- **编码坑**：中文文件不要用 PowerShell `Get-Content/Set-Content`（会乱码），用编辑器工具或 Node 写 UTF-8。
- **用户约束**：每节点提交后推送；不合并 `main`；不打 `p2` 标签。

## 10. 会话结束状态

- 六个子智能体全部空闲；负责人最后合并 #21 并推送 `integration/phase2`、三个证据分支。
- 本日志提交为 `docs(records): update development log after node #21` 后推送。
- 恢复时先读本文件第 7、8 节；下一步是 `#22`（丙）。

## 11. #22 收口完成（最终状态）

- **22 / 22 节点全部完成**。`#22` 节点提交：`412727f`（指标）、`39381af`（报告）；合并提交：`7492201`、`97803e6`；`integration/phase2` HEAD = `97803e6`，已推送。
- **最终指标**（rules v1，`final`=`e5621a6` → 候选 `fb0427a`，由脚本从 Git 生成）：

  | 分类        | 文件 | 行数 | 复杂度 | 函数数 | 最大 |
  | ----------- | ---: | ---: | -----: | -----: | ---: |
  | kernel      |   61 | 2197 |    354 |    200 |   16 |
  | assembly    |   28 | 1910 |    482 |    144 |   21 |
  | plugin      |   67 | 1924 |    272 |    182 |   13 |
  | CLI 合计    |  156 | 6031 |   1108 |    526 |   21 |
  | vscode 单列 |   14 |  402 |     46 |     27 |    4 |
  | dsh 单列    |   11 |  724 |    100 |     51 |   10 |

  报告提交 `412727f` 上重跑指标并核对源文件集合/基线/汇总/规则/分类哈希：**PASS**（`sourceDigest 19683ac3…` 相同，差异仅 `inputs.to`/`command` 字段与 tracked 计数）。证据：`doc/evidence/release/metrics-recheck.log`。

- **验收矩阵**（矩阵实际 35 个需求 ID）：**31 通过 / 4 部分通过 / 0 未执行**。部分通过：`MET-01`（p2 未创建，final→p2 待重跑）、`DSH-01` 与 `PKG-02`（干净安装/加载/卸载已验，模型侧工具调用缺 `DEEPSEEK_API_KEY`）、`REL-01`（候选就绪，发布待确认）。逐条证据见 [acceptance.md §8](../acceptance.md) 与 [closeout 记录](2026-11-25-quality-closeout.md)。
- **ADR**：`0003`–`0008`、`0011`、`0012`、`0014`–`0017` 已标 Accepted（有实现/测试/证据）；`0010`（DSH）保持 Proposed（缺真实模型调用）；`0013` 为空号未补。
- **架构图**：新增 `doc/architecture/phase2-actual.puml`（边来自各 `package.json`）；本机只有 Java 17、无 PlantUML jar，**未渲染 SVG**，已在 `doc/architecture.md` 写明原因与渲染命令。
- **最终检查真实结果**：`npm ci --prefer-offline` exit 0（两个 postinstall 被环境 allowScripts 阻止，已记录）；`npm run check` exit 0（根 128、workspace 310、文档 96/471、架构 11 包/257 源/119 导入）；`npm run verify:visual` exit 0（`differingChannels: 0`）；CLI `--help` 与含 box/stats/dir/tree 的会话 exit 0。日志在 `doc/evidence/release/`。
- **p2 发布步骤（未执行，待用户确认）**：确认后把 `integration/phase2` 合并到 `main` → 在发布提交上创建附注标签 `p2`（不移动 `final`）→ 推送 `main` 与 `p2` → 用 `node scripts/metrics/metrics.mjs --from 'final^{commit}' --to 'p2^{commit}'` 重跑并在 p2 上核对源码散列 → 更新 `doc/release-checklist.md` 的最终 SHA。详见 [发布清单](../release-checklist.md)。
- **仍可改进项**：`C_A`/`C_B` 在 F 上因缺少 `creationParts()` 钩子不可构建（仅 diff 证据）；可用 `0df080b` 的 pre-hook 插件实现重做，或把框架补丁纳入新 F′ 后重建。DSH 模型侧真实调用需 API key；跨平台/Node 22–24/CI 未复跑；VSCode 编辑后 `Ctrl+Z` 刷新未判定。
- 工作树干净；所有子智能体空闲；本轮到此结束。
