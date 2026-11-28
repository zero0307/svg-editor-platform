# VSCode 扩展实践（#3 文件标记、#11 Outline 与 VSIX）

本文记录 `apps/vscode-svg` 的实际实现与真实验证：扩展骨架与 Explorer 的 `[]` 标记（#3）、原生 Outline 与源码定位（#11）、编译/打包与干净安装。未执行的项目在末尾明确列出，不用计划或历史描述代替结果。

## 1. 范围与目录

`apps/vscode-svg` 是独立构建的 VSCode 扩展包（`vscode-svg`，publisher `svgframe`，扩展 id `svgframe.vscode-svg`，版本 0.2.0），按 [ADR-0009](adr/0009-vscode-adapter-boundary.md) 拆成判定/模型层与宿主适配层：

| 文件                                                             | 角色       | 是否 import `vscode`    | 说明                                                               |
| ---------------------------------------------------------------- | ---------- | ----------------------- | ------------------------------------------------------------------ |
| `src/DecoratedFile.ts`                                           | 纯数据契约 | 否                      | Explorer 条目的中立描述与标记结果                                  |
| `src/SvgFileDecorator.ts`                                        | 纯判定     | 否                      | 普通 SVG 文件 → `[]`；目录、非 SVG、非 `file` scheme 无标记        |
| `src/OutlineSpan.ts` / `OutlineNode.ts`                          | 纯数据契约 | 否                      | 0-based UTF-16 偏移与中立 Outline 节点                             |
| `src/OutlineSymbol.ts`                                           | 纯数据契约 | 否                      | 符号树：`name`、`container`、`range`、`selectionRange`、子符号     |
| `src/SvgOutlineModel.ts`                                         | 纯模型     | 否                      | 中立节点 → 符号树；`tag#id`/`tag`、容器判定、selection 包含约束    |
| `src/SvgSyntaxOutlineMapper.ts`                                  | 纯映射     | 否（只 import svg-xml） | **唯一** import `@svgframe/svg-xml` 的文件，逐字段搬运 span        |
| `src/SvgOutlineReader.ts`                                        | 纯读取     | 否                      | 每次重新解析；坏 XML → 空符号 + warning，不抛                      |
| `src/SvgFileDecorationProvider.ts`                               | 宿主适配   | 是                      | `workspace.fs.stat` 后委托判定；异常静默为无标记                   |
| `src/SvgDocumentSymbolProvider.ts`                               | 宿主适配   | 是                      | `document.positionAt` 转 `Range`；`DocumentSymbol` 树              |
| `src/SvgExtension.ts` / `src/extension.ts`                       | 注册组合根 | 是                      | 注册两个 Provider、输出通道、`Disposable` 释放                     |
| `types/`                                                         | —          | —                       | #11 已删除临时声明，#3 的 `types/vscode.d.ts` 不再存在             |
| `test/SvgFileDecorator.test.ts`                                  | 独立测试   | 否                      | 7 项：扩展名、目录、链接、scheme、隐藏/中文路径、退化路径          |
| `test/SvgOutlineModel.test.ts`                                   | 独立测试   | 否                      | 9 项：标签、容器/叶子、顺序、未知标签、selection 包含与回退        |
| `test/SvgSyntaxOutlineMapper.test.ts`                            | 独立测试   | 否                      | 5 项：span 搬运、真实解析、CRLF/中文/emoji、同行多元素、坏 XML     |
| `test/SvgOutlineReader.test.ts`                                  | 独立测试   | 否                      | 4 项：坏 XML warning、编辑刷新、标签、selection 包含               |
| `build.mjs`                                                      | 构建       | —                       | esbuild 单文件入口，内联 svg-xml 与 xmldom，`vscode` 保持 external |
| `examples/`、`.vscode/launch.json`、`.vscodeignore`、`README.md` | 示例与打包 | —                       | 见第 3、7 节                                                       |

