# 2026-11-25 Phase 2 开发日志（阶段快照）

> 用途：记录本次自动化开发到此为止的真实进度、分支/提交、接口约定与遗留问题，供下次继续。**完成状态以本文件和实际提交为准**，未执行的检查不得当作通过。
> 编排规则见 [六人模拟开发编排记录](2026-11-24-agent-team-orchestration.md)；上一轮快照见 [前一日日志](2026-11-24-development-log.md)；任务定义见 [definitions.json](../tasks/definitions.json)。

## 1. 进度总览

- 已完成并合并到集成分支：**12 / 22** 个节点。
- 已完成节点：`#2`、`#1`、`#3`、`#4`、`#5`、`#6`、`#9`、`#7`、`#10`、`#8`、`#12`、`#13`。
- 待做（10 个）：`#11`、`#14`、`#15`、`#16`、`#17`、`#18`、`#19`、`#20`、`#21`、`#22`。
- 集成分支 `integration/phase2` 当前 HEAD：`894b3d1`（`merge #13 TASK-XML-02`），已推送；本地与 `origin/integration/phase2` 一致。
- `main` 未合并、未推送新内容；`final` 标签未移动；未创建 `p2` 标签。

## 2. 分支与提交

| 成员 | 分支                        | 分支最新提交 | 状态                                        |
| ---- | --------------------------- | ------------ | ------------------------------------------- |
| 甲   | `team/jia-core`             | `0773e43`    | 已推送；#2/#7/#10 已合并；下一节点 #14      |
| 乙   | `team/yi-eng`               | `b8a463b`    | 已推送；#5/#6/#9/#8/#13 已合并；无待做节点  |
| 丙   | `team/bing-quality`         | `a7a34a0`    | 已推送；#1/#12 已合并；下一节点 #15/#21/#22 |
| 丁   | `team/ding-vscode`          | `ca80c0b`    | 已推送；#3 已合并；下一节点 #11             |
| 戊   | `team/wu-dsh`               | `63e6c89`    | 已推送；#4 已合并；下一节点 #16             |
| 己   | `team/ji-plugins`（未创建） | —            | #15 冻结后从集成分支创建                    |

节点提交 → 合并提交：

| 节点          | 节点提交  | 合并提交  |
| ------------- | --------- | --------- |
| #2            | `4ae88aa` | `78c2e87` |
| #1            | `20ee5ac` | `24fe0d2` |
| #2 复核（丁） | `75a3911` | `612a548` |
| #3            | `ca80c0b` | `9b2cc65` |
| #4            | `63e6c89` | `124b329` |
| #5            | `4052720` | `bcfc6d9` |
| #6            | `4ee1330` | `63f6709` |
| #9            | `0e97a66` | `98ec3f5` |
| #7            | `23f85a5` | `bc54931` |
| #10           | `0773e43` | `ed6183e` |
| #8            | `11baca4` | `17f9a78` |
| #12           | `a7a34a0` | `6eeb64f` |
| #13           | `b8a463b` | `894b3d1` |

远程：`origin` = <https://github.com/zero0307/svg-editor-platform.git>；`integration/phase2` 与五个 `team/*` 分支均已推送，未推送 `main` 的本地提交。

## 3. 测试与检查（最后一次真实执行）

- `npm test`（Phase 1 旧回归）：**89 / 89 通过**。
- `npm run test:packages`：**185 项通过** = core 96 + svg-xml 36（语法 16 + 严格层 20）+ host 39 + dsh-plugin 7 + vscode-svg 7。
- `npm run check`：通过（Prettier、`check:docs`、旧回归、`build:packages`、`test:packages`、架构检查）。
- 架构检查：38 个旧文件 / 115 条旧 import / 5 个 workspace 包 / 132 个 workspace 源文件 / 17 条跨包 import。
- 指标脚本：`node scripts/metrics/metrics.mjs --from 'final^{commit}' --to <rev> --out docs/metrics`；首版候选 `docs/metrics/e5621a6-to-17f9a78.json`（rules v1，确定性已验证）。
- 环境：Windows 10 x64、Node `v26.13.0`、npm `12.2.1`、VS Code `1.143.1`、DSH `0.2.2-rc.5`。

## 4. 节点验收文档

均位于 `doc/evidence/acceptance/`：`001-qa-01.md`、`002-core-01.md`、`003-vsc-01.md`、`004-dsh-01.md`、`005-eng-01.md`、`006-xml-01.md`、`007-core-02.md`、`008-host-01.md`、`009-host-02.md`、`010-core-03.md`、`012-met-01.md`、`013-xml-02.md`。

其中 #2 由丁跨板块复核（2 通过 / 2 部分通过）；#12 第 4 条部分通过（p2 终版未生成）；#13 的真实 builtins 全量对照留待 #14。

## 5. 包与关键接口（下次开发前必读）

