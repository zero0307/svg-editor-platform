# 开发任务与认领入口

全部任务已创建为GitHub Issues，范围和依赖可在仓库复核，认领与完成状态以Issues为准。总览入口：[任务总览 #23](https://github.com/zero0307/svg-editor-platform/issues/23)。

## 本轮基建之后的分工

本轮提交包含 #1 的基线回放、#2 的公开契约与测试替身、#5 的工作区构建，以及本组选择的 #9 文件与目录适配器。合并状态和认领人以 GitHub 为准。其他小组可从包含该实现的分支开发，依赖按下表验收。

| 可认领工作                             | 主要改动位置                            | 成员能独立演示的结果                                                                                                 |
| -------------------------------------- | --------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| #3 VSCode 文件标记、#4 DSH 最小插件    | 各自的应用目录                          | 在真实 VSCode 中给 SVG 文件加标记；在固定版本的 DSH 中调用一个最小工具，卸载后工具消失。两项都可立即开工。           |
| #6 XML 语法与定位                      | `packages/svg-xml/`                     | 直接对字符串验证嵌套、无 ID、同行重复标签、UTF-16 范围和残缺 XML。使用 core 的 LocatedSvgElement。                   |
| #7 事务与属性                          | `packages/core/` 事务实现               | 向候选树写两处后抛错，原内容、dirty 和已有 redo 完整保留。成功的复合修改一次 undo 即可恢复。可复用 FaultAfterWrite。 |
| #8 A/B 插件加载器                      | `packages/host/` 加载与装配             | 用正常、故障、正常三个夹具插件启动，检查清单、重复名与回滚，第三个插件仍可调用。I/O 适配器已有单独入口。             |
| #10 树展示、#12 Git 指标               | 分别在 core 展示代码、脚本与指标目录    | 给假树添加两个独立标签，再全部关闭并比较树输出；指标组在固定的两个提交上验证文件分类与统计可复现。                   |
| #13 SVG 恢复、#14 默认 CLI、#15 冻结   | svg-xml、builtins、CLI 组合根和验收     | #6+#7 后验证完整子树读回；#14 集成后跑真实默认 CLI；#12+#14 后用测试插件验收并记录框架提交。                         |
| #11 Outline、#16 DSH 双工具            | 各自应用目录                            | #3+#6 后点击 Outline 定位到源码；#4+#14 后在干净 DSH 中生成流程图并读回。DSH 现可用 FakeEditorSession 开发工具逻辑。 |
| #17–#20 CLI 业务插件，#21–#22 集成交付 | stats、dir、box、修改标签各包及验收目录 | 各包先用契约替身验收，正式接入等 #15。#18 使用现成 DirectoryReader 验排序、输出及历史；其余插件按下方依赖独立接入。  |

从干净检出执行 `npm ci`。单独验收本组模块用 `npm test -w @svgframe/host`，契约用 `npm test -w @svgframe/core`。整仓执行 `npm run check` 和 `npm run verify:visual`。文件、目录分类和错误路径的断言均使用真实临时目录。[宿主适配器测试](../../packages/host/test/io.test.ts) · [基线复现记录](../evidence/baseline/README.md)

## 依赖与完成口径

依赖是合并、关闭前的硬门槛，正文与GitHub blocked by关系保持一致。允许基于测试替身提前开发的部分已写在每项接口说明中。插件在公共契约后即可分支开发，正式接入等待框架冻结；A/B证据工作可在冻结后提前准备，最终完整回放再等待全部插件。

框架冻结任务依赖首版指标脚本，冻结F前完成首次metrics。新增插件接入提交必须保存内核/既有插件零差异证据，不能等全部实现合main后补造历史。

## F 公共框架与宿主

| 任务                                                                                                                     | 硬依赖                                                                                                                                                                                                                                                                                                                                                                                             |
| ------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [TASK-CORE-01 · 发布四扩展点、公开领域契约和测试替身](https://github.com/zero0307/svg-editor-platform/issues/2)          | 无未完成硬依赖                                                                                                                                                                                                                                                                                                                                                                                     |
| [TASK-ENG-01 · 建立 npm workspaces、构建顺序和包边界检查](https://github.com/zero0307/svg-editor-platform/issues/5)      | [#1](https://github.com/zero0307/svg-editor-platform/issues/1)、[#2](https://github.com/zero0307/svg-editor-platform/issues/2)                                                                                                                                                                                                                                                                     |
| [TASK-CORE-02 · 实现候选文档事务、属性分派和通用结构不变量](https://github.com/zero0307/svg-editor-platform/issues/7)    | [#5](https://github.com/zero0307/svg-editor-platform/issues/5)                                                                                                                                                                                                                                                                                                                                     |
| [TASK-XML-01 · 建立保留源码范围的中立 XML 语法入口](https://github.com/zero0307/svg-editor-platform/issues/6)            | [#2](https://github.com/zero0307/svg-editor-platform/issues/2)                                                                                                                                                                                                                                                                                                                                     |
| [TASK-XML-02 · 通过 provider 恢复完整 SVG 子树并保留导入语义](https://github.com/zero0307/svg-editor-platform/issues/13) | [#7](https://github.com/zero0307/svg-editor-platform/issues/7)、[#6](https://github.com/zero0307/svg-editor-platform/issues/6)                                                                                                                                                                                                                                                                     |
| [TASK-HOST-01 · 实现双装配共享加载器、清单校验和注册回滚](https://github.com/zero0307/svg-editor-platform/issues/8)      | [#5](https://github.com/zero0307/svg-editor-platform/issues/5)                                                                                                                                                                                                                                                                                                                                     |
| [TASK-HOST-02 · 提供文件、目录和运行会话的真实宿主适配器](https://github.com/zero0307/svg-editor-platform/issues/9)      | [#5](https://github.com/zero0307/svg-editor-platform/issues/5)                                                                                                                                                                                                                                                                                                                                     |
| [TASK-CORE-03 · 建立通用树展示与行尾装饰管线](https://github.com/zero0307/svg-editor-platform/issues/10)                 | [#5](https://github.com/zero0307/svg-editor-platform/issues/5)                                                                                                                                                                                                                                                                                                                                     |
| [TASK-CLI-01 · 插件化默认命令和六种图形并接通 CLI](https://github.com/zero0307/svg-editor-platform/issues/14)            | [#7](https://github.com/zero0307/svg-editor-platform/issues/7)、[#13](https://github.com/zero0307/svg-editor-platform/issues/13)、[#8](https://github.com/zero0307/svg-editor-platform/issues/8)、[#9](https://github.com/zero0307/svg-editor-platform/issues/9)、[#10](https://github.com/zero0307/svg-editor-platform/issues/10)、[#1](https://github.com/zero0307/svg-editor-platform/issues/1) |

## C 命令插件

| 任务                                                                                                       | 硬依赖                                                           |
| ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| [TASK-CMD-01 · 实现可独立启停的 stats 命令插件](https://github.com/zero0307/svg-editor-platform/issues/17) | [#15](https://github.com/zero0307/svg-editor-platform/issues/15) |
| [TASK-CMD-02 · 实现 dir 命令与真实目录组合测试](https://github.com/zero0307/svg-editor-platform/issues/18) | [#15](https://github.com/zero0307/svg-editor-platform/issues/15) |

## B box 与属性

| 任务                                                                                                           | 硬依赖                                                           |
| -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| [TASK-BOX-01 · 实现 box 图形、属性处理器与类型标签](https://github.com/zero0307/svg-editor-platform/issues/19) | [#15](https://github.com/zero0307/svg-editor-platform/issues/15) |

## T 修改标签

| 任务                                                                                                          | 硬依赖                                                           |
| ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| [TASK-TREE-01 · 实现 modified-star 内容脏状态标签](https://github.com/zero0307/svg-editor-platform/issues/20) | [#15](https://github.com/zero0307/svg-editor-platform/issues/15) |

## V VSCode 扩展

| 任务                                                                                                                  | 硬依赖                                                                                                                         |
| --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| [TASK-VSC-01 · 建立 VSCode 扩展并实现 SVG 文件标记](https://github.com/zero0307/svg-editor-platform/issues/3)         | 无未完成硬依赖                                                                                                                 |
| [TASK-VSC-02 · 实现原生 SVG Outline、定位并验证 VSIX 安装](https://github.com/zero0307/svg-editor-platform/issues/11) | [#3](https://github.com/zero0307/svg-editor-platform/issues/3)、[#6](https://github.com/zero0307/svg-editor-platform/issues/6) |

## D DSH 插件

| 任务                                                                                                               | 硬依赖                                                                                                                           |
| ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| [TASK-DSH-01 · 固定 DSH 版本并验证最小插件加载与卸载](https://github.com/zero0307/svg-editor-platform/issues/4)    | 无未完成硬依赖                                                                                                                   |
| [TASK-DSH-02 · 实现 SVG 检查和流程图生成工具并独立安装](https://github.com/zero0307/svg-editor-platform/issues/16) | [#4](https://github.com/zero0307/svg-editor-platform/issues/4)、[#14](https://github.com/zero0307/svg-editor-platform/issues/14) |

## Q 集成验收

| 任务                                                                                                               | 硬依赖                                                                                                                                                                                                                                                                                                                                   |
| ------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [TASK-QA-01 · 固定 Phase 1 行为基线、输入夹具和规格差异](https://github.com/zero0307/svg-editor-platform/issues/1) | 无未完成硬依赖                                                                                                                                                                                                                                                                                                                           |
| [TASK-FRAME-01 · 验收并冻结 M2 通用框架基线](https://github.com/zero0307/svg-editor-platform/issues/15)            | [#14](https://github.com/zero0307/svg-editor-platform/issues/14)、[#12](https://github.com/zero0307/svg-editor-platform/issues/12)                                                                                                                                                                                                       |
| [TASK-MET-01 · 实现 Git 历史指标脚本与目录迁移分类](https://github.com/zero0307/svg-editor-platform/issues/12)     | [#5](https://github.com/zero0307/svg-editor-platform/issues/5)                                                                                                                                                                                                                                                                           |
| [TASK-QA-02 · 保存插件接入差异并完成完整 A/B 回放](https://github.com/zero0307/svg-editor-platform/issues/21)      | [#15](https://github.com/zero0307/svg-editor-platform/issues/15)、[#17](https://github.com/zero0307/svg-editor-platform/issues/17)、[#18](https://github.com/zero0307/svg-editor-platform/issues/18)、[#19](https://github.com/zero0307/svg-editor-platform/issues/19)、[#20](https://github.com/zero0307/svg-editor-platform/issues/20) |
| [TASK-QA-03 · 收口报告、指标和真实证据并发布 p2](https://github.com/zero0307/svg-editor-platform/issues/22)        | [#21](https://github.com/zero0307/svg-editor-platform/issues/21)、[#11](https://github.com/zero0307/svg-editor-platform/issues/11)、[#16](https://github.com/zero0307/svg-editor-platform/issues/16)、[#12](https://github.com/zero0307/svg-editor-platform/issues/12)                                                                   |

## 维护位置

- [definitions.json](definitions.json)：任务目标、范围、接口、验收、需求ID及依赖key；新增或实质调整任务时同步。
- [github-issues.json](github-issues.json)：任务key与真实Issue编号的对应，不记录Assignee或复制任务完成状态。
- [贡献规范](../../CONTRIBUTING.md)：认领、分支、PR与完成规则。
- [文件组织规范](../repository-layout.md)：当前目录、目标目录及证据位置。

新任务按模板建立；依赖变化需同时更新正文、原生blocked by关系和定义，检查无环后再合并。所有任务初始保持未分配，不预设成员账号。
