# 2026-11-24 六人模拟开发编排记录

> 状态：**本次自动化开发的编排约束**。用于把 22 个任务节点按硬依赖串行落地，模拟六名成员各自分支开发、逐节点提交、由负责人统一合并到 `main` 的副本。真实完成状态以本记录的“节点顺序”表和实际提交为准，不把计划写成已完成。

## 1. 角色、分支与节点顺序

`main` 是交付主线，本次**不合并到 `main`**。从 `main` 建立副本分支 `integration/phase2` 作为集成分支；每位成员一个长期功能分支，节点按 `definitions.json` 的 `depends_on` 严格串行。

| 成员 | 角色          | 分支                | 节点（按执行顺序）         |
| ---- | ------------- | ------------------- | -------------------------- |
| 甲   | 框架核心      | `team/jia-core`     | #2 → #7 → #10 → #14        |
| 乙   | 工程/宿主/XML | `team/yi-eng`       | #5 → #6 → #8 → #9 → #13    |
| 丙   | 集成质量      | `team/bing-quality` | #1 → #12 → #15 → #21 → #22 |
| 丁   | VSCode        | `team/ding-vscode`  | #3 → #11                   |
| 戊   | DSH           | `team/wu-dsh`       | #4 → #16                   |
| 己   | 插件 C/B/T    | `team/ji-plugins`   | #17 → #18 → #19 → #20      |

全局合并顺序（拓扑序，前一个节点合并进 `integration/phase2` 并通过检查后，下一个节点才开工）：

```text
#2 甲 → #1 丙 → #3 丁 → #4 戊
      → #5 乙                     （等 #1、#2）
      → #6 乙 → #8 乙 → #9 乙      （等 #2、#5）
      → #7 甲 → #10 甲             （等 #5）
      → #12 丙                     （等 #5）
      → #13 乙                     （等 #7、#6）
      → #11 丁                     （等 #3、#6）
      → #14 甲                     （等 #7、#13、#8、#9、#10、#1）
      → #15 丙                     （等 #14、#12）
      → #17 己 → #18 己 → #19 己 → #20 己   （等 #15）
      → #16 戊                     （等 #4、#14）
      → #21 丙                     （等 #15、#17~#20）
      → #22 丙                     （等 #21、#11、#16、#12）
```

同一成员连续节点可以在一次工作轮内顺序完成，但**每个节点必须单独提交**；负责人按节点逐个 `git merge --no-ff <节点提交>` 到 `integration/phase2`，保留每个节点的合并记录。

## 2. 分支与提交纪律

- 开发子智能体只在自己的 `team/*` 分支上工作：可以 `git add <本节点文件>`、`git commit`，**不得** checkout/switch 分支、不得 merge/rebase/cherry-pick 到集成分支、不得 push、不得打 tag、不得 `git add -A`/`git add .`、不得 `git reset --hard` 或删除未提交文件。
- 开工前先执行 `git rev-parse --abbrev-ref HEAD`；如果不是自己的分支，立即停止并报告，不要自行切换。
- 提交信息：`type(scope): 具体变化 (#issue)`，例如 `feat(core): publish four extension contracts (#2)`。一个节点一个提交；同一次工作轮内的格式调整可以并入该节点提交，但不能把两个节点的功能混进一个提交。
- 仓库根目录已有未提交的规划文档与 `.gitignore` 调整，由负责人统一处理；开发子智能体不要提交或还原它们。
- 负责人负责：分支创建、`integration/phase2` 合并、每次合并后的全量检查、必要时修复集成冲突。开发子智能体发现依赖缺失时，报告而不越权补别的节点。

## 3. 包与公开契约骨架

目标布局以 [架构方案](../architecture.md) 为准。本次固定以下命名，避免各节点各自发明：

