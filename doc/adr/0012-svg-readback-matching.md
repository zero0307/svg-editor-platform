# ADR-0012 provider 驱动的严格 SVG 读回与匹配

状态：Proposed  
日期：2026-11-25  
关联：Issue #13（TASK-XML-02）；需求条目 BASE-01、EXT-01、BOX-03；消费者 #14（CLI 与 builtins）、#19（box）、#21（A/B 回放）

## 背景

Phase 1 的导入器把 SVG 标签直接映射到六个具体图形类（`ShapeFactory.fromSvg`），无法让新图形通过注册恢复，也无法让缺少插件的复合图形按普通标签降级而不写特例。Phase 2 要求严格语义层保留原导入约束（ID、深度、命名空间、白名单、变换与继承、警告、失败原子性），同时把“标签/元数据 → 领域图形”的选择交给 provider，并在 codec 中彻底移除插件名或图形类型分支。

#6 已交付中立语法树（含源码范围）与文本扫描器；本节点在其上实现 `SvgCodec`。真实六种 builtins 在 #14 才接入，因此本节点用测试内 fake provider 证明通用恢复能力。

## 决策

### 1. 公开入口与依赖

- `packages/svg-xml` 新增严格层，公共入口导出 `XmlSvgCodec`；它实现 core 的 `SvgCodec`：`decode(source) → { document, warnings }`、`encode(document) → string`。
- 构造参数只接收 core 公开的 `ShapeProviderRegistry`；恢复过程通过 `ShapeRestoreService` 递归，不 import builtins、具体图形类、host 或 apps。
- encode 复用既有 `@xmldom/xmldom`（Phase 1 已有运行时依赖）做序列化；decode 使用 #6 的语法树，不二次解析 DOM。`@xmldom/xmldom` 在 `@svgframe/svg-xml` 的 `package.json` 显式声明。
- core 契约无需改动：`SvgElementView`、`ElementTransform`、`ShapeProvider`、`ShapeRestoreService`、`SvgCodec` 已足够。语法树的元素增加原始 `attributes` 字段（svg-xml 内部类型），供严格层使用。

### 2. 流水线顺序

`decode` 固定按以下顺序执行，前置失败在任何 provider 分派/降级之前整体拒绝：

1. `SvgString` 字符校验；`<!DOCTYPE`/`<!ENTITY` 拒绝（`unsupported SVG: DTD and entities`）；`<?xml-stylesheet` 拒绝（`unsupported SVG: xml-stylesheet`）。
2. 中立语法解析；失败映射为 `invalid SVG XML`（不把扫描器内部偏移暴露给 CLI）。
3. root 检查：标签必须 `svg`；`xmlns` 非空时必须为 SVG 命名空间；`width`/`height` 默认 800/600、去 `px`；`viewBox` 必须 `0 0 width height`；root 属性白名单仅 `width`、`height`、`viewBox`、`xmlns`、`version`、`xmlns:*`；root 直接非空白文本拒绝。
4. 全局重复 ID：按文档顺序收集显式 id，重复即 `id already exists: <id>`；深度超过 128 即 `SVG nesting exceeds 128 levels`。这一步先于任何降级与 provider 选择。
5. 属性/命名空间预检：元素标签带前缀、`xmlns` 非 SVG、`style`、`on*`、非 `xml`/`xmlns` 的属性前缀都拒绝；文案沿用 Phase 1。
6. 缺 ID 补全：按标签独立计数器从 1 开始，跳过所有显式 id，警告文案固定 `warning: assigned id <id> to unnamed <tag>`，顺序为文档顺序。
7. 变换/继承规范化（见第 4 节）。
8. 自底向上的 provider 恢复：容器 provider 在自己的 `restore` 中通过 `ShapeRestoreService` 恢复子视图，拿到完整子树；每个 root 子节点恢复后交给 `SvgDocument.add`，最后 `document.validate()`。
9. 任一步抛错都直接向上抛 `DomainError`；codec 不缓存、不替换任何外部文档。`EditorSession.read` 因此在失败时保留旧文档、历史与屏障（测试用 `EditorSession` + fake store 验证）。

### 3. provider 选择与降级

- 先收集所有 `matches(view)` 为真的显式语义 provider；多于一个即拒绝，错误固定 `ambiguous provider match for <tag>: <type1>, <type2>`（类型名排序，避免注册顺序影响）。
- 恰好一个则使用；没有显式命中时按 `defaultTag === view.tag` 选标签默认 provider，同样多于一个即拒绝。
- 两者都没有时沿用 Phase 1 文案 `unknown shape type: <tag> (is the plugin loaded?)`。
- 未知 `data-kind` 不特殊处理：若没有 provider 的 `matches` 命中，就按标签默认恢复，`data-kind` 作为普通属性保留，因此“未安装 box 插件按 g 降级”不需要 codec 写 `box` 分支。
- 安装 provider 但结构坏、缺必要部件、类型不符时，由 provider 抛错；codec 不做第二套结构判断，整次 read 失败。
- 叶节点有子元素而 provider 恢复出的形状没有子节点时，按 Phase 1 文案 `unsupported child elements in <tag>` 拒绝；容器上的直接非空白文本按 `unsupported text outside <text>` 拒绝（文本节点检查在 provider 恢复后执行，保持“未知子标签 / 文本”与 Phase 1 相同的优先级）。

### 4. 变换与继承只应用一次