| 目录                | 包名                   | 已实现                                                                                                                                            |
| ------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/core`     | `@svgframe/core`       | 领域、四扩展点、注册表、事件、`EditorSession`、`StructureService`、`AttributeEditingService`、`TreePresenter`、`SvgCodec`/`FileStore` 端口、fakes |
| `packages/svg-xml`  | `@svgframe/svg-xml`    | 中立语法 `parseSvgSyntax`；严格层 `XmlSvgCodec`（变换规范化、provider 恢复、P1 格式 encode）                                                      |
| `packages/host`     | `@svgframe/host`       | `LocalFileStore`、`LocalDirectoryReader`、`PluginInstaller`/`PluginLoader`/`StagedPluginContext`                                                  |
| `apps/vscode-svg`   | `vscode-svg`           | 文件标记（真实宿主截图已存）；`types/vscode.d.ts` 临时 shim                                                                                       |
| `apps/dsh-plugin`   | `@svgframe/dsh-plugin` | 最小插件；本地结构性 `EditorSessionPort`（#16 换真实端口）                                                                                        |
| `packages/builtins` | `@svgframe/builtins`   | **未建立**（#14）                                                                                                                                 |
| `apps/cli`          | `@svgframe/cli`        | **未建立**（#14）                                                                                                                                 |
| `plugins/*`         | 四个插件包             | **未建立**（#17–#20）                                                                                                                             |

接口约定补充（本轮新增）：

- **#14 codec**：`new XmlSvgCodec(providerRegistry)`；六类 builtins provider 的 `defaultTag` 为 rect/circle/ellipse/line/text/g，box 用 `matches` 看 `data-kind`。叶 provider 读 `SvgElementView.attributes`（已去 transform/id/xmlns、完成继承缩放与实体解码），按 `view.transform` 先 scale 后 translate **一次**；容器不得重复应用。provider 必须按 P1 属性顺序（imported→geometry→styles）写属性，否则 encode 字节变化。
- **#14 loader**：构造注册表/创建服务/`EditorEvents` 后 `new PluginInstaller(services)`；A 用 `installAll([...])`，B 用 `new PluginLoader(installer).loadFromConfig(configPath)`；host 消息不带 `error:` 前缀；全部安装成功后再 `TreePresenter.connect`。
- **命令监听**：`PluginContext.subscribe` 只收已提交编辑事件；暂存订阅在失败/禁用时释放。
- **manifest**：插件包 `package.json` 顶层 `svgframe.contributes`（shapes/commands/decorators/attributes 名称数组）。
- **指标**：分类规则在 `scripts/metrics/classification.json`；`plugin` 类当前为 0，`packages/builtins`/`apps/cli`/`plugins` 落地后自动纳入，无需改脚本。

## 6. ADR 编号

已用：`0003`、`0004`、`0005`、`0007`、`0008`、`0009`、`0010`、`0011`、`0012`、`0016`。预留：`0006`（CLI 迁移）、`0014`（box）、`0015`（dirty）。新建前先查 `doc/adr/README.md`。

## 7. 下次继续的顺序与依赖

```text
#11 丁  VSC-02 Outline + VSIX（需 #3 ✓、#6 ✓）              ← 建议先做
#14 甲  CLI-01 迁移（需 #7/#13/#8/#9/#10/#1 全部 ✓）        ← 最大节点
#15 丙  FRAME-01 冻结（需 #14、#12 ✓）
#17 己  stats（需 #15）→ #18 dir → #19 box → #20 modified-star
#16 戊  DSH-02 两个工具（需 #4 ✓、#14）
#21 丙  QA-02 A/B 回放（需 #15、#17–#20）
#22 丙  QA-03 收口（需 #21、#11、#16、#12 ✓）
```

## 8. 恢复操作手册

1. 结束状态：工作树在 `integration/phase2`、干净；`node_modules` 已安装。
2. 继续某成员节点：`git switch team/<成员>`，再 `git merge --no-edit integration/phase2` 同步依赖。
3. 子智能体纪律：只在自己的 `team/*` 分支提交；不 checkout/merge/rebase/push/tag/reset；只 `git add` 本节点文件；每节点一个提交 + 一份 `doc/evidence/acceptance/NNN-<key>.md`。
4. 负责人：`git switch integration/phase2 && git merge --no-ff <节点提交>`，跑 `npm run check`，再 `git push origin team/<成员> integration/phase2`（每节点推送）。
5. 复跑命令：
   ```text
   npm ci --prefer-offline
   npm test                    # 89 项旧回归
   npm run build:packages
   npm run test:packages       # 185 项工作区测试
   npm run check
   npm run cli                 # 旧 CLI（#14 后改入口）
   node scripts/metrics/metrics.mjs --from 'final^{commit}' --to integration/phase2 --out docs/metrics
   ```
6. 单包测试：`npm test -w @svgframe/core`（同理 `@svgframe/svg-xml`、`@svgframe/host`、`vscode-svg`、`@svgframe/dsh-plugin`）。

## 9. 已知差距与风险

- **#14 是最大风险点**：必须删除 `src/`、迁移 83 项测试到新包、切换根 `test`/`cli` 入口，并保证与 `final` 逐字节一致；不能保留两套运行内核。
- **#13 的真实对照**：builtins provider 尚未存在，六种图形与 P1 的逐字节 encode/decode 对照要在 #14 完成；当前仅 fake provider 证明通用能力。
- **#12 首版指标**：`plugin` 类为 0；p2 终版与“在 p2 上重跑核对源码散列”留给 #22。
- **#2 部分通过**：只读是类型/API 边界而非运行时冻结；ADR-0003 仍 Proposed。
- **真实宿主**：VSCode Outline/VSIX 待 #11；DSH 模型侧工具调用因无 API key 未执行。
- **平台**：仅 Windows + Node 26 实测；`.nvmrc` 24.22.1、CI 22/24 未本机复跑。
- **编码坑**：中文文件不要用 PowerShell `Get-Content/Set-Content`（会乱码），用编辑器工具或 Node 写 UTF-8。
- **用户约束**：每节点提交后推送；不合并 `main`；不打 `p2` 标签。

## 10. 会话结束状态

- 六个子智能体全部空闲；负责人最后合并 #13 并推送。
- 本日志提交为 `docs(records): snapshot phase-2 development log (2026-11-25)` 后推送 `integration/phase2`。
- 恢复时先读本文件第 7、8 节。
