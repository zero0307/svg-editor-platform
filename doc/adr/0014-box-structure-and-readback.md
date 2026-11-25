# ADR-0014 box 复合图形的结构、属性语义与读回

状态：Accepted  
日期：2026-11-25  
关联：Issue #19（TASK-BOX-01）；需求条目 ATTR-01、ATTR-02、ATTR-03、BOX-01、BOX-02、BOX-03、BOX-04、BOX-05、TREE-01；消费者 #20（modified-star 并存）、#21（A/B 回放）、#22（p2）

验证证据（2026-11-25 收口复核）：实现与测试见 doc/evidence/acceptance/、doc/evidence/framework/、doc/evidence/assembly/；状态由 TASK-QA-03 复核后更新。

## 背景

`box` 是 Phase 2 唯一需要同时占用三个扩展点的可选插件：`ShapeProvider` 负责创建/恢复复合图形，`AttributeHandler` 定义 `fill`/`label` 的领域语义，`TreeDecorator` 只负责行尾 `(box)` 标注。框架冻结 F 已提供：`ShapeProvider.create/matches/restore`、`ShapeCreationService`、`ContainerShape.canRemoveChild/canInsertChild`、`Shape.canUngroup/validateInvariant`、`StructureService` 的四个结构动作、`AttributeEditingService` 的冲突/回退/候选文档规则、`TreePresenter` 的后缀管线、provider 驱动的严格 codec 与 `data-kind` 降级。box 接入不得修改 `core`/`host`/`builtins`/`svg-xml`。

本 ADR 固定 box 的模板、派生 ID、结构策略、属性语义、读回/降级与序列化，并记录两处**框架能力缺口**（命令反馈多态钩子、ungroup 文案），供后续独立框架补丁决策。

## 决策

### 1. 包与三类贡献的原子注册

- 目录 `plugins/shape-box`，包名 `@svgframe/shape-box`，唯一默认导出 `BoxPlugin`。
- `package.json` 的 `svgframe.contributes` 声明 `shapes:["box"]`、`attributes:["box-attributes"]`、`decorators:["box-type-label"]`；host 将 `attributes` 规范化为 core `PluginManifest.contributes.attributeHandlers`，A 组合根使用同一 core 形状的 `boxManifest`。
- `activate` 只向暂存 context 注册 `BoxProvider`、`BoxAttributeHandler`、`BoxTypeLabelDecorator` 三个实例；三者随 `PluginInstaller` 一次提交或整体回滚，不由插件自行订阅或写活注册表。

### 2. 图形模板、派生 ID 与 clone

- `BoxShape extends Group`（core 公开容器基类）：`tag='g'`、`kind='box'`、构造时 `preserveAttribute('data-kind','box')`；支持额外子节点与嵌套 box。
- 必要部件固定为 `<id>-rect`（`rect`）与 `<id>-label`（`text`），全部经注入的 `ShapeCreationService` 创建，不 import `Rect`/`Text` 或 builtins。
- 创建语法 `create box <id> <x> <y> <w> <h> "<label>"`：参数恰好 5 个，数量错误 `invalid parameters for box`，数字错误沿用 Phase 1 `invalid number for parameter <n>: <value>`。
- 模板由 P1 §6.1B 的两个样例反推并冻结：矩形 `(x, y, w, h)`、默认 `fill="#4a90d9"`；标签文字 `(x+20, y+h/2+5)`（两个样例均为 `x+20`、`y+35`，与 `h=60` 一致）。若未来规格给出新的居中规则，先改本 ADR 再改实现。
- 角色部件**按 ID 动态解析**（`rect()`/`label()` 每次查找直接子节点），因此 `Group.clone()` 复制子树后自动绑定到副本部件，不与源快照共享可变对象。`BoxShape` 重写 `protected newContainer(): BoxShape`（ADR-0004 要求），保证 clone、undo/redo 与候选文档事务保留插件类型与结构策略。
- 创建原子性由候选文档事务保证：`CreateAction` 先查 box id，provider 建完整子树后 `SvgDocument.add` 再校验整棵子树 ID；任一派生 ID 冲突或部件创建失败都丢弃候选，不留下容器或子部件。

