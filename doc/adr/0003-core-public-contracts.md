# ADR-0003 内核公开契约、四扩展点与只读边界

状态：Proposed  
日期：2026-11-24  
关联：Issue #2；需求条目 BASE-02、EXT-01、EXT-02、ATTR-02、LOAD-01；消费者 #5、#7、#8、#10、#13、#14、#16、#17~#20

## 背景

四个板块需要在内核事务、编解码、加载器和 CLI 迁移之前并行开发。若各板块各自发明接口，后续会出现三套形状创建、两套树标签和按命令名判断前置条件的临时分支。架构方案第 4、5、9、11 节要求先发布可编译的公开契约、最小替身和测试夹具；本 ADR 固定这批签名与边界，并明确“契约完成不等于框架实现完成”。

## 决策

### 1. 包与公共入口

- 新建 `packages/core`，包名 `@svgframe/core`，`"type":"module"`，唯一公共入口为 `index.ts`，`exports` 指向 `dist/index.js`（类型 `dist/index.d.ts`）。
- 采用 strict ESM、一类一文件、类名等于文件名。为同时满足“入口为 `dist/index.js`”和“测试编译到 `dist/test/`”，`tsconfig.json` 设 `rootDir: "."`、`outDir: "dist"` 并 `extends` 根配置，源码目录为包根下的 `domain/`、`extensions/`、`ports/`、`events/`、`testing/`。根工作区、项目引用与检查脚本由 #5 建立，本节点不修改根 `package.json`、锁文件和根 `tsconfig.json`。
- core 运行时代码只依赖自身相对模块，不 import host、builtins、plugins、Node 文件系统、VSCode、DSH 或 XML DOM。`node:test`/`node:fs` 只出现在 `test/` 的验收代码中。

### 2. 四扩展点与注册表

| 扩展点             | 稳定注册名 | 注册表                     | 缺省行为                                                                                           | 违约行为                                                                                           |
| ------------------ | ---------- | -------------------------- | -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `ShapeProvider`    | `type`     | `ShapeProviderRegistry`    | 未知类型报 `unknown shape type: <type> (is the plugin loaded?)`；恢复时无显式命中回退 `defaultTag` | 同类型重复注册报 `DuplicateRegistrationError`；显式匹配歧义由 codec 拒绝                           |
| `Command`          | `name`     | `CommandRegistry`          | 未注册命令报 `unknown command: <name>`                                                             | 重复注册拒绝；参数规则由命令自身负责                                                               |
| `TreeDecorator`    | `name`     | `TreeDecoratorRegistry`    | 无装饰器时不产生任何后缀，树输出与 Phase 1 逐字节一致                                              | 渲染或事件观察者抛错时由管线上报并禁用该装饰器，不影响已提交文档                                   |
| `AttributeHandler` | `name`     | `AttributeHandlerRegistry` | 无命中时走目标形状原有属性白名单与多态方法                                                         | 两个及以上命中在修改前抛 `AttributeHandlerConflictError`；命中的处理器失败直接传播，不回退默认处理 |

注册表是泛型类，按稳定名索引，拒绝重复注册（保留先注册项），`entries()`/`names()` 按注册顺序返回，保证 `help` 与标签顺序可复现。插件贡献必须由类或类实例实现，不能注册无归属自由函数。

### 3. 命令与编辑分离

- `Command` 只负责名称、帮助行、参数校验与准备结果；`EditAction` 表示一次作用于候选文档的领域编辑，二者是不同类型。
- `CommandPreparation` 是判别联合，固定携带 `requiresDocument` 与 `effect`：
  - `query`：只读上下文，不替换文档、不改变历史、不设置屏障；
  - `edit`：携带一个 `EditAction`，由会话在候选文档上执行并形成一次 undo 单元；
  - `document`：`init`/`read`/`save` 与带尺寸的 `canvas` 等文档生命周期操作；
  - `history`：`undo`/`redo`，沿用 Phase 1 屏障规则。
- 分发器只按 `requiresDocument` 与 `effect` 路由，禁止按命令名列白名单。`canvas` 无参数是 query，带参数是 document；测试用一个名字为 `read` 但 `requiresDocument: true` 的查询命令证明不存在名称例外。
- 命令反馈统一为 `string | readonly string[]`，与 Phase 1 router 输出兼容。

### 4. 只读边界

