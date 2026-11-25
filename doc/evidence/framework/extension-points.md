# 四扩展点实际位置清单（F = `a21f758`）

本文件是 TASK-FRAME-01 的可核验清单：每个扩展点给出契约、注册入口、框架调用位置（文件与函数）、现有实现、无可选实现时的缺省行为、违约错误与对应测试。命令为 2026-11-25 在 F 上实际执行的结果。

| 扩展点           | 契约                                           | 注册入口                                          |
| ---------------- | ---------------------------------------------- | ------------------------------------------------- |
| ShapeProvider    | `packages/core/extensions/ShapeProvider.ts`    | `ShapeProviderRegistry`（键 = `provider.type`）   |
| Command          | `packages/core/extensions/Command.ts`          | `CommandRegistry`（键 = `command.name`）          |
| TreeDecorator    | `packages/core/extensions/TreeDecorator.ts`    | `TreeDecoratorRegistry`（键 = `decorator.name`）  |
| AttributeHandler | `packages/core/extensions/AttributeHandler.ts` | `AttributeHandlerRegistry`（键 = `handler.name`） |

四个注册表共用 `packages/core/extensions/Registry.ts`：`register` 拒绝空名、带空白名与重复名（`DuplicateRegistrationError`，`Registry.ts:19-25`），`require` 对未注册项报错（`Registry.ts:29-33`）。

## 1. ShapeProvider

- **职责**：按稳定领域类型创建图形，并按 SVG 中间元素恢复完整子树；`type` 是注册名与 `kind`，`defaultTag` 是标签缺省匹配，`matches` 是元数据显式匹配。
- **框架调用位置**：
  - 创建：`ProviderShapeCreationService.create`（`packages/core/services/ProviderShapeCreationService.ts:15`），由 `CreateAction.apply`（`packages/core/services/CreateAction.ts:21-29`）在候选文档中调用。
  - 恢复：`SvgRestorer.restore` → `select`（`packages/svg-xml/strict/SvgRestorer.ts:24-48`），由 `XmlSvgCodec.decode`（`packages/svg-xml/strict/XmlSvgCodec.ts:73-77`）在全局预检与变换归一化之后调用。
- **现有实现**：`packages/builtins/providers/{Rect,Circle,Ellipse,Line,Text,Group}Provider.ts`（默认装配 6 个类型，经 `BuiltinsPlugin.activate` 注册）；测试专用 `packages/core/test/support/DemoBoxProvider.ts` 与 `test/framework/StampProvider.ts`。
- **缺省行为**：未注册类型抛 `unknown shape type: <type> (is the plugin loaded?)`；恢复时先显式 `matches`、再 `defaultTag`，同层多个匹配按 `ambiguous provider match` 拒绝；无 provider 的未知 `data-kind` 回退到标签默认 provider 并保留标记。
- **错误与测试**：`packages/core/test/registry.test.ts:67`（按类型键 + 插件提示）、`packages/core/test/consumer.test.ts:78`（缺 provider）、`packages/svg-xml/test/strict-codec.test.ts:155/175/214/252`（复合恢复、标记降级、未知 `data-kind`、歧义拒绝）、`packages/core/test/consumer.test.ts:86` 与 `test/framework-acceptance.test.ts`（恢复只应用一次变换）。

## 2. Command

- **职责**：命令对象自己拥有名称、帮助、参数规则与前置条件；`prepare`/`prepareTokens` 返回 `requiresDocument` 与 `effect`（`query`/`edit`/`document`/`history`），分发器只按元数据路由。
- **框架调用位置**：`CommandDispatcher.executeTokens`（`apps/cli/src/CommandDispatcher.ts:33-57`）按 `effect` 路由到 `QueryContext`、`session.edit(action)`、`session` 文档操作或历史操作；`execute` 把任意失败格式化成一行 `error:`。
- **现有实现**：`packages/builtins/commands/*Command.ts`（19 个 Phase 1 命令，`test/composition.test.ts` 断言 `commands.names().length === 19`）；`packages/builtins/commands/HelpCommand.ts` 负责按注册顺序输出帮助。
- **缺省行为**：未注册命令抛 `unknown command: <name>`（`CommandDispatcher.ts:36`），输出以 `error:` 开头且退出码规则与 Phase 1 一致；`requiresDocument` 为真但无文档时抛 `no document. use 'init' or 'read' first`。
- **错误与测试**：`packages/core/test/command.test.ts:27/45/63/93`（元数据、非命令名白名单、未知命令、失败原子性）、`test/composition.test.ts`（`requiresDocument` 行为、A/B 字节一致）、`test/baseline.test.ts`（`final` 四会话逐字节回放，含 `unknown command` 分支）。

## 3. TreeDecorator

