# 2026-11-24 Phase 2 开发日志（阶段快照）

> 用途：记录本次自动化开发到此为止的真实进度、分支/提交、接口约定与遗留问题，供下次继续。**完成状态以本文件和实际提交为准**，未执行的检查不得当作通过。
> 编排规则见 [六人模拟开发编排记录](2026-11-24-agent-team-orchestration.md)；任务定义见 [definitions.json](../tasks/definitions.json)。

## 1. 进度总览

- 已完成并合并到集成分支：**9 / 22** 个节点。
- 已完成节点：`#2`、`#1`、`#3`、`#4`、`#5`、`#6`、`#9`、`#7`、`#10`。
- 待做：`#8`、`#11`、`#12`、`#13`、`#14`、`#15`、`#16`、`#17`、`#18`、`#19`、`#20`、`#21`、`#22`。
- 集成分支 `integration/phase2` 当前 HEAD：`ed6183e`（`merge #10 TASK-CORE-03`）。
- `main` 未合并、未推送新内容；`final` 标签未移动；未创建 `p2` 标签。

## 2. 分支与提交

| 成员 | 分支                        | 分支最新提交 | 状态                                                    |
| ---- | --------------------------- | ------------ | ------------------------------------------------------- |
| 甲   | `team/jia-core`             | `0773e43`    | 已推送；#2、#7、#10 已合并                              |
| 乙   | `team/yi-eng`               | `0e97a66`    | 已推送；#5、#6、#9 已合并；下一节点 #8/#13              |
| 丙   | `team/bing-quality`         | `20ee5ac`    | 已推送；#1 已合并；下一节点 #12                         |
| 丁   | `team/ding-vscode`          | `ca80c0b`    | 已推送；#3 已合并；另为甲补了 #2 验收复核；下一节点 #11 |
| 戊   | `team/wu-dsh`               | `63e6c89`    | 已推送；#4 已合并；下一节点 #16                         |
| 己   | `team/ji-plugins`（未创建） | —            | #15 冻结后再从集成分支创建                              |

每个节点一个提交，负责人用 `git merge --no-ff <节点提交>` 合并进 `integration/phase2`：

| 节点              | 节点提交  | 合并提交  |
| ----------------- | --------- | --------- |
| #2                | `4ae88aa` | `78c2e87` |
| #1                | `20ee5ac` | `24fe0d2` |
| #2 验收复核（丁） | `75a3911` | `612a548` |
| #3                | `ca80c0b` | `9b2cc65` |
| #4                | `63e6c89` | `124b329` |
| #5                | `4052720` | `bcfc6d9` |
| #6                | `4ee1330` | `63f6709` |
| #9                | `0e97a66` | `98ec3f5` |
| #7                | `23f85a5` | `bc54931` |
| #10               | `0773e43` | `ed6183e` |

远程：`origin` = <https://github.com/zero0307/svg-editor-platform.git>。已推送 `integration/phase2` 与全部 `team/*` 分支；未推送 `main` 的本地提交。

## 3. 测试与检查（最后一次真实执行）

- `npm test`（Phase 1 旧回归）：**89 / 89 通过**。
- `npm run test:packages`：**139 项通过** = core 96 + svg-xml 16 + host 13 + dsh-plugin 7 + vscode-svg 7。
- `npm run check`：通过（Prettier、`check:docs`、旧回归、`build:packages`、`test:packages`、`scripts/check-architecture.mjs`）。
- 架构检查：38 个旧文件 / 115 条旧 import / 5 个 workspace 包 / 113 个 workspace 源文件 / 4 条跨包 import。
- 环境：Windows 10 x64、Node `v26.13.0`、npm `12.2.1`、VS Code `1.143.1`、DSH `0.2.2-rc.5`；npm registry 为 `https://registry.npmmirror.com`。
- 依赖已安装，`npm ci --prefer-offline` 可从锁文件复现（`lockfileVersion: 3`）。

## 4. 每个节点的验收文档

均位于 `doc/evidence/acceptance/`：

