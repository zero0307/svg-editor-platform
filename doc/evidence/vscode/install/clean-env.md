# #11 干净环境安装记录（干净 profile，无开发路径）

- 日期：2026-11-25
- 扩展：`svgframe.vscode-svg@0.2.0`（VSIX 由 `apps/vscode-svg/dist/svgframe.vscode-svg.vsix` 生成，54 381 字节，不入库）
- 环境：Windows 10 19045 x64；VSCode 1.143.1（commit `e646868227c3e3a9e3f24277c8c7220be42c0be7`）
- 干净隔离目录：`%TEMP%\svgframe-vscode-11-install\{userdata,extensions,workspace}`（全部在仓库外）
- “干净”的含义：扩展由 `--install-extension` 安装到临时 `--extensions-dir`，启动时不带 `--extensionDevelopmentPath`，工作区是把 `apps/vscode-svg/examples` **复制**到临时目录后的 `workspace`，运行时与仓库源码目录没有链接关系。

## 安装

```text
> code --install-extension apps/vscode-svg/dist/svgframe.vscode-svg.vsix ^
    --extensions-dir "%TEMP%\svgframe-vscode-11-install\extensions" ^
    --user-data-dir "%TEMP%\svgframe-vscode-11-install\userdata" --force
Installing extensions...
Extension 'svgframe.vscode-svg.vsix' was successfully installed.
exit 0
```

## 安装后列表

```text
> code --list-extensions --show-versions --extensions-dir ... --user-data-dir ...
svgframe.vscode-svg@0.2.0
exit 0
```

## 安装目录内容（无 workspace 链接、无 node_modules）

```text
extensions.json
svgframe.vscode-svg-0.2.0\.vsixmanifest    (2373 bytes)
svgframe.vscode-svg-0.2.0\package.json     (1025 bytes)
svgframe.vscode-svg-0.2.0\readme.md        (539 bytes)
svgframe.vscode-svg-0.2.0\dist\extension.js (240084 bytes，已内联 svg-xml 与 xmldom)
```

## 运行验证（安装版扩展，非 Extension Development Host）

```text
> code --new-window --user-data-dir ... --extensions-dir ... ^
    --disable-workspace-trust --remote-debugging-port=9334 ^
    "%TEMP%\svgframe-vscode-11-install\workspace"
> code --reuse-window ... --goto "%TEMP%\svgframe-vscode-11-install\workspace\nested\groups.svg"
```

宿主日志（`%TEMP%\svgframe-vscode-11-install\userdata\logs\20261125T130807\window1\exthost\exthost.log` 原文）：

```text
2026-11-25 13:08:09.251 [info] Extension host with pid 34000 started
2026-11-25 13:08:09.804 [info] ExtensionService#_doActivateExtension svgframe.vscode-svg, startup: false, activationEvent: 'onStartupFinished'
```

观察结果（截图 [clean-env-run.png](clean-env-run.png)）：

- 安装版扩展在干净 profile 中激活，Explorer 为 `groups.svg`、`.hidden.svg`、`broken.svg`、`plain.svg` 显示 `[]` 标记；
- 打开 `plain.svg`（文本编辑器）后，原生 Outline 显示 `svg` → `rect#frame`、`text#caption`；
- 安装版与开发版行为一致（同一 `dist/extension.js` 打包产物）。

## 卸载

```text
> code --uninstall-extension svgframe.vscode-svg --extensions-dir ... --user-data-dir ...
Uninstalling svgframe.vscode-svg...
Extension 'svgframe.vscode-svg' was successfully uninstalled!
exit 0

> code --list-extensions --show-versions --extensions-dir ... --user-data-dir ...
(无输出)
exit 0
```

说明：卸载时该临时实例仍在运行，扩展目录当时仍被进程占用；关闭实例后再次启动同一 profile，VSCode 写入
`%TEMP%\svgframe-vscode-11-install\extensions\.obsolete`（内容 `{"svgframe.vscode-svg-0.2.0":true}`）并在下次启动清理目录。
权威状态是 `--list-extensions` 为空、`extensions.json` 中不再登记该扩展；目录残留属于 VSCode 的延迟清理，不是安装未移除。

完整可复现命令与未执行项见 [证据记录](../README.md)。