- **职责**：对只读 `TreeRow` 返回可选后缀；按注册顺序拼接，每个后缀前一个空格；可选 `onEvent` 接收已提交事件。
- **框架调用位置**：`TreePresenter.decorateLine`（`packages/core/presentation/TreePresenter.ts:141-153`）负责后缀拼接；`handleEvent`（`TreePresenter.ts:96-105`）转发提交事件；`disable`（`TreePresenter.ts:154-161`）隔离故障装饰器。
- **现有实现**：当前内核与内置能力**没有**正式装饰器；可选标签属于 `#19`（box 类型标签）与 `#20`（modified-star）。现有实现只有测试替身：`packages/core/test/support/DemoTreeDecorator.ts`、`packages/core/testing/FaultyTreeDecorator.ts`、`test/framework/StampBadgeDecorator.ts`。
- **缺省行为**：无装饰器时树/`show` 的输出与 Phase 1 逐字节相同（零后缀、零额外空格）；单个装饰器抛错只禁用该实例并上报，其余后缀与已提交文档不变。
- **错误与测试**：`packages/core/test/decorator.test.ts:41/49/59/70`（零装饰器基线、后缀、顺序、故障隔离）、`packages/core/test/tree-presenter.test.ts`（行格式与事件）、`test/framework-acceptance.test.ts`（`(stamp)` 后缀、故障上报、事件故障隔离）。

## 4. AttributeHandler

- **职责**：`handles` 是只读纯查询；`apply` 只拿到候选文档，可一次修改多个子部件；命中两个及以上处理器时在任何修改前拒绝；没有命中时回退到图形默认属性规则；命中后失败不再回退。
- **框架调用位置**：`AttributeEditingService.apply`（`packages/core/services/AttributeEditingService.ts:18-36`），由 `AttributeEditAction`（`packages/core/services/AttributeEditAction.ts:17-19`）在 `session.edit` 的候选文档中调用。
- **现有实现**：内核与内置能力**没有**正式处理器；box 的 `fill`/`label` 属于 `#19`。现有实现为测试替身：`packages/core/test/support/{DemoAttributeHandler,MultiPartAttributeHandler,PartialFaultyAttributeHandler}.ts`、`packages/core/testing/FaultyAttributeHandler.ts`、`test/framework/StampAttributes.ts`（同时改 label 与 frame 的一次事务）。
- **缺省行为**：无匹配处理器时走 `Shape.setAttribute`（Phase 1 白名单）；冲突抛 `AttributeHandlerConflictError` 并携带竞争处理器名称。
- **错误与测试**：`packages/core/test/attribute-dispatch.test.ts:28/38/49/60/73`（回退、未知属性、候选文档、失败不回退、冲突前拒绝）、`packages/core/test/attribute.test.ts:47/58/70/99/108`、`test/framework-acceptance.test.ts`（多子部件一次 undo、失败保持历史与事件）。

## 5. 加载与装配（复核，不新增实现）

- 加载器：`packages/host/loader/PluginLoader.ts:28-79` 只读配置、按目录解析模块并把模块对象交给 `PluginInstaller.install`（`packages/host/loader/PluginInstaller.ts:72-153`）；失败消息冻结为 `plugin not found: <module>`、`plugin has no default export: <name>`、`plugin manifest mismatch: <name> (declared: …, registered: …)`、`plugin failed to activate: <name> (<reason>)`、`duplicate registration: <category>/<name>`、`invalid plugin config`。
- A/B 同一路径：`apps/cli/src/Application.ts:46-91` 先用 `PluginInstaller` 安装 builtins，再按 `configPath` 选择 B（`PluginLoader`）或 A（`embeddedPlugins`）；两者都经过同一个 `install`。
- 故障矩阵测试（`npm run test:packages` 中 host 39 项）：`plugin-loader.test.ts:36/57/78/107/120/142/164/188/202/228/250/271/360`（模块缺失、无默认导出、求值与依赖失败区分、非法配置、清单不符、`enabled:false` 跳过、相对/包名解析、只读 options、订阅回滚、每类失败都回滚、A/B 结果一致）；`plugin-installer.test.ts:39/73/87/104/125/143/159/190/206/220/233/254/269`（冻结 options、默认导出校验、清单多重集比较、重复名、内部重复、activate 抛错回滚、订阅释放、跨类别同名允许、`attributeHandlers` 映射、失败继续）。
- 包边界：`node scripts/check-architecture.mjs` 在 F 上输出 `0 legacy files, 0 legacy imports, 7 workspace packages, 197 workspace sources, 65 cross-package imports, matching class filenames`（旧 `src/` 已在 #14 删除）。
- 默认兼容：`test/baseline.test.ts` 对 `apps/cli/dist/main.js` 回放四个冻结会话，stdout/stderr/退出码/产物逐字节与 `final` 一致；`test/composition.test.ts` 断言无插件时 A/B 输出字节相同。

## 复核结论

四类扩展点都有可运行实现（含测试专用实现）、明确缺省行为与失败测试路径；F 内的正式插件目录只有默认能力 `packages/builtins`，`plugins/` 与 box/stats/dir/modified-star 均不存在。清单中的文件与行号在 F 上逐一打开核对；本文件由 TASK-FRAME-01 维护，新增插件节点只追加自身实现行，不改契约列。