依赖：运行时唯一内部依赖 `@svgframe/svg-xml`（`"*"`）；开发依赖 `@types/vscode@1.140.0`、`esbuild@0.28.2`、`@vscode/vsce@4.1.1`。VSCode 扩展的 `name` 不能带 npm 作用域，因此用 `vscode-svg` 而不是 `@svgframe/vscode-svg`。

## 2. 安装与启动

前置：Node 24+（本机 v26.13.0）、`npm ci`、VSCode 1.143.1 或更新版本。

```powershell
# 依赖与工作区（根目录）
npm ci

# 编译 + 打包成单文件入口 dist/extension.js（tsc 后 esbuild）
npm run build -w vscode-svg

# 单测（纯判定/模型/映射/读取 + 已有的装饰器测试）
npm test -w vscode-svg
```

方式 A（F5 调试）：把 `apps/vscode-svg` 作为文件夹打开，运行 `.vscode/launch.json` 的 `Run SVG extension (Extension Development Host)`；它把 `examples` 作为开发宿主工作区。

方式 B（命令行，推荐用于证据）：用独立 profile 启动，避免影响正在使用的 VSCode 窗口：

```powershell
$root = 'E:\develop\svg-editor-platform'
$tmp  = Join-Path $env:TEMP 'svgframe-vscode-11'
& 'D:\Program Files\Microsoft VS Code\bin\code.cmd' --new-window `
  --user-data-dir="$tmp\userdata" --extensions-dir="$tmp\extensions" `
  --disable-workspace-trust --remote-debugging-port=9333 `
  --extensionDevelopmentPath="$root\apps\vscode-svg" `
  "$root\apps\vscode-svg\examples"
```

- `--extensionDevelopmentPath` 指向扩展包目录；宿主读取 `package.json` 的 `main`（打包后的 `dist/extension.js`）。
- `--user-data-dir`/`--extensions-dir` 隔离配置与扩展；结束只关闭本次启动的进程。
- 真实验证时在隔离 profile 写 `{ "window.zoomLevel": 2 }`（后来用 `View: Zoom Out` 调到 1）以便截图辨认，不修改被测代码。

方式 C（安装 VSIX）：见第 7 节。

## 3. 示例工作区

`apps/vscode-svg/examples/` 是开发宿主工作区，同时用于 Outline 演示：

| 条目                              | 用途                                                     | 期望结果                     |
| --------------------------------- | -------------------------------------------------------- | ---------------------------- |
| `plain.svg`                       | 普通 SVG（`rect#frame`、`text#caption`）                 | 标记 `[]`；Outline 3 行      |
| `nested/groups.svg`               | 嵌套分组（`g#flow`、无 id 的 `g`）、中文/emoji、同行元素 | 标记 `[]`；Outline 6 行      |
| `broken.svg`                      | 不完整 XML                                               | 标记 `[]`；Outline 空 + 警告 |
| `.hidden.svg`                     | 点开头的隐藏文件                                         | 标记 `[]`                    |
| `.hidden/hidden.svg`              | 隐藏目录内 SVG（Explorer 未展开）                        | 目录收起                     |
| `plain.txt`、`README.md`          | 普通文本文件                                             | 无标记                       |
| `.hidden/`、`.vscode/`、`nested/` | 目录                                                     | 无标记                       |

`examples/.vscode/settings.json` 设置 `"workbench.editorAssociations": { "*.svg": "default" }`。VSCode 1.143 默认用图片预览打开 SVG，而图片预览没有文本 Outline；显式关联默认（文本）编辑器后，`*.svg` 才以 Text Editor 打开，Outline 与点击定位才有意义。

## 4. 宿主注册与回调职责

