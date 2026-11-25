# ADR-0006 默认命令插件化、A/B 组合根与旧内核迁移

状态：Accepted  
日期：2026-11-25  
关联：Issue #14（TASK-CLI-01）；需求条目 BASE-01、BASE-02、EXT-01、EXT-02、LOAD-01、ASM-01；消费者 #15、#16、#17~#20

验证证据（2026-11-25 收口复核）：实现与测试见 doc/evidence/acceptance/、doc/evidence/framework/、doc/evidence/assembly/；状态由 TASK-QA-03 复核后更新。

## 背景

#2~#13 已交付 core 契约与事务、宿主加载器/适配器、严格 SVG codec 和树展示管线，但可运行的默认能力仍在 Phase 1 的 `src/`。本节点必须把六种图形与 19 条命令迁入 `packages/builtins`、建立 `apps/cli` 的 A/B 组合根，并删除旧内核，同时保持 89 项回归与四个 golden 会话逐字节不变。

## 决策

### 1. `packages/builtins`（`@svgframe/builtins`）

- 从 Phase 1 迁移 `Rect`/`Circle`/`Ellipse`/`Line`/`Text` 与 `GeometryShape` 到 `shapes/`；`Group` 复用 core 的公开 `Group`，在本包以 `shapes/Group.ts` 重新导出，避免出现第二个容器类型。几何、摘要、属性白名单与错误文案逐字节沿用 P1。
- 六个 `ShapeProvider`（`RectProvider`、`CircleProvider`、`EllipseProvider`、`LineProvider`、`TextProvider`、`GroupProvider`）按 P1 顺序注册：`type` 为领域类型，`defaultTag` 为恢复标签，`usage` 为 P1 help 原文，`matches` 一律返回 `false`（默认 provider 只做标签回退，显式匹配留给可选 provider，选择规则在 svg-xml `SvgRestorer`）。
- `create` 严格按 P1 参数个数与数值语法校验：缺参/多参报 `invalid parameters for <type>`，数值报 `invalid number for parameter <n>`；`restore` 从 `SvgElementView` 读取已规范化的属性/文本/子元素：几何字段交给构造函数（缺省 `0`），`fill`/`stroke`/`stroke-width` 走 `setAttribute`，其余非 id/xmlns 属性 `preserveAttribute`，最终 `attributes()` 的顺序仍为 imported→geometry→styles；叶按 `view.transform` 先 `scale` 后 `move` 恰好一次，`g` 只恢复子元素、不重复施加容器变换。
- 提供 `registerDefaultShapes(registry)` 与 `registerDefaultCommands(registry, services)`，顺序固定为 P1 的 6 种图形和 19 条命令；`BuiltinsManifest` 声明同一组名称，`BuiltinsPlugin`（`PluginModule`）在 `activate` 中只向暂存 context 注册，因此内置能力与可选插件走同一个 `PluginInstaller` 校验/提交路径。

### 2. 命令与动作

- 19 条 P1 命令改为 core `Command` 类（`commands/`），`usage`、参数规则与错误文案保持 P1；`prepare` 只产出元数据：`requiresDocument` + `effect`（`query`/`edit`/`document`/`history`）。
- `init`/`read`/`save`/`canvas` 的 `document` 操作由分发器传入 `EditorSessionPort`；`undo`/`redo` 走 `history`；`tree`/`show` 是 `query` 并使用 `TreePresenter`；`canvas` 无参数是 `query`，带尺寸是 `document`。分发器没有命令名白名单。
- `create` 使用 core 的 `ProviderShapeCreationService` + `CreateAction`；`delete`/`addto`/`group`/`ungroup` 使用 core 的 `StructureService` 与四个结构动作；`set` 使用 `AttributeEditingService` + `AttributeEditAction`；`move`/`scale`/`front`/`back` 使用 builtins 内的 `EditAction`，全部只在候选文档上执行。
- `help` 按注册顺序输出命令 usage，再输出 provider usage 与 P1 的 quote/EOF 两行；支持后续插件按装配顺序追加。

### 3. core/svg-xml 的加法 API（唯一接口变更）

