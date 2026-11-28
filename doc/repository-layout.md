# 仓库文件组织规范

本仓库从 Phase 1 的完整历史继续开发，旧 `src/` 已在 #14 删除，默认命令与六种图形位于 `packages/builtins`，CLI 组合根位于 `apps/cli`。下面明确当前目录、各目录职责及每类材料的唯一维护位置。按任务迁移目录时同步修改公开导出、构建、测试和文档，不能只移动文件。

## 当前目录

| 位置                           | 放什么                              | 维护边界                                                  |
| ------------------------------ | ----------------------------------- | --------------------------------------------------------- |
| 根 `README.md`                 | 项目状态、安装运行、主要文档导航    | 保持新成员可直接启动；不复制全部架构细节                  |
| 根两份 `phase_cli_*.md`        | 课程规格原文                        | 原文不因格式检查或实现取舍改写；新增课程版本另外记录      |
| `AGENTS.md`、`CONTRIBUTING.md` | AI修改边界、分支/提交/PR/审阅规则   | 实际行为变化同步更新，不把待配置设置写成已启用            |
| `packages/core/`               | 公开领域抽象、四扩展点、事务与端口  | 只依赖自身；不得 import host/builtins/plugins/平台 API    |
| `packages/svg-xml/`            | 中立语法层与严格 SVG codec          | 只依赖 core 与 XML 解析库                                 |
| `packages/host/`               | 加载事务、文件/目录适配器           | 只依赖 core 与 Node 模块；不硬编码具体插件                |
| `packages/builtins/`           | 六种图形、默认命令与内置插件模块    | 只依赖 core；不得 import host/apps/其他插件               |
| `apps/cli/`                    | Tokenizer、分发器、REPL、A/B 组合根 | 可依赖 core/host/svg-xml/builtins 与显式配置的可选插件    |
| `test/`                        | Phase 1 回归与跨包组合根测试        | 保留基线断言，只通过公开包入口导入                        |
| `examples/`                    | 可回放命令与SVG示例                 | 示例产物属于课程材料；不能混入临时运行日志                |
| `scripts/`                     | 架构、文档、基线、视觉等检查入口    | 运行脚本与证据分开；脚本可复现且不写入源码                |
| `.github/`                     | 实际工作流、Issue与PR模板           | 仓库设置的真实状态由配置记录说明                          |
| `ci/`                          | CI操作说明                          | 真实执行入口仅在 `.github/workflows/`，不另维护工作流副本 |
| `doc/`                         | 开发方案、报告、ADR、记录和验收证据 | 以 [报告入口](README.md) 为导航，不再保留一套独立方案副本 |
| `plugins.config.json`          | B 组合根的可选插件配置              | 默认空列表；插件节点只追加实际模块，不预埋未实现插件      |

根 `package.json` 和锁文件维护安装、构建与检查入口；`.nvmrc` 固定团队主环境。根配置和公共契约由集成协调者组织修改，功能分支说明变更原因，不同时更换包管理器、升级依赖和迁移目录。

## 工作区（Phase 2）

根 `package.json` 声明 npm workspaces：`packages/*`、`apps/*`、`plugins/*`。当前实际包为 `@svgframe/core`、`@svgframe/svg-xml`、`@svgframe/host`、`@svgframe/builtins`、`@svgframe/cli`、`vscode-svg`、`@svgframe/dsh-plugin`；`plugins/` 只声明 glob，建立实际插件包前不创建空目录。

