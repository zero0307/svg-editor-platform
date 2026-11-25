# ADR-0011 插件加载事务、清单校验与 A/B 共享入口

状态：Proposed  
日期：2026-11-25  
关联：Issue #8（TASK-HOST-01）；需求条目 EXT-01、LOAD-01、LOAD-02、LOAD-03、LOAD-04；消费者 #14（A/B 组合根）、#17~#20（插件）

## 背景

课程要求同一个插件既能由组合根在代码中显式装入（A），也能由仓库根的 `plugins.config.json` 配置装入（B），两种方式的行为必须完全相同，差别只在最外层“谁决定装哪些插件、谁实例化模块”。#5 已建立 workspaces 与包边界，#9 已在 `packages/host` 落地文件/目录适配器；本节点补齐加载器与注册事务。框架必须保证：失败的插件不会污染四类注册表或事件总线；已成功插件保留；后续插件继续加载；四类 `contributes` 声明与实际注册一致；错误文案可逐字节比较。

## 决策

### 1. 唯一安装入口

- `packages/host` 新增 `PluginInstaller`（`install`、`installAll`）与 `PluginLoader`（`loadFromConfig`），公共入口由 `@svgframe/host` 的 `index.ts` 导出。
- `PluginInstaller.install({ module, manifest, options })` 是所有路径的唯一事务入口。A 的 `installAll` 接收组合根显式提供的模块对象、manifest 与 options；B 的 `PluginLoader` 只负责读配置、解析模块、读取 package manifest，然后调用同一个 `install`。
- 加载器不 import 任何具体插件，也没有名称映射表或条件分支；模块通过配置字符串动态解析/导入。
- 失败是结构化返回，不抛出：`PluginInstallResult = { ok: true; name } | { ok: false; error: PluginLoadError }`。`PluginLoadError.code` 固定为 `module-not-found`、`missing-default-export`、`activation-failed`、`duplicate-registration`、`manifest-mismatch`、`invalid-config`，`message` 是冻结的用户文案，不含 `error:` 前缀。`installAll`/`loadFromConfig` 逐个返回结果并继续后续插件。

### 2. 暂存上下文与原子发布

每次 `install` 创建新的 `StagedPluginContext`：四张全新注册表、只读 options、公开的 `ShapeCreationService`/`DirectoryReader` 端口，以及暂存订阅列表。

1. 规范化并校验 manifest 结构、default 导出与 `activate` 必须是函数。
2. 顺序执行 `activate`；插件只能向暂存区注册，不能接触活文档、文件系统或历史。
3. 检查四类暂存注册名与全局表是否重复；同一插件内重复由注册表本身抛 `DuplicateRegistrationError`，立即映射为 `duplicate registration`。
4. 按类别比较 `contributes` 声明与暂存注册名称：排序后逐项比较**多重集**（保留重复项），避免集合去重掩盖“声明两次只注册一次”。
5. 全部检查通过后按 shapes → commands → decorators → attributes 顺序一次发布；发布前已排除所有已知失败条件，且暂存注册表使用与全局相同的名称校验，因此单线程组合根下发布步骤不会失败，失败插件不会留下部分注册。
6. 注册发布成功后，才把暂存的 `EditorEventListener` 接入真实 `EditorEvents`；`enabled:false`、校验失败或 activate 抛错时订阅从未接入真实总线，随暂存区丢弃。组合根在全部插件安装完成后才调用 `TreePresenter.connect`，避免失败插件留下监听器。

说明：core 的注册表没有“反注册”API，故本 ADR 用“先完成全部校验、再发布”而不是“发布后回滚已注册项”实现原子性；如果未来允许并发安装或动态卸载，需要新增带释放协议的注册事务，不能沿用本决策。

### 3. manifest 来源与映射

- 权威来源是插件包 `package.json`：`{ name, version, svgframe: { contributes: { shapes, commands, decorators, attributes } } }`；四个数组缺省为空。
- host 用 `normalizePluginManifest` 将其映射为 core 的 `PluginManifest`：`attributes` → `attributeHandlers`（core 既定字段名）。A 也可以直接传 core 形状（`contributes.attributeHandlers`），规范化结果与 B 相同。
- core `PluginModule.manifest` 字段保留在类型里，但 installer 以显式传入的 manifest 参数为唯一事实来源，避免 A/B 读取不同来源；A 的组合根应传入真实 package.json 对象（或同一映射结果）。
- B 从被解析模块所在目录向上查找最近的 `package.json`；相对模块路径以**配置文件所在目录**为基准，包名按该目录的 Node 解析规则（`createRequire`）解析。

### 4. 配置与失败区分

配置形如 `{ "plugins": [{ "module": "./x.mjs", "options"?: {}, "enabled"?: false }] }`：

- JSON 语法错误、根不是对象、`plugins` 不是数组、`module` 非空字符串缺失、`options` 非对象、`enabled` 非布尔值，统一报 `invalid plugin config` 并整体不加载该配置文件，组合根回退默认内置能力。
- `enabled:false` 在解析模块、求值、读取 manifest 之前跳过；其模块顶层即使会抛错也不会被 import。
- 先解析顶层模块：相对路径不存在、包名解析失败 → `plugin not found: <request>`。已定位模块后求值抛错或其内部依赖缺失 → `plugin failed to activate: <package name> (<reason>)`，不能误报为 not found。
- 读取到的 package.json 非法（JSON 语法/结构）也归入激活失败，reason 说明 manifest 问题。

### 5. 冻结错误文案

