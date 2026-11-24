# ADR-0009 VSCode 判定逻辑与宿主适配分离

状态：Proposed  
日期：2026-11-24  
关联：Issue #3、#11；需求条目 VS-01、VS-02、VS-03

## 背景

VSCode 扩展需要在 Explorer 中为 SVG 文件显示 `[]` 标记，并用原生 Outline 显示元素树与源码定位。宿主 API（`FileDecorationProvider`、`DocumentSymbolProvider`、`Range`）只能在 Extension Host 中运行，直接把这些 API 写进业务类会让判定逻辑无法用 `node:test` 独立验证，也无法在没有真实 VSCode 的环境中复跑。

## 决策

- `apps/vscode-svg` 内部拆成四类：纯判定的 `SvgFileDecorator`（路径 → 是否 SVG 普通文件 → 标记）和 `SvgOutlineModel`（中立 XML 语法树 → 符号模型），以及只负责宿主适配的两个 Provider（DecorationProvider、DocumentSymbolProvider）。
- 判定与模型层不 import `vscode`；Provider 层负责把模型转换成宿主类型（`Uri`、`Range`、`DocumentSymbol`）。
- 源码位置一律来自 `packages/svg-xml` 的中立语法入口，Provider 只做 UTF-16 偏移到行列/`Range` 的转换；不通过搜索标签文本猜测位置。
- Outline 不套用 CLI 严格导入器：允许无 `id` 元素和 CLI 暂不支持的 SVG 标签，不补 id、不创建领域对象。
- 打包把运行依赖随扩展一起分发；VSIX 内容与安装步骤写入 `doc/vscode.md`。

## 备选与取舍

- 把判定逻辑直接写进 Provider：代码更少，但只能依赖真实宿主验证，无法在 CI 中覆盖。选择四文件拆分，代价是 Provider 只做薄适配，需要额外把模型映射成宿主类型。
- 使用 CLI 严格导入器生成 Outline：能复用领域模型，但会补 id、拒绝未知标签，违反 VS-02/VS-03；因此只共享中立语法层。

## 验证

- 待 #3/#11 落地后补充：标记判定单测（SVG、非 SVG、目录、隐藏路径）、Outline 的嵌套/无 ID/中文/CRLF/同行多元素 range 测试、VSIX 干净安装记录。
- 真实 Extension Host 截图与安装证据必须在具备桌面环境时执行；未执行时在 `doc/vscode.md` 明确标注，不用设计图代替。

## 后续

若 `node:test` 无法覆盖宿主 API 的边界（如 `selectionRange` 行为），新增宿主侧冒烟脚本而不是把宿主判断下沉到模型层。