- 库包（`packages/*`）公开入口是包根 `index.ts`，`exports["."]` 只暴露 `dist/index.js` 与 `dist/index.d.ts`，测试放包根 `test/` 并编译到包内 `dist/test/`；包 `build` 用 `tsc -b .`，因此构建会自动带上项目引用。
- `packages/host` 除 `LocalFileStore`/`LocalDirectoryReader` 外提供 `PluginInstaller`/`PluginLoader`：A 传模块对象、B 读 `plugins.config.json`，二者走同一注册事务；插件 manifest 在插件包 `package.json` 的 `svgframe.contributes`。
- `packages/builtins` 提供六种 `ShapeProvider`、19 条默认命令、`BuiltinsPlugin`（作为普通 `PluginModule` 经同一 installer 安装）与 `registerDefaultShapes`/`registerDefaultCommands`；只依赖 core。
- `apps/cli` 是库式 TypeScript 包：`src/main.ts` → `dist/main.js` 为 CLI 入口，`dist/index.js` 导出 `Tokenizer`/`CommandDispatcher`/`Repl`/`createApplication` 供测试使用；依赖 core/host/svg-xml/builtins。
- `apps/vscode-svg` 保持扩展自己的 `src/`、`dist/src` 与 `main` 入口；`apps/dsh-plugin` 是 JS 包，不参与 TypeScript 构建。apps 的依赖方向同样受边界检查约束，接入内部包时须在 `package.json` 声明并由检查脚本的允许矩阵覆盖。
- 新增库包时在 `tsconfig.build.json` 追加 `references`，按 `@svgframe/core` 形状设置 `composite`、`rootDir: "."`、`declaration` 与 `exports`；具体约定见 [ADR-0007](adr/0007-workspaces-and-package-boundaries.md)。

实际可用的工作区命令：

```sh
npm ci                     # 干净安装，同时建立 workspace 链接
npm run build              # build:packages + tsc -p tsconfig.json（根 test → dist/test）
npm test                   # 构建并运行根 92 项回归（89 项 P1/基线 + 3 项组合根）
npm run cli                # node apps/cli/dist/main.js（可加 --script/--config/--help）
npm run build:packages     # tsc -b tsconfig.build.json，按项目引用构建库包与 CLI
npm run test:packages      # 先构建，再执行每个 workspace 的 test
npm test -w @svgframe/core # 单包构建并测试；其他包替换为实际包名
npm run check              # 格式 + 文档 + 根 92 项 + 包构建/测试 + 边界检查
```

旧入口名称保留，目标已迁移：`npm run build`/`npm test` 现在构建包并编译根 `test/` 到 `dist/test`；`npm run cli` 运行新 CLI；`npm run verify:visual` 通过公开包构造 codec 后渲染。

## 目标目录与已建立情况

以下目标按对应任务建立，不提前创建空运行包。当前 `packages/core`、`packages/host`、`packages/svg-xml`、`packages/builtins`、`apps/cli`、`apps/vscode-svg`、`apps/dsh-plugin` 已建立；`plugins/*` 仍等待插件节点。

| 目标位置                                            | 职责                                   | 开始建立的条件                         |
| --------------------------------------------------- | -------------------------------------- | -------------------------------------- |
| `packages/core/`                                    | 公开领域抽象、四扩展点、编辑事务与端口 | 公开契约及测试替身评审                 |
| `packages/host/`                                    | 配置加载、注册事务、真实IO适配         | 通用宿主任务及依赖规则确定             |
| `packages/svg-xml/`                                 | 中立XML语法/位置与严格SVG语义适配      | 分清Outline与CLI领域导入边界           |
| `packages/builtins/`                                | 原命令及六种默认图形实现               | 默认装配迁移并保留兼容回归             |
| `plugins/`                                          | stats、dir、box、修改标签等独立插件    | 依赖公共入口，包内可独立测试           |
| `apps/cli/`、`apps/vscode-svg/`、`apps/dsh-plugin/` | 各宿主入口及装配                       | 对应产品线任务开始，不反向成为内核依赖 |
| `test/acceptance/`、`test/fixtures/`                | 跨包回归、受控SVG/目录输入和期望结果   | 基线与集成验收任务                     |
| `doc/transcript/`                                   | CLI输入会话                            | 只存命令与注释；不带提示符或期望输出   |
| `docs/metrics/`                                     | 指标脚本的可复现输出                   | 指标任务完成后生成，不手填数字         |

每个新包的内部实现、公开入口、包内测试放在该包内；跨包装配和端到端验收统一放入 `test/acceptance/`。插件通过包的公开入口导入，不能用相对路径穿透另一个包的 `src/`。

## 文档与任务的唯一位置

