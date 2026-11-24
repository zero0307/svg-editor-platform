# ADR-0008 中立 XML 语法入口与源码范围约定

状态：Proposed  
日期：2026-11-24  
关联：Issue #6（TASK-XML-01）；需求条目 BASE-02、VS-02、VS-03；消费者 #11（VSCode Outline）、#13（严格 codec）

## 背景

VSCode 原生 Outline 需要显示 SVG 的根、容器、叶子和无 id 元素，并把点击准确映射回源码；同一行可能出现多个元素，重复标签很常见，编辑过程中 XML 还可能暂时不完整。这些需求不能交给 CLI 的严格导入器：它会按 Phase 1 白名单拒绝未知标签、补 id、做坐标规范化并创建可编辑领域对象，既会丢失源码位置，也会把“编辑器里的坏文件”当成必须拒绝的输入。

现有的 XML 依赖 `@xmldom/xmldom` 能解析结构，但不提供元素在源码中的偏移，无法在没有再次搜索标签文本的情况下生成稳定范围；按标签文本搜索在重复标签、同一行多个元素和文本内容包含标签字符串时都会定位错误。架构 §7 因此要求把“中立语法/位置层”和“严格 SVG 语义层”分开，并在开工时验证解析依赖的范围能力。

本节点（#6）只交付中立语法入口；严格语义层仍由 #13 在该包内实现。

## 决策

### 1. 包与公共入口

- 新建 `packages/svg-xml`，包名 `@svgframe/svg-xml`，按 [ADR-0007](0007-workspaces-and-package-boundaries.md) 的库包形态：包根 `index.ts`、`composite`、`exports["."]` 只暴露 `dist/index.js` 与 `dist/index.d.ts`，测试在包根 `test/` 并编译到 `dist/test/`。
- 公共 API 是一个函数：`parseSvgSyntax(source: string): SvgSyntaxResult`。`SvgSyntaxResult` 是判别联合 `{ ok: true; root: SvgSyntaxElement } | { ok: false; message: string }`，任何输入都不抛未捕获异常；调用方（VSCode）可在失败时清空大纲并继续工作。
- 语法节点 `SvgSyntaxElement` 含：`tag`（原样限定名，允许未知标签、带前缀名）、可选原始 `id`、直接文本 `text`、`children`、`outerSpan`（整个元素）、`startTagSpan`（开始标签 `<` 到 `>`，含自闭合 `/>`）、`nameSpan`（开始标签内的标签名，供 `selectionRange`）。
- 语法层不套 CLI 白名单、不补 id、不创建领域对象、不做 SVG 语义校验；重复标签、无 id、嵌套 svg 都按源码保留。
- `package.json` 只声明 `@svgframe/core` 一个内部依赖，`tsconfig` 引用 `../core`，为 #13 在同一包内使用 core 公开端口预留；语法层自身目前不 import core 的任何符号。

### 2. 源码范围约定

- `start` 含、`end` 不含；偏移是 **0-based UTF-16 code unit**（JavaScript 字符串下标），不是字节偏移，也不是行/列。
- 不保存行/列：CRLF、emoji 代理对和同一行多元素的换算交给 `apps/vscode-svg`，避免在两个包里各维护一套行列口径。
- `outerSpan` 覆盖开始标签到结束标签，自闭合元素等于 `startTagSpan`；`startTagSpan` 覆盖整个开始标签，包括 `/>`；`nameSpan` 只覆盖标签名，不含 `<`、属性与 `>`。
- 空元素、嵌套元素、同一行兄弟元素的 span 互不重叠（父子为包含关系），定位不依赖标签文本搜索。

### 3. 扫描器

- 使用自写的单遍扫描器，不引入新的 XML 依赖：跳过 XML 声明、处理指令、注释、DOCTYPE（含内部子集），识别开始/结束标签、自闭合标签、带引号属性、CDATA 与直接文本；属性值中的 `>` 与引号不会提前终止开始标签。
- 失败是受控结果，不是异常：未闭合元素、结束标签不匹配、属性缺值/值未闭合、注释/CDATA/PI/DOCTYPE 未终止、根之外出现内容、完全没有根元素，都返回 `ok: false` 并带偏移信息。
- 文本只收集当前元素的直接字符数据（子元素文本归子元素），保留实体与空白原样，不去解码、不 trim；`id` 同样保留原值，不做实体解码或补全。Outline 显示不依赖这些文本，但保持原样避免语法层偷偷改写源码语义。
- 标签名按字符规则读取（允许 `-`、`.`、`:`、非 ASCII），不要求首字符符合完整 XML Name 规范；这是语法容错层的取舍，严格校验留给 #13 的语义层。