| 文件             | 节点 | 结论要点                                                    |
| ---------------- | ---- | ----------------------------------------------------------- |
| `001-qa-01.md`   | #1   | 4 会话逐字节匹配；dir 仅 P1 unknown-command 基线            |
| `002-core-01.md` | #2   | 2 通过 / 2 部分通过（运行期只读保护、消费方评审记录）       |
| `003-vsc-01.md`  | #3   | 真实 Extension Host 截图 `[]`；Outline 观察未执行（属 #11） |
| `004-dsh-01.md`  | #4   | 真实加载/注册/释放；模型侧工具调用未执行（无 API key）      |
| `005-eng-01.md`  | #5   | 干净 `npm ci` + 构建顺序 + 边界检查；Node 22/24 未本机复跑  |
| `006-xml-01.md`  | #6   | UTF-16 span、无 id、不完整 XML 受控失败；VSCode 转换待 #11  |
| `007-core-02.md` | #7   | 事务原子性、属性冲突、结构策略、事件隔离；真实 CLI 待 #14   |
| `009-host-02.md` | #9   | 原子写入、目录读取；`other` 类型仅代码覆盖                  |
| `010-core-03.md` | #10  | 零装饰器逐字节一致、双标签并存、故障隔离                    |

## 5. 包与关键接口（下次开发前必读）

