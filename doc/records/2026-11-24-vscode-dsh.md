# 2026-11-24 VSCode 与 DSH 板块记录

本轮完成 #3、#11（VSCode）与 #4、#16（DSH），并复核 #6（XML 语法入口）。

## 1. 决策

- VSCode 侧把“判定”和“宿主适配”分成四个文件（`SvgFileDecorator`／`SvgOutlineModel` 与两个 Provider），判定逻辑因此可在 `node:test` 里跑；见 [ADR-0009](../adr/0009-vscode-adapter-boundary.md)。
- VSCode 扩展用 esbuild 内联语法包与 xmldom，VSIX 只有 5 个文件，不需要目标机 `npm install`。
- DSH 侧固定 `@deepseek-ai/dsh@0.2.2-rc.5`，插件运行时内联进 `dist/src/session.cjs`，清单零运行时依赖；见 [ADR-0010](../adr/0010-dsh-plugin-boundary.md)。
- 工具描述直接使用宿主受支持的 JSON Schema 子集，不引入 SDK 的 `defineTool`。

## 2. AI 建议检查与纠正

| 问题                                                              | 处理                                                                                                              |
| ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| 曾假定 `EditorSession.init()` 返回根容器 id                       | 实际返回 `canvas 320x160 created` 状态文本；改为不给 `parentId` 即挂文档根，真实宿主报错暴露了该假设              |
| 曾把节点标签创建为 `rect` 的子节点                                | 宿主报 `not a container: start`；编辑器只有 `g` 是容器，改为同级 `text` 并用坐标定位                              |
| 曾把 `output.schema.counts.additionalProperties` 写成 schema 对象 | 宿主抛 `JsonSchemaError: … must be a boolean`；改为布尔值并补记受支持子集                                         |
| 曾尝试把 SDK 的 `defineTool` 内联进 CommonJS bundle               | 加载即失败（`createRequire(import.meta.url)` 在 CJS 中失效）；改为直接提交 JSON Schema                            |
| 曾用 PowerShell `Set-Content -Encoding UTF8` 改 `package.json`    | PS 5.1 会写入 BOM，`dsh plugin add` 报 `is not valid JSON`；改用无 BOM 写入并复查首字节                           |
| 曾用 `SendKeys` 向命令面板输入命令名                              | 中文输入法把按键改写为 `Focus哦那Outline`；改为先切到英文键盘布局、必要时用剪贴板                                 |
| 曾用 `--goto` 打开 SVG 期待文本编辑器                             | VSCode 1.143 会落到图片预览，Outline 显示“cannot provide outline information”；示例工作区显式关联文本编辑器后正常 |
| 首版 DSH 工具直接用 Node 文件 API                                 | 绕过宿主路径解析、写入意图与沙箱策略；改为注入 `ctx.fs`，重跑 `verify:dsh` 并重生成证据（见第 5 节）              |

## 3. 验证结果

- `npm test -w vscode-svg`：12 通过（标记 5、大纲 7）。
- `npm test -w dsh-svg-editor`：6 通过。
- 真实宿主：VSCode 1.143.1 的 Extension Development Host 与 `@deepseek-ai/dsh@0.2.2-rc.5` 各一轮，证据见 `doc/evidence/vscode/` 与 `doc/evidence/dsh/`。
- 工作区边界：`scripts/check-workspaces.mjs` 通过，`apps/vscode-svg` 只依赖 `packages/svg-xml`。

## 4. 遗留

- VSCode 截图采集脚本依赖真实桌面与输入法状态，只保留结果与手工步骤，不作为产品代码入库。

## 5. 收口：文件访问迁到宿主 `ctx.fs`

首版 DSH 工具用 Node 文件 API，虽然验收通过，但绕过宿主的路径解析、写入意图与沙箱策略。收口时改为注入 `ctx.fs`：`resolve(path, { cwd })` → `readText`／`writeText`，存在性用 `stat`，并把“解析失败”当作“目标不存在”以免阻止新建。重跑 `verify:dsh` 后注册、调用、四类失败、并发、无 ID 警告、释放与卸载检查全部保持通过，缺失文件的报文从 Node 的 `ENOENT…` 变为宿主的 `cannot read "…": not found`，`verification.json` 已重新生成。
