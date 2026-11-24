# VSCode 证据记录（TASK-VSC-01 / #3）

- 日期：2026-11-24（Asia/Shanghai）
- 节点：`TASK-VSC-01`（Issue #3），板块 V
- 被测内容：`apps/vscode-svg` 首次提交；证据在提交前于工作树生成，提交内容与之一致（父提交 `75a3911`）。复核时用 `git rev-parse HEAD` 取得该提交 SHA，并可用 `git show` 核对文件内容。
- 扩展版本：`svgframe.vscode-svg` 0.1.0

## 1. 环境

| 项              | 值                                                                   |
| --------------- | -------------------------------------------------------------------- |
| 操作系统        | Windows 10 19045 x64                                                 |
| VSCode          | 1.143.1（commit `e646868227c3e3a9e3f24277c8c7220be42c0be7`）         |
| 本机 Node / npm | v26.13.0 / 12.2.1                                                    |
| 扩展宿主机 Node | v24.21.0（`exthost.log` 的 node-compile-cache 目录名记录）           |
| TypeScript      | 7.0.2（根 `node_modules`）                                           |
| 工作目录        | `E:\develop\svg-editor-platform`                                     |
| 隔离 profile    | `%TEMP%\svgframe-vscode-3\{userdata,extensions}`（仓库外，事后可删） |

## 2. 构建与单测

```text
> npx tsc -p apps/vscode-svg/tsconfig.json
exit 0（strict，无输出）

> node --test "apps/vscode-svg/dist/test/*.test.js"
tests 7 / pass 7 / fail 0 / skipped 0 / duration_ms 77.2527
```

测试覆盖：SVG 扩展名（大小写、多点、Windows 路径）、非 SVG 与伪扩展名、目录、符号链接/其他类型、非 `file` scheme、隐藏目录/空格/中文/emoji 路径、退化路径不抛异常。

## 3. 真实 Extension Host

启动命令（隔离 profile，仅本次实例）：

```powershell
$root = 'E:\develop\svg-editor-platform'
$tmp  = Join-Path $env:TEMP 'svgframe-vscode-3'
& 'D:\Program Files\Microsoft VS Code\bin\code.cmd' --new-window `
  --user-data-dir="$tmp\userdata" --extensions-dir="$tmp\extensions" `
  --disable-workspace-trust `
  --extensionDevelopmentPath="$root\apps\vscode-svg" `
  "$root\apps\vscode-svg\examples"
# 复用同一实例打开文本编辑器：
& 'D:\Program Files\Microsoft VS Code\bin\code.cmd' --reuse-window `
  --user-data-dir="$tmp\userdata" --extensions-dir="$tmp\extensions" `
  --goto "$root\apps\vscode-svg\examples\plain.svg"
```

隔离 profile 的 `User/settings.json` 写入 `{ "window.zoomLevel": 2 }`，只用于放大 Explorer 文字以便在截图中辨认 `[]`；不修改扩展代码，也不影响用户已有实例。

激活证据（`%TEMP%\svgframe-vscode-3\userdata\logs\20261124T203604\window1\exthost\exthost.log` 原文）：

```text
2026-11-24 20:36:05.664 [info] Extension host with pid 23424 started
2026-11-24 20:36:06.128 [info] Eager extensions activated
2026-11-24 20:36:06.172 [info] ExtensionService#_doActivateExtension svgframe.vscode-svg, startup: false, activationEvent: 'onStartupFinished'
```

该日志无 `[error]` 行。窗口标题为 `[Extension Development Host] plain.svg - examples - Visual Studio Code`（Exthost pid 23424，主窗口 pid 19228）。

进程隔离：结束前按命令行过滤 `Code.exe` 中 `--user-data-dir` 含 `svgframe-vscode-3` 的进程（1 个主进程 + 8 个子进程，含 exthost 23424）并逐一结束；结束后该过滤结果为 0，用户已有 VSCode 窗口未受影响。

## 4. 截图

`badge.png`（580×470）是从 1465×832 的真实窗口截图（`PrintWindow` + `PW_RENDERFULLCONTENT`）中裁剪的 Explorer 区域，坐标为原图 `(68,58)-(648,528)`，未做重绘或合成。

观察结果：

- `.hidden.svg`、`broken.svg`、`plain.svg` 三个普通 SVG 文件行尾显示 `[]`；
- `plain.txt`、`README.md` 无标记；
- `.hidden`、`.vscode`、`nested` 三个目录无标记；
- `.hidden` 目录未展开，其内部 SVG 的判定由单测（`.hidden/canvas.svg`）与 provider 的异常吞并逻辑覆盖，未做真实展开观察；
- 同时可见 `plain.svg` 以 Text Editor 打开（示例工作区把 `*.svg` 关联到默认编辑器），供 #11 的 Outline 使用。

完整窗口截图只保留在临时目录（未入库）；没有提交桌面截图采集脚本（依赖桌面与输入法状态），手工复现步骤见 [VSCode 文档](../../vscode.md)。

## 5. 未执行与原因

- Outline、`selectionRange`、编辑刷新与 VSIX 干净安装：属 #11，本节点未实现。
- Outline 视图内容观察：本轮命令面板键盘自动化未成功（视图未展开），按“未执行”记录，不用推断代替；#11 实测。
- 根 `npm run check` 的检查范围不包含 `apps/vscode-svg`（根 `tsc` 仅 `src/`+`test/`，架构检查仅 `src/`）；包内构建与测试是本节点唯一可复现入口，工作区接入由 #5 建立。
- 非 Windows 平台未复跑。
