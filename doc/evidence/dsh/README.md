# DSH 证据索引（TASK-DSH-01 / TASK-DSH-02）

DSH 版本：**0.2.2-rc.5**（Desktop 打包）。所有命令在临时 `DSH_HOME`
（`%TEMP%\dsh-wu-*`）执行，用户 `%USERPROFILE%\.dsh` 未被读改。

| 证据         | 路径                                                   | 内容                                                                               |
| ------------ | ------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| 干净目录安装 | [install/README.md](install/README.md)                 | 命令、版本、退出码、sha256、dump-config 与加载日志                                 |
| 组合结果     | [install/dump-config.log](install/dump-config.log)     | 真实 `--dump-config` 全文，含 `# == @svgframe/dsh-plugin`                          |
| 加载/卸载    | [install/boot.log](install/boot.log)                   | `registered svg_inspect, svg_create_flowchart` / `disposed; registry-residue=none` |
| 加载失败原因 | [install/boot.err](install/boot.err)                   | `MISSING_CREDENTIAL`（本机无 `DEEPSEEK_API_KEY`）                                  |
| 产物哈希     | [install/plugin-sha256.txt](install/plugin-sha256.txt) | `dist/plugin.js` 大小与 sha256                                                     |
| 生成样例     | [flowchart-example.svg](flowchart-example.svg)         | 3 节点 2 连线的真实产物                                                            |

## TASK-DSH-01（#4）补充

生命周期最小插件已在 #4 验证（同一打包路径）。当前 `apps/dsh-plugin` 已演进为两个
正式工具，注册/卸载路径未变，本次重新记录于 `install/`。

## TASK-DSH-02（#16）未执行项

- 模型侧真实调用两个工具：无 `DEEPSEEK_API_KEY`，`headless` 在模型调用前以
  `MISSING_CREDENTIAL` 退出（退出码 1），未执行。
- `plugin add` / `remove` 的 pnpm 流程：临时环境无 pnpm，未执行。
- `ctx.fs` 沙箱拒绝与审批升级路径未触发。

工具的 SVG 生成与检查逻辑由 `apps/dsh-plugin` 的单元测试用 fake gateway +
真实 codec/builtins 覆盖（19 项），样例产物见 `flowchart-example.svg`。
