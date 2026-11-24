# VSCode 扩展实践（#3 文件标记）

本文记录 #3（`TASK-VSC-01`）的实际实现与真实验证：扩展骨架、Explorer 的 `[]` 文件标记、示例工作区与启动步骤。Outline 属 #11，本文只记录当前观察与 Phase 1 复用评估；未执行的项目在末尾明确列出，不用计划或历史描述代替结果。

## 1. 范围与目录

`apps/vscode-svg` 是独立构建的 VSCode 扩展包，按 [ADR-0009](adr/0009-vscode-adapter-boundary.md) 拆成判定与适配两层：

| 文件                                                | 角色         | 是否 import `vscode` | 说明                                                                 |
| --------------------------------------------------- | ------------ | -------------------- | -------------------------------------------------------------------- |
| `src/DecoratedFile.ts`                              | 纯数据契约   | 否                   | Explorer 条目的中立描述与标记结果                                    |
| `src/SvgFileDecorator.ts`                           | 纯判定       | 否                   | 普通 SVG 文件 → `[]`；目录、非 SVG、非 `file` scheme 一律无标记      |
| `src/SvgFileDecorationProvider.ts`                  | 宿主适配     | 是                   | `workspace.fs.stat` 得到真实类型后委托判定类，失败静默返回无标记     |
| `src/SvgExtension.ts`                               | 注册组合根   | 是                   | 注册 provider，保存 `Disposable`，`deactivate` 时释放                |
| `src/extension.ts`                                  | 扩展入口     | 是                   | `activate`/`deactivate`，只做实例生命周期，不写业务判断              |
| `types/vscode.d.ts`                                 | 临时类型声明 | —                    | 本节点不新增依赖，用最小声明保持 strict 编译；#11 换 `@types/vscode` |
| `test/SvgFileDecorator.test.ts`                     | 独立测试     | 否                   | `node:test` 直接测判定层，不需要 Extension Host                      |
| `examples/`、`.vscode/launch.json`、`.vscodeignore` | 示例与启动   | —                    | 见第 2、3 节                                                         |

包名使用 `vscode-svg`（publisher `svgframe`，扩展 id `svgframe.vscode-svg`）。VSCode 扩展的 `name` 不能带 npm 作用域，因此没有采用 `@svgframe/vscode-svg`；workspaces 注册与根构建入口由 #5 决定，本节点不修改根 `package.json`、锁文件或根 `tsconfig.json`。

## 2. 安装与启动

前置：Node 24+（本机 v26.13.0）、根依赖已安装（`npm ci`）、VSCode 1.143.1 或更新版本。

```powershell
# 1) 编译扩展（ESM，输出到 apps/vscode-svg/dist/，已被 .gitignore 忽略）
npx tsc -p apps/vscode-svg/tsconfig.json

# 2) 单测（判定层，无需 VSCode）
node --test "apps/vscode-svg/dist/test/*.test.js"
```

方式 A（F5 调试）：把 `apps/vscode-svg` 作为文件夹打开，运行 `.vscode/launch.json` 的 `Run SVG extension (Extension Development Host)`；它把 `examples` 作为开发宿主工作区。

方式 B（命令行，推荐用于证据）：用独立 profile 启动，避免影响正在使用的 VSCode 窗口：

```powershell
$root = 'E:\develop\svg-editor-platform'
$tmp  = Join-Path $env:TEMP 'svgframe-vscode-3'
& 'D:\Program Files\Microsoft VS Code\bin\code.cmd' --new-window `
  --user-data-dir="$tmp\userdata" --extensions-dir="$tmp\extensions" `
  --disable-workspace-trust `
  --extensionDevelopmentPath="$root\apps\vscode-svg" `
  "$root\apps\vscode-svg\examples"
```

要点：

- `--extensionDevelopmentPath` 指向扩展包目录；宿主读取其 `package.json` 的 `main`（编译产物）并激活。
- `--user-data-dir`/`--extensions-dir` 指向临时目录，和用户已有实例完全隔离；结束时只关闭本次启动的进程。
- 本节点真实验证时在被隔离 profile 的 `User/settings.json` 写入 `{ "window.zoomLevel": 2 }`，仅用于放大 Explorer 文字以便截图辨认 `[]`；不修改被测代码，也不影响其他 profile。

方式 C（安装 VSIX）：属 #11，本节点不产出 VSIX。

## 3. 示例工作区