1. 扩展清单声明 `activationEvents: ["onStartupFinished"]`；宿主启动完成后调用 `activate()`。
2. `SvgExtension` 创建 “SVGFrame SVG” 输出通道，注册 `FileDecorationProvider` 与 `DocumentSymbolProvider`（文档选择器 `{ scheme: 'file', pattern: '**/*.svg' }`），并保存全部 `Disposable`。
3. Explorer 渲染/刷新某个条目时调用 `provideFileDecoration(uri, token)`：只处理 `file` scheme，`workspace.fs.stat` 取真实类型后委托 `SvgFileDecorator`；失败（条目消失、权限、远端）静默返回无标记。
4. 文本编辑器打开或编辑 SVG 时调用 `provideDocumentSymbols(document)`：**每次重新解析** `document.getText()`（无缓存），把符号模型转成 `DocumentSymbol`；无法解析时返回空数组，并把 `SVG outline unavailable: …` 写入输出通道。
5. `deactivate()` 释放输出通道与所有 Provider，不遗留监听。

回调是按需的：Explorer 不显示条目/文档未打开时宿主不会调用；单次装饰一次 `stat`，以正确性优先。

## 5. Decorator 与 Adapter 角色差异

| 维度     | 判定/模型层（`SvgFileDecorator`、`SvgOutlineModel`、映射与读取） | 宿主适配层（两个 Provider）                       |
| -------- | ---------------------------------------------------------------- | ------------------------------------------------- |
| 输入     | 中立值：`{ fsPath, scheme, fileType }`、`OutlineNode`            | `vscode.Uri`、`vscode.TextDocument`、`FileSystem` |
| 输出     | `FileBadge`、`OutlineSymbol`（offset 级）                        | `FileDecoration`、`DocumentSymbol`（`Range`）     |
| 依赖     | 无平台 API（映射器只 import svg-xml），`node:test` 可覆盖        | 只在 Extension Host 内可用，靠真机证据验证        |
| 职责     | 判定“是否 SVG/显示什么”、符号结构与标签规则                      | 类型转换、I/O、异常吞并、警告输出、生命周期释放   |
| 变化影响 | 规则/标签/selection 策略只改这一层                               | 宿主 API 或选择器变化只改这一层                   |

Provider 内不写 `if (tag === …)` 之类的业务规则；#11 的 Outline 没有复用 CLI 严格导入器，也没有引入 VSCode 之外的抽象泄漏。

## 6. Outline 模型、Range 与编辑刷新

- **输入**：`@svgframe/svg-xml` 的 `parseSvgSyntax(source)` 返回 `{ ok: true; root } | { ok: false; message }`；元素带 `tag`、可选原始 `id`、子元素，以及 `outerSpan`/`startTagSpan`/`nameSpan`。偏移是 0-based UTF-16 code unit、end 独占（见 [ADR-0008](adr/0008-neutral-xml-syntax.md)）。
- **映射**：`SvgSyntaxOutlineMapper` 是唯一 import svg-xml 的文件，只逐字段搬运 span 与 tag/id/children，不搜索标签文本、不补 id、不套 CLI 白名单；未知标签与重复标签原样保留。
- **模型**：`SvgOutlineModel` 输出单根符号树；有 id 为 `tag#id`，无 id 为 `tag`；有元素子节点为容器（`Object`），否则为叶子（`Field`）；根也显示。
- **Range**：`range` = `outerSpan`（整个元素），`selectionRange` = `startTagSpan`（整个开始标签），并强制 `selectionRange ⊆ range`；非法 span 回退到 `range`。宿主 Provider 用 `document.positionAt(offset)` 一次转换，CRLF/中文/emoji/同行多元素都由 UTF-16 偏移自然覆盖，不重新搜索源码。
- **定位**：VSCode 点击 Outline 符号时把光标放到 `selectionRange.start`；本实现对 `circle#dot` 实测从 `Ln 1, Col 1` 跳到 `Ln 5, Col 7`（开始标签 `<` 所在列）。
- **与 ADR-0008 的差异**：ADR-0008 建议 `nameSpan` → `selectionRange`；本节点按验收“点击定位开始标签”使用 `startTagSpan`（`nameSpan ⊆ startTagSpan ⊆ outerSpan`，两者都落在开始标签内）。若复核要求只选标签名，改 `SvgOutlineModel.selectionOf` 一行即可。
- **编辑刷新**：Provider 每次调用重新解析、不缓存；真实宿主中在第 13 行插入 `<rect id="added"/>` 后，Outline 立即多出 `rect#added`（未保存，磁盘文件未变）。
- **不完整 XML**：`broken.svg` 在真实宿主中 Outline 显示 “No symbols found in document 'broken.svg'.”，扩展不崩溃；警告写入输出通道，单测断言 warning 文案与空符号。