| 目录                | 包名                     | 已实现                                                                                                                                |
| ------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/core`     | `@svgframe/core`         | 领域、四扩展点、注册表、事件、`EditorSession`、`StructureService`、`AttributeEditingService`、`TreePresenter`、`SvgCodec` 端口、fakes |
| `packages/svg-xml`  | `@svgframe/svg-xml`      | 中立语法入口 `parseSvgSyntax`（0-based UTF-16、end 独占；`outerSpan`/`startTagSpan`/`nameSpan`）                                      |
| `packages/host`     | `@svgframe/host`         | `LocalFileStore`、`LocalDirectoryReader`；`DirectoryEntryKind = 'directory'\|'file'\|'link'\|'other'`                                 |
| `apps/vscode-svg`   | `vscode-svg`             | 文件标记（`SvgFileDecorator` + Provider）；`types/vscode.d.ts` 为临时 shim                                                            |
| `apps/dsh-plugin`   | `@svgframe/dsh-plugin`   | 最小插件 + 本地结构性 `EditorSessionPort`（#16 换真实端口）                                                                           |
| `packages/builtins` | `@svgframe/builtins`     | **未建立**（#14）                                                                                                                     |
| `apps/cli`          | `@svgframe/cli`          | **未建立**（#14）                                                                                                                     |
| `plugins/*`         | `@svgframe/command-*` 等 | **未建立**（#17–#20）                                                                                                                 |

接口约定（各节点报告汇总）：

- `EditorSession.document()` 返回只读投影；`#14` 迁移 Phase 1 测试时，原先直接 `document().require(...).setAttribute(...)` 的写法（如 `test/strings.test.ts`）要改为走编辑路径。
- 属性：`handles` 纯查询；≥2 命中在修改前抛 `AttributeHandlerConflictError`；0 命中走默认白名单；1 命中失败不回退。
- 结构：必要部件由 `ContainerShape.canRemoveChild` / `Shape.canUngroup` 拒绝；box 的最终类型必须重写 `newContainer()`（见 ADR-0004）。
- 展示：`TreePresenter.tree/show/connect`；装饰器按注册顺序拼接、每后缀前一个空格、零装饰器逐字节不变。
- Codec：#13 实现 `SvgCodec.decode(source)→{document,warnings}` / `encode(ReadonlyDocument)→string`；session 会二次 `validate()`，禁止用编解码做历史快照。
- 加载器：#8 必须在注册成功后才 `connect` 装饰器；A/B 共用同一 `PluginInstaller`；`contributes` 四类名称集合比较、重复名拒绝、失败整插件回滚。
- DSH：固定 `0.2.2-rc.5`；真实加载用 `ELECTRON_RUN_AS_NODE=1` + `DSH_NODE_EXECUTABLE` 跑 asar 内 `lib/bin.js`，`DSH_HOME` 指向临时目录；**不得动用户 `C:\Users\tianbaoZeng\.dsh`**。
- VSCode：扩展 `name` 用 `vscode-svg`（id `svgframe.vscode-svg`），#5 已按此注册 workspace；#11 换 `@types/vscode` 并做 esbuild + VSIX。

## 6. ADR 编号

已用：`0003`（公开契约）、`0004`（候选事务/结构）、`0005`（树展示）、`0007`（workspaces）、`0008`（中立 XML）、`0009`（VSCode 边界）、`0010`（DSH 边界）。预留：`0006`（CLI 迁移）、`0011`（加载事务）、`0012`（读回匹配）、`0014`（box）、`0015`（dirty）。新建 ADR 前先查 `doc/adr/README.md` 索引。

## 7. 下次继续的顺序与依赖

依赖均已满足、可直接开工的顺序：

```text
#8  乙  HOST-01 加载器（需 #5 ✓）
#12 丙  MET-01 指标脚本（需 #5 ✓）
#13 乙  XML-02 严格 codec（需 #7 ✓、#6 ✓）
#11 丁  VSC-02 Outline + VSIX（需 #3 ✓、#6 ✓）
#14 甲  CLI-01 迁移（需 #7/#13/#8/#9/#10/#1）
#15 丙  FRAME-01 冻结（需 #14、#12）
#17 己  stats（需 #15）→ #18 dir → #19 box → #20 modified-star
#16 戊  DSH-02 两个工具（需 #4 ✓、#14）
#21 丙  QA-02 A/B 回放（需 #15、#17–#20）
#22 丙  QA-03 收口（需 #21、#11、#16、#12）
```

建议先做 `#8`（解锁 #14），再做 `#12`/`#13`/`#11`，然后 `#14` 汇聚框架。

## 8. 恢复操作手册

1. 工作树当前在哪个分支都可能（本次结束停在 `integration/phase2`）。开工前确认 `git status` 干净。
2. 继续某成员节点：`git switch team/<成员>`，然后 `git merge --no-edit integration/phase2` 同步依赖。
3. 开发子智能体纪律：只在自己的 `team/*` 分支提交；不 checkout/merge/rebase/push/tag/reset；只 `git add` 本节点文件；每节点一个提交 + 一节 `doc/evidence/acceptance/NNN-<key>.md`。
4. 负责人合并：`git switch integration/phase2 && git merge --no-ff <节点提交>`，跑 `npm run check`，然后 `git push origin team/<成员> integration/phase2`（用户要求每节点推送）。
5. 复跑命令：
   ```text
   npm ci --prefer-offline
   npm test                    # 89 项旧回归
   npm run build:packages
   npm run test:packages       # 139 项工作区测试
   npm run check               # 全部检查
   npm run cli                 # 旧 CLI（#14 后改入口）
   ```
6. 单包测试：`npm test -w @svgframe/core`（同理 `-w @svgframe/svg-xml`、`-w @svgframe/host`）。

## 9. 已知差距与风险（下次先处理）

- **#2 部分通过**：只读是类型/API 边界而非运行时冻结；ADR-0003 仍 Proposed；消费方评审记录仅丁一份。
- **#1 仅 Windows + Node 26**：`.nvmrc` 为 24.22.1，CI 矩阵 22/24，跨平台未复跑。
- **指标脚本未做**（#12）：TypeScript 7.0.2 是原生 tsgo，`createSourceFile` 不可用，丙计划按 `unstable/sync` 或词法扫描二选一，需在 #12 记录裁决。
- **真实宿主**：VSCode Outline 与 VSIX 干净安装待 #11；DSH 模型侧工具调用因无 API key 未执行，`plugin add/remove` 的 pnpm 流程未验证。
- **过渡期双实现**：`src/`（Phase 1 内核）与 `packages/*` 并存，`#14` 必须删旧并迁移测试，不能保留两套运行内核。
- **编码坑**：中文文件不要用 PowerShell `Get-Content/Set-Content`（会按 ANSI 读写导致乱码），用编辑器工具或 Node 写 UTF-8。
- **用户约束**：每节点提交后推送；不合并 `main`；不打 `p2` 标签（发布需另行确认）。

## 10. 会话结束状态

- 开发子智能体全部空闲；负责人最后执行合并与推送。
- 本日志写入后，负责人提交 `docs(records): snapshot phase-2 development log` 并推送 `integration/phase2`。
- 恢复时先读本文件第 7、8 节。
