# DSH 版本固定与工具插件（TASK-DSH-01 / TASK-DSH-02）

本页记录 `apps/dsh-plugin` 依赖的 DSH 事实、两个工具的契约、运行时装配与恢复方法。
版本或宿主 API 变化时重新执行本页验证。

## 固定版本

- 发行版：DeepSeek Harness（DSH）**0.2.2-rc.5**。
- 本机安装：Desktop 应用 `DeepSeek Harness`，运行时清单
  `resources/app.asar/dsh/package.json`（`@deepseek-ai/dsh-desktop-runtime`）与
  CLI 包 `resources/app.asar/dsh/node_modules/@deepseek-ai/dsh/package.json`
  的 `version` 均为 `0.2.2-rc.5`。
- 公共 npm 上 `@deepseek-ai/dsh` 的 `latest` 同为 `0.2.2-rc.5`，可用
  `npm i @deepseek-ai/dsh@0.2.2-rc.5` 复现同一版本。
- Node：宿主实测 **24.21.0**（Desktop 内置，经 `ELECTRON_RUN_AS_NODE` 运行）；
  仓库工具链 Node 26.13.0；仓库 `engines.node` 为 `>=22`，插件包不额外要求。

## 安装命令

不写用户 profile。可在任意干净目录（无 workspace 软链）安装：

```powershell
$env:DSH_HOME = "$env:TEMP\dsh-wu-16\home"        # 隔离的宿主状态
$env:ELECTRON_RUN_AS_NODE = '1'                    # 用 Desktop 的 Electron 当 Node
$bin = '...\resources\app.asar\dsh\node_modules\@deepseek-ai\dsh\lib\bin.js'
& "$env:DSH_NODE_EXECUTABLE" $bin --profile wu16 --from-default-profile headless --dump-config
# 把本包复制到 <DSH_HOME>\profiles\wu16\node_modules\@svgframe\dsh-plugin，
# 并在该临时 profile 的 package.json 里声明依赖和 dsh.profile.bundles
& "$env:DSH_NODE_EXECUTABLE" $bin --profile wu16 --dump-config   # 应出现 "# == @svgframe/dsh-plugin"
& "$env:DSH_NODE_EXECUTABLE" $bin --profile wu16 headless ping    # 真实加载/注册/卸载
```

`DSH_NODE_EXECUTABLE` 是 GUI 子系统程序，PowerShell 需用
`Start-Process -Wait -RedirectStandardOutput` 捕获输出，`&` 不可靠。
干净目录安装的完整命令、退出码与产物哈希见
[doc/evidence/dsh/install/README.md](evidence/dsh/install/README.md)。

## 插件产物

- 入口 `main: ./dist/plugin.js`，由 `npm run build -w apps/dsh-plugin` 生成：
  `tsc` 编译 `src/` 后，esbuild 把 `@svgframe/core`、`@svgframe/svg-xml`、
  `@svgframe/builtins` 与 `@xmldom/xmldom` 内联成单文件 ESM。
- 安装只需要 `package.json` + `cordis.patch.yml` + `dist/plugin.js`；`dist/` 不入库。

## 两个工具

### `svg_inspect`（只读）

| 项             | 内容                                                                                     |
| -------------- | ---------------------------------------------------------------------------------------- |
| 输入           | `{ path: string }`                                                                       |
| 输出           | `{ path, width, height, elements, kinds, rootChildren }`                                 |
| `kinds`        | 按 `kind` 计数，顺序固定为 rect、circle、ellipse、line、text、g，未知种类按字母序追加    |
| `rootChildren` | 根节点直接子元素的 id 列表                                                               |
| 行为           | 通过 `EditorSession.read` + `XmlSvgCodec.decode` + 六类 builtins provider 还原；不写文件 |

### `svg_create_flowchart`