- 公开 `ReadonlyShape` 与 `ReadonlyDocument` 能力接口；`Shape`/`SvgDocument` 实现它们。查询上下文 `QueryContext` 只持有只读文档投影，不暴露 session、edit、history 或可变文档。
- 可变能力 `EditableDocument` 只出现在编辑路径：`EditAction.apply(candidate)` 与 `AttributeEditContext.document`，且对象永远是候选文档，不是活文档。
- `AttributeHandler.handles` 只接收 `ReadonlyShape`，必须是纯查询；`apply` 只能在候选文档上通过公开 `require`、属性设置、容器与形状方法修改，可以一次修改多个子部件。
- 属性冲突在修改前完成：命中两个及以上即拒绝；无命中回退默认；命中处理器抛错时不回退默认处理。候选、历史、dirty 与屏障保持不变由 #7 的事务保证，本节点固定错误类型与调用顺序。

### 5. 事件边界

- 事件固定为 `documentInitialized`、`documentRead`、`documentSaved`、`editCommitted`、`undoCommitted`、`redoCommitted`、`canvasChanged`，携带只读文档投影及必要路径、警告、反馈信息。
- 事件只在对应步骤成功后发布；失败步骤不发布任何事件。
- `EditorEventBus.publish` 隔离观察者故障：异常上报给构造时注入的错误处理器，其余观察者继续收到事件，已提交的文档、历史与 dirty 不受影响。装饰器的事件观察者通过该总线接入；#10 负责在装饰失败时禁用装饰器。

### 6. 中立视图与 provider 恢复

- `SvgElementView` 位于 core，包含 `tag`、可选 `id`、已规范化的 `attributes`、`text`、`children` 和源码无关的 `transform`（正均匀缩放 + 平移）。`svg-xml` 负责产生该视图，core 不反向依赖 XML 包。
- `transform` 是元素累计世界变换：叶子 provider 只应用一次；容器 provider 恢复完整子树后不得对整棵子树再次施加累计变换。
- `ShapeProvider.matches` 只声明显式语义命中；标签默认恢复由 `defaultTag` 表达。选择顺序（显式命中 → 标签默认，歧义拒绝）由 #13 的 codec 实现，本节点只固定字段与纯查询语义。

### 7. 加载与插件上下文

- `PluginManifest` 声明 `name`、`version` 与 `contributes`（四类名称集合）；`PluginModule` 的 `activate` 只通过 `PluginContext` 注册能力并读取校验后的 options 与公开服务端口（`ShapeCreationService`、`DirectoryReader`）。
- 上下文不提供文件系统、活文档、可变历史或任意事件订阅；#8 用暂存注册表实现原子提交/回滚，并在提交前比较 manifest 名称集合。本节点只发布契约与 `FakePluginContext`。

### 8. Phase 1 兼容与有意的语义收窄

- 保留 `SvgDocument`（`require`/`container`/`add`/`clone`/`validate`/`resize`/`width`/`height`/`root`）、`Shape`/`Group` 与 `EditorSessionPort`（`document`/`init`/`read`/`save`/`canvas`/`edit`/`undo`/`redo`）的名称与核心语义。
- 三处有意调整，均记录为裁决：
  1. `EditorSessionPort.document()` 返回 `ReadonlyDocument`，而 Phase 1 `SvgEditor.document()` 返回可变 `SvgDocument`。这是只读边界的要求；需要直接构造或修改文档的旧测试改为持有 `SvgDocument` 或走编辑路径。
  2. `SvgDocument.container()` 的返回类型由 `Group` 放宽为 `ContainerShape`，`Shape.parent` 由 `Group | null` 放宽为 `ContainerShape | null`，以支持不继承 `Group` 的复合容器；`Group` 及其方法不变。
  3. 新增 `EditorSessionPort.hasDocument()`（只增不改），避免查询分发器用异常探测文档是否存在。
- `Group.clone()` 通过 `newContainer()` 钩子保留插件复合类型；#7 仍需验证候选克隆、结构保护与属性分派。

## 备选与取舍

- 继续使用 Phase 1 `EditCommand` 作为命令对象：它同时持有 before/after 快照，会迫使命令自行管理历史，且容易再次出现“按名称判断是否需要文档”的分支。选择拆分 `Command` 与 `EditAction`。
- 查询上下文直接传活 `SvgDocument`：调用更省事，但只读承诺无法在类型层成立；选择只读投影 + 候选文档编辑。
- 给属性处理器增加优先级/组合机制：当前无需求，且会引入隐式覆盖；选择“多命中即拒绝”。
- 用 `instanceof Group` 判定容器：无法覆盖不继承 `Group` 的复合容器；选择公开 `ContainerShape` 能力。
- provider 选择按注册顺序取第一个匹配：会静默覆盖并依赖加载顺序；选择显式命中与标签默认两阶段，歧义拒绝（#13 实现）。
- 事件直接在会话内回调：观察者异常会破坏已提交步骤；选择带故障隔离的事件总线。

