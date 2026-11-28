# SVG Editor Platform 架构与开发记录

本仓库从 Phase 1（[zero0307/svg-editor-cli](https://github.com/zero0307/svg-editor-cli)，`final` = `25c263bd…` 附注标签，解引用 `e5621a68…`）的完整历史继续 Phase 2。当前状态：**22 个任务节点全部完成，Phase 2 候选为 `fb0427a`；`p2` 标签与 `main` 合并尚未执行，等待用户确认**（见 [发布清单](release-checklist.md)）。

本文件是课程报告入口：下面每一项都指向实际代码、测试、证据或决策，不把计划写成已完成。

## 1. 交付内容

| 交付物      | 位置                | 说明                                                                                                   |
| ----------- | ------------------- | ------------------------------------------------------------------------------------------------------ |
| CLI 内核    | `packages/core`     | 公开领域抽象、四扩展点契约与注册表、候选文档事务、编辑会话、结构策略、树展示与装饰管线、事件与公开端口 |
| XML 适配    | `packages/svg-xml`  | 中立 XML 语法层（供 Outline）与严格 SVG codec（provider 恢复、变换归一化、Phase 1 字节兼容）           |
| 宿主        | `packages/host`     | 插件加载事务（暂存/清单校验/失败回滚）、文件与目录适配器、`plugins.config.json` 解析                   |
| 默认能力    | `packages/builtins` | Phase 1 的 19 条命令与六种图形 provider，经同一 `PluginInstaller` 安装                                 |
| 可选插件    | `plugins/*`         | `command-stats`、`command-dir`、`shape-box`、`tree-modified`，各自独立测试、可单独启停                 |
| CLI 应用    | `apps/cli`          | REPL、参数入口、A（代码）/B（配置）两个组合根                                                          |
| VSCode 扩展 | `apps/vscode-svg`   | SVG 文件 `[]` 标记、原生 Outline、VSIX 打包                                                            |
| DSH 插件    | `apps/dsh-plugin`   | `svg_inspect` / `svg_create_flowchart` 工具与编辑服务适配                                              |

运行方式见第 10 节；Phase 1 归档材料保留在 [phase1-report.md](phase1-report.md)、[Phase 1 规格](../phase_cli_1.md) 与 [视觉验证](visual-verification/README.md)。

## 2. 架构与依赖

- 当前架构与依赖规则：[architecture.md](architecture.md)；重构前依赖图 [phase1.puml](architecture/phase1.puml)、方案图 [phase2-proposed.puml](architecture/phase2-proposed.puml)、**实际依赖图** [phase2-actual.puml](architecture/phase2-actual.puml)。
- 实际图未渲染 SVG：本机只有 Java 17、没有 PlantUML jar；`.puml` 可直接用 `java -jar plantuml.jar -tsvg` 渲染（原因写在 [architecture.md](architecture.md) 第 3 节）。
- 包边界由 `node scripts/check-architecture.mjs` 检查：11 个 workspace 包、257 个源文件、119 条跨包导入，当前 0 违规（`npm run check` 的一部分）。

## 3. 四扩展点

实际文件/函数、每个实现、无可选实现时的缺省行为与违约错误测试：[扩展点清单](evidence/framework/extension-points.md)（F = `a21f758` 冻结时整理，#17–#20 按此接入）。

## 4. 两种装配方式（A/B）

- A：`apps/cli/src/main.ts` 显式 import 四个插件并放入 `embeddedPlugins`。
- B：同一入口加 `--config plugins.config.json`，由 `packages/host` 的 `PluginLoader` 解析模块、把模块对象交给同一个 `PluginInstaller.install`。
- 加载失败按冻结文案输出后继续启动：`plugin not found: <module>`、`plugin has no default export: <name>`、`plugin manifest mismatch: <name> (declared: …, registered: …)`、`plugin failed to activate: <name> (<reason>)`、`duplicate registration: <category>/<name>`、`invalid plugin config`；失败插件的暂存注册与订阅全部回滚。
- 集成回放的三组 A/B 会话逐字节一致，空配置下四组会话均匹配 Phase 1 基线。原冻结基线上的接入差异与回放记录见[集成装配报告](evidence/assembly/README.md)。
- 从含通用回显修复的共同基线 `9cf8447` 分别检出代码装配 `bcdb30f` 与配置装配 `30f02c7`。两者均独立构建成功，各通过 30 项插件测试。两次回放的标准输出均逐字节匹配预期，生成的 SVG 均匹配既有验收摘要。见[box 双装配复核报告](evidence/assembly/verified-box/README.md)。

## 5. 设计模式与 OCP 验证

| 模式      | 实际角色                                                                                  | 验证                                                                          |
| --------- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Command   | `Command` 契约 + `CommandRegistry` + 元数据驱动 `CommandDispatcher`                       | 19 条默认命令与 4 个插件命令都只经注册接入；分发器无命令名白名单              |
| Composite | `ContainerShape`/`Group` + `box` 复合类型 + 测试专用 `stamp`                              | box 的 fill/label、结构保护、clone 保类型；框架验收测试用与业务无关的复合类型 |
| Adapter   | `host` 的 `LocalFileStore`/`LocalDirectoryReader`、`svg-xml` 的 DOM 适配、VSCode/DSH 适配 | 端口替身测试 + 真实临时目录、真实 Extension Host、真实 DSH 进程               |
| Decorator | `TreeDecorator` 管线 + `(box)`/`modified-star`                                            | 零装饰器字节不变、顺序固定、故障隔离                                          |

## 6. 质量证据

| 项目         | 结果                                                                                                     | 位置                                                             |
| ------------ | -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| 根测试       | 128 项通过（Phase 1 回归 + 基线 + 框架 + 组合根）                                                        | `npm test`，日志 [release/check.log](evidence/release/check.log) |
| 工作区测试   | 310 项通过（core 102、host 39、svg-xml 36、cli 2、dsh 19、vscode 25、stats 14、dir 17、box 30、tree 26） | `npm run test:packages`                                          |
| Phase 1 兼容 | 空配置下四个 golden 会话 4/4 逐字节一致                                                                  | [baseline/README.md](evidence/baseline/README.md)                |
| A/B 装配 | 集成回放三组一致，空配置 4/4；box 两种独立接入均通过构建与预期输出核对 | [集成回放](evidence/assembly/README.md)、[box 双装配复核报告](evidence/assembly/verified-box/README.md) |
| 加载器矩阵   | 39 项 host 测试覆盖四类失败、重复注册、回滚与订阅                                                        | `packages/host/test/`                                            |
| 视觉         | `differingChannels: 0`                                                                                   | [release/verify-visual.log](evidence/release/verify-visual.log)  |
| 指标         | `final → fb0427a` 由脚本从 Git 生成                                                                      | [docs/metrics/README.md](../docs/metrics/README.md)              |

## 7. 需求状态

35 个需求 ID 的逐条状态、证据与真实命令见 [acceptance.md](acceptance.md) §8：**31 通过、4 部分通过、0 未执行**。部分通过的四项是：`MET-01`（p2 尚未创建，final→p2 指标需发布后重跑）、`PKG-02`/`DSH-01`（DSH 干净安装与加载已验证，模型侧真实工具调用缺凭据未执行）、`REL-01`（候选就绪，`p2` 与远程发布待用户确认）。

## 8. 架构决策（ADR）

索引与实际状态：[ADR 清单](adr/README.md)。已建立的 ADR 覆盖初始化、CI、公开契约、事务与结构、树展示、CLI 插件化与组合根、workspaces 与包边界、XML 两层入口、VSCode/DSH 边界、加载事务、SVG 读回匹配、box 结构与读回、dirty 语义、指标规则、复合图形反馈；缺证据的保持 Proposed。

## 9. 会话、夹具与证据

- 会话输入（只含命令与注释）：[doc/transcript](transcript/)。
- 输入 SVG 与固定目录夹具：`test/fixtures/svg/`、`test/fixtures/dir/`（`inventory.json` 为重建协议）。
- golden：`test/fixtures/expected/baseline-final/`。
- 跨里程碑证据索引：[evidence-index.md](evidence-index.md)；逐节点验收：[evidence/acceptance](evidence/acceptance/)。
- VSCode 证据：[evidence/vscode/README.md](evidence/vscode/README.md)；DSH 证据：[evidence/dsh/README.md](evidence/dsh/README.md)。
- 指标脚本与口径：[scripts/metrics/README.md](../scripts/metrics/README.md)。

## 10. 运行与检查

```bash
npm ci
npm run check              # 格式 + 文档 + 根 128 项 + 包构建 + 工作区 310 项 + 架构
npm run verify:visual      # 离线渲染对比
npm run cli -- --help
npm run cli -- --script doc/transcript/baseline-flowchart.txt
npm run cli -- --script doc/transcript/box.txt --config plugins.config.json
```

VSCode：在 `apps/vscode-svg` 下构建并打包 VSIX（见 [vscode.md](vscode.md) 与 [evidence/vscode/install](evidence/vscode/install/clean-env.md)）。DSH：见 [dsh.md](dsh.md) 与 [evidence/dsh/install](evidence/dsh/install/README.md)；模型侧真实调用需 `DEEPSEEK_API_KEY`，**未执行**。

## 11. 未完成项

1. `p2` 标签、`main` 合并与远程推送未执行（用户要求，由主线在确认后按 [release-checklist.md](release-checklist.md) 完成）。
2. 跨平台（Linux/macOS）与 Node 22/24 的全套发布检查未验证；`.nvmrc` 为 24.22.1，全套发布检查实跑为 Node 26.13.0。
3. DSH 模型侧真实工具调用未执行（无凭据）。
4. 真实 VSCode 宿主演示仅在 Windows/本机 VSCode 版本完成，未做跨平台截图。

## 12. Phase 1 归档

- [Phase 1 报告](phase1-report.md)、[基线事实](baseline.md)、[初始化记录](initialization.md)、[Phase 1 交付清单](DELIVERY.md)
- [Phase 1 架构图](architecture.svg) / [原始 PlantUML](architecture.puml)、[历史视觉验证](visual-verification/README.md)
- Phase 1 规格原文：[phase_cli_1.md](../phase_cli_1.md)、[phase_cli_2-研-1.md](../phase_cli_2-研-1.md)（原文不改写）