| 材料                 | 位置与规则                                                                                                     |
| -------------------- | -------------------------------------------------------------------------------------------------------------- |
| 完整开发方案         | [development-plan.md](development-plan.md)，链接专题文档而不复制同一段规则                                     |
| 当前架构             | [architecture.md](architecture.md)；图源在 `doc/architecture/`，保留旧图与目标图的区别                         |
| 板块和开发次序       | [roadmap.md](roadmap.md)，明确职责和依赖；实际任务状态以GitHub Issues为准                                      |
| 可复核任务定义与索引 | `doc/tasks/definitions.json`及`doc/tasks/index.md`；定义用于建单，索引链接实际Issues，不另手工维护一份认领状态 |
| 需求与验收映射       | [acceptance.md](acceptance.md)，需求ID关联实际测试和证据                                                       |
| ADR                  | `doc/adr/NNNN-topic.md`；一条决策一个文件，模板和状态见 [ADR入口](adr/README.md)                               |
| 关键过程与AI纠正     | `doc/records/YYYY-MM-DD-topic.md`，按 [过程模板](records/TEMPLATE.md) 记录实际检查与修正                       |
| 验收证据             | `doc/evidence/<milestone>/`，带被测提交、环境、输入、命令与结果                                                |
| 原始期望输出         | `test/fixtures/expected/`，经过审阅后更新，不用新程序输出自动覆盖旧基线                                        |
| Phase 1归档          | [phase1-report.md](phase1-report.md)及原架构、视觉材料；报告原文保持，不把其中历史状态当成当前状态             |

`doc/` 放报告和开发记录，`docs/metrics/` 是实验指定的指标路径。保留这两个名称，并在报告入口互相链接；不要为统一命名移动课程要求的路径。

## 生成物与提交范围

`node_modules/`、`dist/`、`.npm-cache/`、`coverage/`、`artifacts/` 是本地依赖、构建或临时输出，不跟踪。需要评阅的日志、图像和报告，从一次真实运行中选取并放入 `doc/evidence/`，记录生成方法；完整指标放 `docs/metrics/`。避免把全部重复渲染结果和缓存提交到仓库。

仓库外的参考克隆和方案草稿不再复制进来，不提交 `reference/`、`phase2-plan/`、嵌套 `.git` 或未约定的子模块。正式方案在本仓库 `doc/` 维护，Phase 1源码及历史由Git保存。

每个Issue列出负责目录、跨块公开接口、前置Issue和验收方式。修改其他板块或公共配置时说明影响并邀请对应审阅者；一次任务不夹带全仓格式化、其他插件实现或无关目录移动。合并以需求和目录范围审查，不能仅看检查是否通过。

## 自动检查

`npm run check:docs` 扫描Git跟踪和未忽略的新Markdown文件，检查本地链接及图片目标、代码围栏、目标是否会随仓库提交，并检查被跟踪路径中是否混入依赖、构建输出或材料克隆。该检查也接入 `npm run check`。

`node scripts/check-architecture.mjs` 检查 workspace：包名与目录对应、跨包只能 import 包根且在 `package.json` 中声明、相对 import 不得跨包、`core` 禁止 Node 内置模块与 XML DOM、`builtins`/插件只依赖 `core`、各 apps 按允许矩阵导入；一类一文件与禁止 tag/type switch 规则推广到各 workspace 源码。旧 `src/` 已删除，脚本在目录不存在时跳过旧分层规则（当前输出 `0 legacy files`）。矩阵与命令见 [ADR-0007](adr/0007-workspaces-and-package-boundaries.md)。根 `npm run check` 依次执行 `prettier --check .`、文档检查、根 92 项回归、`build:packages`、`test:packages` 和该脚本。

检查跳过外部URL、纯锚点、代码围栏和行内代码，不把方案中的反引号目录当作必须存在的文件，也不检查GitHub在线权限或锚点是否存在。Markdown引用式链接的目标定义同样检查。

唯一缺图白名单是 Phase 2 原文中的 `docs/images/vscode-svg-badge.jpg` 和 `docs/images/vscode-svg-outline.jpg`。检查会明确提示缺图而保留课程原文；其他失效链接不能用宽泛忽略规则掩盖。最终扩展截图由实际运行另行生成并提交。