### 4. 与严格层的关系

- 严格 SVG codec（#13）可以在同一包内复用语法树的元素顺序与 span，但不得把语法层的容忍当成语义校验：ID 唯一性、命名空间、Phase 1 白名单、变换规范化和 provider 恢复仍由严格层重新执行。
- 语法层不返回可编辑领域对象，避免 VSCode Outline 与 CLI 共享可变模型。

## 备选与取舍

- **用 `@xmldom/xmldom` 解析后再搜索标签文本定位**：实现成本最低，但重复标签、同一行多元素、文本中出现 `<tag>` 时都会定位错；与“不靠搜索标签文本”要求冲突，放弃。
- **给 xmldom 打补丁或换成带范围的解析器（如 saxes/sax）**：仍是外部依赖且多数不保留完整元素范围；课程要求“验证解析依赖的范围精度，必要时独立扫描”，本轮验证结论是不满足，故不新增依赖。
- **只保存行/列而不保存偏移**：CRLF 与 UTF-16 转换容易在每个消费者处重复实现；选择偏移为唯一事实来源，行/列在 VSCode 适配器一次转换。
- **语法层也补 id/做白名单**：会让 Outline 与 CLI 语义耦合，无法显示无 id 与未知标签；明确不做。
- **失败时抛异常**：VSCode 文档每次编辑都会触发解析，异常会污染扩展日志并可能中断 Outline 刷新；改为判别联合结果。

## 验证

真实执行（详见 [Issue #6 验收证据](../evidence/acceptance/006-xml-01.md)）：

- `npm run build:packages`：通过，`packages/svg-xml/dist/index.js` 与声明文件生成。
- `node --test "packages/svg-xml/dist/test/*.test.js"`：16 项通过，覆盖嵌套根/容器/叶子、无 id、重复标签、同一行多元素、未知标签、嵌套 svg、属性值含 `>` 与引号、自闭合、CDATA、注释/PI/DOCTYPE（含内部子集）、BOM、多行开始标签、中文/emoji、CRLF、前导空白、失败矩阵（不抛异常）。
- `node scripts/check-architecture.mjs`：workspace 检查通过；svg-xml 只声明 core，不 import Node 内置模块，符合矩阵。
- `npm run test:packages` 与根 `npm run check`：见证据文档与提交报告。

未覆盖/已知边界：不做 XML 实体解码、命名空间解析、SVG 语义校验、行列计算；这些分别属于 VSCode 适配器或 #13 严格层。语法扫描器接受少量不符合完整 XML Name 规范的标签名，是为了 Outline 容错，不作为 CLI 导入依据。

## 受影响消费者

| 消费者     | 约定                                                                                                                                                            |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| #11 VSCode | 直接使用 `parseSvgSyntax`；`ok:false` 时清空 Outline 不崩溃；`outerSpan` 转整个符号范围、`nameSpan` 转 `selectionRange`；只做 UTF-16/行列转换，不重新搜索源码。 |
| #13 xml    | 在同一包内新增严格 codec，可复用元素顺序与 span；但 ID/命名空间/白名单/变换/ provider 恢复必须重新执行，不信任语法层。                                          |
| #10 / #14  | 不使用语法层做树输出或命令解析；CLI 仍走严格导入器（后续迁移到 #13）。                                                                                          |
| #15 / #21  | 验证 Outline 与 CLI 两个入口都基于同一份源码位置约定，分别提供证据，不互相替代。                                                                                |

## 后续

- #13 落地严格 codec 后，在 ADR 交叉引用本文件，并说明是否会调整语法树字段；若需要行列或实体解码，另开决策而不是静默修改 span 语义。
- #11 真实 VSCode Outline 验证通过后，可把本 ADR 改为 Accepted；在此之前保持 Proposed。
- 若后续选择带源码范围的解析库，需要重新评估本 ADR 的扫描器决策并保留旧实现与证据。