`apps/vscode-svg/examples/` 是开发宿主工作区，同时供 #11 的 Outline 复用：

| 条目                              | 用途                                                     | 期望标记     |
| --------------------------------- | -------------------------------------------------------- | ------------ |
| `plain.svg`                       | 普通 SVG（带 `id`）                                      | `[]`         |
| `nested/groups.svg`               | 嵌套分组、无 `id` 元素、中文与 emoji、同一行多元素       | `[]`         |
| `broken.svg`                      | 不完整 XML，确认标记不因内容错误抛异常（Outline 属 #11） | `[]`         |
| `.hidden.svg`                     | 点开头的隐藏文件，确认隐藏路径正常判定                   | `[]`         |
| `.hidden/hidden.svg`              | 隐藏目录内的 SVG（Explorer 中未展开，判定由单测覆盖）    | （目录收起） |
| `plain.txt`                       | 普通文本文件                                             | 无           |
| `README.md`                       | 普通 Markdown 文件                                       | 无           |
| `.hidden/`、`.vscode/`、`nested/` | 目录                                                     | 无           |

`examples/.vscode/settings.json` 设置 `"workbench.editorAssociations": { "*.svg": "default" }`。VSCode 1.143 默认用图片预览打开 SVG，而图片预览没有文本 Outline，也不适合观察源码；显式关联默认（文本）编辑器后，`plain.svg` 才以 Text Editor 打开。这是 #11 点击定位与编辑刷新的前置条件。

## 4. 宿主注册与回调职责

1. 扩展清单声明 `activationEvents: ["onStartupFinished"]`；宿主启动完成后调用 `activate()`。
2. `activate()` 构造 `SvgExtension`，后者把 `SvgFileDecorationProvider` 注册到 `window.registerFileDecorationProvider`，并保存返回的 `Disposable`。
3. 宿主在渲染或刷新 Explorer 条目时调用 `provideFileDecoration(uri, token)`；本实现只处理 `file` scheme，先用 `workspace.fs.stat` 取真实条目类型（目录、普通文件、符号链接、其他），再委托 `SvgFileDecorator.decide`。
4. 返回 `FileDecoration` 时 Explorer 在文件名后追加 badge（本节点固定 `[]`，`tooltip` 为 `SVG document`）；返回 `undefined` 表示不加任何标记。目录、非 SVG、非 `file` scheme 都是 `undefined`。
5. `stat` 失败（条目已删除、权限、远端 URI）被捕获并当作“无标记”，不向宿主抛异常，因此浏览多目录或隐藏目录不会中断。
6. `deactivate()` 释放全部 `Disposable`，不遗留 provider。

回调是按需的：Explorer 不显示该条目时宿主不会调用；本实现不缓存判定结果（每次一次 `stat`），以正确性优先，示例规模下无需优化。

## 5. Decorator 与 Adapter 的角色差异

| 维度     | `SvgFileDecorator`（Decorator/判定）       | `SvgFileDecorationProvider`（Adapter/适配） |
| -------- | ------------------------------------------ | ------------------------------------------- |
| 输入     | 中立值 `{ fsPath, scheme, fileType }`      | `vscode.Uri` + 宿主 `FileSystem`            |
| 输出     | `FileBadge \| undefined`                   | `vscode.FileDecoration \| undefined`        |
| 依赖     | 无平台 API，`node:test` 可直接覆盖         | 只在 Extension Host 内可用，靠真机激活验证  |
| 职责     | 判定“什么算 SVG 普通文件、显示什么标记”    | 类型转换、I/O、异常吞并、生命周期释放       |
| 变化影响 | 调整规则（大小写、扩展名、scheme）只改此层 | 宿主 API 变化（如 `stat` 签名）只改此层     |

设计意图与 [ADR-0009](adr/0009-vscode-adapter-boundary.md) 一致：把可测试的判定与不可离线运行的适配分开。装饰器负责“附加展示”，适配器负责“平台翻译”；Provider 内不写 `if (svg)` 之类的业务规则。#11 的 `SvgOutlineModel` 与 `DocumentSymbolProvider` 沿用同一分工。

## 6. Phase 1 复用评估

结论：**Phase 1 的严格 SVG 导入器不能用于 Outline，本节点直接复用的是 VSCode 的文件/URI 能力与 Phase 1 之外的中立语法层**。