- `SvgTransform` 与 `SvgImportContext` 从 Phase 1 语义移植：只支持 `translate` 和正等比 `scale`；累计世界变换、`stroke-width`/`font-size` 的继承与缩放、显式 `inherit` 的清理都与 Phase 1 一致。
- `SvgElementView.transform` 是该元素的世界变换。叶 provider 自己应用一次（先按 scale 缩放几何，再按 translate 平移，与 Phase 1 `Shape.scale` + `Shape.move` 顺序一致）；**容器 provider 不得再对恢复出的整棵子树应用该变换**，其子视图已各有自己的世界变换。
- 长度敏感属性（`rx`/`ry`/`dx`/`dy`/`textLength`/`letter-spacing` 等）在世界 scale ≠ 1 时拒绝，错误 `unsupported scaled SVG attribute: <name>`。哪些属性由 provider 自己缩放，当前使用 Phase 1 六个标签的 `geometry()` 键名表（rect/circle/ellipse/line/text/g）；这是兼容 shim，新增 provider 若带几何长度属性，需要把“几何属性集合”提升为公开契约（另开 ADR），本轮不私自扩展 core 接口。
- `view.attributes` 已完成解码/换行规范化，移除 `transform`、`id`、`xmlns*`；`view.text` 为已解码的直接文本（无文本为 `null`），provider 需自行决定空文本语义。

### 5. encode 保持 Phase 1 字节

沿用 Phase 1 的 DOM 构造与 `XMLSerializer` 路径：`<?xml version="1.0" encoding="UTF-8"?>`、`xmlns`/`width`/`height`/`viewBox`、2 空格缩进、属性顺序取 `ReadonlyShape.attributes()`（imported → geometry → styles）、末尾换行、XML 实体转义与 `\r` → `&#13;`。provider 必须以稳定顺序写入属性，fake provider 在测试中复刻 Phase 1 工厂的顺序，保证 encode/decode 往返字节稳定。

### 6. 测试替身

测试内 fake provider 提供六种基础标签与一个 `data-kind="fake-box"` 复合类型：复合 provider 通过 `ShapeRestoreService` 恢复完整子树，提供 `clone` 保留实际类型；通过临时删除 fake-box provider 验证 `data-kind` 保留与 `g` 降级；通过第二个同类 provider 验证显式匹配与 tag 默认匹配的歧义拒绝。

## 备选与取舍

- **继续用 Phase 1 `ShapeFactory` + 六个具体类**：无法支持 provider 注册与 box 降级；拒绝。
- **用 xmldom 解析后再扫描范围**：#6 已验证 xmldom 无源码范围；严格层复用语法树，避免二次解析。
- **按注册顺序取第一个 provider**：会因装配顺序静默覆盖；选择显式命中→默认标签两阶段并拒绝歧义。
- **容器 provider 恢复后再对整个子树应用累计变换**：会造成双重变换；选择把世界变换只交给叶 provider。
- **把几何属性集合写进 codec 的标签表**：当前兼容 Phase 1 需要；长期应由 provider 公开几何属性（见后续）。
- **让 provider 自己决定未知标签报错**：会丢失 Phase 1 文案；codec 在无任何 provider 时统一报 `unknown shape type`。

## 验证

真实执行（详见 [Issue #13 验收证据](../evidence/acceptance/013-xml-02.md)）：

- `npm run build:packages`：通过；`packages/svg-xml/dist/index.js` 导出 `XmlSvgCodec`。
- `node --test "packages/svg-xml/dist/test/*.test.js"`：36 项通过（语法 16 + 严格层 20），覆盖六类 fake provider、变换/继承、敏感属性拒绝、复合 provider 往返与 clone、`data-kind` 降级、重复 ID 前置拒绝、未知标签、显式/默认歧义、坏 provider 失败不改会话文档、实体化 id、encode 字节稳定。
- `node scripts/check-architecture.mjs`：5 个 workspace、132 个源文件通过；svg-xml 只依赖 core 与既有 xmldom。
- `npm run test:packages` 与根 `npm run check`：见证据文档。

未执行/已知差距：真实六种 builtins 的 provider 实现与 Phase 1 全量回归在 #14；本节点只用 fake provider 证明通用机制。命名空间目前用标签前缀 + `xmlns` 属性近似（不是完整 XML 命名空间解析）；CDATA 内实体样文本会与普通文本一样被解码（Phase 1 用 DOM 时 CDATA 不解码），属于边界差异；几何属性集合仍写在 codec 内。

## 受影响消费者

| 消费者  | 约定                                                                                                                                                                                                                               |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| #14 CLI | 构造 `ShapeProviderRegistry` 并注册六种 builtins provider，然后 `new XmlSvgCodec(registry)`；builtins 的叶 provider 应用 `view.transform` 一次，容器 provider 不重复应用；`attributes` 顺序与 Phase 1 工厂一致以保持 encode 字节。 |
| #19 box | box provider 用 `matches` 识别 `data-kind`，用 `ShapeRestoreService` 恢复完整子树并在结构坏时抛错；codec 不写 box 分支；缺 provider 时自动按 g 降级。                                                                              |
| #11     | 继续只使用 #6 的中立语法入口，不调用严格层。                                                                                                                                                                                       |
| #21     | 整机 A/B 回放时用真实 builtins 对照 Phase 1 输出；本 ADR 的 encode/错误文案是应保持的契约。                                                                                                                                        |

## 后续

- #14 落地 builtins provider 后，用真实六类与 Phase 1 的 83/89 项回归核对 encode 字节与全部错误文案；若发现差异，优先修 provider/规范化而不是放宽 codec 检查。
- 若新增 provider 需要几何长度属性缩放，先提出 `ShapeProvider` 公开“几何属性”加法契约并同步 fake/#14/#19，再移除 codec 内的标签映射。
- 命名空间、CDATA 与实体边界若影响真实文件，另开 ADR 明确规定，不静默改变本节点的匹配/降级语义。
