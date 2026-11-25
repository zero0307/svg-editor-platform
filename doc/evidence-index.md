# 证据索引

本文件是跨节点的证据入口：列出被测提交、受保护引用、证据路径、可复现命令、环境与未执行项。单个节点的逐条验收见 `doc/evidence/acceptance/`，不在本文件重复。

## 当前冻结基线 F

| 项目         | 值                                                                                                                                                                                                                                                  |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 提交         | `a21f758bf072a7d8c0ff683bc579db124c6d209d`（简称 `a21f758`）                                                                                                                                                                                        |
| 受保护引用   | 分支 `evidence/p2-framework-base`（本地与 `origin` 都指向同一提交）                                                                                                                                                                                 |
| 标签         | 无（冻结阶段不打 tag；`p2` 由 `#22` 在验收提交上创建）                                                                                                                                                                                              |
| 组件         | 框架完整、业务插件未接入：`packages/{core,host,svg-xml,builtins}`、`apps/{cli,vscode-svg,dsh-plugin}`；F 时 `plugins.config.json` 的 `plugins` 为空（`#17` 起含 `stats`、`#18` 起含 `dir`、`#19` 起含 `box`、`#20` 起含 `tree-modified`，见 M3 行） |
| 冻结证据     | [framework/freeze.json](evidence/framework/freeze.json)（SHA、配置哈希、14 个输入文件 sha256）                                                                                                                                                      |
| 冻结会话输入 | `doc/transcript/baseline-{basic,flowchart,io,dir}.txt`、`test/fixtures/svg/other.svg`、`test/fixtures/dir/`                                                                                                                                         |
| 目录重建协议 | `test/fixtures/dir/inventory.json` + [framework/freeze.json](evidence/framework/freeze.json) 的 `directoryProtocol`                                                                                                                                 |

## F 后框架补丁

| 补丁             | 关联     | 说明                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ---------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 查询命令目录端口 | #18 前置 | 提交 `feat(core): expose directory port to query commands (#18 prerequisite)`，基于 F=`a21f758`。`QueryContext` 增加可选 `DirectoryReader` 与 `directories()`（缺失报 `directory access is not available`），`CommandDispatcher` 与 A/B 组合根注入同一 `LocalDirectoryReader`；不改变既有命令输出、文档/历史/屏障。补丁后 core 98、cli 2、workspace 221；#18~#20 的 A/B 证据以本补丁后提交为新基线。                                                                                                                         |
| 复合图形多态反馈 | #19 后续 | 提交 `feat(core): add polymorphic command feedback for composite shapes (#19 follow-up)`，基于 F=`a21f758`。`Shape.creationParts()` 默认 `[]`、复合图形可返回创建部件；命令反馈统一用领域 `kind`，box 采用钩子输出 `box#n1 created (g#n1 + rect#n1-rect + text#n1-label)`；`ungroup` 复合图形文案改为 `cannot ungroup composite shape: <id>`；undo 保持 `undone: <原消息>`（§6.1B 示意文案不实现，ADR-0017 裁决）。box transcript golden 同步更新；补丁后 root 122、workspace 272，后续 A/B/box 证据以本补丁后提交为新基线。 |

## 证据目录

