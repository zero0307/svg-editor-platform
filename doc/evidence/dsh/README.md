# DSH 生命周期证据（TASK-DSH-01，0.2.2-rc.5）

所有命令在 **临时 DSH_HOME**（`%TEMP%\dsh-wu-test`）执行；用户
`%USERPROFILE%\.dsh` 未被修改。CLI 由 Desktop 内置 Electron 以
`ELECTRON_RUN_AS_NODE=1` 运行 `resources/app.asar/dsh/node_modules/@deepseek-ai/dsh/lib/bin.js`。

## 1. 组合加载（`--dump-config`）

退出码 0，输出中出现新增 bundle 层与行：

```
# == @svgframe/dsh-plugin
- id: svgframe-dsh-plugin
  name: '@svgframe/dsh-plugin'
  config:
    log: true
    dshVersion: 0.2.2-rc.5
```

## 2. 真实启动 / 注册 / 卸载

命令：`dsh --profile wu-test headless ping`，**退出码 1**。

stdout（原文）：

```
[svgframe-dsh] apply start (defineTool=defineTool)
[svgframe-dsh] registered svgframe_probe; registry=hit

[svgframe-dsh] disposed svgframe_probe; registry-free=true
```

stderr（原文）：

```
dsh: MISSING_CREDENTIAL: llm-deepseek: no API key for provider route "deepseek-official"; store DEEPSEEK_API_KEY through the credentials service (the web Models page writes it), or export DEEPSEEK_API_KEY in the launching environment
```

结论：真实 DSH 宿主完成了 bundle 加载、`svgframe_probe` 注册（registry=hit）、
进程退出时的 effect 释放，且释放后注册表已无该工具（registry-free=true）。
退出码 1 的原因是本机没有模型凭据，与本插件无关。

## 3. 未执行 / 未验证

- 模型侧真实工具调用：无 `DEEPSEEK_API_KEY`，未执行。
- `plugin add` / `remove` 的 pnpm 安装流程：临时环境无 `pnpm`，未执行；
  改用"复制进临时 profile node_modules + 修改临时 profile 清单"完成装配。
- 未在本机用户 Desktop profile 中做任何安装或卸载。

## 4. 复现

见 [doc/dsh.md](../../dsh.md)。
