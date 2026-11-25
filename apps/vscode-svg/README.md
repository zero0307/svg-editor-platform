# SVGFrame SVG (VSCode extension)

Explorer 的 SVG `[]` 标记与原生 Outline（根/容器/叶子、`tag#id`、点击定位开始标签）。

开发、启动、打包与验证步骤见仓库文档 `doc/vscode.md`：

```powershell
npm run build -w vscode-svg       # tsc + esbuild 单文件入口
npm test -w vscode-svg            # node:test（判定层、Outline 模型、映射与读取）
npm run package -w vscode-svg     # vsce 生成 VSIX（不入库）
```

示例工作区在 `examples/`；证据在 `doc/evidence/vscode/`。