| 里程碑           | 路径                                                                             | 内容                                                                                                                           |
| ---------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Phase 1 基线     | [evidence/baseline/README.md](evidence/baseline/README.md)                       | golden、四会话退出码、规格差异、生成与比较日志                                                                                 |
| M2 框架冻结（F） | [evidence/framework/extension-points.md](evidence/framework/extension-points.md) | 四扩展点契约/调用位置/实现/缺省/错误测试                                                                                       |
| M2 环境          | [evidence/framework/environment.json](evidence/framework/environment.json)       | Node/npm/TypeScript/OS、`.nvmrc` 差异、实测命令                                                                                |
| M2 检查          | [evidence/framework/check.log](evidence/framework/check.log)                     | `npm run check` 原始输出                                                                                                       |
| M2 指标          | [evidence/framework/metrics-v1.log](evidence/framework/metrics-v1.log)           | `final^{commit}` → F 的指标生成日志                                                                                            |
| M3 stats（#17）  | [evidence/acceptance/017-cmd-01.md](evidence/acceptance/017-cmd-01.md)           | stats 插件逐条验收、A/B 字节一致、禁用与无文档行为                                                                             |
| M3 dir（#18）    | [evidence/acceptance/018-cmd-02.md](evidence/acceptance/018-cmd-02.md)           | dir 插件逐条验收、真实目录组合、A/B 字节一致                                                                                   |
| M3 box（#19）    | [evidence/acceptance/019-box-01.md](evidence/acceptance/019-box-01.md)           | box 三类贡献逐条验收、transcript 回放、读回/降级、结构保护                                                                     |
| M3 tree（#20）   | [evidence/acceptance/020-tree-01.md](evidence/acceptance/020-tree-01.md)         | modified-star 状态机、保存/撤销、双标签顺序、禁用与 A/B                                                                        |
| DSH（#4/#16）    | [evidence/acceptance/016-dsh-02.md](evidence/acceptance/016-dsh-02.md)           | `svg_inspect`/`svg_create_flowchart` 逐条验收、真实宿主加载/卸载、干净目录安装与 sha256                                        |
| DSH 安装证据     | [evidence/dsh/install/README.md](evidence/dsh/install/README.md)                 | 命令、退出码、`--dump-config`、加载日志、产物哈希                                                                              |
| 指标产物         | [docs/metrics/README.md](../docs/metrics/README.md)                              | `e5621a6-to-a21f758.json`、`summary.md`、重算说明                                                                              |
| 节点验收         | `doc/evidence/acceptance/`                                                       | `001-qa-01`、`004-dsh-01`、`012-met-01`、`015-frame-01`、`016-dsh-02`、`017-cmd-01`、`018-cmd-02`、`019-box-01`、`020-tree-01` |

## 命令

```bash
npm test                    # 根测试 128 项（含 Phase 1 基线、框架验收、stats/dir/box/tree 插件测试）
npm run test:packages       # 工作区 310 项（core 102、host 39、svg-xml 36、cli 2、dsh 19、vscode 25、command-stats 14、command-dir 17、shape-box 30、tree-modified 26）
npm run check               # 格式、文档、根测试、包构建、包测试、架构检查
node scripts/metrics/metrics.mjs --from 'final^{commit}' --to a21f758 --out docs/metrics
node scripts/baseline/compare.mjs --entry apps/cli/dist/main.js
# 回放以 test/fixtures/plugins/no-optional-plugins.json 禁用可选插件，对照 final 的 Phase 1 字节；golden 未改
```

Phase 1 回放与可选插件：A 默认入口已装入 `stats`/`dir`/`box`/`tree-modified`，`compare.mjs` 因此显式以空配置（B 模式）运行，使 `dir` 会话仍断言 Phase 1 的 `error: unknown command: dir`；`record.mjs` 录制 `final` 时不传 `--config`。目录端口与多态反馈补丁见“F 后框架补丁”行；`#19` box transcript 回放固定使用 stats/dir/box 插件集，避免 `modified-star` 后缀改变冻结字节。

## 环境

Windows `win32 x64`，Node `v26.13.0`，npm `12.2.1`，TypeScript `7.0.2`。`.nvmrc` 固定 `24.22.1`，本次全部实跑都在 Node 26 上完成；未在 Node 22/24、Linux 或 macOS 上执行，也未运行 CI。

## 未执行项

- `#21` 的 C_A/C_B 证据分支、完整 A/B 回放、`#22` 的 p2 指标与发布清单（默认装配的四个可选插件已全部接入；A/B 在同一提交内验证）。
- **可选插件的已知语义差异**：多态命令反馈已由 [ADR-0017](adr/0017-polymorphic-command-feedback.md) 补丁实现（box 输出 `box#…`、`cannot ungroup composite shape: <id>`）；undo 仍为统一的 `undone: <原消息>`，P1 §6.1B 的 `moved back by` 等示意文案不实现。dirty 状态不跨进程持久化（[ADR-0015](adr/0015-dirty-semantics.md)）。
- 真实 VSCode Extension Host 安装演示（由 V 板块单独记录）；真实 DSH 宿主的加载/卸载与干净目录安装已验（`evidence/dsh/install/`），但**模型侧真实工具调用未执行**（本机无 `DEEPSEEK_API_KEY`，`headless` 在模型调用前退出）。
- 跨平台与 Node 22/24 检查；`npm run verify:visual` 未作为冻结门槛重跑。