### 3. 结构保护与不变量

- `canRemoveChild` 仅拒绝两个必要部件：`delete` → `cannot remove necessary part: <id>`，`addto`/`group` → `cannot move necessary part: <id>`；额外子节点可正常删除/移出/收编。
- `canUngroup()` 返回 `false`：`ungroup` 在 `StructureService` 中先被拒绝，输出框架固定文案 `cannot ungroup box: <id>`。
- 整体删除 box 由其父容器决定，因此 `delete box` 合法，整棵子树作为**一个** undo 单元；嵌套 box 与额外子节点随子树一起删除/恢复。
- `validateInvariant()` 要求：`data-kind=box`，两个必要部件存在且分别为 `rect`/`text`，ID 为派生 ID；错误文案 `invalid box: <id> must keep data-kind=box`、`incomplete box: <id> is missing <partId>`、`invalid box: <partId> must be a <rect|text> part`。`SvgDocument.validate()` 在每次编辑提交前逐节点调用该不变量，构成第二道保护。

### 4. 属性处理器

- `box-attributes` 的 `handles` 是纯查询：仅当目标是 `BoxShape` 且属性为 `fill` 或 `label` 时为真，不修改任何状态。
- `apply` 在候选文档上：`fill` → 内部 rect 的 `fill`，反馈 `box#<id> fill propagated to <id>-rect`；`label` → 内部 text 的文本，反馈 `box#<id> label updated: "<value>"`。两条命令各是一次 `set`，多部件场景仍只形成一个 undo 单元。
- 非 box 的 `label` 不命中处理器，回退 Phase 1 白名单并报 `unknown attribute: label`；命中后 `apply` 抛错由框架传播，不再回退默认处理（core 契约，非本插件实现）。

### 5. 树标签

- `box-type-label` 只读 `TreeRow.node.kind === 'box'` 时返回 `(box)`；框架按注册顺序为每个非空后缀加一个前导空格。零 box 时输出与 Phase 1 逐字节一致；与 `#20` 的 `modified-star` 互不感知，默认顺序为 box 在前、modified 在后。

### 6. 序列化与读回

- 序列化为 `<g id="<id>" data-kind="box" ...>` + 完整子树；`encode` 属性顺序沿用 `attributes()` 的 imported → geometry → styles。默认创建的 rect 带 `fill="#4a90d9"`，标签文字与位置与模板一致。
- `matches` 只认 `tag==='g'` 且 `data-kind==='box'`；显式匹配优先于标签默认匹配。未安装本插件时，codec 按 `g` 默认 provider 恢复并把 `data-kind` 作为导入元数据保留，再次 encode 不丢标记（语义降级、结构不变）。
- `restore` 用完整子树：子视图先经 `ShapeRestoreService` 恢复（叶 provider 各自应用一次世界变换），容器**不再**对整棵子树应用 `element.transform`；随后应用容器自身属性（presentation 走 setter，其余含 `data-kind` 走 preserve），最后调用 `validateInvariant()`。
- 结构坏（缺必要部件、角色类型错误、缺少 id）直接抛错，`EditorSession.read` 保持旧文档、历史与屏障；重复 ID 在 provider 分派前的全局预检中已经整体拒绝，不能靠降级绕过。

### 7. 已知框架缺口与偏差（不在本提交补内核）