| 目录                    | 包名                      | 公开入口职责                                     |
| ----------------------- | ------------------------- | ------------------------------------------------ |
| `packages/core`         | `@svgframe/core`          | 领域抽象、四扩展点、注册表、编辑会话、事务、展示 |
| `packages/svg-xml`      | `@svgframe/svg-xml`       | 中立 XML 语法入口、严格 SVG codec、变换规范化    |
| `packages/host`         | `@svgframe/host`          | 插件加载事务、文件与目录适配器                   |
| `packages/builtins`     | `@svgframe/builtins`      | Phase 1 默认命令与六种图形                       |
| `apps/cli`              | `@svgframe/cli`           | REPL、参数入口、A/B 组合根                       |
| `plugins/command-stats` | `@svgframe/command-stats` | stats 命令插件                                   |
| `plugins/command-dir`   | `@svgframe/command-dir`   | dir 命令插件                                     |
| `plugins/shape-box`     | `@svgframe/shape-box`     | box 图形、属性处理器、类型标签                   |
| `plugins/tree-modified` | `@svgframe/tree-modified` | modified-star 标签                               |
| `apps/vscode-svg`       | `@svgframe/vscode-svg`    | 文件标记、Outline、打包                          |
| `apps/dsh-plugin`       | `@svgframe/dsh-plugin`    | DSH 工具与编辑服务适配                           |

- 每个包只通过 `package.json` 的 `exports` 暴露公共入口；跨包只能 `import '@svgframe/xxx'`，禁止相对路径穿透 `src`。
- `core` 不得 import host/builtins/plugins/Node 文件系统/VSCode/dsh；`builtins` 与 `plugins/*` 只依赖 core 公开入口。
- 为保证 Phase 1 的 83 项回归可迁移，公开入口保留既有类名与核心方法：`SvgDocument`（`require`/`container`/`add`/`clone`/`validate`）、`Shape`/`Group`、`EditorSession`（`document`/`init`/`read`/`save`/`canvas`/`edit`/`undo`/`redo`）、`XmlSvgCodec`（`encode`/`decode`）、`CommandDispatcher.execute`。允许新增接口，不允许无理由改语义。
- 框架节点可以扩展契约，但必须同时更新所有消费者、fake 和 ADR；插件节点（#17~#20）不得修改 `core`/`host`/`builtins` 已冻结实现，缺少通用能力时先报告，由框架节点补。

## 4. 每个节点的完成门槛

1. 功能与 `definitions.json` 的范围/验收对应，落点在本节点 `paths` 指定的目录；测试覆盖故障路径与状态不变要求。
2. `npm run check` 通过；新增包还要通过根 `npm run build:packages`/`npm run test:packages`（#5 建立）。
3. 相关文档/ADR/证据同步更新；证据只能写实际执行结果，未执行的检查明确写“未执行”及原因。
4. 报告：分支、提交 SHA、改动文件、执行过的命令与真实结果、未完成项、对下游的影响。

## 5. 环境事实（开工时核对）

- 工作目录 `E:\develop\svg-editor-platform`；Node `v26.13.0`，npm `12.2.1`；依赖已 `npm ci` 安装。
- 迁移前根入口：`npm test`（编译 `src/` 后跑 `dist/test`）、`npm run check`（格式+文档+测试+架构检查）、`npm run verify:visual`。
- `final` 标签指向 Phase 1 基线；本次不移动 `final`、不 push、不建 `p2` 标签，`p2` 发布需另经主线合并确认。
- 真实 VSCode Extension Host 与真实 DSH 会话是否可用需开工时验证；不可用时以替身单测 + 手工步骤记录，并明确标为未执行，不得伪造截图或安装日志。

## 6. 与既有记录的关系

[团队排期记录](2026-11-16-team-scheduling.md) 是人员与流水线参考；本文件是本次自动化的执行编排。两者冲突时，以 `definitions.json` 的 `depends_on` 和本文件的节点顺序为准，并回写说明。

## 7. 进度快照

截至最近一次收尾：已完成 `#2`、`#1`、`#3`、`#4`、`#5`、`#6`、`#9`、`#7`、`#10`，集成分支 `integration/phase2` 已推送；下一节点为 `#8`。详细的提交 SHA、分支状态、接口约定、复跑命令和遗留问题见 [开发日志](2026-11-24-development-log.md)。
