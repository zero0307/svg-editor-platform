# 已核对的项目现状

本文保留 2026-11-15 方案审阅时的基线事实；初始化后的状态与复验结果见 [初始化记录](initialization.md)。来源为两份实验规格，以及 [Phase 1 仓库](https://github.com/zero0307/svg-editor-cli) 的完整只读克隆。

2026-11-24 补充：`final^{commit}` 的逐字节基线与固定夹具已由 TASK-QA-01 生成，见 [基线证据](evidence/baseline/README.md)；本文其余内容保持审阅时快照，不随后续实现改写。

## 历史与远程

- 当前 Phase 1 `main` 与 `final` 所指向的提交都是 `e5621a68afd4731626d54566f17ba55885d1bc0f`。
- `final` 是 annotated tag。基线提交使用 `git rev-parse 'final^{commit}'` 获取；`git rev-parse final` 得到的是标签对象 `25c263bda5515816d59efb383a3790dd2c77df3a`，两者不可混淆。
- 历史包含分步实现、测试、架构文档及修正提交，应该完整保留；已有 `final` 及归档标签均不移动、不复用。
- 新开发仓库为 [svg-editor-platform](https://github.com/zero0307/svg-editor-platform)。方案审阅时连接器返回其可见性为 private、size 为 0。该描述是导入前快照；初始化后已继承旧历史，访问设置按最终交付需要核对。
- 原实验第二阶段要求使用同一远程仓库、最终 tag 为 `p2`。因此采用新仓库日常开发、原仓库最终交付的路径；若课程明确批准换仓库，再通过 ADR 调整交付目标。

## 现有实现与可复用部分

| 现有位置                                  | 实际能力                                     | Phase 2 建议                                                   |
| ----------------------------------------- | -------------------------------------------- | -------------------------------------------------------------- |
| `src/domain/shapes/Shape.ts`、`Group.ts`  | 封装属性、组合树、虚方法 `clone/move/scale`  | 复用核心模型，抽出公开容器能力与校验钩子                       |
| `src/domain/SvgDocument.ts`               | 全局 ID、插入子树检查、树结构校验和克隆      | 复用；消除对具体普通分组实现的限制                             |
| `src/application/commands/EditCommand.ts` | 在克隆文档执行编辑，校验后返回新文档         | 复用事务机制；属性处理器在同一工作副本中运行                   |
| `src/application/CommandHistory.ts`       | 成功后入栈，文档类操作形成撤销屏障           | 保留规则，增加只读命令元数据与提交事件                         |
| `src/cli/CommandRouter.ts`                | 命令集中装配、错误格式、帮助文本             | 抽为注册表分发；命令定义由类实例提供                           |
| `src/application/ShapeFactory.ts`         | 六种类型的集中映射、创建与读入               | 替换为 provider 注册表与公开创建服务                           |
| `src/cli/ShapePresenter.ts`               | 树和单图形展示                               | 保留基线格式，在行尾接入装饰器管线                             |
| `src/infrastructure/XmlSvgCodec.ts`       | XML 编解码、缺 ID 补全、严格导入与变换规范化 | 抽出解析层，接入 provider 的子树恢复；不直接用于编辑器 Outline |
| `src/application/ports/`                  | 文件和 SVG 编解码端口                        | 延续依赖倒置，新增公开目录访问端口                             |
| `test/`、`examples/`                      | 领域、命令、CLI、持久化、变换和随机历史测试  | 保留并逐步迁移，不随架构改造批量重写预期                       |

源码佐证：[编辑事务](https://github.com/zero0307/svg-editor-cli/blob/e5621a68afd4731626d54566f17ba55885d1bc0f/src/application/commands/EditCommand.ts)、[命令路由](https://github.com/zero0307/svg-editor-cli/blob/e5621a68afd4731626d54566f17ba55885d1bc0f/src/cli/CommandRouter.ts)、[图形工厂](https://github.com/zero0307/svg-editor-cli/blob/e5621a68afd4731626d54566f17ba55885d1bc0f/src/application/ShapeFactory.ts)。

## 直接影响方案的缺口

1. 路由通过命令名排除 `init/read/help` 来判断是否需要文档。直接接入 `dir` 会被挡住，应在框架阶段改成 `requiresDocument` 等命令元数据。
2. CLI、XML 导入、领域校验仍有具体 `Group` 依赖；`box` 的容器能力、恢复、克隆、必要子部件保护，需要提前设计通用契约。
3. 帮助文本中的图形类型仍为固定列表。迁移注册表时应由 provider 提供用法，保持默认装配的输出顺序与文本。
4. `ci/github-actions.yml` 只是模板；实际树中没有 `.github/workflows/`。方案审阅及初始化阶段均未启用远程 CI，不据此声明跨平台检查已通过。
5. 仓库 README 记录了既往测试结果，属于历史描述。规划审阅时没有运行测试，当时默认 PATH 没有 node。初始化阶段另行定位运行时并复验，实际结果以初始化记录和日志为准，不沿用历史通过结论。
6. 两份实验规格在命令反馈示例上与实际基线存在措辞差异，例如当前 undo/redo 使用 `undone:`/`redone:`。应同时记录“规格合规”和“相对 final 兼容”，发现冲突后单列 Issue，不悄悄重写 golden 文件。

## 材料边界

Phase 1 规格现已齐全，可补全属性白名单、box 模板和完整会话。Phase 2 中引用的两张 VSCode 示例图片仍未随材料提供；文字已足够设计功能，最终需要团队自己运行扩展并提交真实截图。

DSH 部分存在“开发”和“设想”的表述差异。按较完整的可运行插件设计 MVP，开源发布和市场上架作为后续选项。截止日期、各成员账号及 DSH 现有安装版本尚未提供，不在方案中编造排期、CODEOWNERS 或版本锁定结果。

## 外部接口的核对来源

- [VSCode API](https://code.visualstudio.com/api/references/vscode-api)：文件装饰与文档符号接口。
- [DSH 官方插件入门](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/develop/basic/index.md)、[工具插件](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/develop/basic/tool.md)、[打包安装](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/develop/basic/publish.md)：与本项目 CLI 插件契约分开实现。
- [DSH 官方开发环境](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/development.md)：当前要求 Node >=24.9.0。开工时记录实际使用的 DSH commit/发行版与兼容 Node 补丁版本。
- [GitHub 分支保护](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)、[保留历史复制仓库](https://docs.github.com/en/repositories/creating-and-managing-repositories/duplicating-a-repository)。本项目导入采用显式推送目标分支与标签，避免后续用 mirror 覆盖开发引用。