| 项   | 内容                                                                                     |
| ---- | ---------------------------------------------------------------------------------------- |
| 输入 | `{ path: string, nodes: [{ id, label, x, y, width?, height? }], edges: [{ from, to }] }` |
| 输出 | `{ path, nodes, connectors, elements }`                                                  |
| 生成 | 每个节点 `<rect>` + `<text>`；每条边 `<line>`，从节点中心到中心                          |
| 默认 | 节点宽 120、高 48；画布至少 800x600，并随最大坐标 +40 边距扩张                           |
| 错误 | 空 `path`、空 `nodes`、重复节点 id、未知边端点、非正尺寸、读写失败均抛 `DomainError`     |

输出契约用**线级 JSON Schema**（对象级 `required` 数组）；输入参数用 DSH 的
author-facing 参数 DSL（属性上 `required: true`）。两者形状不同，见下节"API 差异"。

## 运行时装配与边界

- 每次调用 `SvgRuntime.create()`：新建 `ShapeProviderRegistry`，注册六类
  `defaultProviders`，配 `ProviderShapeCreationService` 与 `XmlSvgCodec`；
  模块级不持有任何可变文档，两次调用互不串状态。
- 文件访问只走注入的 `SvgFileGateway`：`ctx.fs` 绑定为 `CtxFsSvgFileGateway`
  （`resolve/stat/readText/writeText`），插件源码不 import Node `fs`。
- 插件 `inject = ['tools', 'fs']`：宿主没有 `ctx.fs` 时插件不激活（DSH 会给出
  "did not activate" 警告），不会退化到 Node 文件 API。
- 不启动 CLI 子进程、不解析终端文本；业务逻辑只依赖公开包入口。

## 官方 API（0.2.2-rc.5 实测）

- Bundle：`package.json` 的 `dsh.bundle.patch` 指向 YAML patch，行形状
  `- insert: [{ id, name, config }]`；`--dump-config` 可见。
- 插件：`export function apply(ctx, config)`，`export const inject = ['tools','fs']`，
  注册必须在 `ctx.effect(...)` 内，卸载时调用返回的清理函数。
- 工具：`ctx.tools.register(defineTool({...}))`；`parameters` 为
  `名字 → { type, required?, description }`，`output.schema` 为 JSON Schema 节点，
  `output.render(args, value)` 返回 `[{ type: 'text', text }]`。
- `ctx.fs`：`resolve(path, { signal })` → 不透明 target；`stat(target, signal)`
  （不存在返回 undefined）；`readText(target, signal)`；
  `writeText(target, content, expected?, signal?, sandboxPolicy?)`。

## 已知 API 差异（实测）

- `output.schema` 是**线级 JSON Schema**：在字段上写 `required: true` 会被宿主
  `JsonSchemaError: ... required is not supported on type "string"` 拒绝，插件不激活；
  必须改成对象级 `required: [...]`。`parameters` 才用属性级 `required: true`。
- 打包 profile 内不能直接 `import '@deepseek-ai/dsh-tools'`；本插件不依赖它，
  只按上述结构注册普通对象即可（#4 曾用 `DSH_INSTALL_DIR` 兜底解析）。
- `plugin add` 需要 `pnpm`；没有 pnpm 时只能在临时 profile 里手工装配。
- 工具不是 CLI `PluginModule`/`contributes`/`activate` 形状，禁止套用。

## 未验证

- 模型侧真实调用两个工具：本机无 `DEEPSEEK_API_KEY`，`headless` 在模型调用前
  以 `MISSING_CREDENTIAL` 退出（退出码 1）。插件注册/卸载已在真实宿主验证，
  工具业务逻辑由 fake gateway + 真实 codec/builtins 的单元测试覆盖。
- `ctx.fs` 的沙箱拒绝路径（`FS_PERMISSION_DENIED`）与审批升级未在本任务触发。
- HMR 热替换、`plugin add/remove` 的 pnpm 流程未执行。

## 临时 profile 边界与恢复

- 只写 `%TEMP%\dsh-wu-16`；用户 `%USERPROFILE%\.dsh` 未被读改。
- 恢复：`Remove-Item -Recurse -Force "$env:TEMP\dsh-wu-16"`，并
  `Remove-Item Env:DSH_HOME`、`Remove-Item Env:ELECTRON_RUN_AS_NODE`。