## 7. 打包与 VSIX 干净安装

- `build.mjs` 用 esbuild 把 `dist/src/extension.js` 与 `@svgframe/svg-xml`（含 `@xmldom/xmldom`）内联成单文件 `dist/extension.js`（约 234 KB），`vscode` 保持 external。
- `.vscodeignore` 是白名单：`**` 排除其余文件，只放行 `package.json`、`README.md`、`dist/extension.js`；`vsce ls --no-dependencies` 已核对只有这三个内容文件。
- `npm run package -w vscode-svg` → `dist/svgframe.vscode-svg.vsix`（54 381 字节，SHA256 `0E1B6CBD…C4CEB`，5 个 VSIX 条目）。VSIX **不入库**，可由锁文件版本重新生成。
- 干净环境验证（无 `--extensionDevelopmentPath`、无 workspace 链接；扩展装进临时 `--extensions-dir`，工作区是 `examples` 的复制）：`--install-extension` → `--list-extensions` 显示 `svgframe.vscode-svg@0.2.0` → 启动后标记与 Outline 正常 → `--uninstall-extension` 后列表为空。完整命令、日志、哈希与卸载说明见 [安装证据](evidence/vscode/install/clean-env.md) 与 [VSIX 清单](evidence/vscode/install/vsix-files.txt)，运行截图为 [clean-env-run.png](evidence/vscode/install/clean-env-run.png)。
- 依赖选择：`@types/vscode@1.140.0` 是 npm 上最近的**已发布旧版本**（1.141–1.143 未发布），保证用到的 API 在 1.143 宿主中存在；不是官方 1.143 类型，`engines.vscode` 仍为 `^1.143.0`。

## 8. Phase 1 复用评估（解析 / 模型 / 遍历）

结论：**Phase 1 的解析器、领域模型与遍历都不适合 Outline，本节点复用的是中立的语法层与 VSCode 文件能力；不复用 CLI 严格导入器。**

- **解析**：`src/infrastructure/XmlSvgCodec.ts` 是严格语义层，要求根为 `svg`、拒绝未知标签/`style`/事件属性、为无 `id` 元素补 id 并产生 warning，解析失败直接抛 `DomainError`；它基于 `@xmldom/xmldom`，而 DOM 节点不携带源码偏移/行列，无法支持点击定位。Outline 需要相反行为（允许无 id、未知标签、坏 XML 返回空大纲），因此不复用。
- **模型**：Phase 1 `SvgDocument`/`Shape` 是可编辑领域对象，`tag`/`id`/父子结构在导入时已被规范化（补 id、转换换），与源码位置脱钩；Outline 若建在它上面会丢失“无 id/未知标签/原始位置”，违反 VS-02/VS-03。VSCode 侧不需要 `@svgframe/core`。
- **遍历**：`SvgImportContext`/`SvgTransform` 做属性继承与累计变换规范化，属于语义恢复（#13）范畴，与 Outline 的源码结构无关；语法树的遍历由 `SvgOutlineModel` 递归完成，不使用领域树。
- **可复用部分**：示例工作区（嵌套/无 id/中文/emoji/同行/损坏 XML）与“编辑→Outline 刷新”的验证方法；`packages/svg-xml` 的偏移约定由 #6 交付，本节点只做 UTF-16 → `Range` 转换。

## 9. 原生 Outline 观察（#3 观察 → #11 实测）