- core 新增 `ProviderShapeCreationService`（按 provider 注册表分派 `create`）与 `CreateAction`（确保 id 可用、解析容器、经公共创建服务建树后一次 `add`）。
- core `Command` 增加可选 `prepareTokens(tokens)` 与 `CommandToken { value, quoted }`：P1 的 `create ... in <id>` 需要区分带引号的 `in`；分发器优先调用 `prepareTokens`，否则退回 `prepare(string[])`，既有命令与插件契约不变。
- svg-xml 公开导出 `SvgTransform`（P1 变换语义的既有测试需要），并修正 `SvgImportNormalizer` 的深度检查：空子元素列表在深度 129 不应被当作 129 层元素，否则 `final` 深度 128 文档无法回读。其余既有签名与行为不变。
- 这些变更记录在本 ADR，后续消费者可直接使用；不改变四扩展点、事务、事件或注册表的既有语义。

### 4. `apps/cli` 与 A/B

- 入口 `apps/cli/src/main.ts` 编译为 `apps/cli/dist/main.js`；`Tokenizer`、`CommandDispatcher`、`Repl` 位于 app 内。`--script <file>`、`--help`、未知参数与脚本缺失的文案/退出码保持 P1；非 TTY 无 banner/提示符，TTY 有提示符，脚本继续执行且出现 `error:` 时退出码 1。
- `Application` 创建 live 注册表、`ProviderShapeCreationService`、`XmlSvgCodec`、`EditorSession`、`LocalFileStore`/`LocalDirectoryReader` 和 `PluginInstaller`；先以同一 installer 安装 `BuiltinsPlugin`，再按模式安装可选插件。
- A：显式 import core/host/svg-xml/builtins，`embeddedPlugins` 为空时不加载任何可选插件（默认入口）。B：同一装配后用 `PluginLoader.loadFromConfig` 读取配置；`--config <path>` 选择 B，省略路径时默认根 `plugins.config.json`。根配置为 `{"plugins":[]}`。
- 两者共享 builtins 安装与同一条 `PluginInstaller` 路径；无插件时 stdout/stderr/退出码逐字节一致。

### 5. 迁移与门禁

- 删除整个 `src/`；根 `tsconfig.json` 只编译 `test/**`，`build` = `build:packages && tsc -p tsconfig.json`，`test` 从 `dist/test` 运行；`tsconfig.build.json` 增加 builtins 与 cli 项目引用；根 `cli` 直接运行 `apps/cli/dist/main.js`。
- 7 个测试文件的断言全部保留，只把 import 改到公开包入口；`TestHarness` 用 live 注册表 + `ProviderShapeCreationService` + `XmlSvgCodec` + `EditorSession` + `CommandDispatcher` + `TreePresenter` 重建，仍暴露 `files/run/router/editor/snapshot/ids/codec` 语义。`strings.test.ts` 中直接改活文档的一处改为构造 `SvgDocument` + `Text`（断言语义不变）。
- `baseline.test.ts` 与 `cli.test.ts` 的编译入口改为 `apps/cli/dist/main.js`；`scripts/verify-visual.mjs` 改用公开包构造 codec；`check-architecture.mjs` 在 `src/` 不存在时跳过旧分层规则、仍执行 workspace 边界检查。
- 新增 `test/composition.test.ts`：A/B 字节一致、内置能力经 installer 安装、`requiresDocument:false` 假命令未初始化文档可执行。

### 6. 查询命令的目录端口（#18 前置补丁）

- `QueryContext` 增加可选目录端口：构造参数 `(document: ReadonlyDocument | null, directories?: DirectoryReader)`，`directories()` 返回注入的 `DirectoryReader`；未注入时抛 `directory access is not available`。上下文仍不暴露 session、编辑或历史能力，文档仍为只读投影。
- `CommandDispatcher` 构造参数增加 `DirectoryReader`，每次构造 `QueryContext` 时传入；因此 `requiresDocument:false` 的 query 命令在未初始化文档时可执行，且不会按命令名开特例。
- A/B 组合根都用 `@svgframe/host` 的 `LocalDirectoryReader` 注入同一 dispatcher；`F`（`a21f758`）冻结后新增本补丁，后续 #18~#20 的 A/B 证据以补丁后提交为新基线。该补丁只增加端口注入，不改变 builtins/既有命令输出、doc/history/barrier 行为或插件契约。
- 测试：core 覆盖 `QueryContext` 注入与缺失文案；cli 包测试用 `requiresDocument:false` 的假查询命令经端口列目录，断言未初始化可执行、文档/历史/屏障不变，并验证名为 P1 特例（`read`/`help`）的命令仍只按元数据路由。