1. **命令反馈没有多态钩子**：`CreateAction`/`MoveAction`/`DeleteAction` 使用 `${shape.tag}#${shape.id}`，box 的 `tag` 是 `g`，实际输出为 `g#n1 created`、`g#n2 moved by (0,100)`、`g#n1 deleted`；P1 §6.1B 的 `box#n1 created (g#n1 + rect#n1-rect + text#n1-label)`、`box#n2 moved by ...` 需要 core 提供公开的多态描述/反馈钩子（architecture §6 已列为目标，F 未实现）。undo 文案同样是框架统一的 `undone: <message>`。
2. **ungroup 文案**：`StructureService` 固定输出 `cannot ungroup <kind>: <id>`，即 `cannot ungroup box: n1`；P1 §4.4 原文 `cannot ungroup composite shape: n1` 无法在不改 core 的前提下得到。

因此 `doc/transcript/box.txt` 的期望字节以**当前框架实测**为准，并逐字节冻结；功能与结构语义与 P1 §6.1B 一致，只有上述反馈/文案不同。建议在 #19 之后用独立框架补丁引入多态反馈钩子并复核 ungroup 文案，再更新本 ADR 与 transcript。

## 备选与取舍

- **BoxShape 直接继承 `ContainerShape` 并手写 clone（如测试替身 `StampShape`）**：可行，但 `newContainer()` 钩子位于 core `Group`，继承 `Group` 能复用成员复制与插入语义并满足 ADR-0004；选择继承 `Group`。
- **在插件里保存部件引用字段**：clone 后需要手动重绑且易泄漏旧快照；选择按 ID 动态解析。
- **允许单独删除必要部件、靠后续校验兜底**：会在候选文档中产生不完整 box，且错误来源不直观；选择容器策略在操作前拒绝，`validateInvariant` 兜底。
- **坏结构警告并降级为普通 g**：会悄悄改变语义；选择整次 read 失败并保留旧文档（与 ADR-0003/0012 一致）。
- **在本提交中给 core/builtins 加 box 分支或反馈钩子**：违反框架冻结和 issue 边界；选择记录缺口、另开补丁。

## 验证

真实执行（详见 [019-box-01 验收证据](../evidence/acceptance/019-box-01.md)）：

- `npm run build:packages`、`npm run test:packages`：268 项通过，其中 `@svgframe/shape-box` 30 项（provider 6、shape 6、handler 5、decorator 3、plugin 4、session 6）。
- `npm test`：120 项通过；新增 `test/plugin-box.test.ts` 7 项覆盖 A/B 字节一致、transcript 回放、读回、坏结构、降级、禁用与结构命令文案。
- transcript 期望：`test/fixtures/expected/box/stdout.txt` sha256 `56E4F15A22F2506E2EB3ED964B7BDFB7631E69D90090ACF9036271AF4489FCE0`，exit 0。
- A/B 同一 box 会话 stdout sha256 均为 `4A42198F2C3506F011512DF4A198CA2D2F61E08DAED29890322D5576BA50FDD6`。
- 受保护路径 `packages/core`、`packages/host`、`packages/builtins`、`packages/svg-xml`、`apps/vscode-svg`、`apps/dsh-plugin`、既有插件源码差异为空。

## 受影响消费者

| 消费者            | 约定                                                                                                                                  |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| #20 modified-star | 只读文档投影计算指纹，包含 box 的 `data-kind` 与子节点顺序；标签顺序 box 在前；不读取 box 插件实例状态。                              |
| #21 A/B 回放      | 使用 `doc/transcript/box.txt` 与 `test/fixtures/expected/box/` 实测字节；如需 P1 §6.1B 逐字文案，先完成框架反馈钩子补丁并更新本 ADR。 |
| #22 p2            | 记录本 ADR 的缺口状态；`plugins/shape-box` 纳入插件类指标。                                                                           |

## 后续

- 独立框架补丁：在 core 公开“命令反馈/多态描述”钩子并让 builtins 动作使用它；同时评估 ungroup 文案是否改为 P1 原文。补丁合并后重跑 box transcript 并更新期望字节。
- 若 box 模板需要居中而非固定 `x+20`，先改本 ADR 与 transcript，再改 `BoxProvider`。
