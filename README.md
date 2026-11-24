# SVG Editor Platform

高级软件开发 Lab1 的 SVG 编辑平台，基于 [svg-editor-cli](https://github.com/zero0307/svg-editor-cli) 的 Phase 1 完整历史继续开发。现有 CLI 使用 TypeScript、Command 与 Composite 模式，已具备六种内置图形、19 条命令、SVG 读写及撤销重做。

当前运行代码仍为 Phase 1 实现；Phase 2 已建立 npm workspaces（`packages/*`、`apps/*`、`plugins/*`）与包边界检查，`@svgframe/core`、VSCode 扩展和 DSH 插件的契约/骨架已按节点落地，插件框架仍在推进。旧 `src/` CLI 保留到默认命令迁移（#14），`final` 标签仍是兼容基线，最终验收后另建 `p2`。工作区命令与当前包布局见 [文件组织规范](doc/repository-layout.md#工作区phase-2) 和 [ADR-0007](doc/adr/0007-workspaces-and-package-boundaries.md)。

## 团队开发入口

- [完整开发方案](doc/development-plan.md)：架构路线、关键约定和文档导航。
- [板块与开发顺序](doc/roadmap.md)：F 框架、C 命令、B box 与属性、T 修改标签、V VSCode、D DSH，以及横向 Q 集成验收；六名成员按板块认领，不固定一人一块。
- [架构与接口契约](doc/architecture.md)、[测试与验收矩阵](doc/acceptance.md)。
- [协作和分支规范](CONTRIBUTING.md)、[AI 开发约束](AGENTS.md)。
- [报告与记录入口](doc/README.md)：ADR、过程记录、维护规则与 Phase 1 归档。
- [本次初始化记录](doc/initialization.md)：历史、标签、环境、检查结果与推送核验。
- [开发任务认领](doc/tasks/index.md)、[GitHub协作配置](doc/github-operations.md)、[文件组织规范](doc/repository-layout.md)。

采用 `main` 配合短期任务分支，通过 PR 保留分步提交；公共接口和测试替身先合并，各插件板块独立开发后再集成。A/B 装配证据分支与原始接入提交单独保留，具体规则见贡献规范。

## 快速开始

团队开发统一使用 `.nvmrc` 固定的 Node.js 24.22.1 和 npm；当前 CLI 的 `package.json` 仍声明 Node.js >=22。安装对应环境后，在项目根目录执行：

```sh
npm ci
npm run cli
```

```text
svg> init 800 600
svg> create g node
svg> create rect frame 120 100 160 60 #4a90d9 in node
svg> create text label 155 135 "开始" in node
svg> move node 0 100
svg> undo
svg> tree
svg> save demo.svg
```

保存后，用浏览器打开 `demo.svg` 查看结果。输入 `help` 可查看全部命令；退出交互模式时，Unix 使用 Ctrl+D，Windows 使用 Ctrl+Z 后回车。

## 示例与验证

```sh
npm run cli -- --script examples/flowchart.commands
npm run cli -- --script examples/history.commands
npm run cli -- --script examples/transforms.commands
npm run check
npm run build:packages
npm run test:packages
npm run test:coverage
npm run verify:visual
```

上述检查也由 [GitHub Actions](https://github.com/zero0307/svg-editor-platform/actions) 在Ubuntu/Windows、Node22/24上运行。合并门槛为 `CI required`，操作说明见 [CI文档](ci/README.md)。

流程图和历史示例会生成 `examples/flowchart.svg`、`examples/history.svg`。构建后，也可以运行 `node dist/src/bootstrap/main.js`，从标准输入读取命令，或用 `--script "含空格的路径"` 读取脚本。脚本遇到错误后会继续处理剩余行；只要出现过错误，退出码就是 1，全部成功则为 0。

目前已实现课程要求的六种内置类型和 19 条命令，包括嵌套分组、完整撤销/重做、SVG 读写和自动补 id。编辑失败时保留原文档，保存文件时采用原子替换。`box` 留待后续插件阶段实现。

SVG 导入范围限于这六类元素，支持嵌套的 translate 和正等比 scale。导入器会将坐标转换为画布坐标，同时保留分组、字号与描边的含义。旋转、不等比缩放、CSS、path、tspan 和不同坐标系的 viewBox 暂不支持，遇到这些结构会报错并保留原文档。现有行为的具体约束见 [Phase 1 设计与实现记录](doc/phase1-report.md)。

`npm run verify:visual` 使用本地 resvg-js 生成预览，比较课程变换示例在导入前后的渲染像素。该检查不需要浏览器或网络服务。[Phase 1 交付清单与演示步骤](doc/DELIVERY.md)列出了验收命令和提交前要处理的事项。

## 课程平台提交

Phase 1 的课程平台提交文件保留在 [doc/submission/README.md](doc/submission/README.md)，其中列出原仓库、`final` 标签、实验报告和运行方式。Phase 2 日常开发使用本仓库；按当前课程要求，最终将同一验收提交和 `p2` 同步回原课程仓库，交付步骤见 [建仓与开工说明](doc/bootstrap.md)。

## 文件导航

- [Phase 1 课程需求](phase_cli_1.md)
- [Phase 2 课程需求](phase_cli_2-研-1.md)
- [Phase 2 报告、方案与开发记录](doc/README.md)
- [Phase 1 设计与实现记录归档](doc/phase1-report.md)
- [Phase 1 PlantUML 架构图](doc/architecture.puml)
- [Phase 2 目标架构源图](doc/architecture/phase2-proposed.puml)
- [两节点流程图脚本](examples/flowchart.commands)
- [分组和撤销示例](examples/history.commands)
- [嵌套变换导入示例](examples/transforms.commands)

运行时只依赖 [@xmldom/xmldom](https://github.com/xmldom/xmldom)，用于解析和序列化 XML。测试使用 [Node.js 内置测试运行器](https://nodejs.org/docs/latest-v24.x/api/test.html)。