## 验证

真实执行结果（本节点）：

- `npx tsc -p packages/core/tsconfig.json`：通过（strict，无输出）。
- `node --test "packages/core/dist/test/*.test.js"`：50 个测试全部通过（注册表、文档、命令效果路由、属性处理器、装饰器、事件隔离、fake 会话、消费示例）。
- `node scripts/check-docs.mjs` 与根 `npm run check`：见提交报告；根检查不覆盖 `packages/core` 的构建与测试，工作区入口由 #5 建立。

测试覆盖的契约点：注册顺序与重复注册、未知注册名文案、四种 effect 路由、`requiresDocument` 不依赖命令名、查询不改变历史/屏障、`canvas` 查询与修改分流、编辑失败不改状态、`handles` 纯查询、候选文档 apply、冲突拒绝、处理器失败不回退、零装饰器字节不变、观察者/装饰器故障隔离、provider 创建/恢复/变换只应用一次、复合类型 clone。

未完成或未执行：真实编辑会话与事务、属性分派服务、树行装饰管线、SVG codec、插件加载器、box 插件与真实 CLI 组合；这些分别属于 #7、#10、#13、#8、#14、#19。未执行 `npm run build:packages`/`test:packages`（根工作区脚本尚不存在）。因此本 ADR 保持 Proposed，待消费方集成与对应框架任务验证后再改 Accepted。

## 受影响消费者

| 消费者            | 影响与约定                                                                                                                                                                                                        |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| #5 工程           | 把 `packages/core` 纳入 workspaces、项目引用、格式与架构检查；包内入口在包根 `index.ts`（非 `src/`），`rootDir` 为包根，测试输出 `dist/test`；不要改动本包的公开导出而不更新本 ADR。                              |
| #7 事务与属性分派 | 实现 `EditorSessionPort`；用 `EditAction` 在候选文档执行并一次提交；实现属性冲突检测必须抛 `AttributeHandlerConflictError`；节点校验调用 `validateInvariant()`；事件在成功后经 `EditorEventBus` 发布。            |
| #8 加载器         | 用暂存注册表构造 `PluginContext`，按 `PluginManifest.contributes` 比较四类名称集合，失败回滚；不得向插件暴露文件系统或活文档。                                                                                    |
| #10 树管线        | 按 `TreeDecoratorRegistry` 顺序拼接后缀，零后缀保持 Phase 1 字节；捕获装饰失败并禁用该实例；用 `TreeRow` 提供只读上下文。                                                                                         |
| #13 codec         | 产出 `SvgElementView`（规范化属性 + 世界变换）；按 `matches` 显式命中优先、`defaultTag` 回退的两阶段选择 provider，歧义拒绝；叶子只应用一次变换；通过 `ShapeRestoreService` 恢复子元素。                          |
| #14 CLI           | 以 `CommandRegistry` 替换命令表，按 `requiresDocument`/`effect` 路由；`help` 用 `Command.usage` 与 `ShapeProvider.usage`；`EditorSessionPort.document()` 是只读投影，直接改文档的旧测试需改为领域构造或编辑路径。 |
| #16 DSH           | 继续用 `EditorSessionPort` 替身独立开发，不解析 CLI 文本；结构化请求/结果基于本契约。                                                                                                                             |
| #17~#20 插件      | 只 import `@svgframe/core` 公共入口；用 `testing/fake` 的替身独立测试；box 通过 `ShapeCreationService` 创建 `rect`/`text`，通过 `ShapeRestoreService` 恢复子树，不导入 builtins 具体类。                          |

## 后续

- #7 落地事务/会话、#13 落地 codec、#14 落地 CLI、#8 落地加载器后，逐项把本 ADR 的“待验证”改为实际证据；若签名需要调整，新增 ADR 并交叉引用，不静默改写本决策。
- 属性分派与事务原子性另见 #7 的 ADR；box 读回与结构保护另见 box 决策 ADR；本 ADR 只固定它们依赖的公开契约。