| 失败              | code                     | message                                                                       |
| ----------------- | ------------------------ | ----------------------------------------------------------------------------- |
| 顶层模块找不到    | `module-not-found`       | `plugin not found: <request>`                                                 |
| 没有 default 导出 | `missing-default-export` | `plugin has no default export: <package name>`                                |
| default 结构非法  | `activation-failed`      | `plugin failed to activate: <name> (default export has no activate function)` |
| manifest 结构非法 | `activation-failed`      | `plugin failed to activate: <name> (invalid plugin manifest: <reason>)`       |
| activate 抛错     | `activation-failed`      | `plugin failed to activate: <name> (<reason>)`                                |
| 全局/插件内重名   | `duplicate-registration` | `duplicate registration: <category>/<name>`                                   |
| 清单与注册不符    | `manifest-mismatch`      | `plugin manifest mismatch: <name> (declared: …; registered: …)`               |
| 配置非法          | `invalid-config`         | `invalid plugin config`                                                       |

`<package name>` 取 manifest 的 `name`，因为 A 没有配置字符串、B 也可能用相对路径；使用包名是两条路径都能逐字节一致的事实来源（不是配置里的模块路径）。

清单不一致的展开格式固定为按字母序列出四类：`attributes=[...], commands=[...], decorators=[...], shapes=[...]`，数组内名称排序、重复项保留；`declared:` 与 `registered:` 之间用 `; ` 分隔。全局重复检查按同样的字母类别顺序、类别内名称排序，先命中即返回。

### 6. core 公开契约的增补

`PluginContext` 新增 `subscribe(listener: EditorEventListener): () => void`。这是**只针对已提交编辑事件**的类型化订阅，不是任意事件总线；ADR-0003 中“不提供任意持久订阅接口”的限制仍然成立。`FakePluginContext` 同步实现该能力并提供 `publish` 供插件单测。插件通过 `context.subscribe` 拿到的 disposer 在提交前可取消；提交后调用它会解除真实总线上的监听。

## 备选与取舍

- **每个插件先在全局注册表上注册，失败再删除**：core 注册表没有删除 API，且失败中途可能已被其他线程观察到；选择暂存表 + 发布前校验。
- **用集合比较 contributes**：会吞掉声明中的重复名，无法发现“声明两次、注册一次”；选择排序多重集比较。
- **A 直接裸调 `activate(ctx)`**：能绕过清单校验、重名检查和订阅暂存；明确禁止，A 必须走 `installAll`。
- **加载器自己 import 具体插件或维护名称映射**：会让接入新插件的提交修改加载器；选择纯字符串解析。
- **B 用配置字符串导致 `<module>` 在 A/B 不一致**：no-default/manifest 错误统一用 manifest `name`，not found 才用配置字符串。
- **给失败插件保留已订阅监听器再清理**：可能出现回调先于清理触发；选择“失败时从未接入真实总线”。

## 验证

真实执行（详见 [Issue #8 验收证据](../evidence/acceptance/008-host-01.md)）：

- host 单包 `node --test "packages/host/dist/test/*.test.js"`：39 项通过（含既有 13 项适配器测试与本节点 26 项 loader/installer 测试）。
- 故障矩阵：模块不存在、无 default、default 结构非法、manifest 与注册不符、activate 注册后抛错、与既有名称重复、插件内部重复、顶层求值抛错、内部依赖缺失、非法 JSON/结构、enabled:false；每个失败插件前后各放一个成功插件，验证先前保留、失败四类注册与订阅零残留、后续仍加载。
- A/B 一致性：同一组插件分别经 `loadFromConfig` 与 `installAll` 安装，结果消息与注册表名称逐项相同。
- `npm run test:packages` 与根 `npm run check`：见证据文档。

未覆盖：真实 CLI 组合根（#14）尚未接入，A/B 的字节级整机回放由 #21 验收；动态卸载/并发安装不在本节点；`PluginLoadError.code` 的具体 CLI 打印格式由 #14 决定（host 只返回冻结 message）。

## 受影响消费者

| 消费者    | 约定                                                                                                                                                                                                                                    |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| #14 CLI   | 构造四张注册表、`ShapeCreationService`、`DirectoryReader`、`EditorEvents` 后创建 `PluginInstaller`；A 用 `installAll`，B 用 `PluginLoader.loadFromConfig`；打印 `error: ${message}` 由 CLI 负责；全部成功后再 `TreePresenter.connect`。 |
| #17~#20   | 插件包 `package.json` 写 `svgframe.contributes`；default 导出含 `activate(context)`；只用 `context` 注册与订阅，不 import host/其他插件；单测可用 `FakePluginContext`。                                                                 |
| #13 / #11 | 不经过插件加载事务；svg-xml/VSCode 继续使用公开 codec 与语法入口。                                                                                                                                                                      |
| #21 / #15 | 失败矩阵与 A/B 结果作为加载证据；真实整机会话回放由 #21 统一保存。                                                                                                                                                                      |

## 后续

- #14 接入后验证真实 `plugins.config.json`、`error:` 前缀打印、`TreePresenter.connect` 时序与退出码；若 API 需要调整，另开 ADR 并保持错误文案不变。
- #17~#20 的插件若需要释放资源，先在 core/host 增加带 cleanup 的安装协议，不能只回滚四张注册表。
- ADR-0003 的上下文说明以本 ADR 的“类型化、暂存的事件订阅”为补充；接口实现与测试通过后可把本 ADR 改为 Accepted。