- #3 只注册 `FileDecorationProvider`：观察到 `plain.svg` 以 Text Editor 打开（随后具备文本 Outline 的条件），但 Outline 视图内容未观察到，按“未执行”记录。
- #11 注册 `DocumentSymbolProvider` 后实测：`nested/groups.svg` 的原生 Outline 显示 `svg`、`g#flow`、`g`、`circle#dot`、`rect`、`text`（DOM 读取为 `svg (object)` 等，见第 6 节与 [outline.png](evidence/vscode/outline.png)）。
- 与 #6 的边界：语法层给偏移、VSCode 只做转换；`broken.svg` 的空大纲与警告见第 6 节与 [outline-broken.png](evidence/vscode/outline-broken.png)。

## 10. 验证结果与证据

实际执行（2026-11-25，Windows 10 19045 x64，Node v26.13.0，VSCode 1.143.1）：

| 检查                                                 | 结果                                                              |
| ---------------------------------------------------- | ----------------------------------------------------------------- |
| `npm run build -w vscode-svg`                        | exit 0；`dist/extension.js` 234.5 KB（esbuild 单文件）            |
| `npm test -w vscode-svg` / `node --test dist/test/*` | 25 项通过（7 装饰器 + 9 模型 + 5 映射 + 4 读取）                  |
| `npm run build:packages`                             | exit 0（库包；apps 不由 solution 构建，见 ADR-0007）              |
| `npm run test:packages`                              | 通过（含 vscode-svg 的 25 项与 core/svg-xml/host/dsh 的包内测试） |
| `node scripts/check-docs.mjs`                        | 通过（文档链接与仓库布局检查）                                    |
| 根 `npm run check`                                   | 通过（格式、文档、Phase 1 回归、工作区构建/测试、架构边界）       |
| 真实 Extension Host Outline                          | 6 个符号正确显示；点击 `circle#dot` 从 Ln 1 跳到 Ln 5, Col 7      |
| 真实宿主编辑刷新                                     | 插入 `<rect id="added"/>` 后 Outline 立即出现 `rect#added`        |
| 真实宿主坏 XML                                       | `broken.svg` Outline 为空并显示 “No symbols found”，扩展不崩溃    |
| VSIX 干净安装                                        | `--install-extension` → 列表 → 运行 → 卸载 全部成功               |

证据：

- [badge.png](evidence/vscode/badge.png)：Explorer 的 `[]` 标记（#3）。
- [outline.png](evidence/vscode/outline.png)：原生 Outline、`tag#id`、`circle#dot` 选中、开始标签定位与面包屑。
- [outline-edit-refresh.png](evidence/vscode/outline-edit-refresh.png)：编辑后 Outline 新增 `rect#added`（未保存）。
- [outline-broken.png](evidence/vscode/outline-broken.png)：不完整 XML 的空大纲提示。
- [安装证据](evidence/vscode/install/clean-env.md)、[VSIX 清单](evidence/vscode/install/vsix-files.txt)、[干净运行截图](evidence/vscode/install/clean-env-run.png)。

## 11. 未执行与限制

- 真实宿主只逐一点击验证了 `circle#dot` 的定位；其余 5 个符号的 `range`/`selectionRange` 由单测覆盖，未逐个点击截图。
- 真实宿主的编辑刷新只验证了插入元素；删除/重排/非法输入的刷新由单测覆盖（同一 `read` 路径），未逐项在宿主复现。
- 只在本机 VSCode 1.143.1 + Windows 10 验证；未在其它版本、远程/Web、非 Windows 复跑。
- `@types/vscode` 为 1.140.0（最近已发布旧版），不是宿主 1.143 的精确类型；若未来升级需重新编译核对。
- VSIX 不入库；干净环境卸载后目录被标记 `.obsolete`，由 VSCode 下次启动清理（权威状态是 `--list-extensions` 为空）。
- 采集脚本（CDP/窗口捕获）未入库：依赖桌面、窗口焦点与 profile 状态，按记录只保留结果与手工步骤。
