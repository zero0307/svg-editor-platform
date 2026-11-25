# 2026-11-25 Phase 2 收口复核记录

> 节点：`TASK-QA-03`（Issue #22）。范围：在候选 `fb0427a` 上复核真实证据、生成最终指标、写收口报告与发布清单。`p2` 标签、`main` 合并与远程推送**未执行**（用户要求，待确认）。

## 1. 复核清单与真实结论

| 复核项       | 方法                                                                                      | 结论                                                                                                               |
| ------------ | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| 干净安装     | `npm ci --prefer-offline`                                                                 | exit 0；两个 postinstall 被 allowScripts 阻止，日志保留，不影响本次检查                                            |
| 根检查       | `npm run check`                                                                           | exit 0：根 128 项、workspace 310 项、文档 93/387、架构 0 违规（11 包/257 源文件/119 导入）                         |
| 视觉         | `npm run verify:visual`                                                                   | exit 0，`differingChannels: 0`                                                                                     |
| CLI 冒烟     | `--help` + 含 box/stats/dir/tree 的会话                                                   | 均 exit 0；`(box)`、`*`、`stats`、`dir`、`save` 行为符合预期                                                       |
| Phase 1 兼容 | 空配置四会话 golden                                                                       | 4/4 逐字节一致                                                                                                     |
| A/B 装配     | 三组会话 + help 顺序                                                                      | 3/3 逐字节一致，help 字节相同；空配置 4/4                                                                          |
| 加载器矩阵   | host 39 项测试                                                                            | 四类失败、重复名、回滚、订阅释放全部覆盖                                                                           |
| VSCode       | [证据](../evidence/vscode/README.md)、[干净安装](../evidence/vscode/install/clean-env.md) | 标记与 Outline 截图为真实 Extension Host；VSIX 在无源码链接的干净 profile 安装成功                                 |
| DSH          | [安装证据](../evidence/dsh/install/README.md)                                             | 固定版本、干净目录安装、两工具注册与卸载通过；**模型侧真实调用未执行**（无凭据）                                   |
| 指标         | 候选 → 最终 → 报告提交复核                                                                | `final → fb0427a` 由脚本生成；`412727f` 上重跑与报告逐项一致（[recheck](../evidence/release/metrics-recheck.log)） |
| 节点验收     | `doc/evidence/acceptance/` 001–021                                                        | 逐条对照 Issue 的结论已落盘；独立复核人记录仍缺（除本人外）                                                        |

验收矩阵实际状态：**35 个需求 ID，31 通过、4 部分通过、0 未执行**（见 [acceptance.md §8](../acceptance.md#8-收口状态2026-11-25)）。4 项部分通过的共同原因是发布/凭据/平台，而不是实现缺失：`MET-01`（p2 未创建）、`PKG-02` 与 `DSH-01`（DSH 模型侧调用缺 `DEEPSEEK_API_KEY`）、`REL-01`（p2/推送待确认）。

## 2. AI 建议被纠正或降级的记录

1. **命令反馈文案**：曾按 P1 §6.1B 的示意文本（`moved back by`、`(g#… + rect#… + text#…)`）设计输出；对照 `final` 实际字节与统一 undo 语义后，经 [ADR-0017](../adr/0017-polymorphic-command-feedback.md) 裁决：保留多态 `box#n1 created (...)` 反馈，但 undo 统一为 `undone: <原消息>`，不实现规格示意文案。
2. **C_A/C_B 证据分支可运行性**：#21 原计划在 F 上构建并运行两个证据分支；实测 `npm run build:packages` 失败于 `BoxShape.creationParts`（TS4113，该钩子来自 F 之后的 #19 后续补丁）。按授权不修改 F 内核，降级为“diff 证据 + 在含补丁的 I 上做运行期 A/B”，并在 [assembly/README](../evidence/assembly/README.md) 写明。
3. **指标“CLI 合计”口径**：复核发现汇总表把单列的 VSCode/DSH 计入了“CLI 合计”（`totals` 是全部类别之和）。修复为显式 `cli` 桶（内核+装配+插件）并重算候选/最终指标，`totals` 保留并在文档中说明区别。
4. **复杂度遍历提前终止**：#12 首版 `collectUnits` 的 `forEachChild` 回调返回数组（真值）导致遍历在第一个子节点后停止，复杂度全为 0；单元测试与真实数字对照后修正并补充测试。
5. **分类遗漏**：首次在含 4 个插件的提交上跑指标时，新根文件 `plugins.config.json` 未分类而失败；按脚本设计补排除项而不是放宽校验。
6. **规格示例不等于基线**：P1 §6 示例的列对齐、`svg>` 提示符、banner 版本与 `final` 实际输出不同；按 BASE-01 以实际输出为 golden，差异记录在 [spec-diff](../evidence/baseline/spec-diff.md)。

## 3. 未完成与风险

- `p2`、`main` 合并、远程推送未执行；发布步骤在 [release-checklist](../release-checklist.md)。
- 跨平台与 Node 22/24 未验证；`.nvmrc` 24.22.1 与本机 Node 26.13.0 不同。
- DSH 模型侧调用未执行；VSCode 只在 Windows/本机版本验证。
- 实际依赖图未渲染 SVG：本机无 PlantUML jar（Java 17 可用），源文件已提交。
- 各节点验收文档的“独立复核人”记录仍缺；本记录是集成质量方的复核，不替代其他板块的复核签字。
- 收口时复核发现 C_A/C_B 证据分支已由负责人推送到 `origin`；#21 记录写下时“尚未推送”是当时事实，收口状态以本记录与 `doc/evidence-index.md` 为准。新克隆检出验证仍未执行。

## 4. 结论

实现、测试、指标与证据链在候选 `fb0427a` 上自洽；指标报告提交 `412727f` 的源码复核通过。**候选就绪，`p2` 发布待用户确认。**
