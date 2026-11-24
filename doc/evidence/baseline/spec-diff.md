# 规格示例与 `final` 实际输出的差异

本文件记录 Phase 1 规格（[phase_cli_1.md](../../../phase_cli_1.md)）§6 与 §6.1A 的示例文本和 `final` 实际输出之间的差异。依据 [doc/acceptance.md](../../acceptance.md) §3.1：兼容测试保留 `final` 实际程序输出；规格硬性要求冲突时单列并裁决，不为了让 diff 通过而修改预期结果。

验证方式：在 `final^{commit}`（`e5621a68…`）的构建产物上运行四个冻结会话，实际字节见 [test/fixtures/expected/baseline-final](../../../test/fixtures/expected/baseline-final/) 与 [record.log](record.log)。下表的“实际”列都摘自该次运行，不是推测。

| #   | 规格位置        | 规格示例                                                            | `final` 实际                                                                                   | 裁决                                                       |
| --- | --------------- | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| 1   | §6 L330         | `svg-editor 0.1 — type 'help' for commands`                         | 交互模式为 `svg-editor 1.0 — type 'help' for commands`；非交互（`--script`/管道）不打印 banner | 以实际版本号为准；banner 只在交互模式出现，golden 不包含它 |
| 2   | §6 全篇         | 每行带 `svg> ` 提示符，命令之间有空行                               | 非交互模式逐条消息一行，无提示符、无空行                                                       | 以非交互字节为准；提示符和空行属于终端示意，不进入 golden  |
| 3   | §6 L347         | `├── rect#bg        x=0 y=0 w=800 h=600 fill=#ffffff`（列对齐）     | `├── rect#bg  x=0 y=0 w=800 h=600 fill=#ffffff`（类型名后固定两个空格，不补齐列）              | 以实际格式为准；不引入列对齐渲染                           |
| 4   | §6 L354–L358    | `circle#c1 moved to (130,100)`、`circle#c1 moved back to (100,100)` | `circle#c1 moved by (30,0): cx=130 cy=100 r=20 fill=red`，撤销/重做前缀为 `undone:`/`redone:`  | 以实际反馈为准；命令反馈的多态描述在 Phase 2 保持该基线    |
| 5   | §6 L370         | `rect#box restored into g#markers`                                  | `undone: rect#box deleted`                                                                     | 以实际撤销反馈为准                                         |
| 6   | §6.1A L421      | `└── line#arrow1          (280,130) -> (520,130)`（无样式后缀）     | `└── line#arrow1  (280,130) -> (520,130) stroke=black`                                         | 以实际摘要为准：未显式指定样式时摘要仍带默认 `stroke`      |
| 7   | §6.1A L465–L467 | `g#node2 moved by (0,100)`、`g#node2 moved back by (0,-100)`        | `g#node2 moved by (0,100)`、`undone: g#node2 moved by (0,100)`                                 | 移动文案一致，撤销文案按第 4 条统一为 `undone:` 前缀       |

补充说明：

- 规格 §6 的 `$ npm run cli` 启动行、`other.svg` 的 XML 内容均不属于 CLI 输出；`other.svg` 已冻结为 [test/fixtures/svg/other.svg](../../../test/fixtures/svg/other.svg)。
- 实际输出存在 `saved to saved.svg (1 elements)` 这类不做单复数变化的文案；规格示例只出现复数场景，因此不单列为差异，但 Phase 2 修改任何输出文本都必须重新生成 golden 并说明理由。
- 以上差异不改变验收口径：BASE-01 比较的是 `final` 与 Phase 2 禁用可选插件后的输出，规格示例本身不作为 golden。
- 若后续决定让实现贴合规格示例，属行为变更：需新增 ADR、更新本文件与 golden，并同步 `doc/acceptance.md`，不能只改 golden。
