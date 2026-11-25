# ADR-0004 候选文档事务、属性分派与通用结构策略

状态：Accepted  
日期：2026-11-24  
关联：Issue #7（TASK-CORE-02）；需求条目 BASE-01、EXT-01、ATTR-02、ATTR-03、BOX-02、BOX-04、TREE-02；消费者 #8、#10、#13、#14、#16、#17~#20

验证证据（2026-11-25 收口复核）：实现与测试见 doc/evidence/acceptance/、doc/evidence/framework/、doc/evidence/assembly/；状态由 TASK-QA-03 复核后更新。

## 背景

#2 只发布了可编译契约和替身；真实编辑会话、属性分派与结构保护尚不存在，box 接入前必须由框架补齐。本 ADR 固定克隆候选、整树校验、一次提交、事件边界，以及“普通命令统一经过结构策略”的落点，避免 box 或命令节点各自在内核加名称分支。

## 决策

### 1. 会话与候选文档事务

- `packages/core/services/EditorSession.ts` 实现 `EditorSessionPort`，依赖公开 `FileStore` 与 `SvgCodec` 端口；历史栈在内部 `EditHistory`，不向插件暴露可变栈。
- `edit(action)` 的顺序固定：克隆当前文档（多态 `clone()`）→ `action.apply(candidate)` → `candidate.validate()`（ID 唯一、无环、父子链接、深度 128、每节点 `validateInvariant()`）→ 一次替换当前文档、追加一个 undo 单元、清空 redo → 发布 `editCommitted`。任一步抛错丢弃候选，文档、路径、屏障、undo/redo 与事件均不变。
- undo/redo 交换已验证的前后快照，不重新运行 `EditAction` 或属性处理器，不经过 XML 编解码。
- 屏障沿用 Phase 1：`init`/`read`/`save` 与带尺寸的 `canvas` 设置屏障并清空两栈；成功的 `edit` 清除屏障；`undo`/`redo` 在屏障期间报 `undo not allowed after io command`。
- `document()`/`hasDocument()`/无尺寸 `canvas` 是纯查询：不改变 redo、屏障或事件。
- `read` 先读文件、解码、再整树校验，全部成功后才替换文档并记住路径；`save` 先编码、再写入，写入成功后才更新保存路径与屏障；失败不清理任何状态。
- 事件只在成功后发布：`documentInitialized`、`documentRead`、`documentSaved`、`editCommitted`、`undoCommitted`、`redoCommitted`、`canvasChanged`。观察者异常由 `EditorEventBus` 隔离并上报，不影响已提交状态。
- `canvas` 只接受“两者都有”或“都没有”；只给一个尺寸直接报 `canvas requires both width and height`，不静默退化成查询。

### 2. 属性分派

- `AttributeEditingService` 在候选文档上执行一次属性设置；`AttributeEditAction` 把它包装成 `EditAction`，因此多部件修改只形成一个 undo 单元。
- 分派顺序固定：收集 `handles` 命中的处理器（注册顺序）→ 命中两个及以上在修改前抛 `AttributeHandlerConflictError`（携带双方名称）→ 零命中走目标形状原有属性白名单与多态方法 → 单命中调用 `apply({document: candidate}, request)`。
- 命中处理器失败直接传播，不再回退默认处理；未知默认属性仍报 Phase 1 的 `unknown attribute: <name>`。
- 反馈默认沿用 Phase 1 文案 `<tag>#<id> updated: <attr>=<json>`；处理器返回 `message` 时以处理器反馈为准。

### 3. 通用结构策略与结构操作

- 公开策略在多态形状上，而不是第五张注册表：
  - `Shape.canUngroup()`：叶子默认拒绝，`Group` 允许，复合容器可继续拒绝；
  - `ContainerShape.canRemoveChild(child)`：容器决定子节点能否被删除或移出（复合图形的必要部件为 `false`）；
  - `ContainerShape.canInsertChild(child)`：容器决定子节点能否被放入。
- `StructureService` 提供通用 `remove`（整棵子树删除）、`moveTo`（addto）、`group`、`ungroup`；`DeleteAction`/`AddToAction`/`GroupAction`/`UngroupAction` 把它们包装成 `EditAction`。命令节点只实例化这些动作，不直接改结构，因此策略不可绕过。
- 语义区分：删除整个复合图形时只检查其父容器（允许），删除或移出其必要部件时由复合容器拒绝；错误文案为 `cannot remove necessary part: <id>`、`cannot move necessary part: <id>`、`cannot insert <tag>#<id> into <tag>#<parent>`、`cannot ungroup <kind>: <id>`。`ungroup` 先查复合规则（如 `cannot ungroup box: box1`），再查 Phase 1 顶层限制 `cannot ungroup top-level container: <id>`，最后按 P1 物化继承样式并保持子节点顺序。
- `group`/`ungroup` 的插入位置、文档顺序、继承样式物化沿用 Phase 1 实现与文案。
- 复合容器必须在**最终类型**重写 `protected newContainer()`，否则 `clone()` 会退回其父类并丢失结构策略；#19 的 box 需要遵守该钩子。本次测试中的三级子类曾因此丢失策略，已由 `ProtectedBoxShape`/`RejectingGroup` 重写钩子修正。

