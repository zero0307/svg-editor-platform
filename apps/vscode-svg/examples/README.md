# VSCode 示例工作区

这个目录是 Extension Development Host 的示例工作区，用于观察 #3 的 Explorer 标记。启动与验证步骤见 [VSCode 扩展文档](../../../doc/vscode.md)。

- `plain.svg`、`nested/groups.svg`：普通 SVG 文件，应显示 `[]` 标记（后者含嵌套分组、无 `id` 元素、中文与 emoji，供 #11 的 Outline 使用）。
- `broken.svg`：不完整 XML，用于确认标记不因内容错误抛异常（Outline 属 #11）。
- `plain.txt`：普通文本文件，不应显示标记。
- `.hidden/hidden.svg`：隐藏目录内的 SVG，不应抛异常。
- `.vscode/settings.json`：把 `*.svg` 关联到默认（文本）编辑器。VSCode 1.143 默认用图片预览打开 SVG，图片预览没有文本 Outline，也不适合观察源码标记。

本目录不含生成脚本，也不保存运行日志。证据（截图与命令记录）保存在 `doc/evidence/vscode/`。
