# ADR-0009 VSCode 判定逻辑与宿主适配分离

状态：Accepted  
日期：2026-11-24（#3 提出）；2026-11-25（#11 验证后转为 Accepted）  
关联：Issue #3、#11；需求条目 VS-01、VS-02、VS-03、PKG-01

## 背景

VSCode 扩展需要在 Explorer 中为 SVG 文件显示 `[]` 标记，并用原生 Outline 显示元素树与源码定位。宿主 API（`FileDecorationProvider`、`DocumentSymbolProvider`、`Range`）只能在 Extension Host 中运行，直接把这些 API 写进业务类会让判定逻辑无法用 `node:test` 独立验证，也无法在没有真实 VSCode 的环境中复跑。

## 决策

- `apps/vscode-svg` 分成两层四类：纯判定/模型层（`SvgFileDecorator`、`SvgOutlineModel`、`SvgSyntaxOutlineMapper`、`SvgOutlineReader`）与只负责宿主适配的两个 Provider（`SvgFileDecorationProvider`、`SvgDocumentSymbolProvider`）；入口 `SvgExtension` 只做注册与释放。
- 判定与模型层不 import `vscode`；`SvgSyntaxOutlineMapper` 是唯一 import `@svgframe/svg-xml` 的文件。Provider 层负责把模型转换成宿主类型（`Uri`、`Range`、`DocumentSymbol`）。
- 源码位置一律来自 `packages/svg-xml` 的中立语法入口（0-based UTF-16、end 独占）；Provider 只做偏移到 `Range` 的转换（`document.positionAt`），不通过搜索标签文本猜测位置。`range` 取 `outerSpan`，`selectionRange` 取 `startTagSpan` 并由模型约束在 `range` 内；ADR-0008 建议的 `nameSpan` 也在开始标签内，若需要更细的选择只改模型一处。
- Outline 不套用 CLI 严格导入器：允许无 `id` 元素和 CLI 暂不支持的 SVG 标签，不补 id、不创建领域对象；每次调用重新解析，坏 XML 返回空大纲并把警告写入扩展输出通道，不抛异常。
- 打包用 esbuild 把 `@svgframe/svg-xml` 与 `@xmldom/xmldom` 内联进单文件 `dist/extension.js`（`vscode` external）；`.vscodeignore` 为白名单，VSIX 只含扩展清单、README 与入口。VSIX 内容与安装步骤写入 [VSCode 文档](../vscode.md)。

## 实现位置

| 职责              | 文件                                                                               |
| ----------------- | ---------------------------------------------------------------------------------- |
| Explorer 标记判定 | `apps/vscode-svg/src/SvgFileDecorator.ts`                                          |
| Outline 符号模型  | `apps/vscode-svg/src/SvgOutlineModel.ts`                                           |
| 语法树 → 中立节点 | `apps/vscode-svg/src/SvgSyntaxOutlineMapper.ts`                                    |
| 解析 + 警告/刷新  | `apps/vscode-svg/src/SvgOutlineReader.ts`                                          |
| 宿主适配          | `apps/vscode-svg/src/SvgFileDecorationProvider.ts`、`SvgDocumentSymbolProvider.ts` |
| 注册与释放        | `apps/vscode-svg/src/SvgExtension.ts`、`extension.ts`                              |
| 构建/打包         | `apps/vscode-svg/build.mjs`、`.vscodeignore`                                       |

## 备选与取舍

- 把判定逻辑直接写进 Provider：代码更少，但只能依赖真实宿主验证，无法在 CI 中覆盖。选择分层拆分，代价是 Provider 只做薄适配，需要额外把模型映射成宿主类型。
- 使用 CLI 严格导入器生成 Outline：能复用领域模型，但会补 id、拒绝未知标签、没有源码位置，违反 VS-02/VS-03；因此只共享中立语法层。
- 让模型直接接受 `vscode.TextDocument`：能把 offset → Position 写在一处，但模型层将依赖宿主类型，无法独立测试；选择模型只处理偏移，Provider 一次转换。
- `selectionRange` 只取标签名（`nameSpan`）：点击后只选中名字；选择整个开始标签（`startTagSpan`）更贴近“定位开始标签”的验收表述，且仍是稳定包含关系。两者都记录在上述决策中。

## 验证

真实执行（#3、#11，详见 [Issue #3 验收证据](../evidence/acceptance/003-vsc-01.md)、[Issue #11 验收证据](../evidence/acceptance/011-vsc-02.md)）：

- `npm test -w vscode-svg`：25 项通过（装饰器 7、Outline 模型 9、语法映射 5、读取/刷新/警告 4）。
- 真实 Extension Host（隔离 profile，VSCode 1.143.1）：`nested/groups.svg` 的 Outline 显示 `svg`、`g#flow`、`g`、`circle#dot`、`rect`、`text`；点击 `circle#dot` 后光标从 Ln 1 跳到 Ln 5, Col 7（开始标签）；插入 `<rect id="added"/>` 后 Outline 立即出现 `rect#added`；`broken.svg` 空大纲并提示 “No symbols found”，扩展不崩溃。证据：[outline.png](../evidence/vscode/outline.png)、[outline-edit-refresh.png](../evidence/vscode/outline-edit-refresh.png)、[outline-broken.png](../evidence/vscode/outline-broken.png)。
- VSIX：`npm run package -w vscode-svg` 生成 54 381 字节 VSIX；干净 profile `--install-extension` → `--list-extensions` → 运行（标记与 Outline 正常）→ 卸载，日志与哈希见 [安装证据](../evidence/vscode/install/clean-env.md)、[VSIX 清单](../evidence/vscode/install/vsix-files.txt)。
- `node scripts/check-docs.mjs`、`npm run build:packages`、`npm run test:packages`、根 `npm run check` 均通过；根检查的 `test:packages` 会运行本包的 25 项测试。

未覆盖/已知边界：真实宿主只逐个验证了一个符号的点击定位（其余由单测覆盖）；编辑刷新只实测插入元素；`@types/vscode` 采用 1.140.0（最近已发布旧版，不是宿主 1.143 精确类型）；VSIX 不入库，可复现生成。

## 后续

若 `node:test` 无法覆盖宿主 API 的边界（如真实 `selectionRange` 行为），新增宿主侧冒烟脚本而不是把宿主判断下沉到模型层。若复核要求 `selectionRange` 从整个开始标签改为标签名，只改 `SvgOutlineModel.selectionOf` 并重跑 Outline 测试与真实宿主证据。