### 4. 公开端口扩展

- 新增 `ports/SvgCodec.ts`：`decode(source) => { document, warnings }`、`encode(document: ReadonlyDocument) => string`，由 #13 的严格 codec 实现；`FileStore` 沿用 #9 已加入 core 的端口。
- 为支撑独立测试，`testing/` 新增 `FakeFileStore` 与 `FakeSvgCodec`（只构造/指纹化文档，不做 XML 解析）。

### 5. 兼容与有意收窄

- 保留 Phase 1 类名与方法：`SvgDocument`、`Shape`/`Group`、`EditorSessionPort` 的 `document`/`init`/`read`/`save`/`canvas`/`edit`/`undo`/`redo`；文案 `no document…`、`unknown attribute…`、`cannot ungroup top-level container…`、`nothing to undo/redo`、`undo not allowed after io command` 不变。
- `document()` 返回只读投影；需要写入的测试改为走 `edit` 或直接构造 `SvgDocument`。
- dirty 不在 core 保存；它由标签插件订阅提交事件自行维护。失败编辑不发事件，因此 dirty 基准自然不变。
- 未实现：真实 codec（#13）、插件加载器（#8）、树装饰管线（#10）、box 策略实现（#19）、CLI 分发与内置命令（#14）。

## 备选与取舍

- **在命令里各自实现结构检查**：会随每个插件复制策略判断，且 box 接入必须改内核；选择多态策略 + 通用结构服务。
- **把结构策略做成第五张注册表**：需要额外注册名与顺序规则，且策略天然属于具体形状；选择形状/容器的多态钩子。
- **undo 时重新 apply 反向动作**：需要为每个处理器实现逆操作，且可能重跑副作用；选择复用已验证快照。
- **属性冲突按优先级取第一个**：无需求且会静默覆盖；选择多命中即拒绝。
- **read 失败时保留部分警告/新文档**：破坏 P1 原子性；选择全成功才替换。
- **canvas 单尺寸当查询**：容易掩盖调用错误；选择显式拒绝。

## 验证

真实执行（详见 [TASK-CORE-02 验收证据](../evidence/acceptance/007-core-02.md)）：

- `npm run build:packages`：通过（core 为 composite 包，含 `dist/index.d.ts`）。
- `npm --workspace @svgframe/core test`：88 项通过（原 50 项契约 + 38 项事务/属性/结构/会话）。
- 覆盖：多部件一次 undo、undo/redo 不重跑动作与处理器、插件类型贯穿 undo/redo、部分修改/冲突/不变量失败均保持文档/路径/屏障/undo/redo 与事件、查询不清 redo、保存失败不设屏障、七类事件顺序与观察者隔离、必要部件删除/移出/分组/解散被拒、整棵复合删除允许、目标容器拒绝插入。
- 已知差距：`newContainer()` 钩子要求最终类型重写；未通过真实 CLI 回放验证（#14），未与 box 实装联调（#19）。

## 受影响消费者

| 消费者       | 约定                                                                                                                                             |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| #8 加载器    | 不改本 ADR 的契约；插件激活后注册的策略/处理器随暂存事务提交或回滚。                                                                             |
| #13 codec    | 实现 `SvgCodec`：`decode` 返回 `SvgDocument` 与警告，`encode` 接收 `ReadonlyDocument`；导入仍走 `validate()`。                                   |
| #14 CLI      | `set`/`delete`/`addto`/`group`/`ungroup` 用 `AttributeEditAction` 与四个结构动作，不直接改文档；命令前置条件继续用 `requiresDocument`/`effect`。 |
| #19 box      | 必要部件通过 `ContainerShape.canRemoveChild` 拒绝删除/移出，`canUngroup()` 拒绝解散；最终类型重写 `newContainer()`；错误文案使用本 ADR 约定。    |
| #17~#20 插件 | 用 `Shape.validateInvariant()`、容器策略与公开动作；不接触历史栈；失败路径由会话回滚。                                                           |
| #16 DSH      | 真实 `EditorSession` 可按 `EditorSessionPort` 装配 fake 或真实 codec/store。                                                                     |

## 后续

- #10 完成树装饰管线后，把本 ADR 的“事件”约定与标签插件联调；#14 真实 CLI 回放后再复核 P1 文案；若结构文案需要调整，由 #19 提出并更新本 ADR，不静默改内核。