- `src/infrastructure/XmlSvgCodec.ts` 是严格语义层：要求根元素为 `svg`、拒绝未知标签与 `style`/事件属性，会为无 `id` 元素补 id 并产生 warning，并且解析失败直接抛 `DomainError`。Outline 需要相反的行为（允许无 id、允许 CLI 暂不支持的标签、不补 id、坏 XML 返回空大纲），直接复用会违反 VS-02/VS-03。
- 位置能力不可复用：该 codec 基于 `@xmldom/xmldom`，DOM 节点不携带源码偏移/行列，无法支持点击定位；按架构第 7 节，源码范围由 `packages/svg-xml` 的中立语法入口提供（#6），VSCode 只把 UTF-16 偏移转成 `Range`。
- `SvgImportContext`/`SvgTransform` 做属性继承与累计变换规范化，属语义恢复（#13）范畴，与 Outline 的源码结构无关。
- `SvgString`/`Numbers` 等纯工具与 Outline 无关；VSCode 侧不需要引入 `@svgframe/core`。
- 可复用的部分是 #11 的输入约定与示例：本示例工作区的嵌套/无 id/中文/emoji/同一行多元素/损坏 XML 文件可直接作为 Outline 的真实宿主演示素材。

## 7. 原生 Outline 观察（本节点只观察）

本节点只注册 `FileDecorationProvider`，没有注册 `DocumentSymbolProvider`。已实际观察：

- 通过 `examples/.vscode/settings.json` 的编辑器关联，`plain.svg` 在本机 1.143.1 的开发宿主中以 **Text Editor** 打开（截图中可见 `plain.svg` 文本与行号），因此具备后续显示文本 Outline 的条件。
- **未观察到 Outline 视图内容**：本轮尝试用命令面板键盘输入聚焦 Outline（剪贴板粘贴命令名后回车）未成功，视图未展开，也没有取得可核验的提示文本。按“未执行”记录，不用推断或设计图代替。Outline 的真实行为在 #11 注册 `DocumentSymbolProvider` 后连同点击定位一起实测。
- 默认情况下 `*.svg` 会落到图片预览（1.143 的默认行为）；本仓库示例通过显式文本关联避开该路径。该默认行为本轮未单独截图复现。

## 8. 验证结果与证据

实际执行（2026-11-24，Windows 10 19045 x64，Node v26.13.0，VSCode 1.143.1）：

| 检查                                                | 结果                                                                                          |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `npx tsc -p apps/vscode-svg/tsconfig.json`          | exit 0（strict，无输出）                                                                      |
| `node --test "apps/vscode-svg/dist/test/*.test.js"` | 7 项通过、0 失败                                                                              |
| 真实 Extension Host（隔离 profile）                 | 启动成功；`exthost.log` 记录 `svgframe.vscode-svg` 以 `onStartupFinished` 激活                |
| Explorer 观察                                       | `.hidden.svg`、`broken.svg`、`plain.svg` 显示 `[]`；`plain.txt`、`README.md` 与三个目录无标记 |
| `node scripts/check-docs.mjs`                       | 通过（文档链接与仓库布局检查）                                                                |
| 根 `npm run check`                                  | 通过（格式、文档、Phase 1 回归与架构检查；不覆盖 `apps/`，原因见第 9 节）                     |

证据：

- [badge.png](evidence/vscode/badge.png)：真实运行截图的 Explorer 区域裁剪（隐藏文件、不完整 XML、普通 SVG 显示 `[]`；文本/Markdown/目录无标记）。
- [证据记录](evidence/vscode/README.md)：完整命令、隔离 profile、激活日志原文与未执行项。

## 9. 未执行与限制

- Outline、`selectionRange` 与 VSIX 干净安装属 #11，本节点未实现、未验证。
- 根 `npm run check`/CI 目前不编译也不测试 `apps/vscode-svg`（根 `tsc` 只含 `src/`+`test/`，architecture 检查只扫 `src/`），包内命令是本节点唯一可复现入口；工作区入口与检查接入由 #5 建立。
- `types/vscode.d.ts` 是最小临时声明，不是官方类型；#11 安装 `@types/vscode` 后删除并重新编译，届时才核对该 API 子集与真实类型一致。
- 未在 Windows 10 19045 之外复跑；扩展逻辑无平台相关分支，但真实宿主截图仅本平台。
- 未提交采集脚本：桌面/输入法状态相关，按记录只保留结果与手工步骤（见 [VSCode 与 DSH 板块记录](records/2026-11-24-vscode-dsh.md) 的遗留说明）。
