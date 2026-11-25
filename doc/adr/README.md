# 架构决策索引

本文件只做 ADR 导航，不复复制决策正文。编号只递增、不复用；`0013` 未创建（保留编号，不补虚构决策）。状态在 2026-11-25 收口时逐条复核：有实现与真实测试/证据支撑的标 **Accepted**，证据不足的保持 **Proposed** 并写明缺什么。

## 已建立

| 编号                                                        | 决策                                   | 状态         | 依据 / 缺什么                                                                                                                                         |
| ----------------------------------------------------------- | -------------------------------------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| [ADR-0001](0001-repository-bootstrap.md)                    | 保留历史初始化团队开发仓库             | Accepted     | 初始化记录与 Git 历史                                                                                                                                 |
| [ADR-0002](0002-ci-and-collaboration.md)                    | CI 门槛与公开协作                      | Accepted     | `.github/workflows/ci.yml`、协作配置记录；远程 CI 运行需仓库侧确认                                                                                    |
| [ADR-0003](0003-core-public-contracts.md)                   | 内核公开契约、四扩展点与只读边界       | Accepted     | `packages/core`、`test/framework-acceptance.test.ts`、[扩展点清单](../evidence/framework/extension-points.md)                                         |
| [ADR-0004](0004-candidate-transactions-and-structure.md)    | 候选文档事务、属性分派与通用结构策略   | Accepted     | core 事务/结构属性测试、[017](../evidence/acceptance/017-cmd-01.md)/[019](../evidence/acceptance/019-box-01.md)                                       |
| [ADR-0005](0005-tree-display-and-decoration.md)             | 树展示与行尾装饰管线                   | Accepted     | core 树展示测试、零装饰器字节回放、[020](../evidence/acceptance/020-tree-01.md)                                                                       |
| [ADR-0006](0006-cli-pluginization-and-composition-roots.md) | 默认命令插件化、A/B 组合根与旧内核迁移 | Accepted     | `apps/cli`、`packages/builtins`、[assembly](../evidence/assembly/README.md) 三组 A/B                                                                  |
| [ADR-0007](0007-workspaces-and-package-boundaries.md)       | npm workspaces、构建顺序与包边界检查   | Accepted     | `check-architecture` 11 包 0 违规、`test:packages` 310 项                                                                                             |
| [ADR-0008](0008-neutral-xml-syntax.md)                      | 中立 XML 语法入口与源码范围约定        | Accepted     | `packages/svg-xml` 语法层测试、VSCode Outline 证据                                                                                                    |
| [ADR-0009](0009-vscode-adapter-boundary.md)                 | VSCode 判定逻辑与宿主适配分离          | Accepted     | 25 项扩展测试、真实 Extension Host 截图                                                                                                               |
| [ADR-0010](0010-dsh-plugin-boundary.md)                     | DSH 插件与 CLI 插件边界                | **Proposed** | 实现、干净安装/加载/卸载已验；**缺**模型侧真实工具调用（无 `DEEPSEEK_API_KEY`）                                                                       |
| [ADR-0011](0011-plugin-load-transaction.md)                 | 插件加载事务、清单校验与 A/B 共享入口  | Accepted     | host 39 项故障矩阵、A/B 同路径                                                                                                                        |
| [ADR-0012](0012-svg-readback-matching.md)                   | provider 驱动的严格 SVG 读回与匹配     | Accepted     | `strict-codec` 36 项、box 往返/降级                                                                                                                   |
| [ADR-0014](0014-box-structure-and-readback.md)              | box 复合图形的结构、属性语义与读回     | Accepted     | box 30 项、[019](../evidence/acceptance/019-box-01.md)                                                                                                |
| [ADR-0015](0015-dirty-semantics.md)                         | 内容脏状态、祖先传播与标签顺序         | Accepted     | tree-modified 26 项、[020](../evidence/acceptance/020-tree-01.md)                                                                                     |
| [ADR-0016](0016-metrics-rules-and-classification.md)        | 指标规则、解析器与路径分类             | Accepted     | [docs/metrics](../../docs/metrics/README.md)、[012](../evidence/acceptance/012-met-01.md)、[metrics-recheck](../evidence/release/metrics-recheck.log) |
| [ADR-0017](0017-polymorphic-command-feedback.md)            | 复合图形的多态命令反馈                 | Accepted     | core 反馈测试、box 会话、[019](../evidence/acceptance/019-box-01.md)                                                                                  |

## 使用方式

- 新增决策使用下一个未占用编号（当前下一个是 `0018`；`0013` 保留为空号）。
- 已接受决策变化时新增 ADR 并交叉引用，不悄悄改写原决策；被替代的标 `Superseded` 并链接后继。
- 单篇模板见 [TEMPLATE.md](TEMPLATE.md)；每条 ADR 的“验证”节写明测试、反例、证据路径与最终代码位置。
