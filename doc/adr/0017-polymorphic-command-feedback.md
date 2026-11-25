# ADR-0017 复合图形的多态命令反馈

状态：Accepted  
日期：2026-11-25  
关联：Issue #19 后续框架补丁；需求来源 phase_cli_1.md §4.4/§6.1B、architecture §6；消费者 #17~#20

验证证据（2026-11-25 收口复核）：实现与测试见 doc/evidence/acceptance/、doc/evidence/framework/、doc/evidence/assembly/；状态由 TASK-QA-03 复核后更新。

## 背景

Phase 1 的命令反馈用 `shape.tag` 标识目标，例如 `g#n1 created`、`g#n1 deleted`。box 的领域类型是 `box`、SVG 标签才是 `g`，因此 #19 合并后反馈仍显示 `g#n1`，且 create 没有派生部件摘要；`ungroup` 文案也与 P1 §4.4 的 `cannot ungroup composite shape: n1` 不一致。架构 §6 要求内核提供“公开的多态描述钩子/结果对象”，让复合图形在不改内核的情况下输出自己的反馈。

## 决策

### 1. 公开多态钩子

- `Shape` 新增 `creationParts(): readonly string[]`，默认返回 `[]`。复合图形可返回本次创建产生的领域部件，例如 `['g#n1','rect#n1-rect','text#n1-label']`；内核不认识具体类型。
- `CreateAction` 的反馈为 `<kind>#<id> created`；`creationParts()` 非空时追加 ` (<part1> + <part2> + ...)`。普通图形的默认反馈保持 `rect#r created`，逐字节不变。
- box 实现该钩子后，P1 §6.1B 的目标文案为 `box#n1 created (g#n1 + rect#n1-rect + text#n1-label)`。

### 2. 命令反馈使用领域类型 `kind`

- 参与命令反馈的标识统一改为 `shape.kind`（而非 `shape.tag`）：`CreateAction`、`StructureService.remove/moveTo/group/ungroup` 的返回消息、`AttributeEditingService` 的默认属性反馈，以及 builtins 的 `MoveAction`/`ScaleAction`/`FrontAction`/`BackAction`。
- builtins 六种图形的 `kind` 默认等于 `tag`，因此既有输出（`rect#r …`、`g#n1 created with …` 等）逐字节不变；box 等复合类型输出自己的领域名。
- 属性处理器自带 `message` 时仍以处理器反馈为准（如 `box#n2 fill propagated to n2-rect`），本补丁不改处理器结果。

### 3. ungroup 拒绝文案

- 复合图形（`canUngroup() === false` 的容器）拒绝解散时统一为 `cannot ungroup composite shape: <id>`；普通顶层分组仍是 `cannot ungroup top-level container: <id>`，叶子仍报 `not a container: <id>`。
- 成功解散普通容器仍返回 `<kind>#<id> ungrouped (<n> children)`；builtins 的 `g` 输出不变。

### 4. undo 文案裁决

- CLI 统一保持 `undone: <原消息>`（`redone: <原消息>`），不实现 §6.1B 示意文案 `moved back by`/`label restored`。
- 理由：Phase 1 实测约定与 baseline golden 已冻结；会话层 undo/redo 只交换已验证快照，不重新运行命令或处理器，因而没有可靠的“逆操作文案”；自定义恢复文案需要处理器实现逆操作，超出本次范围。该差异记录为规格差异，不在本补丁修改。

### 5. box 采用钩子与 golden 更新

- `plugins/shape-box/BoxShape` 增加 `creationParts()` 返回容器 tag 与当前子部件；`test/fixtures/expected/box/stdout.txt` 的 create/move/undo 行更新为 `box#…`。这是 #19 已知偏差的收口，除该钩子外不改变 box 的创建/属性/结构语义。
- 其他插件（stats/dir/命令插件）`kind` 等于/不涉及复合类型，不受影响。

## 备选与取舍

- **在 core 内按 `kind === 'box'` 分支**：违反“内核不认识具体插件”的约束；选择多态钩子。
- **让命令反馈继续使用 tag，仅 box 特例替换字符串**：会把插件名写进内核或 builtins；选择统一 `kind`。
- **`creationParts` 在容器基类自动推导**：会让普通 `g` 与所有复合类型都改变输出，且默认不再为空；选择默认 `[]` + 复合类型显式覆盖。
- **实现 `moved back by` / `label restored`**：需要逆操作/处理器协作，且与冻结 undo 约定冲突；选择保留 `undone: <原消息>` 并记录偏差。

## 验证

真实执行（本机 Node 26.13.0、TypeScript 7.0.2）：

- `npm run build:packages` 通过。
- `npm test`：**122/122 通过**（含四个 baseline golden 与 box transcript 逐字节回放；box transcript 已按本补丁目标更新）。
- `npm run test:packages`：**272/272 通过**（core 102、host 39、svg-xml 36、cli 2、vscode 25、dsh 7、command-dir 17、command-stats 14、shape-box 30）。
- 新增测试：`packages/core/test/feedback.test.ts`（纯形状无 parts、复合 create 摘要、delete/默认属性用 kind、ungroup 复合文案）；`test/command-feedback.test.ts`（builtins move/scale/front/back 的 kind 与 P1 字节不变、六种图形 create/delete 不变）。
- 架构检查仍为 `0 legacy files, 10 workspace packages, 235 workspace sources, 99 cross-package imports`；未改 host/svg-xml/apps 语义。

## 受影响消费者

| 消费者           | 约定                                                                                                                                                                |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| #17/#18 命令插件 | 反馈标识使用 `kind`；命令名/参数/文案不变。                                                                                                                         |
| #19 box          | 已实现 `creationParts()`，创建输出 `box#… created (g#… + rect#… + text#…)`；删除/移动/解散使用 `kind` 与 `cannot ungroup composite shape`。新复合插件应覆盖该钩子。 |
| #20 标签         | 不涉及命令反馈；tree 输出仍由 `TreeDecorator` 提供。                                                                                                                |
| 其他复合插件     | 若需要 create 摘要，实现 `creationParts()`；默认 `[]` 保持普通命令字节。                                                                                            |

## 后续

- 若未来确认需要逆操作文案，应先更新 undo/redo 契约、处理器接口与 baseline golden，再引入新的 ADR；不在本补丁追加。
- box 的 transcript/证据以本补丁后的提交为新基线，`doc/evidence-index.md` 已登记。
