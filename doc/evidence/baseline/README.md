# Phase 1 逐字节基线

2026-11-19 在 macOS arm64 以 Node 24.22.3、npm 11.6.2 独立检出 `final^{commit}`（`e5621a68afd4731626d54566f17ba55885d1bc0f`）。在该检出运行 `npm ci`、`npm run check`、`npm run verify:visual`。83 项测试通过，400 × 200 变换样例的差异通道数为 0。

[三个命令会话](../../transcript/)来自课程 §6、§6.1A 及错误优先级补充用例。每次在新临时目录执行，§6 的 other.svg 取自 [examples](../../../examples/other.svg)。标准输出、标准错误、退出码和两个保存的 SVG 合计 11 个文件，均从上述独立构建采集，在另一个临时目录回放逐字节通过。[原始期望产物](../../../test/fixtures/expected/)

| 输入               | 退出码 | 规格与实际输出                                                                                |
| ------------------ | ------ | --------------------------------------------------------------------------------------------- |
| cli-1              | 1      | 合法的警告与故意触发的错误都写入 stdout，继续处理后续命令。save 后的 undo 受屏障限制。        |
| flowchart-a        | 0      | 保留实际树行间距及移动反馈。undo 使用 `undone:` 加原操作摘要；规格示意的是反向移动文案。      |
| errors-and-history | 1      | 未初始化时先报缺文档，失败的 set 与只读 canvas 保留已有 redo。读取不存在的 SVG 后仍能查看树。 |

兼容回归采用 final 实际字节。交互示意中的提示符、列对齐、启动版本，以及 undo/redo 的示意文案不作为管道回放期望。新功能另以 Phase 2 规格验收。目录测试使用[临时目录夹具](../../../test/fixtures/directory/setup.mjs)生成空目录、嵌套项、隐藏文件和中文名称。每轮重新创建，日志放在被列目录外。

在当前仓库执行 `npm run build` 后运行 `node scripts/replay-baseline.mjs`。要独立复核，在另一目录检出 final、安装并构建，然后从当前仓库运行以下命令。采集模式要求一个尚不存在的输出目录。

```sh
node scripts/replay-baseline.mjs --cli ../phase1/dist/src/bootstrap/main.js
node scripts/replay-baseline.mjs --cli ../phase1/dist/src/bootstrap/main.js --capture ../new-capture
```
