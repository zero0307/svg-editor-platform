# DSH 版本固定与最小插件生命周期（TASK-DSH-01）

本页记录 `apps/dsh-plugin` 依赖的 DSH 事实。版本变化视为需要重新执行本页验证的变更。

## 固定版本

- 发行版：DeepSeek Harness（DSH）**0.2.2-rc.5**。
- 本机安装：Desktop 应用 `DeepSeek Harness`，运行时清单
  `resources/app.asar/dsh/package.json`（`@deepseek-ai/dsh-desktop-runtime`）
  与 CLI 包 `resources/app.asar/dsh/node_modules/@deepseek-ai/dsh/package.json`
  的 `version` 均为 `0.2.2-rc.5`。
- 公共 npm 上 `@deepseek-ai/dsh` 的 `latest` 同为 `0.2.2-rc.5`，
  因此可用 `npm i -D @deepseek-ai/dsh@0.2.2-rc.5` 复现同一版本。
- Node：本机实测运行时为 Node **24.21.0**（Desktop 内置）；
  仓库 `engines.node` 为 `>=22`，插件包本身不引入额外 Node 要求。

## 安装命令

本任务**不使用** `plugin add` 安装到用户 profile，也不改用户
`%USERPROFILE%\.dsh`。可复现流程（临时目录，可随时删除）：

```powershell
# 1. 隔离的 DSH_HOME
$env:DSH_HOME = "$env:TEMP\dsh-wu-test"
# 2. 用 Desktop 的 Electron 当 Node 跑打包内的 CLI（无需全局 dsh）
$env:ELECTRON_RUN_AS_NODE = '1'
$bin = '...\resources\app.asar\dsh\node_modules\@deepseek-ai\dsh\lib\bin.js'
& "$env:DSH_NODE_EXECUTABLE" $bin --profile wu-test --from-default-profile headless --dump-config
# 3. 把 apps/dsh-plugin 复制进临时 profile 的 node_modules，并在
#    profiles/wu-test/package.json 的 dsh.profile.bundles 追加
#    "@svgframe/dsh-plugin"，依赖写 "0.1.0"（临时 profile 才允许这样做）
# 4. 组合结果
& "$env:DSH_NODE_EXECUTABLE" $bin --profile wu-test --dump-config   # 出现 "# == @svgframe/dsh-plugin"
# 5. 真实加载
& "$env:DSH_NODE_EXECUTABLE" $bin --profile wu-test headless ping
```

`DSH_NODE_EXECUTABLE` 是 Desktop 的 GUI 子系统程序，PowerShell 中需用
`Start-Process -Wait -RedirectStandardOutput` 捕获输出，直接用 `&` 不可靠。

## 临时 profile 边界与恢复

- 只写 `$env:TEMP\dsh-wu-test`；用户 profile `C:\Users\<user>\.dsh\profiles\desktop`
  全程未读改（本任务未调用 `plugin add`，也未改其 `cordis.patch.yml`）。
- 恢复：`Remove-Item -Recurse -Force "$env:TEMP\dsh-wu-test"`，并在同一 shell
  用 `Remove-Item Env:DSH_HOME` / `Remove-Item Env:ELECTRON_RUN_AS_NODE` 还原。
- 删除临时目录后本机 DSH 状态与验证前一致。

## 官方 API（按 0.2.2-rc.5 实测）

已验证：

- Bundle = `package.json` 的 `dsh.bundle.patch` 指向 YAML patch；行形状
  `- insert: [{ id, name, config }]`，组合结果在 `--dump-config` 中可见。
- 插件模块导出 `apply(ctx, config)`，可配 `export const inject = ['tools']`；
  注册必须发生在 `ctx.effect(...)` 内，清理函数在卸载时被调用。
- 工具注册：`ctx.tools.register(defineTool({...}))`，`defineTool` 来自
  `@deepseek-ai/dsh-tools`；`parameters` 为 `名字 → { type, required?, description }`，
  `output.schema` 为内联 JSON Schema，`output.render(args, value)` 返回
  `[{ type: 'text', text }]`；`execute(args, exec)` 收到 `exec.signal`。
- `ctx.tools.get(name)` 可读回注册结果；卸载后读回为 `undefined`（见证据）。
- 工具层可完全脱离宿主，用 fake `ctx` 与 fake `EditorSessionPort` 测试。

未验证（本任务未执行，不写入结论）：

- 模型侧真实调用（headless 需要 `DEEPSEEK_API_KEY`，本机没有凭据，退出码 1）。
- `ctx.fs` 注入：本插件不读文件，未在本任务中调用宿主文件能力；
  插件仍遵守"业务不直接用 Node fs"的边界。
- HMR 热替换、`plugin add`/`remove` 的 pnpm 流程（临时环境无 `pnpm`）。

## 已知 API 差异

- DSH 工具是 `defineTool` + `output.schema` 的结构化契约，**不是**本项目 CLI 的
  `PluginModule`/`contributes`/`activate` 形状，禁止套用。
- 打包 profile 内不能直接 `import '@deepseek-ai/dsh-tools'`：本插件先按普通解析、
  再按 `DSH_INSTALL_DIR` 锚点解析；workspaces 建立后应改为正式依赖声明。
- `plugin add` 需要 `pnpm`；没有 pnpm 时只能手工装配临时 profile（仅限临时目录）。