## 备选与取舍

- **保留 `src/` 作为兼容层**：会造成两套内核、双份契约与不可控漂移；选择删除。
- **命令直接持有 session/provider 并在构造时捕获暂存注册表**：暂存区提交后即失效，且帮助/标签看不到后续插件；选择命令使用 live 注册表引用，注册本身仍完全走暂存事务。
- **builtins 由组合根直接注册、绕过 installer**：无法证明“内置实现经过同一校验路径”；选择 `BuiltinsPlugin` 作为普通模块安装。
- **`create` 只传字符串、不支持 quoted 标记**：P1 的 `in` 子句语义会漂移；选择可选 `prepareTokens` 加法。
- **修复 svg-xml 深度检查 vs 放宽测试**：断言必须保留，选择修 bug。

## 验证

真实执行与逐项证据见 [TASK-CLI-01 验收证据](../evidence/acceptance/014-cli-01.md)。摘要：

- `npm ci --prefer-offline` 成功；`npm run build:packages` 通过。
- `npm test`：92 项通过（89 项旧回归含 6 项基线 + 3 项新组合根测试），0 失败。
- `npm run test:packages`：core 96、svg-xml 39、host 36、vscode 25、dsh 7，合计 203 项通过；builtins/cli 无独立 test 脚本。
- 四个 baseline golden 会话逐字节复现（含 `dir` 的 `unknown command: dir` 与退出码）。
- `node scripts/check-architecture.mjs`：0 legacy files、7 workspace packages、197 workspace sources、65 cross-package imports，跨包依赖只走公开入口。
- 未执行/未完成：可选插件实装（#17~#20）；非空插件配置的 A/B 回放；真实 VSCode/dsh 宿主接入（#11/#16 的更深部分）；#15 的框架冻结与指标收口。

## 受影响消费者

| 消费者           | 入口约定                                                                                                                                                                                                                   |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| #15 验收         | 根 `npm test`/`npm run check` 即完整回归；CLI 入口 `apps/cli/dist/main.js`；A/B 用默认入口与 `--config [path]`。                                                                                                           |
| #16 DSH          | 复用 `@svgframe/core` 的 `EditorSessionPort` 与 `@svgframe/svg-xml` 的 codec；不解析 CLI 文本，不依赖 builtins 具体类。                                                                                                    |
| #17/#18 命令插件 | 在 `plugins/*` 只依赖 `@svgframe/core`；命令声明 `requiresDocument`/`effect`，通过 `context.commands` 注册；manifest 的 `commands` 名称必须与实际注册一致。                                                                |
| #19 box          | 注册 `ShapeProvider`（`type=box`、显式 `matches`、`defaultTag` 可选）与 `AttributeHandler`；创建内部 `rect`/`text` 用 `ShapeCreationService`；结构保护用 `canRemoveChild`/`canUngroup` 并在最终类型重写 `newContainer()`。 |
| #20 标签         | 注册 `TreeDecorator`；CLI 组合根在安装成功后 `TreePresenter.connect(session.events)`；插件失败不得遗留订阅。                                                                                                               |
| #8 加载器        | 配置格式与安装事务不变；builtins 作为普通 `PluginModule` 安装，加载器仍不 import 具体插件。                                                                                                                                |

## 后续

- #17~#20 接入时只新增插件包与配置，不改 core/builtins/CLI 运行路径；若需要新的通用能力，先在框架节点补充并更新本 ADR。
- #15 冻结前在干净克隆执行 `npm ci` + 根 `check` + 四会话 golden，确认本机与 CI 一致。
- 本 ADR 保持 Proposed，待插件接入与 #15 验收后复核。
