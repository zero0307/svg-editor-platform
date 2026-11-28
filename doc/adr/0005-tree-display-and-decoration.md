# ADR-0005 树展示与行尾装饰管线

状态：Proposed  
日期：2026-11-24  
关联：Issue #10（TASK-CORE-03）；需求条目 EXT-01、TREE-01、TREE-03、BASE-01；消费者 #8、#14、#17~#20

## 背景

Phase 1 的 `ShapePresenter` 直接输出 `tree`/`show` 行；Phase 2 要在不改 golden 的前提下，让 `box` 的 `(box)` 与 `modified-star` 的 `*` 等业务标签按注册顺序拼接。标签插件不应修改渲染代码，也不能因为标签异常破坏已提交的文档或历史。本 ADR 固定展示服务的行格式、行上下文、后缀拼接与故障/生命周期规则。

## 决策

### 1. 展示服务与行格式

- `packages/core/presentation/TreePresenter.ts` 提供 `tree(document, id?)` 与 `show(document, id)`，输入是只读 `ReadonlyDocument`/`ReadonlyShape`，不持有可变文档。
- 基础行沿用 Phase 1：根行为 `svg (<w>x<h>)`；子树/子行使用 `├── `/`└── ` 与 `│   `/`    ` 前缀；节点行为 `<tag>#<id>` 后接 `  <summary>`（summary 为空则不加）；`show` 首行为 `<tag>#<id>  parent=svg|g#<id>`，随后是属性、可选 `text=<json>`、可选 `children=<ids>`。
- 零装饰器时 `tree`、`tree id`、`show` 与空文档输出与 `final` 逐字节一致；期望字符串由实际运行 Phase 1 `ShapePresenter` 生成后硬编码在测试中，而不是按本 ADR 手写推断。

### 2. 行上下文

- 每次渲染为每行构造只读 `TreeRow`：`document`、`node`、`parent`、`depth`。
- 整棵树的根行：`node` 为 `document.root`、`parent` 为 `null`、`depth` 为 0，因此 dirty 类标签可标记根行。
- `tree id` 的首行：`node` 为目标形状、`parent` 为其实际父节点、`depth` 为 0；子行 `depth` 递增。
- `show` 的头部行：`node` 为目标形状、`parent` 为其实际父节点、`depth` 为 0；后缀只加在头部行，属性/文本/子节点行不拼接标签。

### 3. 后缀拼接

- 按 `TreeDecoratorRegistry` 的注册顺序调用 `decorate(row)`；`null`、空串与仅空白串都视为无后缀。
- 每个非空后缀前加一个空格，后缀之间也以一个空格连接；无任何后缀时返回原行，不产生尾随空格。
- 新增装饰器只需注册，不改 `TreePresenter` 或行格式代码。

### 4. 生命周期、故障隔离与事件

- 每个 `TreePresenter` 实例持有自己的禁用集合，键为装饰器稳定注册名；不使用模块全局变量，两个实例/两个编辑器互不影响。
- `decorate` 抛错时：上报给构造时注入的 `(error, decoratorName)` 报告器，把该装饰器在本实例中禁用并继续渲染其余行/装饰器；已输出的行与文档、历史不变。
- `connect(session.events)` 转发七类已提交事件给注册装饰器；`onEvent` 抛错同样上报并只禁用该装饰器。一个 presenter 同时只接受一个连接，返回的断开函数可恢复。
- 事件只在会话成功后到达；观察者或装饰器故障不得回滚已提交的文档、undo/redo 或 dirty 基准。报告器自身抛错被吞掉，避免破坏展示。
- 装饰器实例自己的状态（例如 dirty 基准指纹）留在实例内；`TreePresenter` 不缓存业务状态。

### 5. 接入约定

- #14 的 CLI 使用 `TreePresenter` 渲染 `tree`/`show`，用 `connect(session.events)` 接入标签事件，报告器写 stderr；`tree` 命令仍是只读 `query`，不改屏障与历史。
- #19 的 `box-type-label` 与标签插件的 `modified-star` 只实现 `TreeDecorator`，按注册名排序；加载器在注册成功后再连接事件，失败插件不遗留订阅。
- 本节点不实现 box 或 modified-star，也不让展示修改文档。

## 备选与取舍

- **把标签逻辑写进渲染器**：每新增标签都要改内核，违反接入零内核改动；选择注册表 + 管线。
- **每个装饰器直接输出整行**：会复制前缀/缩进规则并容易改变字节；选择只返回后缀。
- **模块级 disabled 集合**：多编辑器共享状态会互相禁用标签（TREE-03 禁止）；选择实例级集合。
- **让装饰器拿可变文档自行判断**：会破坏只读边界；选择只读行上下文 + 已提交事件。
- **失败后继续调用同一装饰器**：每行重复报错并可能污染状态；选择首次失败即禁用并报告一次。

## 验证

真实执行（详见 [TASK-CORE-03 验收证据](../evidence/acceptance/010-core-03.md)）：

- `npm run build:packages`：通过。
- `npm --workspace @svgframe/core test`：96 项通过（新增 8 项展示/装饰测试）。
- 覆盖：零装饰器与 Phase 1 的 `tree`/`tree id`/`show`/空文档逐字节相同；两个假标签并存且顺序可复现；空/空白后缀不多空格；根行可标记；渲染失败被捕获、报告并只禁用该实例中的该装饰器；两个 presenter 禁用状态独立；第三个假标签无需改渲染代码；`connect` 转发事件、失败观察者被禁用、断开后不再接收；展示与事件故障不改变文档/历史。
- 未执行/未完成：真实 CLI 的 `tree`/`show` 回放（#14）；box 与 modified-star 实际插件（#19/TREE）；真实 VSCode/dsh 适配不消费本服务。

## 受影响消费者

| 消费者              | 约定                                                                                                                                           |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| #14 CLI             | 用 `TreePresenter` 替换 `ShapePresenter` 的 `tree`/`show`，连接 `session.events`，保留命令的 `query` 元数据；错误报告写 stderr，不影响退出码。 |
| #8 加载器           | 装饰器注册成功后才允许连接事件；激活失败不得遗留订阅。                                                                                         |
| #19 box             | 只注册 `box-type-label` 装饰器返回 `(box)`；根名仍是 `g#id`；不改渲染代码。                                                                    |
| #TREE modified-star | 在实例内维护 dirty 基准，`decorate` 只读行；`onEvent` 消费已提交事件，失败会被禁用。                                                           |
| #17/#18             | 命令/目录插件不依赖展示服务；若输出树，复用 `TreePresenter`。                                                                                  |

## 后续

- #14 真实 CLI 回放确认 `tree`/`show` 与 P1 的其余字节（摘要与属性顺序）一致后，可考虑把本 ADR 与该节点的展示证据一起复核。
- 若未来需要行内多段样式或非字符串后缀，先新增 ADR，不直接改变 `TreeDecorator` 返回值语义。
